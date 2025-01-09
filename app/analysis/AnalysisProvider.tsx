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
            .eq('entreprise_id', session.entreprise_id);

        if (checkedSites.length > 0) {
            let or_condition = ``;
            if (checkedSites.includes('autres')) {
                or_condition = `infos_json->formAPI->createFormInput->emitter->company->>siret.eq.""`;
                if (checkedSites.length > 1) {
                    or_condition += `,infos_json->formAPI->createFormInput->emitter->company->>siret.in.(${checkedSites.join(',')})`;
                }
            } else {
                or_condition = `infos_json->formAPI->createFormInput->emitter->company->>siret.in.(${checkedSites.join(',')})`;
            }
            query = query.or(or_condition);
        }

        if (checkedPointsCollecte.length > 0) {
            if (!checkedPointsCollecte.includes("Non renseigné")) {
                query = query.filter('infos_json->formAPI->createFormInput->emitter->workSite->>name', 'in', `(${checkedPointsCollecte.join(',')})`);
            } else {
                query = query.or(
                    `infos_json->formAPI->createFormInput->emitter->>workSite.is.null,` +
                    `infos_json->formAPI->createFormInput->emitter->workSite->>name.eq."",` +
                    `infos_json->formAPI->createFormInput->emitter->workSite->>name.in.(${checkedPointsCollecte.filter(pc => pc !== "Non renseigné").join(',')})`
                );
            }
        }

        const { data, error } = await query;

        if (error) {
            console.error("Error fetching BSDs:", error);
            return;
        }

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