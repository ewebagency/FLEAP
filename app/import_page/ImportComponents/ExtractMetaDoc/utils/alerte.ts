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
    tonnage?: string | number;
    date?: string;
    num_bsd?: string;
    num_bon?: string;
    ced?: string;
    facture?: {
        ligne?: {
            type_operation?: string;
            unite?: string;
        } | Array<{
            type_operation?: string;
            unite?: string;
            quantite?: number;
            prix_unitaire?: number;
            montant_ht?: number;
        }>;
    };
}

interface InfosRaw {
    site_raw?: string;
    presta_raw?: string;
    type_doc?: string;
    num_facture?: string;
    montant_total_ht?: number;
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

// Interface pour le résultat d'une alerte
interface AlerteResult {
    hasError: boolean;
    message: string;
}

// ===== FONCTIONS D'ALERTE MODULAIRES =====

/**
 * Vérifie si le tonnage est un nombre valide entre 0 et 50
 */
export const alerteTonnage = (tonnageStr: string | number | undefined): AlerteResult => {
    if (!tonnageStr || String(tonnageStr).trim() === "") {
        return { hasError: true, message: "Tonnage manquant" };
    }
    
    try {
        // Nettoyer la chaîne (enlever espaces, virgules, etc.)
        const tonnageClean = String(tonnageStr).replace(',', '.').replace(/\s/g, '').trim();
        const tonnageFloat = parseFloat(tonnageClean);
        
        if (isNaN(tonnageFloat)) {
            return { hasError: true, message: `Tonnage non numérique: ${tonnageStr}` };
        }
        
        if (tonnageFloat < 0) {
            return { hasError: true, message: `Tonnage négatif: ${tonnageFloat}` };
        } else if (tonnageFloat > 50) {
            return { hasError: true, message: `Tonnage trop élevé: ${tonnageFloat} (max: 50)` };
        } else {
            return { hasError: false, message: "" };
        }
    } catch {
        return { hasError: true, message: `Tonnage non numérique: ${tonnageStr}` };
    }
};

/**
 * Vérifie la présence d'une date valide
 */
export const alerteDate = (dateStr: string | undefined): AlerteResult => {
    if (!dateStr || String(dateStr).trim() === "") {
        return { hasError: true, message: "Date manquante" };
    }
    
    // Vérifier si la date contient au moins des chiffres
    if (!/\d/.test(String(dateStr))) {
        return { hasError: true, message: `Date invalide (pas de chiffres): ${dateStr}` };
    }
    
    return { hasError: false, message: "" };
};

/**
 * Vérifie qu'un numéro BSD contient au moins 5 chiffres consécutifs
 */
export const alerteNumBsd = (numBsd: string | undefined): AlerteResult => {
    if (!numBsd || String(numBsd).trim() === "") {
        return { hasError: true, message: "Numéro BSD manquant" };
    }
    
    // Extraire tous les chiffres
    const chiffres = String(numBsd).replace(/\D/g, '');
    
    if (chiffres.length < 5) {
        return { hasError: true, message: `Numéro BSD insuffisant (moins de 5 chiffres): ${numBsd}` };
    }
    
    return { hasError: false, message: "" };
};

/**
 * Vérifie qu'un numéro de bon contient au moins 5 chiffres consécutifs
 */
export const alerteNumBon = (numBon: string | undefined): AlerteResult => {
    if (!numBon || String(numBon).trim() === "") {
        return { hasError: true, message: "Numéro de bon manquant" };
    }
    
    // Extraire tous les chiffres
    const chiffres = String(numBon).replace(/\D/g, '');
    
    if (chiffres.length < 5) {
        return { hasError: true, message: `Numéro de bon insuffisant (moins de 5 chiffres): ${numBon}` };
    }
    
    return { hasError: false, message: "" };
};

/**
 * Vérifie qu'un numéro de facture contient au moins 5 chiffres consécutifs
 */
export const alerteNumFacture = (numFacture: string | undefined): AlerteResult => {
    if (!numFacture || String(numFacture).trim() === "") {
        return { hasError: true, message: "Numéro de facture manquant" };
    }
    
    // Extraire tous les chiffres
    const chiffres = String(numFacture).replace(/\D/g, '');
    
    if (chiffres.length < 5) {
        return { hasError: true, message: `Numéro de facture insuffisant (moins de 5 chiffres): ${numFacture}` };
    }
    
    return { hasError: false, message: "" };
};

/**
 * Vérifie qu'un code CED contient exactement 6 chiffres
 */
export const alerteCed = (cedCode: string | undefined): AlerteResult => {
    if (!cedCode || String(cedCode).trim() === "") {
        return { hasError: true, message: "Code CED manquant" };
    }
    
    // Extraire tous les chiffres
    const chiffres = String(cedCode).replace(/\D/g, '');
    
    if (chiffres.length !== 6) {
        return { hasError: true, message: `Code CED invalide (doit contenir exactement 6 chiffres): ${cedCode} (trouvé: ${chiffres.length})` };
    }
    
    return { hasError: false, message: "" };
};

/**
 * Vérifie que quantité × prix_unitaire = montant (avec tolérance)
 */
export const alerteCalculFacture = (
    quantite: number | undefined,
    prixUnitaire: number | undefined,
    montant: number | undefined
): AlerteResult => {
    if (quantite === undefined || prixUnitaire === undefined || montant === undefined) {
        return { hasError: false, message: "" };
    }
    
    try {
        const calculAttendu = quantite * prixUnitaire;
        // Tolérance de 0.01 pour les erreurs d'arrondi
        if (Math.abs(calculAttendu - montant) > 0.01) {
            return { 
                hasError: true, 
                message: `Calcul incorrect: ${quantite} × ${prixUnitaire} = ${calculAttendu} ≠ ${montant}` 
            };
        }
        return { hasError: false, message: "" };
    } catch {
        return { 
            hasError: true, 
            message: `Valeurs non numériques: qty=${quantite}, prix=${prixUnitaire}, montant=${montant}` 
        };
    }
};

/**
 * Vérifie que la somme des montants des prestations = montant_total
 */
export const alerteSommeFacture = (
    prestations: Array<{ montant_ht?: number }> | undefined,
    montantTotal: number | undefined
): AlerteResult => {
    if (!prestations || !montantTotal) {
        return { hasError: false, message: "" };
    }
    
    try {
        let sommeCalculee = 0;
        for (const presta of prestations) {
            if (presta.montant_ht !== undefined) {
                try {
                    sommeCalculee += Number(presta.montant_ht);
                } catch {
                    continue;
                }
            }
        }
        
        // Tolérance de 0.01 pour les erreurs d'arrondi
        if (Math.abs(sommeCalculee - montantTotal) > 0.01) {
            return { 
                hasError: true, 
                message: `Somme incorrecte: ${sommeCalculee} ≠ ${montantTotal}` 
            };
        }
        return { hasError: false, message: "" };
    } catch {
        return { 
            hasError: true, 
            message: `Erreur de calcul de somme: prestations=${prestations}, total=${montantTotal}` 
        };
    }
};

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
                /*if (dechet.nom) {
                    const hasDechetMapping = hasMapping(dechet.nom, paramsMapping.params_mapping_nom_dechet);
                    dechets.push({ value: dechet.nom, hasMapping: hasDechetMapping });
                }*/

                // Vérifier contenant
                if (dechet.contenant) {
                    const hasContenantMapping = hasMapping(dechet.contenant, paramsMapping.params_mapping_contenant);
                    contenants.push({ value: dechet.contenant, hasMapping: hasContenantMapping });
                }

                // Vérifier opération (dans facture.ligne.type_operation)
                const ligne = dechet.facture?.ligne;
                if (ligne && !Array.isArray(ligne)) {
                    if (ligne.type_operation) {
                        const hasOperationMapping = hasMapping(ligne.type_operation, paramsMapping.params_mapping_operation);
                        operations.push({ value: ligne.type_operation, hasMapping: hasOperationMapping });
                    }

                    // Vérifier unité (dans facture.ligne.unite)
                    if (ligne.unite) {
                        const hasUniteMapping = hasMapping(ligne.unite, paramsMapping.params_mapping_unite);
                        unites.push({ value: ligne.unite, hasMapping: hasUniteMapping });
                    }
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
    
    /*if (result.missingFields.dechets.length > 0) {
        missing.push(`Déchets: ${result.missingFields.dechets.map(d => `"${d}"`).join(', ')}`);
    }*/
    
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
        // Récupérer les données du PDF pour les validations supplémentaires
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
        
        // Construire le message d'alerte
        let message = "";
        let stop = false;
        const missingMessages: string[] = [];

        // === ALERTES DE TRADUCTION ===
        if (!verificationResult.hasTranslation) {
            stop = true;

            // Site manquant
            if (verificationResult.missingFields.site_raw) {
                missingMessages.push(`Site "${verificationResult.details.site_raw?.value}" non reconnu`);
            }

            // Prestataire manquant
            if (verificationResult.missingFields.presta_raw) {
                missingMessages.push(`Prestataire "${verificationResult.details.presta_raw?.value}" non reconnu`);
            }

            // Déchets manquants
            /*if (verificationResult.missingFields.dechets.length > 0) {
                const dechetsNonReconnus = verificationResult.missingFields.dechets.map(d => `"${d}"`).join(', ');
                missingMessages.push(`Déchet(s) non reconnu(s): ${dechetsNonReconnus}`);
            }*/

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
        }

        // === NOUVELLES ALERTES MODULAIRES ===
        // Flags pour activer/désactiver les alertes
        const ENABLE_ALERTE_TONNAGE = true;
        const ENABLE_ALERTE_DATE = true;
        const ENABLE_ALERTE_NUM_BSD = true;
        const ENABLE_ALERTE_NUM_BON = true;
        const ENABLE_ALERTE_NUM_FACTURE = true;
        const ENABLE_ALERTE_CED = false;
        const ENABLE_ALERTE_CALCUL_FACTURE = true;
        const ENABLE_ALERTE_SOMME_FACTURE = true;

        if (infosRaw && infosRaw.dechet && Array.isArray(infosRaw.dechet)) {
            const typeDoc = infosRaw.type_doc;
            const dechets = infosRaw.dechet;

            // Alerte tonnage pour tous les déchets
            if (ENABLE_ALERTE_TONNAGE) {
                for (const dechet of dechets) {
                    if (dechet.tonnage !== undefined) {
                        const result = alerteTonnage(dechet.tonnage);
                        if (result.hasError) {
                            stop = true;
                            missingMessages.push(`Tonnage: ${result.message}`);
                        }
                    }
                }
            }

            // Alerte date pour tous les déchets
            if (ENABLE_ALERTE_DATE) {
                for (const dechet of dechets) {
                    if (dechet.date !== undefined) {
                        const result = alerteDate(dechet.date);
                        if (result.hasError) {
                            stop = true;
                            missingMessages.push(`Date: ${result.message}`);
                        }
                    }
                }
            }

            // Alerte CED pour tous les déchets
            if (ENABLE_ALERTE_CED) {
                for (const dechet of dechets) {
                    if (dechet.ced !== undefined) {
                        const result = alerteCed(dechet.ced);
                        if (result.hasError) {
                            stop = true;
                            missingMessages.push(`Code CED: ${result.message}`);
                        }
                    }
                }
            }

            // Alerte num_bsd pour tous les déchets
            if (ENABLE_ALERTE_NUM_BSD) {
                for (const dechet of dechets) {
                    if (dechet.num_bsd !== undefined) {
                        const result = alerteNumBsd(dechet.num_bsd);
                        if (result.hasError) {
                            stop = true;
                            missingMessages.push(`Numéro BSD: ${result.message}`);
                        }
                    }
                }
            }

            // Alerte num_bon pour tous les déchets
            if (ENABLE_ALERTE_NUM_BON) {
                for (const dechet of dechets) {
                    if (dechet.num_bon !== undefined) {
                        const result = alerteNumBon(dechet.num_bon);
                        if (result.hasError) {
                            stop = true;
                            missingMessages.push(`Numéro de bon: ${result.message}`);
                        }
                    }
                }
            }

            // Alerte num_facture (pour les factures)
            if (ENABLE_ALERTE_NUM_FACTURE && typeDoc === 'facture' && infosRaw.num_facture) {
                const result = alerteNumFacture(infosRaw.num_facture);
                if (result.hasError) {
                    stop = true;
                    missingMessages.push(`Numéro de facture: ${result.message}`);
                }
            }

            // Alertes spécifiques aux factures
            if (typeDoc === 'facture') {
                for (const dechet of dechets) {
                    if (dechet.facture?.ligne && Array.isArray(dechet.facture.ligne)) {
                        const prestations = dechet.facture.ligne;

                        // Alerte calcul facture pour chaque prestation
                        if (ENABLE_ALERTE_CALCUL_FACTURE) {
                            for (const presta of prestations) {
                                if (presta.quantite !== undefined && 
                                    presta.prix_unitaire !== undefined && 
                                    presta.montant_ht !== undefined) {
                                    const result = alerteCalculFacture(
                                        presta.quantite,
                                        presta.prix_unitaire,
                                        presta.montant_ht
                                    );
                                    if (result.hasError) {
                                        stop = true;
                                        missingMessages.push(`Calcul facture: ${result.message}`);
                                    }
                                }
                            }
                        }

                        // Alerte somme facture (une seule fois par document)
                        if (ENABLE_ALERTE_SOMME_FACTURE && infosRaw.montant_total_ht !== undefined) {
                            const result = alerteSommeFacture(prestations, infosRaw.montant_total_ht);
                            if (result.hasError) {
                                stop = true;
                                missingMessages.push(`Somme facture: ${result.message}`);
                            }
                            break; // On vérifie seulement une fois pour le total
                        }
                    }
                }
            }
        }

        // Construire le message final
        message = missingMessages.length > 0 ? missingMessages.join('; ') : "";

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
