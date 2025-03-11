
import { supabase } from '@/app/database/supabaseClient';
import { redis } from '@/app/database/redisClient';
import { NextResponse } from 'next/server';

interface FastDataSupa {
    id: string;
    entreprise_id: string;
    user_id: string;
    created_at: string;
    status_track_dechets: string;
    readable_id_track_dechets: string;
    facture_infos: {
        footer: {
            total_ht: number | string;
        };
    };
    infos_json: {
        formAPI: {
            createFormInput: {
                emitter: {
                  company: {
                    orgId: string;
                    siret: string;
                    name: string;
                  }
                };
                recipient: {
                  processingOperation: string;                  
                  company: {
                    orgId: string;
                    siret: string;
                    name: string;
                  }
                };
                transporter: {
                  company: {
                    orgId: string;
                    siret: string;
                    name: string;
                  }
                };
                wasteDetails: {
                    code: string;
                    name: string;
                    quantity: string;
                    isDangerous: string;
                };
                takenOverAt: string;
                other_infos: {
                    fillRate: string;
                };
            };
        };
    };
    on_track_dechets: boolean;
    created_on_fleap: string;
    facture_treated: boolean;
    id_track_dechets: string;
}

interface CacheData {
    data: FastDataSupa[];
    timestamp: number; 
    fullDataLoaded: boolean;
    totalCount?: number;
}


interface SupabaseFlatResponse {
    id: string;
    entreprise_id: string;
    user_id: string;
    created_at: string;
    status_track_dechets: string;
    readable_id_track_dechets: string;
    total_ht: string;
    quantityReceived: string;
    emitter: {
        company: {
            orgId: string;
            siret: string;
            name: string;
        };
    };
    recipient: {
        processingOperation: string;
        company: {
            orgId: string;
            siret: string;
            name: string;
        };
    };
    transporter: {
        company: {
            orgId: string;
            siret: string;
            name: string;
        };
    };
    wasteDetails: {
        name: string;
        code: string;
        quantity: string;
        isDangerous: string;
    };
    takenOverAt: string;
    fillRate: string;
    on_track_dechets: boolean;
    created_on_fleap: string;
    facture_treated: boolean;
    id_track_dechets: string;
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

async function setCachedData(entreprise_id: string, user_id: string, data: FastDataSupa[], fullDataLoaded: boolean, totalCount?: number): Promise<void> {
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
  const lastId = searchParams.get('lastId');

  if (!entreprise_id || !user_id) {
    return NextResponse.json({ error: 'entreprise_id and user_id are required' }, { status: 400 });
  }

  try {
    const cachedData = await getCachedData(entreprise_id, user_id);
    
    if (cachedData && !lastId) {
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

    console.log('🔴 [DB] Querying Supabase...');
    
    let query = supabase
      .from('bsd')
      .select(`
        id,
        entreprise_id,
        user_id,
        created_at,
        status_track_dechets,
        readable_id_track_dechets,
        facture_infos->footer->total_ht,
        infos_json->formAPI->createFormInput->>quantityReceived,
        infos_json->formAPI->createFormInput->emitter,
        infos_json->formAPI->createFormInput->recipient,
        infos_json->formAPI->createFormInput->transporter,
        infos_json->formAPI->createFormInput->wasteDetails,
        infos_json->formAPI->createFormInput->wasteDetails
        infos_json->formAPI->createFormInput->>takenOverAt,
        infos_json->formAPI->createFormInput->other_infos->>fillRate,
        on_track_dechets,
        created_on_fleap,
        facture_treated,
        id_track_dechets
      `)
      .eq('entreprise_id', entreprise_id)
      .order('id', { ascending: false })
      .limit(200);

    if (lastId) {
      console.log('Received lastId:', lastId);
      query = query.lt('id', lastId);
      console.log('Query with id filter applied');
    }

    const { data, error } = await query;

    if (error) throw error;

    // Restructurer les données pour correspondre à l'interface FastDataSupa
    const formattedData = (data as unknown as SupabaseFlatResponse[]).map(item => ({
      id: item.id,
      entreprise_id: item.entreprise_id,
      user_id: item.user_id,
      created_at: item.created_at,
      status_track_dechets: item.status_track_dechets,
      readable_id_track_dechets: item.readable_id_track_dechets,
      facture_infos: {
        footer: {
          total_ht: item.total_ht || 0
        }
      },
      infos_json: {
        formAPI: {
          createFormInput: {
            quantityReceived: item.quantityReceived,
            emitter: { 
              company: {
                siret: item.emitter.company.siret,
                orgId: item.emitter.company.orgId,
                name: item.emitter.company.name
              }
            },
            recipient: {
              company: {
                siret: item.recipient.company.siret,
                orgId: item.recipient.company.orgId,
                name: item.recipient.company.name
              },
              processingOperation: item.recipient.processingOperation
            },
            transporter: {
              company: {
                siret: item.transporter.company.siret,
                orgId: item.transporter.company.orgId,
                name: item.transporter.company.name
              }
            },
            wasteDetails: {name: item.wasteDetails.name, code: item.wasteDetails.code, quantity: item.wasteDetails.quantity, isDangerous: item.wasteDetails.isDangerous},
            takenOverAt: item.takenOverAt,
            other_infos: {
              fillRate: item.fillRate
            }
          }
        }
      },
      on_track_dechets: item.on_track_dechets,
      created_on_fleap: item.created_on_fleap,
      facture_treated: item.facture_treated,
      id_track_dechets: item.id_track_dechets
    }));

    // Si c'est le premier chargement, mettre en cache
    if (!lastId) {
      const { count } = await supabase
      .from('bsd')
      .select('*', { count: 'exact', head: true })
      .eq('entreprise_id', entreprise_id);

      await setCachedData(entreprise_id, user_id, formattedData, false, count || 0);
    }

    // Vérifier s'il y a plus de données à charger
    const lastLoadedId = lastId || formattedData[formattedData.length - 1]?.id;
    console.log('Last loaded id:', lastLoadedId);

    const { count: remainingCount, error: countError } = await supabase
        .from('bsd')
        .select('*', { count: 'exact', head: true })
        .eq('entreprise_id', entreprise_id)
        .lt('id', lastLoadedId);

    if (countError) {
        console.error('Error counting remaining BSDs:', countError);
    }

    console.log('Query details:', {
        lastLoadedId,
        remainingCount,
        formattedDataLength: formattedData.length
    });

    const hasMoreData = remainingCount ? remainingCount > 0 : false;
    console.log('Remaining count:', remainingCount, 'Has more:', hasMoreData);
    
    // Ajouter des logs pour la réponse
    const response = {
        data: formattedData,
        hasMore: hasMoreData,
        totalCount: remainingCount || 0,
        isPartialData: !cachedData || !cachedData.fullDataLoaded
    };
    //console.log('API Response:', response);
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('[Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}