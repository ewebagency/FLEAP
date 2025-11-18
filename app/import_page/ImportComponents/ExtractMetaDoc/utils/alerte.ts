const CODE_DR_PATTERN = /^[DER]\d+$/i;
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
interface FactureLigne {
    type_operation?: string;
    unite?: string;
    quantite?: number | string;
    prix_unitaire?: number | string;
    montant_ht?: number | string;
    type?: string;
}

interface DechetData {
    nom?: string;
    contenant?: string;
    tonnage?: string | number;
    date?: string;
    num_bsd?: string;
    num_bon?: string;
    nom_site?: string;
    ced?: string;
    d_r?: string;
    facture?: {
        ligne?: FactureLigne | FactureLigne[];
    };
}

interface InfosRaw {
    site_raw?: string;
    presta_raw?: string;
    type_doc?: string;
    type_bon?: string;
    type_facture?: string;
    num_facture?: string;
    montant_total_ht?: number | string;
    dechet?: DechetData[];
}

// Interface pour le résultat de vérification
type MappingMatchStatus = 'matched' | 'non_affilie' | 'inconnu';
type OperationCategory = 'collecte' | 'rotation' | 'traitement' | 'penalite' | 'tgap' | 'location' | 'depot';

interface MappingDetail {
    value: string;
    status: MappingMatchStatus;
    parent?: string;
    operationCategory?: OperationCategory;
    meta?: {
        dechetIndex?: number;
        ligneIndex?: number;
    };
}

interface MissingFields {
    site_raw?: MappingDetail | null;
    presta_raw?: MappingDetail | null;
    nom_prestataire_2?: MappingDetail | null;  // V2
    sites_facture: MappingDetail[];  // V2: sites par déchet (factures)
    dechets: MappingDetail[];
    operations: MappingDetail[];
    unites: MappingDetail[];
    contenants: MappingDetail[];
}

interface VerificationResult {
    hasTranslation: boolean;
    missingFields: MissingFields;
    details: {
        site_raw?: MappingDetail;
        presta_raw?: MappingDetail;
        nom_prestataire_2?: MappingDetail;  // V2
        sites_facture?: MappingDetail[];  // V2: sites par déchet (factures)
        dechets?: MappingDetail[];
        operations?: MappingDetail[];
        unites?: MappingDetail[];
        contenants?: MappingDetail[];
    };
}

// Interface pour le résultat d'une alerte
interface AlerteResult {
    hasError: boolean;
    message: string;
}

type ConfidenceData = {
    brute?: number;
    spec?: number;
    handwritten?: [number, boolean];
    large_word_review_llm_can_understand?: boolean;
    large_word_review_reason?: string;
} & Record<string, unknown>;

const MIN_NEAR_MATCH_LENGTH = 5;
const STOP_WORDS = new Set([
    'site',
    'chantier',
    'de',
    'la',
    'le',
    'les',
    'des',
    'du',
    'd',
    'l'
]);
const KNOWN_BON_KEYWORDS = ['pesee', 'pesée', 'livraison', 'collecte', 'enlevement', 'enlèvement', 'transport', 'pese'];
const KNOWN_FACTURE_KEYWORDS = ['facture', 'avoir', 'rachat'];
const OPERATION_CATEGORY_KEYWORDS: Record<OperationCategory, string[]> = {
    collecte: ['collecte'],
    rotation: ['rotation'],
    traitement: ['traitement'],
    penalite: ['penalite', 'pénalité', 'penalty'],
    tgap: ['tgap', 't.g.a.p'],
    location: ['location'],
    depot: ['depot', 'dépôt']
};
const OPERATION_CATEGORY_LABELS: Record<OperationCategory, string> = {
    collecte: 'collecte',
    rotation: 'rotation',
    traitement: 'traitement',
    penalite: 'pénalité',
    tgap: 'TGAP',
    location: 'location',
    depot: 'dépôt'
};

const LABEL_STATUS_FLAG_MAP: Record<string, { inconnu?: string; non_affilie?: string }> = {
    'Site': { inconnu: 'site_inconnu', non_affilie: 'site_non_affilie' },
    'Prestataire': { inconnu: 'presta_inconnu', non_affilie: 'presta_non_affilie' },
    'Prestataire (V2)': { inconnu: 'presta_inconnu', non_affilie: 'presta_non_affilie' },
    'Opération(s)': { inconnu: 'operation_inconnue', non_affilie: 'operation_non_affiliee' },
    'Unité(s)': { inconnu: 'unite_inconnue', non_affilie: 'unite_non_affiliee' },
    'Contenant(s)': { inconnu: 'contenant_inconnu', non_affilie: 'contenant_non_affilie' },
    'Déchet(s)': { inconnu: 'dechet_inconnu', non_affilie: 'dechet_non_affilie' },
    'Site(s) facture': { inconnu: 'site_inconnu', non_affilie: 'site_non_affilie' }
};

const normalizeText = (value: string): string => {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const hasExactMapping = (value: string, mapping: Record<string, string[]>): boolean => {
    if (!value || !mapping) return false;
    const normalizedValue = normalizeText(value);
    if (!normalizedValue) return false;

    return Object.keys(mapping).some(key => {
        const normalizedKey = normalizeText(key);
        if (normalizedKey === normalizedValue) return true;

        const synonyms = mapping[key] || [];
        return synonyms.some(mappedValue => normalizeText(mappedValue) === normalizedValue);
    });
};

const hasNearMatch = (value: string, mapping: Record<string, string[]>): boolean => {
    if (!value || !mapping) return false;
    const normalizedValue = normalizeText(value);
    if (!normalizedValue) return false;

    const tokens = normalizedValue
        .split(' ')
        .filter(token => token.length >= MIN_NEAR_MATCH_LENGTH && !STOP_WORDS.has(token));
    if (tokens.length === 0) return false;

    const candidates: string[] = [];
    Object.entries(mapping).forEach(([key, synonyms]) => {
        const normalizedKey = normalizeText(key);
        if (normalizedKey) {
            candidates.push(normalizedKey);
        }
        if (Array.isArray(synonyms)) {
            synonyms.forEach(synonym => {
                const normalizedSynonym = normalizeText(synonym);
                if (normalizedSynonym) {
                    candidates.push(normalizedSynonym);
                }
            });
        }
    });

    for (const token of tokens) {
        for (const candidate of candidates) {
            if (candidate.includes(token)) {
                return true;
            }
        }
    }

    return false;
};

const getMappingMatchStatus = (value: string | undefined, mapping: Record<string, string[]>): MappingMatchStatus => {
    if (!value) return 'matched';
    if (hasExactMapping(value, mapping)) {
        return 'matched';
    }
    return hasNearMatch(value, mapping) ? 'non_affilie' : 'inconnu';
};

const normalizeSimple = (value: string): string => normalizeText(value);

const matchesKnownKeyword = (value: string | undefined, keywords: string[]): boolean => {
    if (!value) return false;
    const normalizedValue = normalizeSimple(value);
    if (!normalizedValue) return false;
    return keywords.some(keyword => normalizedValue.includes(normalizeSimple(keyword)));
};

const matchesPattern = (value: string | undefined, pattern: RegExp): boolean => {
    if (!value) return false;
    return pattern.test(value.trim());
};

const parseNumericValue = (value: string | number | undefined): number | null => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    const normalized = value
        .replace(/\s+/g, '')
        .replace(',', '.')
        .trim();

    if (normalized.length === 0) return null;

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
        console.warn('[alerte.ts] parseNumericValue: valeur non numérique', { value, normalized });
    }
    return Number.isFinite(parsed) ? parsed : null;
};

const getMappingParent = (value: string | undefined, mapping: Record<string, string[]>): string | undefined => {
    if (!value) return undefined;
    const normalizedValue = normalizeText(value);
    if (!normalizedValue) return undefined;

    for (const key of Object.keys(mapping)) {
        const normalizedKey = normalizeText(key);
        if (normalizedKey === normalizedValue) {
            return key;
        }
        const synonyms = mapping[key] || [];
        if (synonyms.some(mappedValue => normalizeText(mappedValue) === normalizedValue)) {
            return key;
        }
    }
    return undefined;
};

const detectOperationCategory = (parentValue: string | undefined): OperationCategory | undefined => {
    if (!parentValue) return undefined;
    const normalizedParent = normalizeText(parentValue);
    if (!normalizedParent) return undefined;

    for (const [category, keywords] of Object.entries(OPERATION_CATEGORY_KEYWORDS) as Array<[OperationCategory, string[]]>) {
        if (keywords.some(keyword => normalizedParent.includes(normalizeText(keyword)))) {
            return category;
        }
    }
    return undefined;
};

const formatOperationCategoryLabel = (category: OperationCategory): string => {
    return OPERATION_CATEGORY_LABELS[category] || category;
};

const getFlagKeyForLabel = (label: string, status: MappingMatchStatus | undefined): string | null => {
    if (!status) return null;
    const mapping = LABEL_STATUS_FLAG_MAP[label];
    if (!mapping) return null;
    if (status === 'inconnu' && mapping.inconnu) {
        return mapping.inconnu;
    }
    if (status === 'non_affilie' && mapping.non_affilie) {
        return mapping.non_affilie;
    }
    return null;
};

const hasNonEmptyString = (value: string | undefined | null): boolean => {
    return typeof value === 'string' && value.trim().length > 0;
};

const hasValue = (value: unknown): boolean => {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') {
        return value.trim().length > 0;
    }
    return String(value).trim().length > 0;
};

const mapTonnageMessageToFlag = (message: string): string | null => {
    const lower = message.toLowerCase();
    if (lower.includes('manquant')) return 'tonnage_non_lu';
    if (lower.includes('non numérique')) return 'tonnage_invalide';
    if (lower.includes('négatif')) return 'tonnage_negatif';
    if (lower.includes('trop élevé')) return 'tonnage_eleve';
    return null;
};

const mapDateMessageToFlag = (message: string): string | null => {
    const lower = message.toLowerCase();
    if (lower.includes('manquante')) return 'date_non_lue';
    if (lower.includes('invalide')) return 'date_invalide';
    return null;
};

const mapNumberMessageToFlag = (message: string, type: 'bsd' | 'bon' | 'facture'): string | null => {
    const lower = message.toLowerCase();
    const isMissing = lower.includes('manquant');
    const isInvalid = lower.includes('insuffisant') || lower.includes('invalide');
    if (type === 'bsd') {
        if (isMissing) return 'num_bsd_non_lu';
        if (isInvalid) return 'num_bsd_invalide';
    } else if (type === 'bon') {
        if (isMissing) return 'num_bon_non_lu';
        if (isInvalid) return 'num_bon_invalide';
    } else if (type === 'facture') {
        if (isMissing) return 'num_facture_non_lu';
        if (isInvalid) return 'num_facture_invalide';
    }
    return null;
};

const mapCedMessageToFlag = (message: string): string | null => {
    const lower = message.toLowerCase();
    if (lower.includes('manquant')) return 'ced_non_lu';
    if (lower.includes('invalide')) return 'ced_invalide';
    return null;
};

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
    quantite: number | string | undefined,
    prixUnitaire: number | string | undefined,
    montant: number | string | undefined
): AlerteResult => {
    if (quantite === undefined || prixUnitaire === undefined || montant === undefined) {
        return { hasError: false, message: "" };
    }
    
    try {
        const quantiteValue = parseNumericValue(quantite);
        const prixValue = parseNumericValue(prixUnitaire);
        const montantValue = parseNumericValue(montant);

        if (quantiteValue === null || prixValue === null || montantValue === null) {
            return {
                hasError: true,
                message: `Valeurs non numériques: qty=${quantite}, prix=${prixUnitaire}, montant=${montant}`
            };
        }

        const calculAttendu = quantiteValue * prixValue;
        // Tolérance de 0.01 pour les erreurs d'arrondi
        if (Math.abs(calculAttendu - montantValue) > 0.01) {
            return { 
                hasError: true, 
                message: `Calcul incorrect: ${quantiteValue} × ${prixValue} = ${calculAttendu} ≠ ${montantValue}` 
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
    prestations: Array<{ montant_ht?: number | string }> | undefined,
    montantTotal: number | string | undefined
): AlerteResult => {
    if (!prestations || !montantTotal) {
        return { hasError: false, message: "" };
    }
    
    try {
        const montantTotalValue = parseNumericValue(montantTotal);
        if (montantTotalValue === null) {
            return { hasError: true, message: `Montant total non numérique: ${montantTotal}` };
        }

        let sommeCalculee = 0;
        const lignesSansMontant: number[] = [];

        prestations.forEach((presta, index) => {
            if (!hasValue(presta.montant_ht)) {
                lignesSansMontant.push(index + 1);
                return;
            }
            const montantValue = parseNumericValue(presta.montant_ht);
            if (montantValue === null) {
                return;
            }
            sommeCalculee += montantValue;
        });

        console.info('[alerteSommeFacture] Vérification somme', {
            prestations,
            amountTotalRaw: montantTotal,
            montantTotalValue,
            sommeCalculee,
            lignesSansMontant,
            ecart: Math.abs(sommeCalculee - montantTotalValue)
        });
        
        const messages: string[] = [];
        const sommeIncorrecte = Math.abs(sommeCalculee - montantTotalValue) > 0.01;
        
        if (sommeIncorrecte) {
            messages.push(`Somme incorrecte: ${sommeCalculee} ≠ ${montantTotalValue}`);
        }
        if (lignesSansMontant.length > 0) {
            messages.push(`Montant HT manquant pour ligne(s): ${lignesSansMontant.join(', ')}`);
        }

        // hasError = true uniquement si la somme est incorrecte (pas juste si des lignes n'ont pas de montant)
        return sommeIncorrecte
            ? { hasError: true, message: messages.join('; ') }
            : { hasError: false, message: messages.length > 0 ? messages.join('; ') : "" };
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

        // Vérifier site_raw
        const siteRawValue = infosRaw.site_raw;
        const siteRawDetail = siteRawValue
            ? { value: siteRawValue, status: getMappingMatchStatus(siteRawValue, paramsMapping.params_mapping_site) }
            : undefined;

        // Vérifier presta_raw
        const prestaRawValue = infosRaw.presta_raw;
        const prestaRawDetail = prestaRawValue
            ? { value: prestaRawValue, status: getMappingMatchStatus(prestaRawValue, paramsMapping.params_mapping_presta) }
            : undefined;

        // V2: Vérifier nom_prestataire_2
        const nomPrestataire2Value = (infosRaw as { nom_prestataire_2?: string }).nom_prestataire_2;
        const nomPrestataire2Detail = nomPrestataire2Value
            ? { value: nomPrestataire2Value, status: getMappingMatchStatus(nomPrestataire2Value, paramsMapping.params_mapping_presta) }
            : undefined;

        // Vérifier les déchets, opérations, unités et contenants
        const dechets: MappingDetail[] = [];
        const operations: MappingDetail[] = [];
        const unites: MappingDetail[] = [];
        const contenants: MappingDetail[] = [];
        const sitesFacture: MappingDetail[] = [];  // V2: sites par déchet (factures)

        if (infosRaw.dechet && Array.isArray(infosRaw.dechet)) {
            infosRaw.dechet.forEach((dechet, dechetIndex) => {
                // Vérifier nom du déchet
                /*if (dechet.nom) {
                    const hasDechetMapping = hasMapping(dechet.nom, paramsMapping.params_mapping_nom_dechet);
                    dechets.push({ value: dechet.nom, hasMapping: hasDechetMapping });
                }*/

                // V2: Vérifier nom_site pour les factures (site par déchet)
                const typeDoc = (infosRaw as { type_doc?: string }).type_doc;
                if (typeDoc === 'facture' && (dechet as { nom_site?: string }).nom_site) {
                    const nomSiteValue = (dechet as { nom_site: string }).nom_site;
                    const siteStatus = getMappingMatchStatus(nomSiteValue, paramsMapping.params_mapping_site);
                    sitesFacture.push({ value: nomSiteValue, status: siteStatus });
                }

                // Vérifier contenant
                if (dechet.contenant) {
                    const contenantStatus = getMappingMatchStatus(dechet.contenant, paramsMapping.params_mapping_contenant);
                    contenants.push({ value: dechet.contenant, status: contenantStatus });
                }

                // Vérifier opération (dans facture.ligne.type_operation)
                const lignes = dechet.facture?.ligne;
                const lignesArray: FactureLigne[] = Array.isArray(lignes)
                    ? lignes
                    : lignes
                        ? [lignes]
                        : [];

                lignesArray.forEach((ligneItem, ligneIndex) => {
                    if (ligneItem.type_operation) {
                        const operationStatus = getMappingMatchStatus(ligneItem.type_operation, paramsMapping.params_mapping_operation);
                        const parent = operationStatus === 'matched'
                            ? getMappingParent(ligneItem.type_operation, paramsMapping.params_mapping_operation)
                            : undefined;
                        const operationCategory = parent ? detectOperationCategory(parent) : undefined;
                        const operationDetail: MappingDetail = {
                            value: ligneItem.type_operation,
                            status: operationStatus,
                            parent,
                            operationCategory,
                            meta: { dechetIndex, ligneIndex }
                        };
                        console.info('[alerte.ts] Opération analysée', {
                            type_operation: ligneItem.type_operation,
                            status: operationStatus,
                            parent,
                            operationCategory,
                            dechetIndex,
                            ligneIndex
                        });
                        operations.push(operationDetail);
                    } else {
                        console.warn('[alerte.ts] Opération non reconnue', {
                            type_operation: ligneItem.type_operation,
                            dechetIndex,
                            ligneIndex
                        });
                    }

                    // Vérifier unité (dans facture.ligne.unite)
                    if (ligneItem.unite) {
                        const uniteStatus = getMappingMatchStatus(ligneItem.unite, paramsMapping.params_mapping_unite);
                        unites.push({ value: ligneItem.unite, status: uniteStatus });
                    }
                });
            });
        }

        // Déterminer les champs manquants
        const missingFields: MissingFields = {
            site_raw: siteRawDetail && siteRawDetail.status !== 'matched' ? siteRawDetail : null,
            presta_raw: prestaRawDetail && prestaRawDetail.status !== 'matched' ? prestaRawDetail : null,
            nom_prestataire_2: nomPrestataire2Detail && nomPrestataire2Detail.status !== 'matched' ? nomPrestataire2Detail : null,  // V2
            sites_facture: sitesFacture.filter(s => s.status !== 'matched'),  // V2
            dechets: dechets.filter(d => d.status !== 'matched'),
            operations: operations.filter(o => o.status !== 'matched'),
            unites: unites.filter(u => u.status !== 'matched'),
            contenants: contenants.filter(c => c.status !== 'matched')
        };

        if (missingFields.operations.length > 0) {
            missingFields.operations.forEach(missingOperation => {
                console.warn('[alerte.ts] Opération sans mapping', missingOperation);
            });
        } else {
            console.info('[alerte.ts] Toutes les opérations sont mappées');
        }

        // Vérifier s'il y a au moins une traduction manquante
        const hasTranslation = 
            (!siteRawDetail || siteRawDetail.status === 'matched') && 
            (!prestaRawDetail || prestaRawDetail.status === 'matched') && 
            (!nomPrestataire2Detail || nomPrestataire2Detail.status === 'matched') &&  // V2
            sitesFacture.every(s => s.status === 'matched') &&  // V2
            dechets.every(d => d.status === 'matched') &&
            operations.every(o => o.status === 'matched') &&
            unites.every(u => u.status === 'matched') &&
            contenants.every(c => c.status === 'matched');

        return {
            hasTranslation,
            missingFields,
            details: {
                site_raw: siteRawDetail,
                presta_raw: prestaRawDetail,
                nom_prestataire_2: nomPrestataire2Detail,  // V2
                sites_facture: sitesFacture.length > 0 ? sitesFacture : undefined,  // V2
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
    const missing: string[] = [];
    const formatSingle = (detail: MappingDetail | null | undefined, label: string) => {
        if (!detail) return;
        const suffix = detail.status === 'non_affilie' ? 'non affilié' : 'non reconnu';
        missing.push(`${label}: "${detail.value}" ${suffix}`);
    };
    const formatMultiple = (details: MappingDetail[], label: string) => {
        if (details.length === 0) return;
        const nonAffilie = details.filter(item => item.status === 'non_affilie');
        const inconnus = details.filter(item => item.status === 'inconnu');

        if (nonAffilie.length > 0) {
            missing.push(`${label} non affilié(s): ${nonAffilie.map(item => `"${item.value}"`).join(', ')}`);
        }
        if (inconnus.length > 0) {
            missing.push(`${label} non reconnu(s): ${inconnus.map(item => `"${item.value}"`).join(', ')}`);
        }
    };
    
    formatSingle(result.missingFields.site_raw, 'Site');
    formatSingle(result.missingFields.presta_raw, 'Prestataire');
    formatSingle(result.missingFields.nom_prestataire_2, 'Prestataire (V2)');

    // formatMultiple(result.missingFields.dechets, 'Déchet(s)');
    formatMultiple(result.missingFields.operations, 'Opération(s)');
    formatMultiple(result.missingFields.unites, 'Unité(s)');
    formatMultiple(result.missingFields.contenants, 'Contenant(s)');
    formatMultiple(result.missingFields.sites_facture, 'Site(s) facture');
    
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
            .select('infos_raw, confidence')
            .eq('id', pdfId)
            .eq('entreprise_id', entrepriseId)
            .single();

        if (pdfError || !pdfData) {
            throw new Error(`Erreur lors de la récupération du PDF: ${pdfError?.message || 'PDF non trouvé'}`);
        }

        const infosRaw = pdfData.infos_raw as InfosRaw;
        const confidenceData = (pdfData.confidence as ConfidenceData | null | undefined) ?? null;
        const typeDocValue = (infosRaw.type_doc || '').toLowerCase();
        const typeBonValue = (infosRaw as { type_bon?: string }).type_bon;
        const typeFactureValue = (infosRaw as { type_facture?: string }).type_facture;
        
        // Construire le message d'alerte
        let message = "";
        let stop = false;
        const missingMessages: string[] = [];
        const alerteFlags: string[] = [];
        const addFlagValue = (flag: string | null | undefined) => {
            if (!flag) return;
            if (!alerteFlags.includes(flag)) {
                alerteFlags.push(flag);
            }
        };

        const pushSingleMappingMessage = (detail: MappingDetail | null | undefined, label: string) => {
            if (!detail) return;
            const qualifier = detail.status === 'non_affilie' ? 'non affilié' : 'non reconnu';
            missingMessages.push(`${label} "${detail.value}" ${qualifier}`);
            const flagKey = getFlagKeyForLabel(label, detail.status);
            if (flagKey) {
                addFlagValue(flagKey);
            }
        };

        const pushArrayMappingMessage = (
            details: MappingDetail[],
            label: string,
            feminine: boolean
        ) => {
            if (details.length === 0) return;
            const nonAffilie = details.filter(item => item.status === 'non_affilie');
            const inconnus = details.filter(item => item.status === 'inconnu');

            const affSuffix = feminine ? 'non affiliée(s)' : 'non affilié(s)';
            const incSuffix = feminine ? 'non reconnue(s)' : 'non reconnu(s)';

            if (nonAffilie.length > 0) {
                missingMessages.push(`${label} ${affSuffix}: ${nonAffilie.map(item => `"${item.value}"`).join(', ')}`);
            }
            if (inconnus.length > 0) {
                missingMessages.push(`${label} ${incSuffix}: ${inconnus.map(item => `"${item.value}"`).join(', ')}`);
            }

            details.forEach(detail => {
                const flagKey = getFlagKeyForLabel(label, detail.status);
                if (flagKey) {
                    addFlagValue(flagKey);
                }
            });
        };

        const pushDocumentTypeMessage = (label: string, value: string | undefined) => {
            const formattedValue = value && value.trim().length > 0 ? `"${value}"` : 'non renseigné';
            missingMessages.push(`${label} non reconnu: ${formattedValue}`);
            stop = true;
            if (label === 'Type de bon') {
                addFlagValue('type_bon_inconnu');
            } else if (label === 'Type de facture') {
                addFlagValue('type_facture_inconnu');
            }
        };

        // === ALERTES DE TRADUCTION ===
        if (!verificationResult.hasTranslation) {
            stop = true;

            pushSingleMappingMessage(verificationResult.missingFields.site_raw, 'Site');
            pushSingleMappingMessage(verificationResult.missingFields.presta_raw, 'Prestataire');
            pushSingleMappingMessage(verificationResult.missingFields.nom_prestataire_2, 'Prestataire (V2)');

            pushArrayMappingMessage(verificationResult.missingFields.operations, 'Opération(s)', true);
            pushArrayMappingMessage(verificationResult.missingFields.unites, 'Unité(s)', true);
            pushArrayMappingMessage(verificationResult.missingFields.contenants, 'Contenant(s)', false);
            pushArrayMappingMessage(verificationResult.missingFields.sites_facture, 'Site(s) facture', false);
        }

        // Type de bon
        if (typeDocValue === 'bon') {
            if (!matchesKnownKeyword(typeBonValue, KNOWN_BON_KEYWORDS)) {
                pushDocumentTypeMessage('Type de bon', typeBonValue);
            }
        }

        if (typeDocValue === 'bsd') {
            const dechetsArray = Array.isArray(infosRaw.dechet) ? infosRaw.dechet : [];
            const invalidCodeDrIndexes: number[] = [];

            dechetsArray.forEach((dechet, index) => {
                const codeDrValue = (dechet as { d_r?: string }).d_r;
                if (!hasNonEmptyString(codeDrValue) || !matchesPattern(codeDrValue, CODE_DR_PATTERN)) {
                    invalidCodeDrIndexes.push(index + 1);
                }
            });

            if (invalidCodeDrIndexes.length > 0) {
                stop = true;
                missingMessages.push(`Code DR invalide pour collecte(s): ${invalidCodeDrIndexes.join(', ')}`);
                addFlagValue('code_dr_invalide');
            }
        }

        // Type de facture
        if (typeDocValue === 'facture') {
            if (!matchesKnownKeyword(typeFactureValue, KNOWN_FACTURE_KEYWORDS)) {
                pushDocumentTypeMessage('Type de facture', typeFactureValue);
            }
        }

        if (confidenceData?.large_word_review_llm_can_understand === false) {
            stop = true;
            const reason = typeof confidenceData.large_word_review_reason === 'string' && confidenceData.large_word_review_reason.trim().length > 0
                ? confidenceData.large_word_review_reason
                : 'Le document risque d\'être mal compris.';
            missingMessages.push(`Lecture OCR douteuse: ${reason}`);
            addFlagValue('large_word_review_llm_can_understand');
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
                            addFlagValue(mapTonnageMessageToFlag(result.message));
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
                            addFlagValue(mapDateMessageToFlag(result.message));
                        }
                    }
                }
            }

            // Alerte CED pour tous les déchets
            if (ENABLE_ALERTE_CED || typeDoc==="bsd") {
                for (const dechet of dechets) {
                    if (dechet.ced !== undefined) {
                        const result = alerteCed(dechet.ced);
                        if (result.hasError) {
                            stop = true;
                            missingMessages.push(`Code CED: ${result.message}`);
                            addFlagValue(mapCedMessageToFlag(result.message));
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
                            addFlagValue(mapNumberMessageToFlag(result.message, 'bsd'));
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
                            addFlagValue(mapNumberMessageToFlag(result.message, 'bon'));
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
                    addFlagValue(mapNumberMessageToFlag(result.message, 'facture'));
                }
            }

            // Alertes spécifiques aux factures
            if (typeDoc === 'facture') {
                const toutesLesPrestations: FactureLigne[] = [];

                dechets.forEach((dechet, dechetIndex) => {
                    const lignes = dechet.facture?.ligne;
                    const prestations = Array.isArray(lignes)
                        ? lignes
                        : lignes
                            ? [lignes]
                            : [];

                    if (prestations.length === 0) {
                        return;
                    }

                    toutesLesPrestations.push(...prestations);

                    if (ENABLE_ALERTE_CALCUL_FACTURE) {
                        prestations.forEach(presta => {
                            // Ne vérifier le calcul que si quantité, prix unitaire ET montant HT sont présents et non vides
                            if (hasValue(presta.quantite) &&
                                hasValue(presta.prix_unitaire) &&
                                hasValue(presta.montant_ht)) {
                                const result = alerteCalculFacture(
                                    presta.quantite,
                                    presta.prix_unitaire,
                                    presta.montant_ht
                                );
                                if (result.hasError) {
                                    stop = true;
                                    missingMessages.push(`Calcul facture: ${result.message}`);
                                    addFlagValue('calcul_errone');
                                }
                            }
                        });
                    }

                    const categoriesParCollecte: Partial<Record<OperationCategory, number>> = {};
                    const matchedOperationDetails = verificationResult.details.operations ?? [];
                    matchedOperationDetails
                        .filter((detail): detail is MappingDetail & { operationCategory: OperationCategory; meta: { dechetIndex?: number } } =>
                            detail.meta?.dechetIndex === dechetIndex && !!detail.operationCategory
                        )
                        .forEach(detail => {
                            const category = detail.operationCategory;
                            categoriesParCollecte[category] = (categoriesParCollecte[category] || 0) + 1;
                        });

                    Object.entries(categoriesParCollecte).forEach(([category, count]) => {
                        if ((count ?? 0) > 1) {
                            stop = true;
                            const label = formatOperationCategoryLabel(category as OperationCategory);
                            missingMessages.push(`Structure de collecte fausse: Trop d'opérations ${label} pour la collecte ${dechetIndex + 1} (${count} détectées, maximum 1)`);
                            addFlagValue('structure_collecte_fausse');
                        }
                    });

                    const hasPrestations = prestations.length > 0;
                    if (hasPrestations) {
                        const missingCollecteFields: string[] = [];
                        if (!hasNonEmptyString(dechet.date)) {
                            missingCollecteFields.push('date');
                        }
                        if (!hasNonEmptyString(dechet.nom)) {
                            missingCollecteFields.push('déchet');
                        }
                        const hasDocumentNumber = hasNonEmptyString(dechet.num_bon) || hasNonEmptyString(dechet.num_bsd);
                        if (!hasDocumentNumber) {
                            missingCollecteFields.push('numéro de Bon/BSD');
                        }
                        /*if (!hasNonEmptyString(dechet.contenant)) {
                            missingCollecteFields.push('contenant');
                        }*/
                        if (!hasValue(dechet.tonnage)) {
                            missingCollecteFields.push('tonnage');
                        }

                        if (missingCollecteFields.length > 0) {
                            stop = true;
                            missingMessages.push(`Structure de collecte fausse: Collecte ${dechetIndex + 1} incomplète (manque: ${missingCollecteFields.join(', ')})`);
                            addFlagValue('structure_collecte_fausse');
                        }
                    }
                });

                if (ENABLE_ALERTE_SOMME_FACTURE &&
                    infosRaw.montant_total_ht !== undefined &&
                    toutesLesPrestations.length > 0) {
                    const montantTotalValue = parseNumericValue(infosRaw.montant_total_ht);
                    if (montantTotalValue !== null) {
                        const result = alerteSommeFacture(toutesLesPrestations, montantTotalValue);
                        if (result.hasError) {
                            stop = true;
                            missingMessages.push(`Somme facture: ${result.message}`);
                            addFlagValue('somme_erronee');
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
                    message,
                    flags: alerteFlags
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
