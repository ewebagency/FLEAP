import { PdfInfo } from '../interface/pdf_interface';
import { getParamsMappingByEntreprise, getBSDCandidates } from './bdd';
import { supabase } from '@/app/database/supabaseClient';
import { link_in_bdd, create_in_bdd, translateByMapping } from './link_or_create_bdd';
// import { RowBSD } from '@/app/register/interface/BSD_Interface';

// Types pour la logique de liaison
export type LinkAction = 'to_link' | 'to_create' | 'to_check_by_user';

export interface LinkResult {
    action: LinkAction;
    id_link?: string;
    candidates?: string[];
}

// Types pour la nouvelle logique de matching automatique
export interface AutoLinkParams {
    to_link: MatchingRule[];
    to_check_by_user: MatchingRule[];
    create: MatchingRule[];
}

export interface MatchingRule {
    num_bsd: boolean;
    num_bon: boolean;
    site: boolean;
    presta: boolean;
    ced: boolean;
    nom_dechet_tresh: number;
    nom_dechet: boolean;
    date: boolean;
    date_tresh: number;
}

export interface AutoLinkResult {
    result: 'to_link' | 'to_check_by_user' | 'create';
    id?: string;
    pluto?: 'link' | 'create';
}

// Règles paramétrables pour contrôler la logique de liaison
export interface LinkRules {
    // Fenêtres de dates
    strictDays: number; // anciennement ecart_fin : (<) = to_link
    looseDays: number;  // anciennement ecart_grossier : (>) = to_create

    // Activer/désactiver des étapes entières
    includeUltraStrictStep: boolean; // match num_bon / num_bsd
    includeStrictStep: boolean;      // filtres serrés
    includeLooseStep: boolean;       // filtres élargis

    // Filtres utilisés dans l'étape stricte
    useDateStrict: boolean;
    usePrestaStrict: boolean;
    useSiteStrict: boolean;
    useCedStrict: boolean; // comparaison CED chiffres seuls
    useWasteNameStrict: boolean; // fuzzy match nom déchet
    wasteNameThresholdStrict: number; // 0..1
    wasteNameCedOperatorStrict: 'AND' | 'OR';

    // Filtres utilisés dans l'étape large
    useDateLoose: boolean;
    usePrestaLoose: boolean;
    useSiteLoose: boolean;
    useCedLoose: boolean; // généralement false par défaut
    useWasteNameLoose: boolean; // fuzzy match nom déchet
    wasteNameThresholdLoose: number; // 0..1
    wasteNameCedOperatorLoose: 'AND' | 'OR';
}

// Valeurs par défaut (équivalentes au comportement actuel)
export const LINK_RULES_DEFAULT: LinkRules = {
    includeUltraStrictStep: true,
    includeStrictStep: true,
    includeLooseStep: true,

    // Strict : To_link
    strictDays: 2,
    useDateStrict: true,
    usePrestaStrict: true,
    useSiteStrict: true,
    useCedStrict: true,
    useWasteNameStrict: true,
    wasteNameThresholdStrict: 0.8,
    wasteNameCedOperatorStrict: 'OR',

    // Large : To_create
    looseDays: 8,
    useDateLoose: true,
    usePrestaLoose: true,
    useSiteLoose: true,
    useCedLoose: false,
    useWasteNameLoose: false,
    wasteNameThresholdLoose: 0.8,
    wasteNameCedOperatorLoose: 'OR',
};

// Interface pour les candidats BSD basée sur la structure réelle de la table
export interface BSDCandidate {
    id: string;
    created_at: string;
    readable_id_track_dechets: string; //numbsd
    infos_json: {
        formAPI: {
            createFormInput: {
                emitter: {
                    company: {
                        siret: string;
                        name: string;
                    };
                    workSite: {
                        name: string;
                    };
                };
                recipient: {
                    company: {
                        siret: string;
                        name: string;
                    };
                };
                transporter: {
                    company: {
                        siret: string;
                        name: string;
                    };
                };
                wasteDetails: {
                    code: string;
                    name: string;
                };
                takenOverAt: string;
            };
        };
    };
    other_infos?: {
        numeroBon?: string;
    };
}

// Cache SWR pour les candidats BSD
const bsdCandidatesCache = new Map<string, {
    data: BSDCandidate[];
    timestamp: number;
    lastDate: string;
}>();

// Configuration par défaut pour l'accès BDD/cache (indépendant des règles métier)
const DEFAULT_CONFIG = {
    page_limit: 1000, // Supabase max per query
    cache_duration: 5 * 60 * 1000, // 5 minutes
};

// Fonction pour récupérer les candidats BSD avec cache SWR
export const candidats_BDD = async (
    entrepriseId: number,
    pdf_date: string,
    ecart: number,
    config = DEFAULT_CONFIG
): Promise<BSDCandidate[]> => {
    const cacheKey = `${entrepriseId}_${pdf_date}_${ecart}`;
    const now = Date.now();
    const cached = bsdCandidatesCache.get(cacheKey);

    // Vérifier si le cache est valide
    if (cached && 
        (now - cached.timestamp) < config.cache_duration &&
        new Date(cached.lastDate) >= new Date(pdf_date)) {
        return cached.data;
    }

    // Calculer la fenêtre [pdf_date - ecart, pdf_date + ecart]
    const startDate = new Date(pdf_date);
    startDate.setDate(startDate.getDate() - ecart);
    const endDate = new Date(pdf_date);
    endDate.setDate(endDate.getDate() + ecart);

    // Récupérer les BSDs par pages en se basant sur created_at (ordre décroissant)
    const allCandidates: BSDCandidate[] = [];
    let cursorEnd = endDate.toISOString();
    const keepPaging = true;

    while (keepPaging) {
        const { data, error } = await getBSDCandidates(
            entrepriseId,
            startDate.toISOString(),
            cursorEnd,
            config.page_limit
        );

        if (error || !data) {
            console.error('Erreur lors de la récupération des BSDs:', error);
            break;
        }

        if (data.length === 0) {
            break;
        }

        allCandidates.push(...data);

        // Si moins que le maximum, on a tout récupéré
        if (data.length < config.page_limit) {
            break;
        }

        // Déplacer le curseur à la plus ancienne date récupérée - 1 ms pour éviter les doublons
        const lastCreatedAt = new Date(data[data.length - 1].created_at);
        if (lastCreatedAt <= startDate) {
            break;
        }
        cursorEnd = new Date(lastCreatedAt.getTime() - 1).toISOString();
    }

    // Mettre en cache
    bsdCandidatesCache.set(cacheKey, {
        data: allCandidates,
        timestamp: now,
        lastDate: allCandidates.length > 0 ? allCandidates[allCandidates.length - 1].created_at : pdf_date
    });

    return allCandidates;
};

// Fonction pour extraire et normaliser les données du PDF
export const normalizePdfData = (
    rawData: Record<string, unknown>,
    siteMapping: Record<string, string[]>,
    prestaMapping: Record<string, string[]>,
    dechetIndex: number = 0,
    preserveCase: boolean = false
): Record<string, string> => {
    const normalized: Record<string, string> = {};
    
    // Extraire les données du déchet (tous types de documents)
    if (Array.isArray(rawData.dechet) && rawData.dechet.length > dechetIndex) {
        const dechet = rawData.dechet[dechetIndex] as Record<string, unknown>;
        normalized.date = (dechet.date as string) || '';
        normalized.ced = (dechet.ced as string) || '';
        normalized.waste_name = (dechet.nom as string) || '';
        normalized.num_bon = (dechet.num_bon as string) || '';
        normalized.num_bsd = (dechet.num_bsd as string) || '';
        normalized.tonnage = (dechet.tonnage as string) || '';
        
        // V2: Pour les factures, utiliser nom_site du déchet (sinon site_raw racine)
        normalized.site = (dechet.nom_site as string) || (rawData.site_raw as string) || '';
        
        normalized.prestataire = (rawData.presta_raw as string) || '';
        normalized.destinataire = (rawData.presta_raw as string) || ''; // Pour les factures aussi
        normalized.transporteur = (rawData.presta_raw as string) || '';
    }
    
    // Appliquer les mappings pour normaliser les noms de sites
    if (normalized.site) {
        for (const [mappedSiteRaw, originalSites] of Object.entries(siteMapping || {})) {
            const mappedSite = (mappedSiteRaw || '').split('|')[0];
            if (Array.isArray(originalSites) && originalSites.includes(normalized.site)) {
                normalized.site = mappedSite;
                break;
            }
        }
    }

    // Appliquer les mappings pour normaliser les prestataires (destinataire/transporteur)
    const normalizePresta = (value: string): string => {
        if (!value) return value;
        for (const [mappedPrestaRaw, originalNames] of Object.entries(prestaMapping || {})) {
            const mappedPresta = (mappedPrestaRaw || '').split('|')[0];
            if (Array.isArray(originalNames) && originalNames.includes(value)) {
                return mappedPresta;
            }
        }
        return value;
    };
    if (normalized.prestataire) normalized.prestataire = normalizePresta(normalized.prestataire);
    if (normalized.destinataire) normalized.destinataire = normalizePresta(normalized.destinataire);
    if (normalized.transporteur) normalized.transporteur = normalizePresta(normalized.transporteur);
    
    // Normaliser tous les champs (trim + optionnellement minuscules)
    for (const [key, value] of Object.entries(normalized)) {
        normalized[key] = preserveCase ? value.trim() : value.toLowerCase().trim();
    }
    
    return normalized;
};

// Fonction pour extraire les chiffres d'un CED
const extractNumbersFromCed = (ced: string): string => {
    return ced.replace(/[^\d]/g, '').replace(/\s/g, '');
};

// Format CED for display: keep 6 digits and insert spaces as XX XX XX
const formatCedForDisplay = (ced: string): string => {
    const digits = extractNumbersFromCed(ced).slice(0, 6);
    if (digits.length !== 6) return digits; // fallback
    return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)}`;
};

// Parse numbers that may use French formatting (e.g., "2,24")
const parseLocaleNumber = (value: string | number | undefined): number => {
    if (typeof value === 'number') return value;
    const raw = (value || '').toString().trim();
    if (!raw) return 0;
    // Remove spaces (thousands separators)
    let s = raw.replace(/\s/g, '');
    // If comma used as decimal and dot not used, replace comma with dot
    if (s.includes(',') && !s.includes('.')) {
        s = s.replace(/,/g, '.');
    } else if (s.includes(',') && s.includes('.')) {
        // Heuristic: if last comma is after last dot, commas are decimal separators; remove dots
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
            s = s.replace(/\./g, '').replace(/,/g, '.');
        } else {
            // Dots as decimal separators; remove commas
            s = s.replace(/,/g, '');
        }
    }
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? n : 0;
};

// Helper pour tester si un numéro est contenu dans l'autre (min 5 chiffres)
export const isNumberContained = (num1: string, num2: string): boolean => {
    if (!num1 || !num2) return false;
    const clean1 = num1.replace(/\D/g, ''); // Garder que les chiffres
    const clean2 = num2.replace(/\D/g, '');
    if (clean1.length < 5 || clean2.length < 5) return false;
    return clean1.includes(clean2) || clean2.includes(clean1);
};

// Fonction pour comparer les dates avec un écart
const isDateInRange = (date1: string, date2: string, ecartDays: number): boolean => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d1.getTime() - d2.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= ecartDays;
};

// Fuzzy matching (distance de Levenshtein)
const computeLevenshteinDistance = (a: string, b: string): number => {
    const s = (a || '').toLowerCase().trim();
    const t = (b || '').toLowerCase().trim();
    const m = s.length;
    const n = t.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = s[i - 1] === t[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }
    return dp[m][n];
};

const computeSimilarity = (a: string, b: string): number => {
    if (!a || !b) return 0;
    const dist = computeLevenshteinDistance(a, b);
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    return 1 - dist / maxLen;
};

// Fonction principale de liaison (version simplifiée utilisant ProposeActionAuto)
export const LinkOrCreate = async (
    pdfInfo: PdfInfo,
    entrepriseId: number,
    dechetIndex: number = 0,
    config = DEFAULT_CONFIG,
    rulesOverride?: Partial<LinkRules>
): Promise<LinkResult> => {
    try {
        // Récupérer les mappings de traduction
        const { data: mappings, error: mappingError } = await getParamsMappingByEntreprise(entrepriseId);
        if (mappingError || !mappings) {
            throw new Error('Impossible de récupérer les mappings');
        }

        // Récupérer les candidats BSD autour de la date cible (fenêtre large)
        const pdfDechets = pdfInfo.infos_raw?.dechet as Record<string, unknown>[] | undefined;
        const pdfDate = pdfDechets?.[dechetIndex] ? (pdfDechets[dechetIndex] as Record<string, unknown>)?.date as string : undefined;
        const candidates = await candidats_BDD(
            entrepriseId,
            pdfDate || new Date().toISOString(),
            200,
            config
        );

        // Convertir les règles en paramètres auto_link pour la compatibilité
        const autoLinkParams: AutoLinkParams = {
            to_link: [
                {
                    num_bsd: true,
                    num_bon: true,
                    site: rulesOverride?.useSiteStrict ?? LINK_RULES_DEFAULT.useSiteStrict,
                    presta: rulesOverride?.usePrestaStrict ?? LINK_RULES_DEFAULT.usePrestaStrict,
                    ced: rulesOverride?.useCedStrict ?? LINK_RULES_DEFAULT.useCedStrict,
                    nom_dechet_tresh: Math.round((rulesOverride?.wasteNameThresholdStrict ?? LINK_RULES_DEFAULT.wasteNameThresholdStrict) * 100),
                    nom_dechet: rulesOverride?.useWasteNameStrict ?? LINK_RULES_DEFAULT.useWasteNameStrict,
                    date: rulesOverride?.useDateStrict ?? LINK_RULES_DEFAULT.useDateStrict,
                    date_tresh: rulesOverride?.strictDays ?? LINK_RULES_DEFAULT.strictDays
                }
            ],
            to_check_by_user: [
                {
                    num_bsd: false,
                    num_bon: false,
                    site: rulesOverride?.useSiteLoose ?? LINK_RULES_DEFAULT.useSiteLoose,
                    presta: rulesOverride?.usePrestaLoose ?? LINK_RULES_DEFAULT.usePrestaLoose,
                    ced: rulesOverride?.useCedLoose ?? LINK_RULES_DEFAULT.useCedLoose,
                    nom_dechet_tresh: Math.round((rulesOverride?.wasteNameThresholdLoose ?? LINK_RULES_DEFAULT.wasteNameThresholdLoose) * 100),
                    nom_dechet: rulesOverride?.useWasteNameLoose ?? LINK_RULES_DEFAULT.useWasteNameLoose,
                    date: rulesOverride?.useDateLoose ?? LINK_RULES_DEFAULT.useDateLoose,
                    date_tresh: rulesOverride?.looseDays ?? LINK_RULES_DEFAULT.looseDays
                }
            ],
            create: []
        };

        // Utiliser la nouvelle fonction ProposeActionAuto
        const result = ProposeActionAuto(
            pdfInfo.infos_raw || {},
            candidates,
            mappings,
            autoLinkParams,
            dechetIndex
        );

        return {
            action: result.action,
            id_link: result.id_candidat
        };

    } catch (error) {
        console.error('Erreur dans LinkOrCreate:', error);
        return {
            action: 'to_check_by_user'
        };
    }
};

// Interface pour les données PDF normalisées
export interface NormalizedPdfData {
    date: string;
    ced: string;
    waste_name: string;
    num_bon: string;
    num_bsd: string;
    tonnage: string;
    site: string;
    prestataire: string;
    destinataire: string;
    transporteur: string;
}

// Interface pour les mappings de paramètres
export interface ParamsMapping {
    params_mapping_site?: Record<string, string[]>;
    params_mapping_presta?: Record<string, string[]>;
    params_mapping_contenant?: Record<string, string[]>;
    params_mapping_unite?: Record<string, string[]>;
    params_mapping_operation?: Record<string, string[]>;
}

// Interface pour le résultat de la proposition d'action
export interface ProposeActionResult {
    action: 'to_link' | 'to_check_by_user' | 'to_create';
    id_candidat?: string;
    nb_candidats?: number; // Nombre de candidats trouvés pour to_check_by_user
    matched_rule?: MatchingRule; // Règle exacte qui a matché
    rule_info?: string; // Info sur la règle (ex: "to_check_by_user #2")
}

// Fonction principale simplifiée pour proposer une action
export const ProposeActionAuto = (
    pdf_infos: Record<string, unknown>,
    bsds: BSDCandidate[],
    params_mapping: ParamsMapping,
    auto_link_params: AutoLinkParams,
    dechetIndex: number = 0
): ProposeActionResult => {
        // Normaliser les données du PDF
        const normalizedPdf = normalizePdfData(
        pdf_infos,
        params_mapping.params_mapping_site || {},
        params_mapping.params_mapping_presta || {},
            dechetIndex
        );
    // Fonction pour créer une condition basée sur une règle
    const createCondition = (rule: MatchingRule) => {
        return (pdfData: Record<string, string>, bsdCandidate: BSDCandidate): boolean => {

            // Vérification num_bsd
            if (rule.num_bsd) {
                const pdfNumBsd = pdfData.num_bsd || '';
                const candidateNumBsd = (bsdCandidate.readable_id_track_dechets || '').trim();
                if (!isNumberContained(pdfNumBsd, candidateNumBsd)) {
                    return false;
                }
            }

            // Vérification num_bon
            if (rule.num_bon) {
                const pdfNumBon = pdfData.num_bon || '';
                const candidateNumBon = (bsdCandidate.other_infos?.numeroBon || '').trim();
                if (!isNumberContained(pdfNumBon, candidateNumBon)) {
                    return false;
                }
            }

            // Vérification site (comparaison SIRET via mapping)
            if (rule.site) {
                const pdfSiteName = pdfData.site || '';
                const pdfSiteSiret = findSiretFromMapping(pdfSiteName, params_mapping.params_mapping_site || {});
                const candidateSiteSiret = (bsdCandidate.infos_json.formAPI.createFormInput.emitter.company?.siret || '').trim();
                
                if (!pdfSiteSiret || !candidateSiteSiret || pdfSiteSiret !== candidateSiteSiret) {
                    return false;
                }
            }

            // Vérification prestataire (comparaison SIRET via mapping - destinataire OU transporteur)
            if (rule.presta) {
                const pdfDestinataireName = pdfData.destinataire || '';
                const pdfTransporteurName = pdfData.transporteur || '';
                const pdfDestinataireSiret = findSiretFromMapping(pdfDestinataireName, params_mapping.params_mapping_presta || {});
                const pdfTransporteurSiret = findSiretFromMapping(pdfTransporteurName, params_mapping.params_mapping_presta || {});
                
                const candidateRecipientSiret = (bsdCandidate.infos_json.formAPI.createFormInput.recipient.company.siret || '').trim();
                const candidateTransporterSiret = (bsdCandidate.infos_json.formAPI.createFormInput.transporter.company.siret || '').trim();
                
                const recipientOk = pdfDestinataireSiret && candidateRecipientSiret && pdfDestinataireSiret === candidateRecipientSiret;
                const transporterOk = pdfTransporteurSiret && candidateTransporterSiret && pdfTransporteurSiret === candidateTransporterSiret;
                
                if (!recipientOk && !transporterOk) {
                    return false;
                }
            }

            // Vérification CED
            if (rule.ced) {
                const pdfCedNumbers = extractNumbersFromCed(pdfData.ced || '');
                const candidateCedNumbers = extractNumbersFromCed(bsdCandidate.infos_json.formAPI.createFormInput.wasteDetails.code || '');
                if (!pdfCedNumbers || !candidateCedNumbers || pdfCedNumbers !== candidateCedNumbers) {
                    return false;
                }
            }

            // Vérification nom de déchet (fuzzy matching)
            if (rule.nom_dechet) {
                const pdfWaste = pdfData.waste_name || '';
                const candidateWaste = (bsdCandidate.infos_json.formAPI.createFormInput.wasteDetails.name || '').toLowerCase().trim();
                const similarity = computeSimilarity(pdfWaste, candidateWaste);
                if (!pdfWaste || !candidateWaste || similarity < (rule.nom_dechet_tresh / 100)) {
                    return false;
                }
            }

            // Vérification date
            if (rule.date) {
                const takenOverAt = bsdCandidate.infos_json?.formAPI?.createFormInput?.takenOverAt || '';
                const candidateDate = takenOverAt || bsdCandidate.created_at;
                const dateMatch = isDateInRange(candidateDate, pdfData.date, rule.date_tresh);
                if (!pdfData.date || !dateMatch) {
                    return false;
                }
            }

            return true;
        };
        };

        // Parcourir les règles dans l'ordre : to_link -> to_check_by_user -> create
    for (let i = 0; i < auto_link_params.to_link.length; i++) {
        const rule = auto_link_params.to_link[i];
        const isInCondition = createCondition(rule);
        for (const bsd of bsds) {
            if (isInCondition(normalizedPdf, bsd)) { 
                return {
                    action: 'to_link',
                    id_candidat: bsd.id,
                    matched_rule: rule,
                    rule_info: `to_link #${i + 1}`
                };
            }
        }
    }

    for (let i = 0; i < auto_link_params.to_check_by_user.length; i++) {
        const rule = auto_link_params.to_check_by_user[i];
        const isInCondition = createCondition(rule);
        const matchingCandidates = bsds.filter(bsd => isInCondition(normalizedPdf, bsd));
        if (matchingCandidates.length > 0) {
                return {
                action: 'to_check_by_user',
                id_candidat: matchingCandidates[0].id,
                nb_candidats: matchingCandidates.length,
                matched_rule: rule,
                rule_info: `to_check_by_user #${i + 1}`
            };
        }
    }

    for (let i = 0; i < auto_link_params.create.length; i++) {
        const rule = auto_link_params.create[i];
        const isInCondition = createCondition(rule);
        for (const bsd of bsds) {
            if (isInCondition(normalizedPdf, bsd)) {
                return {
                    action: 'to_create',
                    matched_rule: rule,
                    rule_info: `create #${i + 1}`
                };
            }
        }
    }

    // Si aucune règle ne correspond, retourner to_create par défaut
    return {
        action: 'to_create'
    };
};

// Nouvelle fonction de matching automatique basée sur les paramètres JSON (version simplifiée)
export const AutoLinkWithParams = async (
    pdfInfo: PdfInfo,
    entrepriseId: number,
    dechetIndex: number = 0,
    params: AutoLinkParams,
    config = DEFAULT_CONFIG
): Promise<AutoLinkResult> => {
    try {
        // Récupérer les mappings de traduction
        const { data: mappings, error: mappingError } = await getParamsMappingByEntreprise(entrepriseId);
        if (mappingError || !mappings) {
            throw new Error('Impossible de récupérer les mappings');
        }

        // Récupérer les candidats BSD autour de la date cible (fenêtre large)
        const pdfDechets = pdfInfo.infos_raw?.dechet as Record<string, unknown>[] | undefined;
        const pdfDate = pdfDechets?.[dechetIndex] ? (pdfDechets[dechetIndex] as Record<string, unknown>)?.date as string : undefined;
        const candidates = await candidats_BDD(
            entrepriseId,
            pdfDate || new Date().toISOString(),
            200,
            config
        );

        // Utiliser la nouvelle fonction ProposeActionAuto
        const result = ProposeActionAuto(
            pdfInfo.infos_raw || {},
            candidates,
            mappings,
            params,
            dechetIndex
        );

        return {
            result: result.action === 'to_create' ? 'create' : result.action,
            id: result.id_candidat,
            pluto: result.action === 'to_link' ? 'link' : 'create'
        };

    } catch (error) {
        console.error('Erreur dans AutoLinkWithParams:', error);
        return {
            result: 'create',
            pluto: 'create'
        };
    }
};

export interface AutoLinkThisDocOptions {
    entrepriseId: number;
    pdfId: string;
    userId?: string;
    simulationMode?: boolean;
}

export interface AutoLinkThisDocOutcomeItem {
    index_dechet: number;
    result: ProposeActionResult;
    performed: 'linked' | 'created' | 'to_check_by_user' | 'skipped';
    bsd_id?: string;
}

export interface AutoLinkThisDocOutcome {
    results: AutoLinkThisDocOutcomeItem[];
}

const upsertStatusFlag = async (
    entrepriseId: number,
    pdfId: string,
    updater: (prev: Array<Record<string, unknown>>) => Array<Record<string, unknown>>
): Promise<void> => {
    const { data: currentPdf, error: fetchErr } = await supabase
        .from('pdf_infos')
        .select('bsd_linked')
        .eq('entreprise_id', entrepriseId)
        .eq('id', pdfId)
        .maybeSingle();

    if (fetchErr) {
        throw fetchErr;
    }

    const prevArray: Array<Record<string, unknown>> = Array.isArray(currentPdf?.bsd_linked)
        ? (currentPdf!.bsd_linked as Array<Record<string, unknown>>)
        : [];

    const nextArray = updater(prevArray);

    const { error: updateErr } = await supabase
        .from('pdf_infos')
        .update({ bsd_linked: nextArray })
        .eq('entreprise_id', entrepriseId)
        .eq('id', pdfId);

    if (updateErr) {
        throw updateErr;
    }
};

const ensureStatusOnLinkedItem = (
    array: Array<Record<string, unknown>>,
    indexDechet: number,
    status: 'linked' | 'created' | 'check_by_user',
    bsdId?: string
): Array<Record<string, unknown>> => {
    const next = [...array];
    const matchIdx = next.findIndex(item => {
        const idx = (item.index_dechet as number | undefined);
        const id = (item.bsd_id as string | undefined);
        if (bsdId) {
            return idx === indexDechet && id === bsdId;
        }
        return idx === indexDechet;
    });

    if (matchIdx >= 0) {
        const updated = { ...next[matchIdx] } as Record<string, unknown>;
        updated.status = status;
        if (bsdId) updated.bsd_id = bsdId;
        next[matchIdx] = updated;
        return next;
    }

    const base: Record<string, unknown> = { index_dechet: indexDechet, status };
    if (bsdId) base.bsd_id = bsdId;
    next.push(base);
    return next;
};

export const AutoLinkOrCreateThisDoc = async (
    pdf_infos: Record<string, unknown>,
    bsds: BSDCandidate[],
    params_mapping: ParamsMapping,
    auto_link_params: AutoLinkParams,
    options: AutoLinkThisDocOptions
): Promise<AutoLinkThisDocOutcome> => {
    const outcome: AutoLinkThisDocOutcome = { results: [] };

    // Récupérer les indices déjà traités (bsd_linked) pour éviter les doublons
    // Ne considérer comme "déjà traités" que les statuts finaux (linked, created, pushed)
    // Les statuts check_by_user et to_check_by_user doivent être retraités
    const { data: currentPdfRow, error: currentPdfErr } = await supabase
        .from('pdf_infos')
        .select('bsd_linked, document_type')
        .eq('entreprise_id', options.entrepriseId)
        .eq('id', options.pdfId)
        .maybeSingle();
    if (currentPdfErr) {
        throw currentPdfErr;
    }
    const alreadyProcessed = new Set<number>(
        Array.isArray(currentPdfRow?.bsd_linked)
            ? (currentPdfRow!.bsd_linked as Array<{ index_dechet?: number; status?: string }>)
                .filter(it => {
                    // Exclure les statuts check_by_user et to_check_by_user
                    const status = it.status;
                    return status !== 'check_by_user' && status !== 'to_check_by_user';
                })
                .map(it => it.index_dechet)
                .filter((v): v is number => typeof v === 'number')
            : []
    );

    // Nombre de déchets dans le document
    const dechets = Array.isArray((pdf_infos as { dechet?: unknown[] }).dechet)
        ? ((pdf_infos as { dechet: unknown[] }).dechet)
        : [];

    for (let index = 0; index < dechets.length; index++) {
        const result = ProposeActionAuto(
            pdf_infos,
            bsds,
            params_mapping,
            auto_link_params,
            index
        );

        // Si déjà traité, enregistrer comme skipped avec éventuel bsd_id existant
        if (alreadyProcessed.has(index)) {
            let existingBsdId: string | undefined;
            const existing = Array.isArray(currentPdfRow?.bsd_linked)
                ? (currentPdfRow!.bsd_linked as Array<{ index_dechet?: number; bsd_id?: string }>).
                    find(it => it.index_dechet === index)
                : undefined;
            if (existing && typeof existing.bsd_id === 'string') {
                existingBsdId = existing.bsd_id;
            }
            outcome.results.push({ index_dechet: index, result, performed: 'skipped', bsd_id: existingBsdId });
            continue;
        }

        if (result.action === 'to_link' && result.id_candidat) {
            if (!options.simulationMode) {
                await link_in_bdd(options.entrepriseId, result.id_candidat, options.pdfId, index);
                await upsertStatusFlag(options.entrepriseId, options.pdfId, prev =>
                    ensureStatusOnLinkedItem(prev, index, 'linked', result.id_candidat)
                );
            }
            outcome.results.push({ index_dechet: index, result, performed: 'linked', bsd_id: result.id_candidat });
        } else if (result.action === 'to_create') {
            if (!options.simulationMode) {
                const createRes = await create_in_bdd(options.entrepriseId, options.pdfId, index, { user_id: options.userId });
                const createdId = (createRes as { bsd_id?: string }).bsd_id;
                await upsertStatusFlag(options.entrepriseId, options.pdfId, prev =>
                    ensureStatusOnLinkedItem(prev, index, 'created', createdId)
                );
                outcome.results.push({ index_dechet: index, result, performed: 'created', bsd_id: createdId });
            } else {
                // En mode simulation, on simule un ID créé
                outcome.results.push({ index_dechet: index, result, performed: 'created', bsd_id: 'SIMULATED_ID' });
            }
        } else if (result.action === 'to_check_by_user') {
            if (!options.simulationMode) {
                await upsertStatusFlag(options.entrepriseId, options.pdfId, prev =>
                    ensureStatusOnLinkedItem(prev, index, 'check_by_user')
                );
            }
            outcome.results.push({ index_dechet: index, result, performed: 'to_check_by_user' });
        } else {
            outcome.results.push({ index_dechet: index, result, performed: 'skipped' });
        }
    }


    return outcome;
};

// ===================== Facture helpers & persistence =====================

export interface FactureLineBodyItem {
    unite: string;
    quantite: number;
    montant_ht: number;
    prix_unitaire: number;
    type_operation: string;
    // V2 fields
    tva_percent?: number;
    avoir?: boolean;
    declassement?: boolean;
}

export interface FactureLineHeader {
    filiere: string;
    site_nom: string;
    bon_pesee: string;
    site_siret: string;
    code_dechet: string;
    date_depart: string;
    num_dossier: string;
    type_dechet: string;
    bon_intention: string;
    site_description: string;
    site_num_affaire: string;
    dechet_description: string;
    contenant?: string;
    rep?: boolean;  // V2: flag REP
    volume_m3?: string;  // V2: volume en m3
    nombre_colis?: string;  // V2: nombre de colis
}

export interface FactureDepart {
    line_body: FactureLineBodyItem[];
    line_header: FactureLineHeader;
}

export interface FactureJson {
    footer: {
        total_ht: number;
        total_ttc?: number;  // V2
    };
    header: {
        num_facture: string;
        date_facture: string;
        prestataire_nom: string;
        prestataire_siret: string;
        prestataire_num_client: string;
        prestataire_description: string;
        // V2 fields
        date_debut?: string;
        num_contrat?: string;
        num_compte?: string;
        num_client?: string;
        type_facture?: string;
    };
    departs: FactureDepart[];
}

// Map a value to its canonical from params mapping (keeps casing of canonical keys)
const mapValueByParams = (value: string, mapping?: Record<string, string[]>): string => {
    if (!value) return '';
    if (!mapping) return value;
    const trimmed = value.trim();
    
    for (const [canonical, variants] of Object.entries(mapping)) {
        if (Array.isArray(variants) && variants.some(v => (v || '').trim() === trimmed)) {
            return canonical;
        }
    }
    return value;
};

export const buildFactureFromNormalized = (
    normalized: Record<string, string>, 
    pdf_infos: Record<string, unknown>, 
    dechetIndex: number,
    params_mapping: ParamsMapping
): FactureJson => {
    const date = normalized.date || '';
    const ced = normalized.ced || '';
    const waste = normalized.waste_name || '';
    const prestataire = normalized.prestataire || '';
    const num_bon = normalized.num_bon || '';

    // V2: Extraire les données de facture depuis pdf_infos.infos_raw.dechet[dechetIndex]
    const dechets = Array.isArray(pdf_infos.dechet) ? pdf_infos.dechet : [];
    const dechet = dechets[dechetIndex] as Record<string, unknown> | undefined;
    
    // V2: Utiliser nom_site depuis le déchet (après affiliation)
    const site = (dechet?.nom_site as string) || normalized.site || '';
    const flag_rep = (dechet?.flag_rep as string) === 'true';
    
    const factureData = dechet?.facture as Record<string, unknown> | undefined;
    const factureLignes = Array.isArray(factureData?.ligne) ? factureData.ligne : [];

    // Extraire num_facture et champs V2 depuis pdf_infos
    const num_facture = (pdf_infos.num_facture as string) || '';
    const date_fin_periode = (pdf_infos.date_fin_periode as string) || date;
    const date_debut_periode = (pdf_infos.date_debut_periode as string) || '';
    const num_contrat = (pdf_infos.num_contrat as string) || '';
    const num_compte = (pdf_infos.num_compte as string) || '';
    const num_client = (pdf_infos.num_client as string) || '';
    const type_facture = (pdf_infos.type_facture as string) || '';
    const total_ttc = parseFloat((pdf_infos.total_ttc as string) || '0');
    
    // V2: Déterminer si c'est un avoir/rachat global
    const isAvoirOrRachat = type_facture.toLowerCase().includes('avoir') || type_facture.toLowerCase().includes('rachat');

    // Trouver les SIRET et noms traduits via les mappings
    const siteTranslated = translateByMapping(site, params_mapping.params_mapping_site || {});
    const siteSiret = siteTranslated.siret || '';
    const siteNormalized = siteTranslated.name || site;  // Nom traduit, fallback sur brut
    
    const prestaTranslated = translateByMapping(prestataire, params_mapping.params_mapping_presta || {});
    const prestataireSiret = prestaTranslated.siret || '';
    const prestataireNormalized = prestaTranslated.name || prestataire;  // Nom traduit, fallback sur brut
    
    // Construire les line_body depuis les données de facture (avec mapping unite/operation)
    const line_body: FactureLineBodyItem[] = factureLignes.map((ligne: Record<string, unknown>) => {
        const uniteRaw = ((ligne.unite as string) || '').trim();
        const operationRaw = ((ligne.type_operation as string) || '').trim();
        
        const baseItem: FactureLineBodyItem = {
            unite: mapValueByParams(uniteRaw, params_mapping.params_mapping_unite),
            quantite: parseLocaleNumber((ligne.quantite as string) || '0'),
            montant_ht: parseLocaleNumber((ligne.montant_ht as string) || '0'),
            prix_unitaire: parseLocaleNumber((ligne.prix_unitaire as string) || '0'),
            type_operation: mapValueByParams(operationRaw, params_mapping.params_mapping_operation),
            tva_percent: parseFloat((ligne.tva_pourcentage as string) || '0') || 0.2  // V2: défaut 0.2 (20%)
        };
        
        // V2: Si type_facture contient "avoir" ou "rachat", forcer avoir à true pour toutes les lignes
        if (isAvoirOrRachat || (ligne.avoir as string) === 'true') {
            baseItem.avoir = true;
        }
        
        // V2: Ajouter declassement conditionnellement
        if ((ligne.declassement as string) === 'true') {
            baseItem.declassement = true;
        }
        
        return baseItem;
    });

    // Calculer le total HT
    const total_ht = line_body.reduce((sum, ligne) => sum + ligne.montant_ht, 0);

    const depart: FactureDepart = {
        line_body,
        line_header: {
            filiere: '',
            site_nom: siteNormalized,  // V2: Nom traduit (après mapping)
            bon_pesee: num_bon,
            site_siret: siteSiret,
            code_dechet: formatCedForDisplay(ced),
            date_depart: date,
            num_dossier: '',
            type_dechet: waste,
            bon_intention: '',
            site_description: siteNormalized,  // V2: Nom traduit (après mapping)
            site_num_affaire: '',
            dechet_description: waste,
            contenant : mapValueByParams(
                (((pdf_infos as { dechet?: Array<{ contenant?: string }> }).dechet?.[dechetIndex]?.contenant as string) || '').trim(),
                params_mapping.params_mapping_contenant
            ),
            rep: flag_rep,  // V2: flag REP
            volume_m3: (dechet?.volume_m3 as string) || undefined,  // V2: volume
            nombre_colis: (dechet?.nombre_colis as string) || undefined  // V2: nombre de colis
        }
    };

    return {
        footer: {
            total_ht,
            total_ttc: total_ttc || undefined  // V2: ne pas inclure si 0
        },
        header: {
            num_facture,
            date_facture: date_fin_periode,  // V2: utiliser date_fin_periode
            prestataire_nom: prestataireNormalized,  // V2: Nom traduit (après mapping)
            prestataire_siret: prestataireSiret,
            prestataire_num_client: '',
            prestataire_description: '',
            // V2: Nouveaux champs
            date_debut: date_debut_periode || undefined,
            num_contrat: num_contrat || undefined,
            num_compte: num_compte || undefined,
            num_client: num_client || undefined,
            type_facture: type_facture || undefined
        },
        departs: [depart]
    };
};

// Helper pour trouver le SIRET depuis les mappings
export const findSiretFromMapping = (name: string, mapping: Record<string, string[]>): string => {
    if (!name) return '';
    const input = name.toLowerCase().trim();
    
    for (const [mappedName, originalNames] of Object.entries(mapping)) {
        const mappedParts = (mappedName || '').split('|');
        const canonicalName = (mappedParts[0] || '').toLowerCase().trim();
        const siret = mappedParts.length > 1 ? mappedParts[1] : '';
        const originals = Array.isArray(originalNames) ? originalNames : [];
        const hasExactOriginal = originals.some(o => (o || '').toLowerCase().trim() === input);
        const matchesCanonical = canonicalName === input;
        if (hasExactOriginal || matchesCanonical) {
            return siret;
        }
    }
    return '';
};

export const push_in_facture_bdd = async (
    entrepriseId: number,
    pdfId: string,
    indexDechet: number,
    factureJson: FactureJson,
    userId?: string
): Promise<void> => {
    // Vérifier l'existence d'une ligne pour ce pdf/index
    const { data: existing, error: existingErr } = await supabase
        .from('facture')
        .select('id')
        .eq('pdf_infos_id', pdfId)
        .eq('index_dechet_pdf', indexDechet)
        .maybeSingle();

    if (existingErr) {
        throw existingErr;
    }
    if (existing) {
        return; // déjà présent
    }

    const insertPayload: Record<string, unknown> = {
        entreprise_id: entrepriseId,
        user_id: userId,
        pdf_infos_id: pdfId,
        index_dechet_pdf: indexDechet,
        infos_json: factureJson
    };
    if (userId) insertPayload.user_id = userId;

    const { error: insertErr } = await supabase
        .from('facture')
        .insert(insertPayload);
    if (insertErr) {
        throw insertErr;
    }
};
