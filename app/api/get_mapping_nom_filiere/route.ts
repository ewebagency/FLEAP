import { supabase } from '@/app/database/supabaseClient';
import { NextResponse } from 'next/server';

interface MappingNomFiliere {
  nom: string;
  filiere: string;
  trie?: boolean;
}
// Cache en mémoire simple avec singleton pattern
class CacheManager {
  private static instance: CacheManager;
  private cache: Record<string, { data: MappingNomFiliere[]; timestamp: number }> = {};
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  public get(key: string): MappingNomFiliere[] | null {
    const item = this.cache[key];
    const now = Date.now();

    if (item && now - item.timestamp < this.CACHE_DURATION) {
      return item.data;
    }
    return null;
  }

  public set(key: string, data: MappingNomFiliere[]): void {
    if (this.cache[key]) {
        delete this.cache[key];
        console.log('Cache supprimé pour la clé:', key);
    }
    
    console.log('Cache mis à jour pour la clé:', key);
    this.cache[key] = {
        data,
        timestamp: Date.now()
    };
  }

  public clear(): void {
    this.cache = {};
  }

  public clearByPattern(pattern: string): void {
    Object.keys(this.cache).forEach(key => {
      if (key.includes(pattern)) {
        delete this.cache[key];
        console.log('Cache supprimé pour la clé:', key);
      }
    });
  }
}

const cacheManager = CacheManager.getInstance();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entreprise_id = searchParams.get('entreprise_id');
  const forceReload = searchParams.get('forceReload') === 'true';
  const clearCache = searchParams.get('clearCache') === 'true';

  if (!entreprise_id) {
    return NextResponse.json({ error: 'entreprise_id is required' }, { status: 400 });
  }

  // Si clearCache est demandé, vider le cache pour cette entreprise
  if (clearCache) {
    cacheManager.clearByPattern(`mapping_nom:${entreprise_id}`);
    return NextResponse.json({ message: 'Cache cleared' });
  }

  try {
    const cacheKey = `mapping_nom:${entreprise_id}`;
    const cachedData = !forceReload ? cacheManager.get(cacheKey) : null;

    console.log('Cache status:', cachedData ? 'found' : 'not found', forceReload ? '(forced reload)' : '');
    
    if (cachedData && !forceReload) {
      console.log('------Mapping NOM Filière 🎯');
      return NextResponse.json({ data: cachedData });
    }

    console.log('------Mapping NOM Filière 🔴', forceReload ? '(forced reload)' : '');
    
    const { data, error } = await supabase
      .from('entreprise')
      .select('mapping_nom_filiere')
      .eq('id', entreprise_id)
      .single();

    if (error) throw error;

    cacheManager.set(cacheKey, data.mapping_nom_filiere);
    
    return NextResponse.json({ data: data.mapping_nom_filiere });
    
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
