import { BSD } from '@/app/analysis/AnalysisProvider';
import { supabase } from '@/app/database/supabaseClient';
import { NextResponse } from 'next/server';

// Cache en mémoire simple avec singleton pattern pour le rendre plus persistant
class CacheManager {
  private static instance: CacheManager;
  private cache: Record<string, { data: BSD[]; timestamp: number }> = {};
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  public get(key: string): BSD[]|null {
    const item = this.cache[key];
    const now = Date.now();

    if (item && now - item.timestamp < this.CACHE_DURATION) {
      return item.data;
    }
    return null;
  }

  public set(key: string, data: BSD[]): void {
    this.cache[key] = {
      data,
      timestamp: Date.now()
    };
  }

  public clear(): void {
    this.cache = {};
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

  if (!entreprise_id) {
    return NextResponse.json({ error: 'entreprise_id is required' }, { status: 400 });
  }

  try {
    const cacheKey = `bsds:${entreprise_id}`;
    // Ne vérifier le cache que si forceReload est false
    const cachedData = !forceReload ? cacheManager.get(cacheKey) : null;

    console.log('Cache status:', cachedData ? 'found' : 'not found', forceReload ? '(forced reload)' : '');
    
    if (cachedData && !forceReload) {
      console.log('------Bsd_Data from Server CACHE HIT 🎯');
      return NextResponse.json({ data: cachedData });
    }

    console.log('------Bsd_Data from Server CACHE MISS 🔴', forceReload ? '(forced reload)' : '');
    
    // Récupération paginée des BSDs
    let allData: BSD[] = [];
    let hasMore = true;
    let page = 0;
    const pageSize = 1000;

    while (hasMore) {
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
    cacheManager.set(cacheKey, allData);
    return NextResponse.json({ data: allData });
    
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}