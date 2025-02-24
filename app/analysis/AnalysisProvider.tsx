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

export const AnalysisContext = createContext<AnalysisContextType | null>(null);

export const AnalysisProvider = ({ children }: { children: React.ReactNode }) => {
    const {entreprise_id} = useSession();
    const { filieres, points_collecte, sites, filieres_ou_prestataires, segmentDates } = useFilterContext();
    const [loading, setLoading] = useState(true);
    const [bsds, setBsds] = useState<BSD[]>([]);
    const [mappingTable, setMappingTable] = useState<Array<{ ced: string; filiere: string }>>([]);
    const [siretToName, setSiretToName] = useState<Record<string, string>>({});

    const { filterFunctions } = useFiltresPerso();

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

    const fetchAndFilterBSDs = useCallback(async () => {
        if (!entreprise_id) return;

        try {
            setLoading(true);
            const response = await fetch(`/api/get_data_bsd?entreprise_id=${entreprise_id}`);
            const { data: fetchedBSDs } = await response.json();

            if (!fetchedBSDs) {
                setBsds([]);
                return;
            }

            // Utiliser la fonction mutualisée de filtrage
            const filtered = filterBSDs(
                fetchedBSDs,
                filieres,
                sites,
                points_collecte,
                segmentDates,
                mappingTable,
                [], // pas de filtres personnalisés pour l'analyse
                false, // pas de filtre des BSDs en attente pour l'analyse
            );

            setBsds(filtered);

        } catch (error) {
            console.error("Error fetching BSDs:", error);
            setBsds([]);
        } finally {
            setLoading(false);
        }
    }, [entreprise_id, filieres, sites, points_collecte, segmentDates, mappingTable]);

    useEffect(() => {
        setLoading(true);
        fetchAndFilterBSDs().finally(() => setLoading(false));
    }, [entreprise_id, filieres, points_collecte, sites, segmentDates, filterFunctions, mappingTable]);

    return (
        <AnalysisContext.Provider value={{ 
            bsds, 
            loading,
            refetch: fetchAndFilterBSDs,
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