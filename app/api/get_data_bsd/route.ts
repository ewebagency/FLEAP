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

  private constructor() {}

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  private getCacheKey(baseKey: string, nextTimeFullReload: boolean): string {
    // En production, on ajoute un timestamp à la clé si nextTimeFullReload est true
    if (process.env.VERCEL && nextTimeFullReload) {
      return `${baseKey}:${Date.now()}`;
    }
    return baseKey;
  }

  public get(key: string, nextTimeFullReload: boolean = false): { data: BSD[]|null, fullDataLoaded: boolean, totalCount?: number } {
    const cacheKey = this.getCacheKey(key, nextTimeFullReload);
    const item = this.cache[cacheKey];
    const now = Date.now();

    // En production, si nextTimeFullReload est true, on considère qu'il n'y a pas de cache
    if (process.env.VERCEL && nextTimeFullReload) {
      return { data: null, fullDataLoaded: false };
    }

    if (item) {
      // Vérifier si le cache est expiré
      if (now - item.timestamp > this.MAX_CACHE_AGE) {
        console.log(`Cache expired for key: ${cacheKey}`);
        delete this.cache[cacheKey];
        return { data: null, fullDataLoaded: false };
      }

      // Si le cache est périmé mais pas complètement expiré, on le considère comme partiel
      if (now - item.timestamp > this.CACHE_DURATION) {
        console.log(`Cache stale for key: ${cacheKey}, returning partial data`);
        return { 
          data: item.data, 
          fullDataLoaded: false,
          totalCount: item.totalCount
        };
      }

      console.log(`Cache hit for key: ${cacheKey}`);
      return { 
        data: item.data, 
        fullDataLoaded: item.fullDataLoaded,
        totalCount: item.totalCount
      };
    }
    console.log(`Cache miss for key: ${cacheKey}`);
    return { data: null, fullDataLoaded: false };
  }

  public set(key: string, data: BSD[], fullDataLoaded: boolean = true, totalCount?: number, nextTimeFullReload: boolean = false): void {
    const cacheKey = this.getCacheKey(key, nextTimeFullReload);
    const now = Date.now();
    
    // En production avec nextTimeFullReload, on ne met pas en cache
    if (process.env.VERCEL && nextTimeFullReload) {
      console.log(`Skipping cache set in production with nextTimeFullReload for key: ${cacheKey}`);
      return;
    }

    // Si on a déjà des données en cache, on vérifie si elles ont été modifiées
    const existingData = this.cache[cacheKey];
    if (existingData) {
      // Si les données sont identiques, on ne met pas à jour le timestamp
      if (JSON.stringify(existingData.data) === JSON.stringify(data)) {
        console.log(`No changes detected for key: ${cacheKey}, keeping existing cache`);
        return;
      }
    }

    // Mise à jour du cache avec un nouveau timestamp
    console.log(`Updating cache for key: ${cacheKey}, fullDataLoaded: ${fullDataLoaded}`);
    this.cache[cacheKey] = {
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
  }

  public invalidate(entreprise_id: string): void {
    // En production, on invalide toutes les clés qui commencent par ce préfixe
    if (process.env.VERCEL) {
      const prefix = `bsds:${entreprise_id}`;
      Object.keys(this.cache).forEach(key => {
        if (key.startsWith(prefix)) {
          console.log(`Invalidating cache for key: ${key}`);
          delete this.cache[key];
        }
      });
    } else {
      const key = `bsds:${entreprise_id}`;
      if (this.cache[key]) {
        console.log(`Invalidating cache for key: ${key}`);
        delete this.cache[key];
      }
    }
  }
}

const cacheManager = CacheManager.getInstance();

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
  const nextTimeFullReload = searchParams.get('nextTimeFullReload') === 'true';
  const limit = fastLoad ? 50 : parseInt(searchParams.get('limit') || '0');

  if (!entreprise_id) {
    return NextResponse.json({ error: 'entreprise_id is required' }, { status: 400 });
  }

  try {
    const cacheKey = `bsds:${entreprise_id}`;
    
    // Si forceReload ou nextTimeFullReload est true, on invalide le cache pour cette entreprise
    if (forceReload || nextTimeFullReload) {
      console.log('------Force reload requested, invalidating cache for:', cacheKey);
      cacheManager.invalidate(entreprise_id);
    }
    
    // Vérifier le cache avec nextTimeFullReload
    const { data: cachedData, fullDataLoaded, totalCount: cachedTotalCount } = !forceReload ? 
      cacheManager.get(cacheKey, nextTimeFullReload) : 
      { data: null, fullDataLoaded: false, totalCount: undefined };

    // Si on a des données en cache et qu'on demande un fastLoad, on retourne les données du cache
    if (cachedData && !forceReload) {
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

    console.log('------Bsd_Data from Server CACHE MISS 🔴', forceReload ? '(forced reload)' : '', fastLoad ? '(fast load)' : '');
    
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
    
    // Mettre en cache les données avec nextTimeFullReload
    cacheManager.set(cacheKey, allData, !fastLoad, totalCount, nextTimeFullReload);
    
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