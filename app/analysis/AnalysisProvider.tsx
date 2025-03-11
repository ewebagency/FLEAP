import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from '../component/SessionProvider';
import { useFilterContext, FiliereOuPrestataireInterface } from '../FilterContext';
import { supabase } from '../database/supabaseClient';
import { getMappingTableFiliere } from '../register/RegisterComponents/Modal/FormulaireFull/utils_new';
import { FormInput, BSDD_TrackDechets, OtherInfos } from '../register/interface/BSD_Interface';
import { useFiltresPerso } from '../component/FiltresPerso/FiltresPersoProvider';
import { filterBSDs, CommonBSD } from '../register/FiltreFunctionnal';
// Utiliser l'interface commune
export type BSD = CommonBSD;

interface AnalysisContextType {
  bsds: BSD[];
  loading: boolean;
  refetch: () => Promise<void>;
  mappingTable: Array<{ ced: string; filiere: string }>;
  siretToName: Record<string, string>;
  filieres_ou_prestataires: FiliereOuPrestataireInterface;
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
}

export const AnalysisProvider = ({ children }: { children: React.ReactNode }) => {
    const {entreprise_id, user_id} = useSession();
    const { filieres, points_collecte, sites, filieres_ou_prestataires, segmentDates } = useFilterContext();
    const [loading, setLoading] = useState(true);
    const [rawBSDs, setRawBSDs] = useState<BSD[]>([]);
    const [filteredBSDs, setFilteredBSDs] = useState<BSD[]>([]);
    const [mappingTable, setMappingTable] = useState<Array<{ ced: string; filiere: string }>>([]);
    const [siretToName, setSiretToName] = useState<Record<string, string>>({});
    const [filtersInitialized, setFiltersInitialized] = useState(false);

    const { filterFunctions } = useFiltresPerso();

    // Vérifier si les filtres sont initialisés
    useEffect(() => {
        const areFiltersInitialized = filieres.length > 0 && sites.length > 0;
        setFiltersInitialized(areFiltersInitialized);
    }, [filieres, sites]);

    // Charger la table de mapping
    useEffect(() => {
        const loadMappingTable = async () => {
            if (entreprise_id) {
                const mapping = await getMappingTableFiliere(entreprise_id);
                setMappingTable(mapping || []);
            }
        };
        loadMappingTable();
    }, [entreprise_id]);

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
        if (!entreprise_id) return;

        try {
            setLoading(true);
            let allBSDs: BSD[] = [];
            let hasMore = true;
            let lastId: string | null = null;

            // Récupérer tous les BSDs en paginant
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
                        infos_json->formAPI->createFormInput->other_infos->>fillRate,
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
                                        processingOperation: item.recipient.processingOperation
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
                        other_infos: {
                            fillRate: item.fillRate,
                            volume: "",
                            volumeUnit: "",
                            containerDescription: ""
                        }
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

            console.log('Total BSDs loaded:', allBSDs.length);
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

        const filteredData = filterBSDs(rawBSDs, filieres, sites, points_collecte, segmentDates, mappingTable, filterFunctions, false);

        setFilteredBSDs(filteredData);
    }, [rawBSDs, filieres, points_collecte, sites, segmentDates, filterFunctions, filtersInitialized]);

    return (
        <AnalysisContext.Provider value={{ 
            bsds: filteredBSDs, 
            loading,
            refetch: fetchBSDs,
            mappingTable,
            siretToName,
            filieres_ou_prestataires
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