import { supabase } from '@/app/database/supabaseClient';

// Types pour les paramètres de mapping
interface ParamsMapping {
    params_mapping_site: Record<string, string[]>;
    params_mapping_presta: Record<string, string[]>;
    params_mapping_nom_dechet: Record<string, string[]>;
    params_mapping_operation: Record<string, string[]>;
    params_mapping_unite: Record<string, string[]>;
    params_mapping_contenant: Record<string, string[]>;
}

// Types pour les données extraites du PDF
interface DechetData {
    nom?: string;
    contenant?: string;
    facture?: {
        ligne?: {
            type_operation?: string;
            unite?: string;
        };
    };
}

interface InfosRaw {
    site_raw?: string;
    presta_raw?: string;
    dechet?: DechetData[];
}

// Interface pour le résultat de vérification
interface VerificationResult {
    hasTranslation: boolean;
    missingFields: {
        site_raw?: boolean;
        presta_raw?: boolean;
        dechets: string[];
        operations: string[];
        unites: string[];
        contenants: string[];
    };
    details: {
        site_raw?: { value: string; hasMapping: boolean };
        presta_raw?: { value: string; hasMapping: boolean };
        dechets?: Array<{ value: string; hasMapping: boolean }>;
        operations?: Array<{ value: string; hasMapping: boolean }>;
        unites?: Array<{ value: string; hasMapping: boolean }>;
        contenants?: Array<{ value: string; hasMapping: boolean }>;
    };
}

/**
 * Vérifie si les données extraites d'un PDF ont des traductions dans les paramètres de mapping de l'entreprise
 * @param pdfId - L'ID du PDF à vérifier
 * @param entrepriseId - L'ID de l'entreprise
 * @returns Promise<VerificationResult> - Résultat de la vérification
 */
export const verifierTraductionsPDF = async (
    pdfId: string,
    entrepriseId: string
): Promise<VerificationResult> => {
    try {
        // Récupérer les données du PDF
        const { data: pdfData, error: pdfError } = await supabase
            .from('pdf_infos')
            .select('infos_raw')
            .eq('id', pdfId)
            .eq('entreprise_id', entrepriseId)
            .single();

        if (pdfError || !pdfData) {
            throw new Error(`Erreur lors de la récupération du PDF: ${pdfError?.message || 'PDF non trouvé'}`);
        }

        const infosRaw = pdfData.infos_raw as InfosRaw;
        if (!infosRaw) {
            throw new Error('Aucune donnée extraite trouvée pour ce PDF');
        }

        // Récupérer tous les paramètres de mapping de l'entreprise
        const { data: entrepriseData, error: entrepriseError } = await supabase
            .from('entreprise')
            .select(`
                params_mapping_site,
                params_mapping_presta,
                params_mapping_nom_dechet,
                params_mapping_operation,
                params_mapping_unite,
                params_mapping_contenant
            `)
            .eq('id', entrepriseId)
            .single();

        if (entrepriseError || !entrepriseData) {
            throw new Error(`Erreur lors de la récupération des mappings: ${entrepriseError?.message || 'Entreprise non trouvée'}`);
        }

        const paramsMapping: ParamsMapping = {
            params_mapping_site: entrepriseData.params_mapping_site || {},
            params_mapping_presta: entrepriseData.params_mapping_presta || {},
            params_mapping_nom_dechet: entrepriseData.params_mapping_nom_dechet || {},
            params_mapping_operation: entrepriseData.params_mapping_operation || {},
            params_mapping_unite: entrepriseData.params_mapping_unite || {},
            params_mapping_contenant: entrepriseData.params_mapping_contenant || {}
        };

        // Fonction utilitaire pour vérifier si une valeur a un mapping
        const hasMapping = (value: string, mapping: Record<string, string[]>): boolean => {
            if (!value || !mapping) return false;
            const normalizedValue = value.trim().toLowerCase();
            return Object.keys(mapping).some(key => 
                key.toLowerCase() === normalizedValue || 
                mapping[key].some(mappedValue => mappedValue.toLowerCase() === normalizedValue)
            );
        };

        // Vérifier site_raw
        const siteRawValue = infosRaw.site_raw;
        const siteRawHasMapping = siteRawValue ? hasMapping(siteRawValue, paramsMapping.params_mapping_site) : true;

        // Vérifier presta_raw
        const prestaRawValue = infosRaw.presta_raw;
        const prestaRawHasMapping = prestaRawValue ? hasMapping(prestaRawValue, paramsMapping.params_mapping_presta) : true;

        // Vérifier les déchets, opérations, unités et contenants
        const dechets: Array<{ value: string; hasMapping: boolean }> = [];
        const operations: Array<{ value: string; hasMapping: boolean }> = [];
        const unites: Array<{ value: string; hasMapping: boolean }> = [];
        const contenants: Array<{ value: string; hasMapping: boolean }> = [];

        if (infosRaw.dechet && Array.isArray(infosRaw.dechet)) {
            infosRaw.dechet.forEach(dechet => {
                // Vérifier nom du déchet
                if (dechet.nom) {
                    const hasDechetMapping = hasMapping(dechet.nom, paramsMapping.params_mapping_nom_dechet);
                    dechets.push({ value: dechet.nom, hasMapping: hasDechetMapping });
                }

                // Vérifier contenant
                if (dechet.contenant) {
                    const hasContenantMapping = hasMapping(dechet.contenant, paramsMapping.params_mapping_contenant);
                    contenants.push({ value: dechet.contenant, hasMapping: hasContenantMapping });
                }

                // Vérifier opération (dans facture.ligne.type_operation)
                if (dechet.facture?.ligne?.type_operation) {
                    const hasOperationMapping = hasMapping(dechet.facture.ligne.type_operation, paramsMapping.params_mapping_operation);
                    operations.push({ value: dechet.facture.ligne.type_operation, hasMapping: hasOperationMapping });
                }

                // Vérifier unité (dans facture.ligne.unite)
                if (dechet.facture?.ligne?.unite) {
                    const hasUniteMapping = hasMapping(dechet.facture.ligne.unite, paramsMapping.params_mapping_unite);
                    unites.push({ value: dechet.facture.ligne.unite, hasMapping: hasUniteMapping });
                }
            });
        }

        // Déterminer les champs manquants
        const missingFields = {
            site_raw: siteRawValue ? !siteRawHasMapping : false,
            presta_raw: prestaRawValue ? !prestaRawHasMapping : false,
            dechets: dechets.filter(d => !d.hasMapping).map(d => d.value),
            operations: operations.filter(o => !o.hasMapping).map(o => o.value),
            unites: unites.filter(u => !u.hasMapping).map(u => u.value),
            contenants: contenants.filter(c => !c.hasMapping).map(c => c.value)
        };

        // Vérifier s'il y a au moins une traduction manquante
        const hasTranslation = 
            siteRawHasMapping && 
            prestaRawHasMapping && 
            dechets.every(d => d.hasMapping) &&
            operations.every(o => o.hasMapping) &&
            unites.every(u => u.hasMapping) &&
            contenants.every(c => c.hasMapping);

        return {
            hasTranslation,
            missingFields,
            details: {
                site_raw: siteRawValue ? { value: siteRawValue, hasMapping: siteRawHasMapping } : undefined,
                presta_raw: prestaRawValue ? { value: prestaRawValue, hasMapping: prestaRawHasMapping } : undefined,
                dechets: dechets.length > 0 ? dechets : undefined,
                operations: operations.length > 0 ? operations : undefined,
                unites: unites.length > 0 ? unites : undefined,
                contenants: contenants.length > 0 ? contenants : undefined
            }
        };

    } catch (error) {
        console.error('Erreur lors de la vérification des traductions:', error);
        throw error;
    }
};

/**
 * Fonction utilitaire pour obtenir un résumé des traductions manquantes
 * @param result - Résultat de la vérification
 * @returns string - Résumé des traductions manquantes
 */
export const getResumeTraductionsManquantes = (result: VerificationResult): string => {
    const missing = [];
    
    if (result.missingFields.site_raw) {
        missing.push(`Site: "${result.details.site_raw?.value}"`);
    }
    
    if (result.missingFields.presta_raw) {
        missing.push(`Prestataire: "${result.details.presta_raw?.value}"`);
    }
    
    if (result.missingFields.dechets.length > 0) {
        missing.push(`Déchets: ${result.missingFields.dechets.map(d => `"${d}"`).join(', ')}`);
    }
    
    if (result.missingFields.operations.length > 0) {
        missing.push(`Opérations: ${result.missingFields.operations.map(o => `"${o}"`).join(', ')}`);
    }
    
    if (result.missingFields.unites.length > 0) {
        missing.push(`Unités: ${result.missingFields.unites.map(u => `"${u}"`).join(', ')}`);
    }
    
    if (result.missingFields.contenants.length > 0) {
        missing.push(`Contenants: ${result.missingFields.contenants.map(c => `"${c}"`).join(', ')}`);
    }
    
    if (missing.length === 0) {
        return "Toutes les traductions sont disponibles";
    }
    
    return `Traductions manquantes: ${missing.join('; ')}`;
};

/**
 * Met à jour la colonne alerte de la base de données en fonction du résultat de la vérification des traductions
 * @param pdfId - L'ID du PDF à mettre à jour
 * @param entrepriseId - L'ID de l'entreprise
 * @param verificationResult - Le résultat de la vérification des traductions
 * @returns Promise<void>
 */
export const mettreAJourAlerteTraductions = async (
    pdfId: string,
    entrepriseId: string,
    verificationResult: VerificationResult
): Promise<void> => {
    try {
        // Construire le message d'alerte
        let message = "";
        let stop = false;

        if (!verificationResult.hasTranslation) {
            stop = true;
            const missingMessages = [];

            // Site manquant
            if (verificationResult.missingFields.site_raw) {
                missingMessages.push(`Site "${verificationResult.details.site_raw?.value}" non reconnu`);
            }

            // Prestataire manquant
            if (verificationResult.missingFields.presta_raw) {
                missingMessages.push(`Prestataire "${verificationResult.details.presta_raw?.value}" non reconnu`);
            }

            // Déchets manquants
            if (verificationResult.missingFields.dechets.length > 0) {
                const dechetsNonReconnus = verificationResult.missingFields.dechets.map(d => `"${d}"`).join(', ');
                missingMessages.push(`Déchet(s) non reconnu(s): ${dechetsNonReconnus}`);
            }

            // Opérations manquantes
            if (verificationResult.missingFields.operations.length > 0) {
                const operationsNonReconnues = verificationResult.missingFields.operations.map(o => `"${o}"`).join(', ');
                missingMessages.push(`Opération(s) non reconnue(s): ${operationsNonReconnues}`);
            }

            // Unités manquantes
            if (verificationResult.missingFields.unites.length > 0) {
                const unitesNonReconnues = verificationResult.missingFields.unites.map(u => `"${u}"`).join(', ');
                missingMessages.push(`Unité(s) non reconnue(s): ${unitesNonReconnues}`);
            }

            // Contenants manquants
            if (verificationResult.missingFields.contenants.length > 0) {
                const contenantsNonReconnus = verificationResult.missingFields.contenants.map(c => `"${c}"`).join(', ');
                missingMessages.push(`Contenant(s) non reconnu(s): ${contenantsNonReconnus}`);
            }

            message = missingMessages.join('; ');
        } else {
            // Toutes les traductions sont disponibles
            stop = false;
            message = "";
        }

        // Mettre à jour la colonne alerte dans la base de données
        const { error } = await supabase
            .from('pdf_infos')
            .update({
                alerte: {
                    stop,
                    message
                }
            })
            .eq('id', pdfId)
            .eq('entreprise_id', entrepriseId);

        if (error) {
            throw new Error(`Erreur lors de la mise à jour de l'alerte: ${error.message}`);
        }

        console.log(`Alerte mise à jour pour le PDF ${pdfId}:`, { stop, message });

    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'alerte:', error);
        throw error;
    }
};

/**
 * Fonction combinée qui vérifie les traductions et met à jour l'alerte en une seule opération
 * @param pdfId - L'ID du PDF à vérifier et mettre à jour
 * @param entrepriseId - L'ID de l'entreprise
 * @returns Promise<VerificationResult> - Résultat de la vérification
 */
export const verifierEtMettreAJourAlerte = async (
    pdfId: string,
    entrepriseId: string
): Promise<VerificationResult> => {
    try {
        // Vérifier les traductions
        const verificationResult = await verifierTraductionsPDF(pdfId, entrepriseId);
        
        // Mettre à jour l'alerte
        await mettreAJourAlerteTraductions(pdfId, entrepriseId, verificationResult);
        
        return verificationResult;
    } catch (error) {
        console.error('Erreur lors de la vérification et mise à jour de l\'alerte:', error);
        throw error;
    }
};
