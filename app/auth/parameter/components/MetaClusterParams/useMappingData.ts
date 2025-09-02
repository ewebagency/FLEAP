import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { supabase } from '@/app/database/supabaseClient';
import { MAPPING_CONFIGS, MappingTypeConfig, MetaValue, RawValue, Mapping } from './mappingConfig';

// Fetcher pour SWR
const fetcher = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Erreur lors de la récupération des données');
    }
    return response.json();
};

// Fetcher pour Supabase
const supabaseFetcher = async (key: string) => {
    const [table, fieldPath, entreprise_id] = key.split('|');
    
    // Extraire le champ de base et le chemin
    let field: string;
    let path: string | undefined;
    
    if (fieldPath.includes('.')) {
        const parts = fieldPath.split('.');
        field = parts[0];
        path = parts.slice(1).join('.'); // Rejoindre le reste pour gérer les chemins complexes
    } else {
        field = fieldPath;
        path = undefined;
    }
    
    if (table === 'pdf_infos') {
        // Récupérer les valeurs brutes depuis pdf_infos.infos_raw
        const allRawValues: RawValue[] = [];
        let from = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('pdf_infos')
                .select(`id, infos_raw`)
                .eq('entreprise_id', entreprise_id)
                .range(from, from + limit - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                const rawValues = data
                    .map(item => {
                        // Vérifier que infos_raw n'est pas null
                        if (!item.infos_raw) {
                            console.warn('infos_raw is null for item:', item.id);
                            return [];
                        }
                        
                        const infosRaw = item.infos_raw as Record<string, unknown>;
                        const typeDoc = (infosRaw.type_doc as string) || 'inconnu';
                        
                        // Extraire les valeurs selon le type de champ
                        let rawValues: string[] = [];
                        
                        if (field === 'dechet' && infosRaw.dechet && Array.isArray(infosRaw.dechet)) {
                            // Pour les champs dans le tableau dechet
                            const dechetArray = infosRaw.dechet as Array<Record<string, unknown>>;
                            
                            // Utiliser le chemin spécifique passé en paramètre
                            if (path === 'nom') {
                                rawValues = dechetArray.map(d => d.nom as string).filter(Boolean);
                            } else if (path === 'contenant') {
                                rawValues = dechetArray.map(d => d.contenant as string).filter(Boolean);
                            } else if (path === 'facture.ligne.type_operation') {
                                // Extraire type_operation depuis facture.ligne
                                console.log('Extracting type_operation from:', dechetArray.length, 'dechets');
                                dechetArray.forEach(d => {
                                    if (d.facture && typeof d.facture === 'object') {
                                        const facture = d.facture as Record<string, unknown>;
                                        if (facture.ligne && Array.isArray(facture.ligne)) {
                                            const lignes = facture.ligne as Array<Record<string, unknown>>;
                                            console.log('Found', lignes.length, 'lignes in facture');
                                            lignes.forEach(ligne => {
                                                console.log('Ligne:', ligne);
                                                if (ligne.type_operation && typeof ligne.type_operation === 'string') {
                                                    console.log('Adding type_operation:', ligne.type_operation);
                                                    rawValues.push(ligne.type_operation);
                                                }
                                            });
                                        }
                                    }
                                });
                            } else if (path === 'facture.ligne.unite') {
                                // Extraire unite depuis facture.ligne
                                console.log('Extracting unite from:', dechetArray.length, 'dechets');
                                dechetArray.forEach(d => {
                                    if (d.facture && typeof d.facture === 'object') {
                                        const facture = d.facture as Record<string, unknown>;
                                        if (facture.ligne && Array.isArray(facture.ligne)) {
                                            const lignes = facture.ligne as Array<Record<string, unknown>>;
                                            console.log('Found', lignes.length, 'lignes in facture');
                                            lignes.forEach(ligne => {
                                                console.log('Ligne:', ligne);
                                                if (ligne.unite && typeof ligne.unite === 'string') {
                                                    console.log('Adding unite:', ligne.unite);
                                                    rawValues.push(ligne.unite);
                                                }
                                            });
                                        }
                                    }
                                });
                            }
                        } else {
                            // Pour les champs simples (site_raw, presta_raw)
                            const rawValue = infosRaw[field];
                            if (rawValue && typeof rawValue === 'string' && rawValue.trim()) {
                                rawValues = [rawValue];
                            }
                        }
                        
                        // Créer un objet pour chaque valeur trouvée
                        return rawValues.map(rawValue => ({
                            nom: rawValue,
                            typeDoc: typeDoc || 'inconnu',
                            pdfId: item.id,
                            pdf_id: item.id
                        }));
                    })
                    .flat() // Aplatir le tableau de tableaux
                    .filter(item => item.nom && item.nom.trim().length > 0)
                    .map(item => ({
                        nom: item.nom.trim(),
                        typeDoc: item.typeDoc,
                        pdfId: item.pdfId,
                        pdf_id: item.pdf_id
                    }));

                allRawValues.push(...rawValues);
                from += limit;
                hasMore = data.length === limit;
            } else {
                hasMore = false;
            }
        }

        // Dédupliquer par nom et calculer le type de document dominant
        const valueGroups = new Map<string, { values: RawValue[], typeCounts: Map<string, number> }>();
        
        allRawValues.forEach(item => {
            if (!valueGroups.has(item.nom)) {
                valueGroups.set(item.nom, { values: [], typeCounts: new Map() });
            }
            const group = valueGroups.get(item.nom)!;
            group.values.push(item);
            
            // Compter les types de documents
            const currentCount = group.typeCounts.get(item.typeDoc) || 0;
            group.typeCounts.set(item.typeDoc, currentCount + 1);
        });

        // Créer les valeurs uniques avec le type dominant
        const uniqueValues: RawValue[] = Array.from(valueGroups.entries()).map(([nom, group]) => {
            // Trouver le type de document le plus fréquent
            let dominantType = 'inconnu';
            let maxCount = 0;
            
            group.typeCounts.forEach((count, type) => {
                if (count > maxCount) {
                    maxCount = count;
                    dominantType = type;
                }
            });

            // Prendre le premier PDF pour les autres infos
            const firstValue = group.values[0];
            return {
                nom,
                typeDoc: dominantType,
                pdfId: firstValue.pdfId,
                pdf_id: firstValue.pdf_id
            };
        });

        return uniqueValues.sort((a, b) => a.nom.localeCompare(b.nom));
    } else if (table === 'table_autocompletion') {
        // Récupérer les valeurs métas selon le champ
        if (field === 'site') {
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
        } else if (field === 'presta') {
            // Pour les prestataires, on combine transporteurs et destinataires
            const { data: destData, error: destError } = await supabase
                .from('table_autocompletion')
                .select('id, destinataire->>nomBoite, destinataire->>siret')
                .not('destinataire->>nomBoite', 'is', null)
                .eq('entreprise_id', entreprise_id);

            if (destError) throw destError;

            const { data: transpData, error: transpError } = await supabase
                .from('table_autocompletion')
                .select('id, transporteur->>nomBoite, transporteur->>siret')
                .not('transporteur->>nomBoite', 'is', null)
                .eq('entreprise_id', entreprise_id);

            if (transpError) throw transpError;

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
            const uniquePrestas = new Map<string, MetaValue>();
            allPrestas.forEach(presta => {
                const key = `${presta.nom}|${presta.siret}`;
                if (!uniquePrestas.has(key)) {
                    uniquePrestas.set(key, presta);
                }
            });

            return Array.from(uniquePrestas.values()).sort((a, b) => a.nom.localeCompare(b.nom));
        } else if (field === 'dechet') {
            const { data, error } = await supabase
                .from('table_autocompletion')
                .select('id, dechet->>nom, dechet->>codeCED')
                .not('dechet->>nom', 'is', null)
                .eq('entreprise_id', entreprise_id);

            if (error) throw error;

            return data.map(item => ({
                id: item.id,
                nom: item.nom,
                code: item.codeCED || ''
            })).sort((a, b) => a.nom.localeCompare(b.nom));
        } else if (field === 'contenant') {
            const { data, error } = await supabase
                .from('table_autocompletion')
                .select('id, contenant->>nom')
                .not('contenant->>nom', 'is', null)
                .eq('entreprise_id', entreprise_id);

            if (error) throw error;

            return data.map(item => ({
                id: item.id,
                nom: item.nom
            })).sort((a, b) => a.nom.localeCompare(b.nom));
        }
    } else if (table === 'entreprise') {
        // Récupérer les mappings existants
        const { data, error } = await supabase
            .from('entreprise')
            .select(field)
            .eq('id', entreprise_id)
            .single();

        if (error) {
            console.warn(`Erreur lors de la récupération du mapping ${field}:`, error);
            return {};
        }
        
        if (data && typeof data === 'object' && field in data) {
            const mappings = (data as Record<string, unknown>)[field];
            if (typeof mappings === 'object' && mappings !== null) {
                return mappings as Mapping;
            }
        }
        
        console.warn(`Format de mapping incorrect pour ${field}, retour d'un objet vide`);
        return {};
    }
    
    throw new Error(`Type de table non supporté: ${table}`);
};

export const useMappingData = (entreprise_id: string | undefined) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // SWR pour les valeurs brutes
    const rawValuesSWR = useSWR(
        entreprise_id ? MAPPING_CONFIGS.map(config => {
            // Créer une clé unique qui inclut le chemin d'extraction
            const path = config.rawFieldPath ? `${config.rawField}.${config.rawFieldPath}` : config.rawField;
            return `pdf_infos|${path}|${entreprise_id}`;
        }) : null,
        async (keys) => {
            const results = await Promise.all(
                keys.map(key => supabaseFetcher(key))
            );
            
            const rawValuesMap: Record<string, RawValue[]> = {};
            MAPPING_CONFIGS.forEach((config, index) => {
                rawValuesMap[config.key] = results[index] as RawValue[];
            });
            
            return rawValuesMap;
        },
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
            refreshInterval: 0,
            onError: (err) => {
                console.error('Erreur SWR raw values:', err);
                setError('Erreur lors du chargement des valeurs brutes');
            }
        }
    );

    // SWR pour les valeurs métas (autocompletion)
    const metaValuesSWR = useSWR(
        entreprise_id ? MAPPING_CONFIGS.filter(config => config.metaSource === 'autocompletion').map(config => `table_autocompletion|${config.metaField}|${entreprise_id}`) : null,
        async (keys) => {
            const results = await Promise.all(
                keys.map(key => supabaseFetcher(key))
            );
            
            const metaValuesMap: Record<string, MetaValue[]> = {};
            MAPPING_CONFIGS.filter(config => config.metaSource === 'autocompletion').forEach((config, index) => {
                metaValuesMap[config.key] = results[index] as MetaValue[];
            });
            
            // Ajouter les valeurs codées en dur
            MAPPING_CONFIGS.filter(config => config.metaSource === 'hardcoded').forEach(config => {
                metaValuesMap[config.key] = config.hardcodedValues?.map((value, index) => ({
                    id: `hardcoded_${index}`,
                    nom: value
                })) || [];
            });
            
            // Ajouter des valeurs vides pour les mappings de type 'database' (seront remplies plus tard)
            MAPPING_CONFIGS.filter(config => config.metaSource === 'database').forEach(config => {
                metaValuesMap[config.key] = [];
            });
            
            // Ajouter des valeurs vides pour les mappings de type 'dynamic' (seront remplies plus tard)
            MAPPING_CONFIGS.filter(config => config.metaSource === 'dynamic').forEach(config => {
                metaValuesMap[config.key] = [];
            });
            
            return metaValuesMap;
        },
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
            refreshInterval: 0,
            onError: (err) => {
                console.error('Erreur SWR meta values:', err);
                setError('Erreur lors du chargement des valeurs métas');
            }
        }
    );

    // SWR pour les mappings existants (uniquement pour les mappings non-hardcoded)
    const mappingsSWR = useSWR(
        entreprise_id ? MAPPING_CONFIGS.filter(config => config.metaSource !== 'hardcoded').map(config => `entreprise|${config.key}|${entreprise_id}`) : null,
        async (keys) => {
            const results = await Promise.all(
                keys.map(key => supabaseFetcher(key))
            );
            
            const mappingsMap: Record<string, Mapping> = {};
            
            // Traiter les mappings non-hardcoded depuis la base de données
            MAPPING_CONFIGS.filter(config => config.metaSource !== 'hardcoded').forEach((config, index) => {
                mappingsMap[config.key] = results[index] as Mapping;
            });
            
            // Créer les mappings hardcoded en local
            MAPPING_CONFIGS.filter(config => config.metaSource === 'hardcoded').forEach(config => {
                const hardcodedMapping: Mapping = {};
                config.hardcodedValues?.forEach(value => {
                    hardcodedMapping[value] = [value]; // Auto-association par défaut
                });
                mappingsMap[config.key] = hardcodedMapping;
            });
            
            return mappingsMap;
        },
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
            refreshInterval: 0,
            onError: (err) => {
                console.error('Erreur SWR mappings:', err);
                setError('Erreur lors du chargement des mappings');
            }
        }
    );

    // Gestion du loading global
    useEffect(() => {
        const isLoadingGlobal = 
            (rawValuesSWR.isLoading || rawValuesSWR.isValidating) ||
            (metaValuesSWR.isLoading || metaValuesSWR.isValidating) ||
            (mappingsSWR.isLoading || mappingsSWR.isValidating);
        
        setIsLoading(isLoadingGlobal);
    }, [rawValuesSWR.isLoading, rawValuesSWR.isValidating, metaValuesSWR.isLoading, metaValuesSWR.isValidating, mappingsSWR.isLoading, mappingsSWR.isValidating]);

    // Gestion des erreurs
    useEffect(() => {
        if (rawValuesSWR.error || metaValuesSWR.error || mappingsSWR.error) {
            setError('Erreur lors du chargement des données');
        } else {
            setError(null);
        }
    }, [rawValuesSWR.error, metaValuesSWR.error, mappingsSWR.error]);

    // Mettre à jour les valeurs métas pour les mappings de type 'database' et 'dynamic'
    useEffect(() => {
        if (mappingsSWR.data && metaValuesSWR.data) {
            const updatedMetaValues = { ...metaValuesSWR.data };
            let hasChanges = false;

            MAPPING_CONFIGS.filter(config => config.metaSource === 'database' || config.metaSource === 'dynamic').forEach(config => {
                const mapping = (mappingsSWR.data || {})[config.key] || {};
                const metaValues = Object.keys(mapping).map((key, index) => ({
                    id: `dynamic_${index}`,
                    nom: key
                }));
                
                if (JSON.stringify(updatedMetaValues[config.key]) !== JSON.stringify(metaValues)) {
                    updatedMetaValues[config.key] = metaValues;
                    hasChanges = true;
                }
            });

            if (hasChanges) {
                // Mise à jour silencieuse sans déclencher de re-render
                metaValuesSWR.mutate(updatedMetaValues, false);
            }
        }
    }, [mappingsSWR.data, metaValuesSWR.data]);

    // Sauvegarder un mapping avec optimistic update
    const saveMapping = async (config: MappingTypeConfig, mapping: Mapping): Promise<void> => {
        try {
            if (!entreprise_id) {
                throw new Error('ID de l\'entreprise non trouvé');
            }

            // Optimistic update immédiat
            const currentMappings = mappingsSWR.data || {};
            const optimisticMappings = { ...currentMappings, [config.key]: mapping };
            
            // Mettre à jour le cache SWR immédiatement sans revalidation
            mappingsSWR.mutate(optimisticMappings, false);

            // Sauvegarder en base en arrière-plan
            const updateData = { [config.key]: mapping };
            const { error } = await supabase
                .from('entreprise')
                .update(updateData)
                .eq('id', entreprise_id);

            if (error) {
                // En cas d'erreur, revalider pour revenir à l'état précédent
                mappingsSWR.mutate();
                throw error;
            }

            // Revalidation silencieuse en arrière-plan pour s'assurer de la cohérence
            setTimeout(() => {
                mappingsSWR.mutate();
            }, 100);
        } catch (err) {
            console.error(`Erreur lors de la sauvegarde du mapping ${config.key}:`, err);
            throw err;
        }
    };

    return {
        rawValues: rawValuesSWR.data || {},
        metaValues: metaValuesSWR.data || {},
        mappings: mappingsSWR.data || {},
        isLoading,
        error,
        saveMapping,
        mutate: {
            rawValues: rawValuesSWR.mutate,
            metaValues: metaValuesSWR.mutate,
            mappings: mappingsSWR.mutate
        }
    };
};
