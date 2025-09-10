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
                  workSite: {
                    name: string;
                  };
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
            };
        };
    };
    other_infos: {
        fillRate: string;
        doe: boolean;
        flux: string;
        rep?: {
            sent_to_rep: boolean;
        };
    };
    on_track_dechets: boolean;
    created_on_fleap: string;
    facture_treated: boolean;
    id_track_dechets: string;
    pdf_ids: string[];
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
        workSite: {
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
    doe: boolean;
    flux: string;
    numeroBon: string;
    sent_to_rep: boolean;
    on_track_dechets: boolean;
    created_on_fleap: string;
    facture_treated: boolean;
    id_track_dechets: string;
    pdf_ids: string[];
}

async function getCachedData(entreprise_id: string, user_id: string, site: string | null): Promise<CacheData | null> {
    const cacheKey = `bsds:${user_id}:${entreprise_id}:${site || 'ALL'}`;
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

async function setCachedData(entreprise_id: string, user_id: string, site: string | null, data: FastDataSupa[], fullDataLoaded: boolean, totalCount?: number): Promise<void> {
    const cacheKey = `bsds:${user_id}:${entreprise_id}:${site || 'ALL'}`;
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
  const lastDate = searchParams.get('lastDate');
  const lastId = searchParams.get('lastId');
  const site = searchParams.get('site');

  if (!entreprise_id || !user_id) {
    return NextResponse.json({ error: 'entreprise_id and user_id are required' }, { status: 400 });
  }

  // Validate optional site parameter (SIRET format: 14 digits). If not valid, ignore.
  const siteFilter = site && /^\d+$/.test(site) ? site : null;

  try {
    const cachedData = await getCachedData(entreprise_id, user_id, siteFilter);
    
    if (cachedData && !lastDate) {
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
        infos_json->formAPI->createFormInput->>takenOverAt,
        other_infos->>fillRate,
        other_infos->>doe,
        other_infos->>flux,
        other_infos->rep->>sent_to_rep,
        other_infos->>numeroBon,
        on_track_dechets,
        created_on_fleap,
        facture_treated,
        id_track_dechets,
        pdf_ids
      `)
      .eq('entreprise_id', entreprise_id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(200);

    if (siteFilter) {
      query = query.filter('infos_json->formAPI->createFormInput->emitter->company->>siret', 'eq', siteFilter);
    }

    if (lastDate && lastId) {
      // Pagination composite : (created_at < lastDate) OR (created_at = lastDate AND id < lastId)
      query = query.or(`created_at.lt.${lastDate},and(created_at.eq.${lastDate},id.lt.${lastId})`);
      console.log('Query with composite date+id filter applied');
    } else if (lastDate) {
      query = query.lt('created_at', lastDate);
      console.log('Query with date filter applied');
    }

    const { data, error } = await query;

    if (error) throw error;

    //console.log("probleme dans takenOverAt 6", data[0]);

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
              },
              workSite: item.emitter.workSite
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
          }
        }
      },
      other_infos: {
        fillRate: item.fillRate,
        doe: item.doe,
        flux: item.flux,
        rep: item.sent_to_rep ? { sent_to_rep: item.sent_to_rep } : undefined,
        numeroBon: item.numeroBon
      },
      on_track_dechets: item.on_track_dechets,
      created_on_fleap: item.created_on_fleap,
      facture_treated: item.facture_treated,
      id_track_dechets: item.id_track_dechets,
      pdf_ids: item.pdf_ids
    }));


    // Si c'est le premier chargement, mettre en cache
    if (!lastDate) {
      let countBase = supabase
        .from('bsd')
        .select('*', { count: 'exact', head: true })
        .eq('entreprise_id', entreprise_id);
      if (siteFilter) {
        countBase = countBase.filter('infos_json->formAPI->createFormInput->emitter->company->>siret', 'eq', siteFilter);
      }
      const { count } = await countBase;

      await setCachedData(entreprise_id, user_id, siteFilter, formattedData, false, count || 0);
    }

    // Vérifier s'il y a plus de données à charger
    let countQuery = supabase
      .from('bsd')
      .select('*', { count: 'exact', head: true })
      .eq('entreprise_id', entreprise_id);

    if (siteFilter) {
      countQuery = countQuery.filter('infos_json->formAPI->createFormInput->emitter->company->>siret', 'eq', siteFilter);
    }

    if (lastDate && lastId) {
      countQuery = countQuery.or(`created_at.lt.${lastDate},and(created_at.eq.${lastDate},id.lt.${lastId})`);
    } else if (lastDate) {
      countQuery = countQuery.lt('created_at', lastDate);
    }

    const { count: remainingCount, error: countError } = await countQuery;

    if (countError) {
        console.error('Error counting remaining BSDs:', countError);
    }

    console.log('Query details:', {
        lastLoadedDate: lastDate || formattedData[formattedData.length - 1]?.created_at,
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