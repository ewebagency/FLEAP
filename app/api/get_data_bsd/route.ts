import { BSD } from '@/app/analysis/AnalysisProvider';
import { supabase } from '@/app/database/supabaseClient';
import { redis } from '@/app/database/redisClient';
import { NextResponse } from 'next/server';

interface CacheData {
  data: BSD[];
  timestamp: number;
  fullDataLoaded: boolean;
  totalCount?: number;
}

async function getCachedData(entreprise_id: string, user_id: string): Promise<CacheData | null> {
  const cacheKey = `bsds:${user_id}:${entreprise_id}`;
  try {
    const cachedData = await redis.get<CacheData>(cacheKey);
    if (!cachedData) {
      console.log(`[Cache] MISS ❌ - ${cacheKey}`);
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (now - cachedData.timestamp > 5 * 60) {
      console.log(`[Cache] EXPIRED ⏳ - ${cacheKey}`);
      await redis.del(cacheKey);
      return null;
    }

    console.log(`[Cache] HIT 🎯 - ${cacheKey}`);
    return cachedData;
  } catch (error) {
    console.error('[Cache] ERROR reading:', error);
    return null;
  }
}

async function setCachedData(entreprise_id: string, user_id: string, data: BSD[], fullDataLoaded: boolean, totalCount?: number): Promise<void> {
  const cacheKey = `bsds:${user_id}:${entreprise_id}`;
  try {
    const cacheData: CacheData = {
      data,
      timestamp: Math.floor(Date.now() / 1000),
      fullDataLoaded,
      totalCount
    };

    await redis.set(cacheKey, cacheData, {
      ex: 5 * 60
    });

    console.log(`[Cache] SET ✅ - ${cacheKey} (${data.length} BSDs)`);
  } catch (error) {
    console.error('[Cache] ERROR writing:', error);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entreprise_id = searchParams.get('entreprise_id');
  const user_id = searchParams.get('user_id');
  const fastLoad = searchParams.get('fastLoad') === 'true';

  if (!entreprise_id || !user_id) {
    return NextResponse.json({ error: 'entreprise_id and user_id are required' }, { status: 400 });
  }

  try {
    const cachedData = await getCachedData(entreprise_id, user_id);
    
    if (cachedData) {
      if (fastLoad && !cachedData.fullDataLoaded) {
        return NextResponse.json({ 
          data: cachedData.data.slice(0, 50), 
          isPartialData: true,
          totalCount: cachedData.totalCount || cachedData.data.length
        });
      }
      
      return NextResponse.json({ 
        data: cachedData.data,
        isPartialData: !cachedData.fullDataLoaded,
        totalCount: cachedData.totalCount || cachedData.data.length
      });
    }

    console.log('[DB] Querying Supabase...');
    
    let allData: BSD[] = [];
    let hasMore = true;
    let page = 0;
    const pageSize = fastLoad ? 50 : 1000;
    const maxPages = fastLoad ? 1 : Number.MAX_SAFE_INTEGER;

    const { count, error: countError } = await supabase
      .from('bsd')
      .select('*', { count: 'exact', head: true })
      .eq('entreprise_id', entreprise_id);

    if (countError) throw countError;
    const totalCount = count || 0;

    while (hasMore && page < maxPages) {
      const { data, error } = await supabase
        .from('bsd')
        .select('*')
        .eq('entreprise_id', entreprise_id)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allData = [...allData, ...data];
      hasMore = data.length === pageSize;
      page++;
    }

    console.log(`[DB] Loaded ${allData.length}/${totalCount} BSDs`);
    await setCachedData(entreprise_id, user_id, allData, !fastLoad, totalCount);
    
    return NextResponse.json({ 
      data: allData,
      isPartialData: fastLoad,
      totalCount
    });
    
  } catch (error) {
    console.error('[Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}