import { BSD } from '@/app/analysis/AnalysisProvider';
import { supabase } from '@/app/database/supabaseClient';
import { NextResponse } from 'next/server';

// Cache en mémoire simple avec singleton pattern pour le rendre plus persistant
class CacheManager {
  private static instance: CacheManager;
  private cache: Record<string, { 
    data: BSD[]; 
    timestamp: number; 
    fullDataLoaded: boolean;
    totalCount?: number;
    lastModified?: number;
  }> = {};
  private readonly CACHE_DURATION = 1 * 60 * 1000; // 1 minute
  private readonly MAX_CACHE_AGE = 5 * 60 * 1000; // 5 minutes maximum
  private nextTimeFullReload: Record<string, boolean> = {};

  private constructor() {}

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  public get(key: string): { data: BSD[]|null, fullDataLoaded: boolean, totalCount?: number } {
    const item = this.cache[key];
    const now = Date.now();

    if (item) {
      // Vérifier si le cache est expiré
      if (now - item.timestamp > this.MAX_CACHE_AGE) {
        console.log(`Cache expired for key: ${key}`);
        delete this.cache[key];
        return { data: null, fullDataLoaded: false };
      }

      // Si le cache est périmé mais pas complètement expiré, on le considère comme partiel
      if (now - item.timestamp > this.CACHE_DURATION) {
        console.log(`Cache stale for key: ${key}, returning partial data`);
        return { 
          data: item.data, 
          fullDataLoaded: false,
          totalCount: item.totalCount
        };
      }

      console.log(`Cache hit for key: ${key}`);
      return { 
        data: item.data, 
        fullDataLoaded: item.fullDataLoaded,
        totalCount: item.totalCount
      };
    }
    console.log(`Cache miss for key: ${key}`);
    return { data: null, fullDataLoaded: false };
  }

  public set(key: string, data: BSD[], fullDataLoaded: boolean = true, totalCount?: number): void {
    const now = Date.now();
    
    // Si on a déjà des données en cache, on vérifie si elles ont été modifiées
    const existingData = this.cache[key];
    if (existingData) {
      // Si les données sont identiques, on ne met pas à jour le timestamp
      if (JSON.stringify(existingData.data) === JSON.stringify(data)) {
        console.log(`No changes detected for key: ${key}, keeping existing cache`);
        return;
      }
    }

    // Mise à jour du cache avec un nouveau timestamp
    console.log(`Updating cache for key: ${key}, fullDataLoaded: ${fullDataLoaded}`);
    this.cache[key] = {
      data,
      timestamp: now,
      fullDataLoaded,
      totalCount,
      lastModified: now
    };
  }

  public clear(): void {
    console.log('Clearing all cache');
    this.cache = {};
    this.nextTimeFullReload = {};
  }

  public invalidate(entreprise_id: string): void {
    const key = `bsds:${entreprise_id}`;
    if (this.cache[key]) {
      console.log(`Invalidating cache for key: ${key}`);
      delete this.cache[key];
    }
  }

  public setNextTimeFullReload(entreprise_id: string): void {
    const key = `bsds:${entreprise_id}`;
    this.nextTimeFullReload[key] = true;
    console.log(`Set next time full reload for key: ${key}`);
  }

  public shouldFullReload(entreprise_id: string): boolean {
    const key = `bsds:${entreprise_id}`;
    const shouldReload = this.nextTimeFullReload[key] || false;
    if (shouldReload) {
      delete this.nextTimeFullReload[key];
      console.log(`Full reload requested for key: ${key}`);
    }
    return shouldReload;
  }
}

export const cacheManager = CacheManager.getInstance();

interface FilterParams {
  entreprise_id: string;
  filieres?: string[];
  sites?: string[];
  dateDebut?: string;
  dateFin?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entreprise_id = searchParams.get('entreprise_id');
  const forceReload = searchParams.get('forceReload') === 'true';
  const fastLoad = searchParams.get('fastLoad') === 'true';
  const limit = fastLoad ? 50 : parseInt(searchParams.get('limit') || '0');

  if (!entreprise_id) {
    return NextResponse.json({ error: 'entreprise_id is required' }, { status: 400 });
  }

  try {
    const cacheKey = `bsds:${entreprise_id}`;
    
    // Vérifier si on doit forcer un rechargement complet
    const shouldFullReload = forceReload || cacheManager.shouldFullReload(entreprise_id);
    
    if (shouldFullReload) {
      console.log('------Full reload requested, invalidating cache for:', cacheKey);
      cacheManager.invalidate(cacheKey);
    }
    
    // Vérifier le cache
    const { data: cachedData, fullDataLoaded, totalCount: cachedTotalCount } = !shouldFullReload ? cacheManager.get(cacheKey) : { data: null, fullDataLoaded: false, totalCount: undefined };

    // Si on a des données en cache et qu'on demande un fastLoad, on retourne les données du cache
    // même si on n'a pas encore chargé toutes les données
    if (cachedData && !shouldFullReload) {
      console.log('------Bsd_Data from Server CACHE HIT 🎯', fastLoad ? '(fast load)' : '', fullDataLoaded ? '(full data)' : '(partial data)');
      console.log(`------Total BSDs in cache: ${cachedData.length}`);
      
      // Si on demande un fastLoad et qu'on n'a pas encore toutes les données, on retourne les 50 premiers
      if (fastLoad && !fullDataLoaded) {
        return NextResponse.json({ 
          data: cachedData.slice(0, 50), 
          isPartialData: true,
          totalCount: cachedTotalCount || cachedData.length
        });
      }
      
      // Sinon on retourne toutes les données du cache
      return NextResponse.json({ 
        data: cachedData,
        isPartialData: !fullDataLoaded,
        totalCount: cachedTotalCount || cachedData.length
      });
    }

    console.log('------Bsd_Data from Server CACHE MISS 🔴', shouldFullReload ? '(forced reload)' : '', fastLoad ? '(fast load)' : '');
    
    // Récupération paginée des BSDs
    let allData: BSD[] = [];
    let hasMore = true;
    let page = 0;
    const pageSize = fastLoad ? 50 : 1000;
    const maxPages = fastLoad ? 1 : Number.MAX_SAFE_INTEGER;

    // Récupérer d'abord le nombre total de BSDs pour cette entreprise
    const { count, error: countError } = await supabase
      .from('bsd')
      .select('*', { count: 'exact', head: true })
      .eq('entreprise_id', entreprise_id);

    if (countError) {
      console.error('Error counting BSDs:', countError);
      throw countError;
    }

    const totalCount = count || 0;
    console.log(`------Total BSDs in database: ${totalCount}`);

    while (hasMore && page < maxPages) {
      const { data, error } = await supabase
        .from('bsd')
        .select('*')
        .eq('entreprise_id', entreprise_id)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;

      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }

      allData = [...allData, ...data];
      console.log(`------Fetched page ${page + 1} with ${data.length} BSDs`);

      if (data.length < pageSize) {
        hasMore = false;
      }
      page++;
    }

    console.log(`------Total BSDs fetched: ${allData.length}`);
    
    // Si on fait un fastLoad, on met en cache les données partielles
    cacheManager.set(cacheKey, allData, !fastLoad, totalCount);
    
    return NextResponse.json({ 
      data: allData,
      isPartialData: fastLoad,
      totalCount: totalCount
    });
    
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}