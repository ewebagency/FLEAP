"use client";

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { useSession } from '@/app/component/SessionProvider';
import Select from 'react-select';
import { MultiValue } from 'react-select';
import { toast } from 'react-hot-toast';

interface MetaSite {
    id: string;
    nom: string;
    siret: string;
}

interface SiteRaw {
    nom: string;
    pdfId: string;
    pdf_id: string;
    pdfInfo?: {
        name_pdf_in_bucket: string;
    };
}

interface PrestaRaw {
    nom: string;
    pdfId: string;
    pdf_id: string;
    pdfInfo?: {
        name_pdf_in_bucket: string;
    };
}

interface MetaPresta {
    id: string;
    nom: string;
    siret: string;
}

interface SiteMapping {
    [metaSiteKey: string]: string[];
}

interface PrestaMapping {
    [metaPrestaKey: string]: string[];
}

interface OptionType {
    label: string;
    value: string;
}

export default function FormatDataTab() {
    const [unifiedSiteRaw, setUnifiedSiteRaw] = useState<SiteRaw[]>([]);
    const [unifiedPrestaRaw, setUnifiedPrestaRaw] = useState<PrestaRaw[]>([]);
    const [metaSites, setMetaSites] = useState<MetaSite[]>([]);
    const [metaPrestas, setMetaPrestas] = useState<MetaPresta[]>([]);
    const [siteMappings, setSiteMappings] = useState<SiteMapping>({});
    const [prestaMappings, setPrestaMappings] = useState<PrestaMapping>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const {entreprise_id} = useSession();
    
    // États pour l'interface - Sites
    const [searchSiteRaw, setSearchSiteRaw] = useState('');
    const [searchMetaSite, setSearchMetaSite] = useState('');
    const [selectedMetaSite, setSelectedMetaSite] = useState<OptionType | null>(null);
    const [selectedSiteRaw, setSelectedSiteRaw] = useState<Set<string>>(new Set());
    
    // États pour l'interface - Prestataires
    const [searchPrestaRaw, setSearchPrestaRaw] = useState('');
    const [searchMetaPresta, setSearchMetaPresta] = useState('');
    const [selectedMetaPresta, setSelectedMetaPresta] = useState<OptionType | null>(null);
    const [selectedPrestaRaw, setSelectedPrestaRaw] = useState<Set<string>>(new Set());

    // Récupérer les site_raw unifiés depuis la table bon_pdf
    const fetchUnifiedSiteRaw = async (): Promise<SiteRaw[]> => {
        try {
            if (!entreprise_id) {
                throw new Error('ID de l\'entreprise non trouvé');
            }

            const allSiteRaw: SiteRaw[] = [];
            let from = 0;
            const limit = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('bon_pdf')
                    .select('id, infos->>site_raw, pdf_id')
                    .eq('entreprise_id', entreprise_id)
                    .range(from, from + limit - 1);

                if (error) throw error;

                if (data && data.length > 0) {
                    const siteRawValues = data
                        .map(item => ({
                            nom: item.site_raw as string,
                            pdfId: item.id,
                            pdf_id: item.pdf_id
                        }))
                        .filter(site => site.nom && site.nom.trim().length > 0)
                        .map(site => ({
                            nom: site.nom.trim(),
                            pdfId: site.pdfId,
                            pdf_id: site.pdf_id
                        }));

                    allSiteRaw.push(...siteRawValues);
                    from += limit;
                    hasMore = data.length === limit;
                } else {
                    hasMore = false;
                }
            }

            // Dédupliquer par nom et garder le premier PDF trouvé pour chaque nom
            const uniqueSites = new Map<string, SiteRaw>();
            allSiteRaw.forEach(site => {
                if (!uniqueSites.has(site.nom)) {
                    uniqueSites.set(site.nom, site);
                }
            });

            return Array.from(uniqueSites.values()).sort((a, b) => a.nom.localeCompare(b.nom));
        } catch (err) {
            console.error('Erreur lors du chargement des site_raw:', err);
            throw err;
        }
    };

    // Récupérer les presta_raw unifiés depuis la table bon_pdf
    const fetchUnifiedPrestaRaw = async (): Promise<PrestaRaw[]> => {
        try {
            if (!entreprise_id) {
                throw new Error('ID de l\'entreprise non trouvé');
            }

            const allPrestaRaw: PrestaRaw[] = [];
            let from = 0;
            const limit = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('bon_pdf')
                    .select('id, infos->>presta_raw, pdf_id')
                    .eq('entreprise_id', entreprise_id)
                    .range(from, from + limit - 1);

                if (error) throw error;

                if (data && data.length > 0) {
                    const prestaRawValues = data.flatMap(item => {
                        const prestas: PrestaRaw[] = [];
                        
                        // Ajouter transporteur si présent
                        if (item.presta_raw && item.presta_raw.trim().length > 0) {
                            prestas.push({
                                nom: item.presta_raw.trim(),
                                pdfId: item.id,
                                pdf_id: item.pdf_id
                            });
                        }
                        
                       
                        
                        return prestas;
                    });

                    allPrestaRaw.push(...prestaRawValues);
                    from += limit;
                    hasMore = data.length === limit;
                } else {
                    hasMore = false;
                }
            }

            // Dédupliquer par nom et garder le premier PDF trouvé pour chaque nom
            const uniquePrestas = new Map<string, PrestaRaw>();
            allPrestaRaw.forEach(presta => {
                if (!uniquePrestas.has(presta.nom)) {
                    uniquePrestas.set(presta.nom, presta);
                }
            });

            return Array.from(uniquePrestas.values()).sort((a, b) => a.nom.localeCompare(b.nom));
        } catch (err) {
            console.error('Erreur lors du chargement des presta_raw:', err);
            throw err;
        }
    };

    // Récupérer les meta sites depuis table_autocompletion
    const fetchMetaSites = async (): Promise<MetaSite[]> => {
        try {
            const { data, error } = await supabase
                .from('table_autocompletion')
                .select('id, site->>nom, site->>siret')
                .not('site->>nom', 'is', null)
                .eq('entreprise_id', entreprise_id);

            if (error) throw error;

            return data.map(item => ({
                id: item.id,
                nom: item.nom,
                siret: item.siret || ''
            })).sort((a, b) => a.nom.localeCompare(b.nom));
        } catch (err) {
            console.error('Erreur lors du chargement des meta sites:', err);
            throw err;
        }
    };

    // Récupérer les meta prestas depuis table_autocompletion
    const fetchMetaPrestas = async (): Promise<MetaPresta[]> => {
        try {
            // Récupérer les destinataires
            const { data: destData, error: destError } = await supabase
                .from('table_autocompletion')
                .select('id, destinataire->>nomBoite, destinataire->>siret')
                .not('destinataire->>nomBoite', 'is', null)
                .eq('entreprise_id', entreprise_id);

            if (destError) throw destError;

            // Récupérer les transporteurs
            const { data: transpData, error: transpError } = await supabase
                .from('table_autocompletion')
                .select('id, transporteur->>nomBoite, transporteur->>siret')
                .not('transporteur->>nomBoite', 'is', null)
                .eq('entreprise_id', entreprise_id);

            if (transpError) throw transpError;

            // Combiner les deux types de prestataires
            const allPrestas = [
                ...(destData || []).map(item => ({
                    id: item.id,
                    nom: item.nomBoite,
                    siret: item.siret || ''
                })),
                ...(transpData || []).map(item => ({
                    id: item.id,
                    nom: item.nomBoite,
                    siret: item.siret || ''
                }))
            ];

            // Dédupliquer par nom et siret
            const uniquePrestas = new Map<string, MetaPresta>();
            allPrestas.forEach(presta => {
                const key = `${presta.nom}|${presta.siret}`;
                if (!uniquePrestas.has(key)) {
                    uniquePrestas.set(key, presta);
                }
            });

            return Array.from(uniquePrestas.values()).sort((a, b) => a.nom.localeCompare(b.nom));
        } catch (err) {
            console.error('Erreur lors du chargement des meta prestas:', err);
            throw err;
        }
    };

    // Récupérer les mappings existants
    const fetchSiteMappings = async (): Promise<SiteMapping> => {
        try {
            if (!entreprise_id) {
                throw new Error('ID de l\'entreprise non trouvé');
            }

            const { data, error } = await supabase
                .from('entreprise')
                .select('params_mapping_site')
                .eq('id', entreprise_id)
                .single();

            if (error) throw error;
            
            const mappings = data?.params_mapping_site || {};
            console.log('Mappings sites chargés:', mappings);
            
            // Vérifier que le format est correct
            if (typeof mappings === 'object' && mappings !== null) {
                return mappings;
            } else {
                console.warn('Format de mapping incorrect, retour d\'un objet vide');
                return {};
            }
        } catch (err) {
            console.error('Erreur lors du chargement des mappings sites:', err);
            return {};
        }
    };

    // Récupérer les mappings prestas existants
    const fetchPrestaMappings = async (): Promise<PrestaMapping> => {
        try {
            if (!entreprise_id) {
                throw new Error('ID de l\'entreprise non trouvé');
            }

            const { data, error } = await supabase
                .from('entreprise')
                .select('params_mapping_presta')
                .eq('id', entreprise_id)
                .single();

            if (error) throw error;
            
            const mappings = data?.params_mapping_presta || {};
            console.log('Mappings prestas chargés:', mappings);
            
            // Vérifier que le format est correct
            if (typeof mappings === 'object' && mappings !== null) {
                return mappings;
            } else {
                console.warn('Format de mapping prestas incorrect, retour d\'un objet vide');
                return {};
            }
        } catch (err) {
            console.error('Erreur lors du chargement des mappings prestas:', err);
            return {};
        }
    };

    // Sauvegarder les mappings
    const saveSiteMappings = async (mappings: SiteMapping): Promise<void> => {
        try {
            if (!entreprise_id) {
                throw new Error('ID de l\'entreprise non trouvé');
            }

            console.log('mappings sites', mappings);
            const { error } = await supabase
                .from('entreprise')
                .update({ params_mapping_site: mappings })
                .eq('id', entreprise_id);

            if (error) throw error;
        } catch (err) {
            console.error('Erreur lors de la sauvegarde des mappings sites:', err);
            throw err;
        }
    };

    // Sauvegarder les mappings prestas
    const savePrestaMappings = async (mappings: PrestaMapping): Promise<void> => {
        try {
            if (!entreprise_id) {
                throw new Error('ID de l\'entreprise non trouvé');
            }

            console.log('mappings prestas', mappings);
            const { error } = await supabase
                .from('entreprise')
                .update({ params_mapping_presta: mappings })
                .eq('id', entreprise_id);

            if (error) throw error;
        } catch (err) {
            console.error('Erreur lors de la sauvegarde des mappings prestas:', err);
            throw err;
        }
    };

    // Initialisation
    useEffect(() => {
        const initializeData = async () => {
            try {
                setIsLoading(true);
                const [siteRawData, prestaRawData, metaSitesData, metaPrestasData, siteMappingsData, prestaMappingsData] = await Promise.all([
                    fetchUnifiedSiteRaw(),
                    fetchUnifiedPrestaRaw(),
                    fetchMetaSites(),
                    fetchMetaPrestas(),
                    fetchSiteMappings(),
                    fetchPrestaMappings()
                ]);

                setUnifiedSiteRaw(siteRawData);
                setUnifiedPrestaRaw(prestaRawData);
                setMetaSites(metaSitesData);
                setMetaPrestas(metaPrestasData);
                
                // Vérifier et nettoyer le format des mappings sites si nécessaire
                let cleanSiteMappings = siteMappingsData;
                if (siteMappingsData && typeof siteMappingsData === 'object') {
                    // Vérifier si les clés sont au bon format (nom|siret)
                    const hasInvalidFormat = Object.keys(siteMappingsData).some(key => {
                        const parsed = parseMetaSiteKey(key);
                        return !metaSitesData.find(ms => 
                            ms.nom === parsed.nom && ms.siret === parsed.siret
                        );
                    });
                    
                    if (hasInvalidFormat) {
                        console.warn('Format de mapping sites incorrect détecté, nettoyage...');
                        cleanSiteMappings = {};
                        await saveSiteMappings(cleanSiteMappings);
                    }
                }
                
                // Vérifier et nettoyer le format des mappings prestas si nécessaire
                let cleanPrestaMappings = prestaMappingsData;
                if (prestaMappingsData && typeof prestaMappingsData === 'object') {
                    // Vérifier si les clés sont au bon format (nom|siret)
                    const hasInvalidFormat = Object.keys(prestaMappingsData).some(key => {
                        const parsed = parseMetaPrestaKey(key);
                        return !metaPrestasData.find(mp => 
                            mp.nom === parsed.nom && mp.siret === parsed.siret
                        );
                    });
                    
                    if (hasInvalidFormat) {
                        console.warn('Format de mapping prestas incorrect détecté, nettoyage...');
                        cleanPrestaMappings = {};
                        await savePrestaMappings(cleanPrestaMappings);
                    }
                }
                
                setSiteMappings(cleanSiteMappings);
                setPrestaMappings(cleanPrestaMappings);
            } catch (err) {
                setError('Erreur lors du chargement des données');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        initializeData();
    }, [entreprise_id]);

    // Filtrer les site_raw selon la recherche
    const filteredSiteRaw = useMemo(() => {
        return unifiedSiteRaw.filter(site => 
            site.nom.toLowerCase().includes(searchSiteRaw.toLowerCase())
        );
    }, [unifiedSiteRaw, searchSiteRaw]);

    // Filtrer les meta sites selon la recherche
    const filteredMetaSites = useMemo(() => {
        const q = searchMetaSite.trim().toLowerCase();
        if (!q) return metaSites;
        return metaSites.filter(site => {
            const nomMatch = site.nom?.toLowerCase().includes(q);
            const siretMatch = site.siret?.toLowerCase().includes(q);
            return Boolean(nomMatch || siretMatch);
        });
    }, [metaSites, searchMetaSite]);

    // Fonction utilitaire pour générer la clé du meta site
    const getMetaSiteKey = (nom: string, siret: string): string => {
        return `${nom}|${siret}`;
    };

    // Fonction utilitaire pour parser la clé du meta site
    const parseMetaSiteKey = (key: string): { nom: string; siret: string } => {
        const [nom, siret] = key.split('|');
        return { nom: nom || '', siret: siret || '' };
    };

    // Convertir les meta sites en options pour react-select
    const metaSiteOptions: OptionType[] = filteredMetaSites.map(site => ({
        label: `${site.nom}${site.siret ? ` (${site.siret})` : ''}`,
        value: getMetaSiteKey(site.nom, site.siret)
    }));

    // Filtrer les presta_raw selon la recherche
    const filteredPrestaRaw = useMemo(() => {
        return unifiedPrestaRaw.filter(presta => 
            presta.nom.toLowerCase().includes(searchPrestaRaw.toLowerCase())
        );
    }, [unifiedPrestaRaw, searchPrestaRaw]);

    // Filtrer les meta prestas selon la recherche
    const filteredMetaPrestas = useMemo(() => {
        const q = searchMetaPresta.trim().toLowerCase();
        if (!q) return metaPrestas;
        return metaPrestas.filter(presta => {
            const nomMatch = presta.nom?.toLowerCase().includes(q);
            const siretMatch = presta.siret?.toLowerCase().includes(q);
            return Boolean(nomMatch || siretMatch);
        });
    }, [metaPrestas, searchMetaPresta]);

    // Fonction utilitaire pour générer la clé du meta presta
    const getMetaPrestaKey = (nom: string, siret: string): string => {
        return `${nom}|${siret}`;
    };

    // Fonction utilitaire pour parser la clé du meta presta
    const parseMetaPrestaKey = (key: string): { nom: string; siret: string } => {
        const [nom, siret] = key.split('|');
        return { nom: nom || '', siret: siret || '' };
    };

    // Convertir les meta prestas en options pour react-select
    const metaPrestaOptions: OptionType[] = filteredMetaPrestas.map(presta => ({
        label: `${presta.nom}${presta.siret ? ` (${presta.siret})` : ''}`,
        value: getMetaPrestaKey(presta.nom, presta.siret)
    }));

    // Obtenir tous les site_raw déjà associés
    const associatedSiteRaw = useMemo(() => {
        const allAssociated = new Set<string>();
        Object.values(siteMappings).forEach(sites => {
            sites.forEach(site => allAssociated.add(site));
        });
        return allAssociated;
    }, [siteMappings]);

    // Filtrer les site_raw disponibles (non associés)
    const availableSiteRaw = useMemo(() => {
        return filteredSiteRaw.filter(site => !associatedSiteRaw.has(site.nom));
    }, [filteredSiteRaw, associatedSiteRaw]);

    // Obtenir tous les presta_raw déjà associés
    const associatedPrestaRaw = useMemo(() => {
        const allAssociated = new Set<string>();
        Object.values(prestaMappings).forEach(prestas => {
            prestas.forEach(presta => allAssociated.add(presta));
        });
        return allAssociated;
    }, [prestaMappings]);

    // Filtrer les presta_raw disponibles (non associés)
    const availablePrestaRaw = useMemo(() => {
        return filteredPrestaRaw.filter(presta => !associatedPrestaRaw.has(presta.nom));
    }, [filteredPrestaRaw, associatedPrestaRaw]);

    // Gérer la sélection/désélection de tous les site_raw
    const handleSelectAllSiteRaw = (checked: boolean) => {
        if (checked) {
            setSelectedSiteRaw(new Set(availableSiteRaw.map(site => site.nom)));
        } else {
            setSelectedSiteRaw(new Set());
        }
    };

    // Gérer la sélection d'un site_raw individuel
    const handleSelectSiteRaw = (site: SiteRaw, checked: boolean) => {
        const newSelected = new Set(selectedSiteRaw);
        if (checked) {
            newSelected.add(site.nom);
        } else {
            newSelected.delete(site.nom);
        }
        setSelectedSiteRaw(newSelected);
    };

    // Gérer la sélection/désélection de tous les presta_raw
    const handleSelectAllPrestaRaw = (checked: boolean) => {
        if (checked) {
            setSelectedPrestaRaw(new Set(availablePrestaRaw.map(presta => presta.nom)));
        } else {
            setSelectedPrestaRaw(new Set());
        }
    };

    // Gérer la sélection d'un presta_raw individuel
    const handleSelectPrestaRaw = (presta: PrestaRaw, checked: boolean) => {
        const newSelected = new Set(selectedPrestaRaw);
        if (checked) {
            newSelected.add(presta.nom);
        } else {
            newSelected.delete(presta.nom);
        }
        setSelectedPrestaRaw(newSelected);
    };

    // Associer les site_raw sélectionnés au meta site
    const handleAssociateSites = async () => {
        if (!selectedMetaSite || selectedSiteRaw.size === 0) return;

        try {
            const newMappings = { ...siteMappings };
            const metaSiteKey = selectedMetaSite.value;
            
            // S'assurer que le meta site existe dans le mapping
            if (!newMappings[metaSiteKey]) {
                newMappings[metaSiteKey] = [];
            }
            
            // Ajouter les nouveaux site_raw au meta site
            const newSiteRaw = Array.from(selectedSiteRaw);
            newMappings[metaSiteKey] = [
                ...newMappings[metaSiteKey],
                ...newSiteRaw
            ];

            console.log('Nouveau mapping sites:', newMappings);
            await saveSiteMappings(newMappings);
            setSiteMappings(newMappings);
            setSelectedSiteRaw(new Set());
            setSelectedMetaSite(null);
            setError(null);
        } catch (err) {
            setError('Erreur lors de l\'association des sites');
            console.error(err);
        }
    };

    // Associer les presta_raw sélectionnés au meta presta
    const handleAssociatePrestas = async () => {
        if (!selectedMetaPresta || selectedPrestaRaw.size === 0) return;

        try {
            const newMappings = { ...prestaMappings };
            const metaPrestaKey = selectedMetaPresta.value;
            
            // S'assurer que le meta presta existe dans le mapping
            if (!newMappings[metaPrestaKey]) {
                newMappings[metaPrestaKey] = [];
            }
            
            // Ajouter les nouveaux presta_raw au meta presta
            const newPrestaRaw = Array.from(selectedPrestaRaw);
            newMappings[metaPrestaKey] = [
                ...newMappings[metaPrestaKey],
                ...newPrestaRaw
            ];

            console.log('Nouveau mapping prestas:', newMappings);
            await savePrestaMappings(newMappings);
            setPrestaMappings(newMappings);
            setSelectedPrestaRaw(new Set());
            setSelectedMetaPresta(null);
            setError(null);
        } catch (err) {
            setError('Erreur lors de l\'association des prestataires');
            console.error(err);
        }
    };

    // Supprimer une association
    const handleRemoveAssociation = async (metaSiteKey: string, siteRaw: string) => {
        try {
            const newMappings = { ...siteMappings };
            newMappings[metaSiteKey] = newMappings[metaSiteKey].filter(site => site !== siteRaw);
            
            if (newMappings[metaSiteKey].length === 0) {
                delete newMappings[metaSiteKey];
            }

            await saveSiteMappings(newMappings);
            setSiteMappings(newMappings);
            setError(null);
        } catch (err) {
            setError('Erreur lors de la suppression de l\'association site');
            console.error(err);
        }
    };

    // Supprimer une association presta
    const handleRemovePrestaAssociation = async (metaPrestaKey: string, prestaRaw: string) => {
        try {
            const newMappings = { ...prestaMappings };
            newMappings[metaPrestaKey] = newMappings[metaPrestaKey].filter(presta => presta !== prestaRaw);
            
            if (newMappings[metaPrestaKey].length === 0) {
                delete newMappings[metaPrestaKey];
            }

            await savePrestaMappings(newMappings);
            setPrestaMappings(newMappings);
            setError(null);
        } catch (err) {
            setError('Erreur lors de la suppression de l\'association prestataire');
            console.error(err);
        }
    };

    // Ouvrir le PDF dans une nouvelle fenêtre
    const handleOpenPdf = async (site: SiteRaw) => {
        try {
            // Récupérer les informations du PDF depuis pdf_infos
            const { data: pdfInfo, error: pdfError } = await supabase
                .from('pdf_infos')
                .select('name_pdf_in_bucket')
                .eq('id', site.pdf_id)
                .eq('entreprise_id', entreprise_id)
                .single();

            if (pdfError) {
                console.error('Erreur lors de la récupération des infos PDF:', pdfError);
                toast.error('Impossible de récupérer les informations du PDF');
                return;
            }

            if (!pdfInfo?.name_pdf_in_bucket) {
                toast.error('Nom du fichier PDF non trouvé');
                return;
            }

            // Créer l'URL signée
            const { data: urlData, error: urlError } = await supabase
                .storage
                .from('pdfs_bucket')
                .createSignedUrl(pdfInfo.name_pdf_in_bucket, 3600);

            if (urlError || !urlData?.signedUrl) {
                console.error('Erreur lors de la création de l\'URL:', urlError);
                toast.error('Impossible d\'ouvrir le fichier');
                return;
            }

            // Ouvrir le PDF dans une nouvelle fenêtre
            window.open(urlData.signedUrl, '_blank');
        } catch (err) {
            console.error('Erreur lors de l\'ouverture du PDF:', err);
            toast.error('Erreur lors de l\'ouverture du PDF');
        }
    };

    // Ouvrir le PDF pour un presta dans une nouvelle fenêtre
    const handleOpenPrestaPdf = async (presta: PrestaRaw) => {
        try {
            // Récupérer les informations du PDF depuis pdf_infos
            const { data: pdfInfo, error: pdfError } = await supabase
                .from('pdf_infos')
                .select('name_pdf_in_bucket')
                .eq('id', presta.pdf_id)
                .single();

            if (pdfError) {
                console.error('Erreur lors de la récupération des infos PDF:', pdfError);
                toast.error('Impossible de récupérer les informations du PDF');
                return;
            }

            if (!pdfInfo?.name_pdf_in_bucket) {
                toast.error('Nom du fichier PDF non trouvé');
                return;
            }

            // Créer l'URL signée
            const { data: urlData, error: urlError } = await supabase
                .storage
                .from('pdfs_bucket')
                .createSignedUrl(pdfInfo.name_pdf_in_bucket, 3600);

            if (urlError || !urlData?.signedUrl) {
                console.error('Erreur lors de la création de l\'URL:', urlError);
                toast.error('Impossible d\'ouvrir le fichier');
                return;
            }

            // Ouvrir le PDF dans une nouvelle fenêtre
            window.open(urlData.signedUrl, '_blank');
        } catch (err) {
            console.error('Erreur lors de l\'ouverture du PDF:', err);
            toast.error('Erreur lors de l\'ouverture du PDF');
        }
    };

    if (isLoading) return <div>Chargement...</div>;
    if (error) return <div className="text-red-500">{error}</div>;

    return (
        <div className="flex justify-center">
            <div className="bg-white rounded-lg shadow-lg p-8 w-[90%]">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Nettoyage des données</h2>
                <p className="text-gray-600 mb-6 px-10">
                    Associez les données brutes (sites et prestataires) aux données métas pour standardiser vos informations. 
                    Sélectionnez un meta puis cochez les données brutes à associer.
                </p>
                
                {/* Section Prestataires */}
                <div className="mb-12">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 px-10">Prestataires (Transporteurs et Destinataires)</h3>
                    <div className="grid grid-cols-2 gap-8 px-10">
                        {/* Colonne gauche - Presta_raw */}
                        <div className="space-y-4">
                            <h4 className="text-lg font-semibold text-gray-800">Prestataires bruts disponibles</h4>
                            
                            {/* Barre de recherche */}
                            <input
                                type="text"
                                placeholder="Rechercher dans les prestataires bruts..."
                                value={searchPrestaRaw}
                                onChange={(e) => setSearchPrestaRaw(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />

                            {/* Checkbox "Sélectionner tout" */}
                            {availablePrestaRaw.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedPrestaRaw.size === availablePrestaRaw.length}
                                        onChange={(e) => handleSelectAllPrestaRaw(e.target.checked)}
                                        className="form-checkbox h-4 w-4 text-blue-600"
                                    />
                                    <label className="text-sm text-gray-700">
                                        Sélectionner tout ({availablePrestaRaw.length})
                                    </label>
                                </div>
                            )}

                            {/* Liste des presta_raw */}
                            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
                                {availablePrestaRaw.length === 0 ? (
                                    <div className="p-4 text-gray-500 text-center">
                                        {searchPrestaRaw ? 'Aucun prestataire trouvé' : 'Aucun prestataire brut disponible'}
                                    </div>
                                ) : (
                                    <div className="space-y-1 p-2">
                                        {availablePrestaRaw.map((presta) => (
                                            <div key={presta.nom} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPrestaRaw.has(presta.nom)}
                                                    onChange={(e) => handleSelectPrestaRaw(presta, e.target.checked)}
                                                    className="form-checkbox h-4 w-4 text-blue-600"
                                                />
                                                <div className="flex items-center gap-2 flex-1">
                                                    <span className="text-sm text-gray-700">{presta.nom}</span>
                                                    <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">
                                                        Bon
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => handleOpenPrestaPdf(presta)}
                                                    className="text-blue-500 hover:text-blue-700 text-xs"
                                                    title="Ouvrir le PDF"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Colonne droite - Meta prestas et associations */}
                        <div className="space-y-4">
                            <h4 className="text-lg font-semibold text-gray-800">Prestataires métas et associations</h4>
                            
                            {/* Sélection du meta presta */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Sélectionner un prestataire meta :</label>
                                <Select
                                    isClearable
                                    value={selectedMetaPresta}
                                    onChange={(newValue) => setSelectedMetaPresta(newValue)}
                                    options={metaPrestaOptions}
                                    placeholder="Choisir un prestataire meta..."
                                    className="flex-1"
                                    classNamePrefix="select"
                                    noOptionsMessage={() => "Aucun prestataire meta trouvé"}
                                    onInputChange={(newValue) => setSearchMetaPresta(newValue)}
                                    inputValue={searchMetaPresta}
                                />
                                
                                {selectedMetaPresta && selectedPrestaRaw.size > 0 && (
                                    <button
                                        onClick={handleAssociatePrestas}
                                        className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                                    >
                                        Associer {selectedPrestaRaw.size} prestataire(s) à &quot;{selectedMetaPresta.label}&quot;
                                    </button>
                                )}
                            </div>

                            {/* Associations existantes */}
                            <div className="space-y-3">
                                <h5 className="text-md font-medium text-gray-700">Associations existantes :</h5>
                                {Object.keys(prestaMappings).length === 0 ? (
                                    <div className="text-gray-500 text-center p-4">
                                        Aucune association créée
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {Object.entries(prestaMappings).map(([metaPrestaKey, prestas]) => {
                                            const { nom, siret } = parseMetaPrestaKey(metaPrestaKey);
                                            const metaPresta = metaPrestas.find(mp => 
                                                mp.nom === nom && mp.siret === siret
                                            );
                                            return (
                                                <div key={metaPrestaKey} className="border border-gray-200 rounded-lg p-4">
                                                    <h6 className="font-semibold text-gray-800 mb-2">
                                                        {metaPresta?.nom || nom}
                                                        {siret && <span className="text-sm text-gray-500 ml-2">({siret})</span>}
                                                    </h6>
                                                    <div className="space-y-1">
                                                        {prestas.map((presta) => (
                                                            <div key={presta} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
                                                                <span className="text-sm text-gray-700">{presta}</span>
                                                                <button
                                                                    onClick={() => handleRemovePrestaAssociation(metaPrestaKey, presta)}
                                                                    className="text-red-500 hover:text-red-700"
                                                                    title="Supprimer l'association"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section Sites */}
                <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-4 px-10">Sites</h3>
                    <div className="grid grid-cols-2 gap-8 px-10">
                        {/* Colonne gauche - Site_raw */}
                        <div className="space-y-4">
                            <h4 className="text-lg font-semibold text-gray-800">Sites bruts disponibles</h4>
                        
                        {/* Barre de recherche */}
                        <input
                            type="text"
                            placeholder="Rechercher dans les sites bruts..."
                            value={searchSiteRaw}
                            onChange={(e) => setSearchSiteRaw(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        {/* Checkbox "Sélectionner tout" */}
                        {availableSiteRaw.length > 0 && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={selectedSiteRaw.size === availableSiteRaw.length}
                                    onChange={(e) => handleSelectAllSiteRaw(e.target.checked)}
                                    className="form-checkbox h-4 w-4 text-blue-600"
                                />
                                <label className="text-sm text-gray-700">
                                    Sélectionner tout ({availableSiteRaw.length})
                                </label>
                            </div>
                        )}

                        {/* Liste des site_raw */}
                        <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
                            {availableSiteRaw.length === 0 ? (
                                <div className="p-4 text-gray-500 text-center">
                                    {searchSiteRaw ? 'Aucun site trouvé' : 'Aucun site brut disponible'}
                                </div>
                            ) : (
                                <div className="space-y-1 p-2">
                                    {availableSiteRaw.map((site) => (
                                        <div key={site.nom} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                                            <input
                                                type="checkbox"
                                                checked={selectedSiteRaw.has(site.nom)}
                                                onChange={(e) => handleSelectSiteRaw(site, e.target.checked)}
                                                className="form-checkbox h-4 w-4 text-blue-600"
                                            />
                                            <div className="flex items-center gap-2 flex-1">
                                                <span className="text-sm text-gray-700">{site.nom}</span>
                                                <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">
                                                    Bon
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleOpenPdf(site)}
                                                className="text-blue-500 hover:text-blue-700 text-xs"
                                                title="Ouvrir le PDF"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Colonne droite - Meta sites et associations */}
                    <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-gray-800">Sites métas et associations</h4>
                        
                        {/* Sélection du meta site */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Sélectionner un site meta :</label>
                            <Select
                                isClearable
                                value={selectedMetaSite}
                                onChange={(newValue) => setSelectedMetaSite(newValue)}
                                options={metaSiteOptions}
                                placeholder="Choisir un site meta..."
                                className="flex-1"
                                classNamePrefix="select"
                                noOptionsMessage={() => "Aucun site meta trouvé"}
                                onInputChange={(newValue) => setSearchMetaSite(newValue)}
                                inputValue={searchMetaSite}
                            />
                            
                            {selectedMetaSite && selectedSiteRaw.size > 0 && (
                                <button
                                    onClick={handleAssociateSites}
                                    className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                                >
                                    Associer {selectedSiteRaw.size} site(s) à &quot;{selectedMetaSite.label}&quot;
                                </button>
                            )}
                        </div>

                        {/* Associations existantes */}
                        <div className="space-y-3">
                            <h4 className="text-md font-medium text-gray-700">Associations existantes :</h4>
                            {Object.keys(siteMappings).length === 0 ? (
                                <div className="text-gray-500 text-center p-4">
                                    Aucune association créée
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {Object.entries(siteMappings).map(([metaSiteKey, sites]) => {
                                        const { nom, siret } = parseMetaSiteKey(metaSiteKey);
                                        const metaSite = metaSites.find(ms => 
                                            ms.nom === nom && ms.siret === siret
                                        );
                                        return (
                                            <div key={metaSiteKey} className="border border-gray-200 rounded-lg p-4">
                                                <h5 className="font-semibold text-gray-800 mb-2">
                                                    {metaSite?.nom || nom}
                                                    {siret && <span className="text-sm text-gray-500 ml-2">({siret})</span>}
                                                </h5>
                                                <div className="space-y-1">
                                                    {sites.map((site) => (
                                                        <div key={site} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
                                                            <span className="text-sm text-gray-700">{site}</span>
                                                            <button
                                                                onClick={() => handleRemoveAssociation(metaSiteKey, site)}
                                                                className="text-red-500 hover:text-red-700"
                                                                title="Supprimer l'association"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                </div>
            </div>
        </div>
    );
}
