import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSession } from '../component/SessionProvider';
import { useFilterContext, FiliereOuPrestataireInterface } from '../FilterContext';
import { supabase } from '../database/supabaseClient';
import { getMappingTableFiliere } from '../register/RegisterComponents/Modal/FormulaireFull/utils_new';
import { FormInput, BSDD_TrackDechets } from '../register/interface/BSD_Interface';

export interface BSD {
  created_at: string;
  infos_json: {
    formAPI: {
      createFormInput: FormInput;
    };
  };
}

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
    const session = useSession();
    const { filieres, points_collecte, sites, filieres_ou_prestataires } = useFilterContext();
    const [loading, setLoading] = useState(true);
    const [bsds, setBsds] = useState<BSD[]>([]);
    const [mappingTable, setMappingTable] = useState<Array<{ ced: string; filiere: string }>>([]);
    const [siretToName, setSiretToName] = useState<Record<string, string>>({});

    // Charger la table de mapping
    useEffect(() => {
        const loadMappingTable = async () => {
            if (session?.entreprise_id) {
                const mapping = await getMappingTableFiliere(session.entreprise_id);
                setMappingTable(mapping || []);
            }
        };
        loadMappingTable();
    }, [session?.entreprise_id]);

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

    const fetchBSDs = async () => {
        if (!session?.entreprise_id) return;

        const checkedFilieres = filieres.filter(f => f.checked).map(f => f.name);
        const checkedPointsCollecte = points_collecte.filter(pc => pc.checked).map(pc => pc.name);
        const checkedSites = sites.filter(site => site.checked).map(site => site.orgId);

        if (checkedFilieres.length === 0 || checkedPointsCollecte.length === 0) {
            setBsds([]);
            return;
        }

        let query = supabase
            .from('bsd')
            .select('*')
            .eq('entreprise_id', session.entreprise_id)
            .order('created_at', { ascending: false });

        // Récupérer tous les CEDs de toutes les filières
        const { data: mappingData } = await supabase
            .from('entreprise')
            .select('mapping_ced_filiere')
            .eq('id', session.entreprise_id)
            .single();

        let filiere_conditions = [];

        // Conditions pour les CEDs (filières)
        if (mappingData) {
            const mapping_table = mappingData.mapping_ced_filiere;
            
            // Liste de tous les CEDs de toutes les filières
            const ced_from_all_filiere = mapping_table.map((mapping: {ced: string}) => cleanCED(mapping.ced));
            
            // Liste des CEDs des filières sélectionnées
            const ced_from_checked_filiere = mapping_table
                .filter((mapping: {filiere: string}) => 
                    checkedFilieres.filter(f => f !== 'Autres').includes(mapping.filiere))
                .map((mapping: {ced: string}) => cleanCED(mapping.ced));

            const formatCEDs = (ceds: string[]) => {
                return ceds.flatMap(ced => [
                    ced,
                    ced.replace(/(\d{2})(?=\d)/g, '$1 ').trim(),
                    ced.replace(/(\d{2})(?=\d)/g, '$1 ').trim() + '*'
                ]);
            };

            // Si "Autres" est sélectionné
            if (checkedFilieres.includes('Autres')) {
                const all_formatted_ceds = formatCEDs(ced_from_all_filiere);
                if (all_formatted_ceds.length > 0) {
                    filiere_conditions.push(
                        `infos_json->formAPI->createFormInput->wasteDetails->>code.not.in.(${all_formatted_ceds.join(',')})`
                    );
                }
            }

            // Pour les filières normales
            const checked_formatted_ceds = formatCEDs(ced_from_checked_filiere);
            if (checked_formatted_ceds.length > 0) {
                filiere_conditions.push(
                    `infos_json->formAPI->createFormInput->wasteDetails->>code.in.(${checked_formatted_ceds.join(',')})`
                );
            }
        }

        // Conditions pour les sites
        let site_conditions = [];
        if (checkedSites.length > 0) {
            if (checkedSites.includes('----')) {
                site_conditions.push(`infos_json->formAPI->createFormInput->emitter->company->>siret.eq.""`);
            }
            
            const realSites = checkedSites.filter(site => site !== '----');
            if (realSites.length > 0) {
                site_conditions.push(`infos_json->formAPI->createFormInput->emitter->company->>siret.in.(${realSites.join(',')})`);
            }
        } else {
            setBsds([]);
            return;
        }

        // Appliquer les conditions avec AND entre sites et filières
        if (filiere_conditions.length > 0) {
            query = query.or(filiere_conditions.join(','));
        }

        if (site_conditions.length > 0) {
            query = query.or(site_conditions.join(','));
        }

        console.log('filiere_conditions', filiere_conditions);
        console.log('site_conditions', site_conditions);

        const { data, error } = await query;

        if (error) {
            console.error("Error fetching BSDs:", error);
            return;
        }

        console.log('Nombre de BSDs récupérés dans analyse', data.length);
        setBsds(data || []);
    };

    useEffect(() => {
        setLoading(true);
        fetchBSDs().finally(() => setLoading(false));
    }, [session, filieres, points_collecte, sites]);

    return (
        <AnalysisContext.Provider value={{ 
            bsds, 
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
    const ced_clean = ced.replaceAll(' ', '').replace('*', '').trim();
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