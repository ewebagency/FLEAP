import useSWR from 'swr';
import { supabase } from '@/app/database/supabaseClient';

// Types
interface SiteMapping {
    [metaSiteKey: string]: string[];
}

interface PrestaMapping {
    [metaPrestaKey: string]: string[];
}

interface MetaSite {
    nom: string;
    siret: string;
}

interface MetaPresta {
    nom: string;
    siret: string;
}

// SWR Fetcher pour les mappings
const fetcher = async (url: string) => {
    const { data, error } = await supabase
        .from('entreprise')
        .select('params_mapping_site, params_mapping_presta')
        .eq('id', url)
        .single();

    if (error) throw error;
    return data;
};

// Hook SWR pour récupérer les mappings
export const useMappings = (entreprise_id: string) => {
    const { data, error, mutate } = useSWR(
        entreprise_id ? entreprise_id : null,
        fetcher,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
            refreshInterval: 0
        }
    );

    return {
        siteMappings: (data?.params_mapping_site || {}) as SiteMapping,
        prestaMappings: (data?.params_mapping_presta || {}) as PrestaMapping,
        isLoading: !error && !data,
        isError: error,
        mutate
    };
};

// Fonction utilitaire pour parser une clé meta (nom|siret)
const parseMetaKey = (key: string): { nom: string; siret: string } => {
    const [nom, siret] = key.split('|');
    return { nom: nom || '', siret: siret || '' };
};

// Fonction pour trouver le meta site d'un site_raw
export const findMetaSite = (site_raw: string, params_site_mapping: SiteMapping): MetaSite | null => {
    for (const [metaKey, sites] of Object.entries(params_site_mapping)) {
        if (sites.includes(site_raw)) {
            return parseMetaKey(metaKey);
        }
    }
    return null;
};

// Fonction pour trouver le meta presta d'un presta_raw
export const findMetaPresta = (presta_raw: string, params_presta_mapping: PrestaMapping): MetaPresta | null => {
    for (const [metaKey, prestas] of Object.entries(params_presta_mapping)) {
        if (prestas.includes(presta_raw)) {
            return parseMetaKey(metaKey);
        }
    }
    return null;
};

// Fonction générique pour trouver le meta d'un raw (site ou presta)
export const findMeta = (
    raw: string, 
    params_mapping: SiteMapping | PrestaMapping, 
    type: 'site' | 'presta'
): MetaSite | MetaPresta | null => {
    if (type === 'site') {
        return findMetaSite(raw, params_mapping as SiteMapping);
    } else {
        return findMetaPresta(raw, params_mapping as PrestaMapping);
    }
};

// Fonction pour obtenir le nom complet du meta (nom + siret)
export const getMetaDisplayName = (meta: MetaSite | MetaPresta): string => {
    if (meta.siret) {
        return `${meta.nom} (${meta.siret})`;
    }
    return meta.nom;
};

// Fonction pour vérifier si un raw est mappé
export const isRawMapped = (
    raw: string, 
    params_mapping: SiteMapping | PrestaMapping
): boolean => {
    return Object.values(params_mapping).some(sites => sites.includes(raw));
};

// Fonction pour obtenir tous les raws mappés
export const getMappedRaws = (params_mapping: SiteMapping | PrestaMapping): string[] => {
    return Object.values(params_mapping).flat();
};

// Fonction pour obtenir tous les raws non mappés
export const getUnmappedRaws = (
    allRaws: string[], 
    params_mapping: SiteMapping | PrestaMapping
): string[] => {
    const mappedRaws = getMappedRaws(params_mapping);
    return allRaws.filter(raw => !mappedRaws.includes(raw));
};
