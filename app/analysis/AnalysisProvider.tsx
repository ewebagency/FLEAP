import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from '../component/SessionProvider';
import { useFilterContext, FiliereOuPrestataireInterface } from '../FilterContext';
import { supabase } from '../database/supabaseClient';
import { getMappingTableFiliere } from '../register/RegisterComponents/Modal/FormulaireFull/utils_new';
import { FormInput, BSDD_TrackDechets, OtherInfos } from '../register/interface/BSD_Interface';
import { useFiltresPerso } from '../component/FiltresPerso/FiltresPersoProvider';
import { filterBSDs, CommonBSD } from '../register/FiltreFunctionnal';
import useSWR from 'swr';
import { applyFilterType, FilterType as SharedFilterType } from './filterType';
import LZString from 'lz-string';
import { isCacheUpToDate, saveCacheVersion } from '../utils/cacheVersionChecker';

// Utiliser l'interface commune
export type BSD = CommonBSD;

// Constantes pour le cache des BSDs d'analyse
const CACHE_VERSION_ANALYSIS = '1.3'; // Incrémenter pour invalider les anciens caches lourds
const CACHE_DURATION_ANALYSIS = 24 * 60 * 60 * 1000; // 24 heures

// Version LIGHT des BSDs pour le cache (seulement les champs nécessaires à l'analyse)
// 
// ⚠️ IMPORTANT - MAINTENANCE :
// Cette interface contient UNIQUEMENT les champs utilisés par les graphiques/tableaux d'analyse.
// Si vous créez un nouveau graphique qui nécessite un champ supplémentaire :
//   1. Ajouter le champ à cette interface LightBSD
//   2. Modifier bsdToLight() pour extraire ce champ
//   3. Modifier lightToBsd() pour reconstruire ce champ
//   4. Incrémenter CACHE_VERSION_ANALYSIS pour invalider les anciens caches
// 
// Champs actuellement stockés :
// - Identifiants : id, entreprise_id, readable_id, id_track_dechets
// - Dates : created_at, takenOverAt
// - Statuts : status_track_dechets, created_on_fleap, on_track_dechets, facture_treated
// - Déchet : wasteCode, wasteName, quantity, quantityReceived, isDangerous
// - Financier : total_ht
// - Valorisation : valoParts, processingOperation
// - Acteurs : emitterSiret, recipientSiret, recipientName, transporterSiret, transporterName
// - Autres : fillRate, tri, declassement_boolean
//
interface LightBSD {
    id: string;
    entreprise_id: string;
    created_at: string;
    status_track_dechets: string;
    readable_id_track_dechets: string;
    created_on_fleap?: boolean;
    on_track_dechets: boolean;
    facture_treated: boolean;
    id_track_dechets: string;
    total_ht: string;
    quantityReceived?: string;
    quantity: string;
    wasteCode: string;
    wasteName?: string;
    isDangerous?: boolean;
    emitterSiret: string;
    takenOverAt?: string;
    fillRate?: string;
    tri?: boolean;
    declassement_boolean?: boolean;
    valoParts?: Array<{ code_valo: string; tonnage: string }>;
    processingOperation?: string;
    recipientSiret?: string;
    recipientName?: string;
    transporterSiret?: string;
    transporterName?: string;
}

interface CachedAnalysisBSDsData {
    bsds: LightBSD[];
    timestamp: number;
    version: string;
}

// Fonction pour convertir un BSD complet en version LIGHT pour le cache
const bsdToLight = (bsd: CommonBSD): LightBSD => {
    return {
        id: bsd.id,
        entreprise_id: String(bsd.entreprise_id || ''),
        created_at: bsd.created_at,
        status_track_dechets: bsd.status_track_dechets,
        readable_id_track_dechets: bsd.readable_id_track_dechets,
        created_on_fleap: bsd.created_on_fleap as boolean | undefined,
        on_track_dechets: bsd.on_track_dechets,
        facture_treated: bsd.facture_treated,
        id_track_dechets: bsd.id_track_dechets,
        total_ht: String(bsd.facture_infos?.footer?.total_ht || '0'),
        quantityReceived: bsd.infos_json?.formAPI?.createFormInput?.quantityReceived as string | undefined,
        quantity: String(bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity || '0'),
        wasteCode: bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code || '',
        wasteName: bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.name,
        isDangerous: bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.isDangerous,
        emitterSiret: bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret || '',
        takenOverAt: bsd.infos_json?.formAPI?.createFormInput?.takenOverAt as string | undefined,
        fillRate: bsd.other_infos?.fillRate,
        tri: bsd.other_infos?.tri,
        declassement_boolean: bsd.other_infos?.declassement?.declassement_boolean,
        valoParts: bsd.infos_json?.formAPI?.createFormInput?.recipient?.valoParts as Array<{ code_valo: string; tonnage: string }> | undefined,
        processingOperation: bsd.infos_json?.formAPI?.createFormInput?.recipient?.processingOperation,
        recipientSiret: bsd.infos_json?.formAPI?.createFormInput?.recipient?.company?.siret,
        recipientName: bsd.infos_json?.formAPI?.createFormInput?.recipient?.company?.name,
        transporterSiret: bsd.infos_json?.formAPI?.createFormInput?.transporter?.company?.siret,
        transporterName: bsd.infos_json?.formAPI?.createFormInput?.transporter?.company?.name
    };
};

// Fonction pour convertir un BSD LIGHT en BSD complet pour React
const lightToBsd = (light: LightBSD): CommonBSD => {
    // Reconstruire la structure minimale nécessaire pour les graphiques/tableaux
    const wasteDetails = {
        code: light.wasteCode,
        name: light.wasteName || '',
        quantity: parseFloat(light.quantity) || 0,
        isDangerous: light.isDangerous
    };
    
    return {
        id: light.id,
        entreprise_id: light.entreprise_id,
        user_id: '',
        created_at: light.created_at,
        status_track_dechets: light.status_track_dechets,
        readable_id_track_dechets: light.readable_id_track_dechets,
        created_on_fleap: light.created_on_fleap,
        on_track_dechets: light.on_track_dechets,
        facture_treated: light.facture_treated,
        id_track_dechets: light.id_track_dechets,
        facture_infos: {
            footer: { total_ht: light.total_ht }
        },
        infos_json: {
            formAPI: {
                createFormInput: {
                    id: light.id,
                    readableId: light.readable_id_track_dechets,
                    customId: light.id,
                    status: light.status_track_dechets,
                    quantityReceived: light.quantityReceived ? parseFloat(light.quantityReceived) : undefined,
                    takenOverAt: light.takenOverAt,
                    emitter: {
                        company: {
                            siret: light.emitterSiret,
                            name: '',
                            orgId: light.emitterSiret
                        }
                    },
                    recipient: {
                        company: { 
                            siret: light.recipientSiret || '', 
                            name: light.recipientName || '', 
                            orgId: light.recipientSiret || '' 
                        },
                        processingOperation: light.processingOperation || '',
                        valoParts: light.valoParts
                    },
                    transporter: {
                        company: { 
                            siret: light.transporterSiret || '', 
                            name: light.transporterName || '', 
                            orgId: light.transporterSiret || '' 
                        }
                    },
                    wasteDetails: wasteDetails
                }
            }
        },
        other_infos: {
            fillRate: light.fillRate || '',
            tri: light.tri,
            volume: '',
            volumeUnit: '',
            containerDescription: '',
            declassement: light.declassement_boolean ? { declassement_boolean: light.declassement_boolean } : undefined
        }
    } as unknown as CommonBSD;
};

// Fonction pour récupérer les BSDs d'analyse depuis le cache (avec décompression)
const getAnalysisBSDsFromCache = (entreprise_id: string): CommonBSD[] | null => {
    try {
        const cacheKey = `analysis-bsds-${entreprise_id}`;
        const compressed = localStorage.getItem(cacheKey);
        
        if (!compressed) {
            console.log('📦 Aucun cache trouvé pour les BSDs d\'analyse');
            return null;
        }
        
        // Décompresser les données
        const decompressed = LZString.decompress(compressed);
        if (!decompressed) {
            console.log('❌ Erreur de décompression du cache');
            localStorage.removeItem(cacheKey);
            return null;
        }
        
        const parsedCache: CachedAnalysisBSDsData = JSON.parse(decompressed);
        
        if (parsedCache.version !== CACHE_VERSION_ANALYSIS) {
            console.log('⚠️ Version du cache BSDs obsolète');
            localStorage.removeItem(cacheKey);
            return null;
        }
        
        const now = Date.now();
        if (now - parsedCache.timestamp > CACHE_DURATION_ANALYSIS) {
            console.log('⏰ Cache BSDs expiré');
            localStorage.removeItem(cacheKey);
            return null;
        }
        
        console.log(`✅ Cache BSDs d'analyse trouvé avec ${parsedCache.bsds.length} BSDs (décompressé)`);
        
        // Convertir les LightBSD en CommonBSD
        return parsedCache.bsds.map(lightToBsd);
    } catch (error) {
        console.error('❌ Erreur lecture cache BSDs:', error);
        localStorage.removeItem(`analysis-bsds-${entreprise_id}`);
        return null;
    }
};

// Fonction pour sauvegarder les BSDs d'analyse dans le cache (avec compression)
const saveAnalysisBSDsToCache = (entreprise_id: string, bsds: CommonBSD[]): void => {
    try {
        const cacheKey = `analysis-bsds-${entreprise_id}`;
        
        // Convertir les BSDs en version LIGHT (beaucoup plus léger)
        const lightBSDs = bsds.map(bsdToLight);
        
        const cacheData: CachedAnalysisBSDsData = {
            bsds: lightBSDs,
            timestamp: Date.now(),
            version: CACHE_VERSION_ANALYSIS
        };
        
        const jsonString = JSON.stringify(cacheData);
        const uncompressedSize = (new Blob([jsonString]).size / 1024 / 1024).toFixed(2);
        
        // Compresser avec LZ-String
        const compressed = LZString.compress(jsonString);
        const compressedSize = (new Blob([compressed]).size / 1024 / 1024).toFixed(2);
        const ratio = ((1 - parseFloat(compressedSize) / parseFloat(uncompressedSize)) * 100).toFixed(1);
        
        console.log(`🗜️ Compression: ${uncompressedSize} MB → ${compressedSize} MB (${ratio}% de réduction)`);
        
        // Vérifier la taille compressée
        if (new Blob([compressed]).size > 8 * 1024 * 1024) {
            console.warn(`⚠️ Cache compressé encore trop gros (${compressedSize} MB)`);
            console.warn('💡 Limite: 8 MB - Réduisez le nombre de BSDs ou utilisez IndexedDB');
            return;
        }
        
        localStorage.setItem(cacheKey, compressed);
        console.log(`💾 Cache COMPRESSÉ sauvegardé: ${bsds.length} BSDs → ${compressedSize} MB`);
    } catch (error) {
        if (error instanceof Error && error.name === 'QuotaExceededError') {
            console.error('❌ Quota localStorage dépassé!');
            console.error('💡 Videz le cache : localStorage.clear() dans la console');
        } else {
            console.error('❌ Erreur sauvegarde cache BSDs:', error);
        }
    }
};

type FilterType = SharedFilterType;

interface AnalysisContextType {
  bsds: BSD[];
  loading: boolean;
  refetch: () => Promise<void>;
  mappingTable: Array<{ ced?: string; nom?: string; filiere: string }>;
  siretToName: Record<string, string>;
  filieres_ou_prestataires: FiliereOuPrestataireInterface;
  filterType: FilterType;
  setFilterType: (val: FilterType) => void;
}

// Ajout du type intermédiaire
type FormattedBSD = Omit<CommonBSD, keyof CommonBSD> & {
    id: string;
    entreprise_id: string;
    user_id: string;
    created_at: string;
    status_track_dechets: string;
    readable_id_track_dechets: string;
    facture_infos: { footer: { total_ht: string } };
    infos_json: {
        formAPI: {
            createFormInput: Partial<BSDD_TrackDechets>;
        };
    };
    on_track_dechets: boolean;
    created_on_fleap: string;
    facture_treated: boolean;
    id_track_dechets: string;
    other_infos: { fillRate: string };
};

export const AnalysisContext = createContext<AnalysisContextType | null>(null);

interface SupabaseBSD {
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
            siret: string;
            orgId: string;
            name: string;
        };
    };
    recipient: {
        processingOperation: string;
        valoParts?: {
            code_valo: string;
            tonnage: string;
        }[];
        company: {
            siret: string;
            orgId: string;
            name: string;
        };
    };
    transporter: {
        company: {
            siret: string;
            orgId: string;
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
    other_infos: { tri?:boolean, fillRate: string, volume: string, volumeUnit: string, containerDescription: string, declassement?: { declassement_boolean: boolean } };
}

export const AnalysisProvider = ({ children }: { children: React.ReactNode }) => {
    const {entreprise_id, user_id} = useSession();
    const { filieres, points_collecte, sites, filieres_ou_prestataires, segmentDates } = useFilterContext();
    const [loading, setLoading] = useState(true);
    const [rawBSDs, setRawBSDs] = useState<BSD[]>([]);
    const [filteredBSDs, setFilteredBSDs] = useState<BSD[]>([]);
    const [mappingTable, setMappingTable] = useState<Array<{ ced?: string; nom?: string; filiere: string }>>([]);
    const [siretToName, setSiretToName] = useState<Record<string, string>>({});
    const [filtersInitialized, setFiltersInitialized] = useState(false);
    const [filterType, setFilterType] = useState<FilterType>('imported');

    const { filterFunctions } = useFiltresPerso();

    // Vérifier si les filtres sont initialisés
    useEffect(() => {
        const areFiltersInitialized = filieres.length > 0 && sites.length > 0;
        setFiltersInitialized(areFiltersInitialized);
    }, [filieres, sites]);

    // Utiliser SWR pour le mapping_nom_filiere
    const { data: mappingNomFiliere } = useSWR(
        filieres_ou_prestataires.nom === 'filiere_nom' && entreprise_id 
            ? `/api/get_mapping_nom_filiere?entreprise_id=${entreprise_id}` 
            : null,
        async (url) => {
            const response = await fetch(url);
            const result = await response.json();
            return result.data;
        },
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            refreshInterval: 0
        }
    );

    // Charger la table de mapping
    useEffect(() => {
        const loadMappingTable = async () => {
            if (entreprise_id) {
                if (filieres_ou_prestataires.nom === 'filiere') {
                    const mapping = await getMappingTableFiliere(entreprise_id);
                    setMappingTable(mapping || []);
                } else if (filieres_ou_prestataires.nom === 'filiere_nom') {
                    // Utiliser les données SWR pour mapping_nom_filiere
                    setMappingTable(mappingNomFiliere || []);
                }
            }
        };
        loadMappingTable();
    }, [entreprise_id, filieres_ou_prestataires.nom, mappingNomFiliere]);

    // Créer le mapping SIRET -> Nom
    useEffect(() => {
        const mapping: { [key: string]: string } = {};
        sites.forEach(site => {
            if (site.orgId && site.givenName) {
                mapping[site.orgId] = site.givenName;
            }
        });
        setSiretToName(mapping);
    }, [sites]);

    const fetchBSDs = useCallback(async () => {
        if (!entreprise_id) {
            console.log('⚠️ Pas d\'entreprise_id, skip fetchBSDs');
            return;
        }

        try {
            setLoading(true);
            console.log('🔍 fetchBSDs appelé pour entreprise:', entreprise_id);
            
            // 1. Vérifier si le cache local est à jour (comparaison avec version Redis)
            const isUpToDate = await isCacheUpToDate(entreprise_id, 'analysis-bsds');
            
            // 2. Si à jour, utiliser le cache localStorage
            if (isUpToDate) {
                const cachedBSDs = getAnalysisBSDsFromCache(entreprise_id);
                if (cachedBSDs && cachedBSDs.length > 0) {
                    console.log(`⚡ Utilisation cache BSDs analyse (version validée par serveur) - ${cachedBSDs.length} BSDs`);
                    setRawBSDs(cachedBSDs);
                    setLoading(false);
                    return;
                }
            } else {
                console.log('🔄 Cache BSDs analyse obsolète ou inexistant, rechargement...');
            }
            
            console.log('🔄 Chargement des BSDs d\'analyse depuis la BDD...');
            let allBSDs: BSD[] = [];
            let hasMore = true;
            let lastId: string | null = null;

            // 2. Si pas de cache, récupérer tous les BSDs en paginant
            while (hasMore) {
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
                        other_infos,
                        on_track_dechets,
                        created_on_fleap,
                        facture_treated,
                        id_track_dechets
                    `)
                    .eq('entreprise_id', entreprise_id)
                    .order('id', { ascending: false })
                    .limit(1000);

                if (lastId) {
                    query = query.lt('id', lastId);
                }

                const { data, error } = await query;

                if (error) throw error;

                if (!data || data.length === 0) {
                    hasMore = false;
                    break;
                }

                // Formater les données
                const formattedData = (data as unknown as SupabaseBSD[]).map(item => {
                    const bsd = {
                        id: item.id,
                        entreprise_id: item.entreprise_id,
                        user_id: item.user_id,
                        created_at: item.created_at,
                        status_track_dechets: item.status_track_dechets,
                        readable_id_track_dechets: item.readable_id_track_dechets,
                        facture_infos: {
                            footer: {
                                total_ht: String(item.total_ht || '0')
                            }
                        },
                        infos_json: {
                            formAPI: {
                                createFormInput: {
                                    id: item.id,
                                    readableId: item.readable_id_track_dechets,
                                    customId: item.id,
                                    status: item.status_track_dechets,
                                    emitter: {
                                        company: {
                                            siret: item.emitter.company.siret,
                                            name: item.emitter.company.name,
                                            orgId: item.emitter.company.orgId,
                                        }
                                    },
                                    recipient: {
                                        company: {
                                            siret: item.recipient.company.siret,
                                            name: item.recipient.company.name,
                                            orgId: item.recipient.company.orgId,
                                        },
                                        processingOperation: item.recipient.processingOperation,
                                        valoParts: item.recipient.valoParts,
                                    },
                                    transporter: {
                                        company: {
                                            siret: item.transporter.company.siret,
                                            name: item.transporter.company.name,
                                            orgId: item.transporter.company.orgId,
                                        },
                                    },
                                    wasteDetails: {
                                        code: item.wasteDetails.code,
                                        name: item.wasteDetails.name,
                                        quantity: parseFloat(item.wasteDetails.quantity),
                                        isDangerous: item.wasteDetails.isDangerous === "true",
                                    },
                                    takenOverAt: item.takenOverAt,
                                    quantityReceived: parseFloat(item.quantityReceived || "0"),
                                }
                            }
                        },
                        on_track_dechets: item.on_track_dechets,
                        created_on_fleap: item.created_on_fleap,
                        facture_treated: item.facture_treated,
                        id_track_dechets: item.id_track_dechets,
                        other_infos: item.other_infos
                    };
                    return bsd as unknown as CommonBSD;
                });

                allBSDs = [...allBSDs, ...formattedData];
                lastId = data[data.length - 1].id;

                // Vérifier s'il y a plus de données
                const { count } = await supabase
                    .from('bsd')
                    .select('*', { count: 'exact', head: true })
                    .eq('entreprise_id', entreprise_id)
                    .lt('id', lastId);

                hasMore = count ? count > 0 : false;
            }

            console.log(`✅ ${allBSDs.length} BSDs d'analyse chargés depuis la BDD`);
            
            // 3. Sauvegarder dans le cache localStorage AVANT de mettre à jour l'état
            console.log('💾 Tentative de sauvegarde dans localStorage...');
            saveAnalysisBSDsToCache(entreprise_id, allBSDs);
            
            // 4. Sauvegarder la version du cache (synchronisation multi-utilisateurs)
            await saveCacheVersion(entreprise_id, 'analysis-bsds');
            
            setRawBSDs(allBSDs);

        } catch (error) {
            console.error("Error fetching BSDs:", error);
            setRawBSDs([]);
        } finally {
            setLoading(false);
        }
    }, [entreprise_id]);

    // Charger les données une seule fois au montage du composant
    useEffect(() => {
        if (entreprise_id) {
            fetchBSDs();
        }
    }, [entreprise_id, fetchBSDs]);

    // Appliquer les filtres
    useEffect(() => {
        if (!filtersInitialized || rawBSDs.length === 0) return;

        let filteredData: BSD[] = [];
        if (filieres_ou_prestataires.nom === 'filiere') {
            filteredData = filterBSDs(rawBSDs, filieres, sites, points_collecte, segmentDates, mappingTable, filterFunctions, false);
        } else if (filieres_ou_prestataires.nom === 'filiere_nom') {
            // Adapter filterBSDs pour filtrer par nom de déchet
            filteredData = filterBSDs(rawBSDs, filieres, sites, points_collecte, segmentDates, mappingTable, filterFunctions, false, 'nom');
        }

        let finalFiltered = filteredData;
        
        // Appliquer le filtre selon le type sélectionné via helper partagé
        finalFiltered = applyFilterType<BSD>(filteredData, filterType, {
            getStatus: (b: BSD) => b.status_track_dechets as unknown as string | undefined,
            getCreatedOnFleap: (b: BSD) => b.created_on_fleap as unknown as boolean | undefined,
        });
        
        setFilteredBSDs(finalFiltered);

    }, [rawBSDs, filieres, points_collecte, sites, segmentDates, filterFunctions, filtersInitialized, filterType, filieres_ou_prestataires.nom, mappingTable]);

    return (
        <AnalysisContext.Provider value={{ 
            bsds: filteredBSDs, 
            loading,
            refetch: fetchBSDs,
            mappingTable,
            siretToName,
            filieres_ou_prestataires,
            filterType,
            setFilterType
        }}>
            {children}
        </AnalysisContext.Provider>
    );
};

export const useAnalysis = (): AnalysisContextType => {
    const context = useContext(AnalysisContext);
    if (!context) {
        throw new Error('useAnalysis must be used within an AnalysisProvider');
    }
    return context;
};

const cleanCED = (ced: string): string => {
    const ced_clean = ced.replace(/[^\d]/g,'');
    return ced_clean;
};

const getCEDsFromFilieres = async (entreprise_id: string | null, checkedFilieres: string[]) => {
    const { data, error } = await supabase
        .from('entreprise')
        .select('mapping_ced_filiere')
        .eq('id', entreprise_id)
        .single();

    if (data) {
        const mapping_table = data.mapping_ced_filiere;
        const ced_uniques: string[] = [];
        
        if (checkedFilieres.length === 1 && checkedFilieres[0] === 'Autres') {
            return [];
        }

        const checkedFilieres_sans_autres = checkedFilieres.filter(filiere => filiere !== 'Autres');
        
        for (const mapping of mapping_table) {
            for (const filiere of checkedFilieres_sans_autres) {
                if (mapping.filiere === filiere) {
                    ced_uniques.push(cleanCED(mapping.ced));
                }
            }
        }

        return ced_uniques;
    }
    return [];
}; 