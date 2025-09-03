import { PdfInfo } from '../interface/pdf_interface';
import { getParamsMappingByEntreprise, getBSDCandidates } from './bdd';
// import { RowBSD } from '@/app/register/interface/BSD_Interface';

// Types pour la logique de liaison
export type LinkAction = 'to_link' | 'to_create' | 'to_check_by_user';

export interface LinkResult {
    action: LinkAction;
    id_link?: string;
    candidates?: string[];
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
const normalizePdfData = (
    rawData: Record<string, unknown>,
    siteMapping: Record<string, string[]>,
    prestaMapping: Record<string, string[]>,
    dechetIndex: number = 0
): Record<string, string> => {
    const normalized: Record<string, string> = {};
    
    // Extraire les données selon le type de document
    if (rawData.type_doc === 'bon' && Array.isArray(rawData.dechet) && rawData.dechet.length > dechetIndex) {
        const dechet = rawData.dechet[dechetIndex] as Record<string, unknown>;
        normalized.date = (dechet.date as string) || '';
        normalized.ced = (dechet.ced as string) || '';
        normalized.waste_name = (dechet.nom as string) || '';
        normalized.num_bon = (dechet.num_bon as string) || '';
        normalized.tonnage = (dechet.tonnage as string) || '';
        normalized.site = (rawData.site_raw as string) || '';
        normalized.prestataire = (rawData.presta_raw as string) || '';
        normalized.destinataire = (rawData.presta_raw as string) || ''; // Pour les bons, le prestataire est souvent le destinataire
        normalized.transporteur = (rawData.presta_raw as string) || ''; // Ou le transporteur
    } else if (rawData.type_doc === 'facture' && Array.isArray(rawData.dechet) && rawData.dechet.length > dechetIndex) {
        // Pour les factures, on prend le déchet spécifique
        const dechet = rawData.dechet[dechetIndex] as Record<string, unknown>;
        normalized.date = (dechet.date as string) || '';
        normalized.ced = (dechet.ced as string) || '';
        normalized.waste_name = (dechet.nom as string) || '';
        normalized.num_bon = (dechet.num_bon as string) || '';
        normalized.num_bsd = (dechet.num_bsd as string) || '';
        normalized.tonnage = (dechet.tonnage as string) || '';
        normalized.site = (rawData.site_raw as string) || '';
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
    
    // Normaliser tous les champs (minuscules et trim)
    for (const [key, value] of Object.entries(normalized)) {
        normalized[key] = value.toLowerCase().trim();
    }
    
    return normalized;
};

// Fonction pour extraire les chiffres d'un CED
const extractNumbersFromCed = (ced: string): string => {
    return ced.replace(/[^\d]/g, '').replace(/\s/g, '');
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

// Fonction principale de liaison
export const LinkOrCreate = async (
    pdfInfo: PdfInfo,
    entrepriseId: number,
    dechetIndex: number = 0,
    config = DEFAULT_CONFIG,
    rulesOverride?: Partial<LinkRules>
): Promise<LinkResult> => {
    try {
        // Règles effectives (defaults + override)
        const rules: LinkRules = { ...LINK_RULES_DEFAULT, ...(rulesOverride || {}) };
        // Récupérer les mappings de traduction
        const { data: mappings, error: mappingError } = await getParamsMappingByEntreprise(entrepriseId);
        if (mappingError || !mappings) {
            throw new Error('Impossible de récupérer les mappings');
        }

        // Normaliser les données du PDF (site + prestataire)
        const normalizedPdf = normalizePdfData(
            pdfInfo.infos_raw || {},
            mappings.params_mapping_site || {},
            mappings.params_mapping_presta || {},
            dechetIndex
        );

        // Récupérer les candidats BSD autour de la date cible (fenêtre large)
        const candidates = await candidats_BDD(
            entrepriseId,
            normalizedPdf.date || new Date().toISOString(),
            200,
            config
        );
        console.log("MinDate Candidates", candidates.map(candidate => candidate));

        // ÉTAPE 1: Liaison ultra évidente (correspondance exacte des numéros)
        if (rules.includeUltraStrictStep) {
            const ultraStrictCandidates = candidates.filter(candidate => {
                const pdfNumBon = normalizedPdf.num_bon;
                const pdfNumBsd = normalizedPdf.num_bsd;
                const candidateNumBon = candidate.other_infos?.numeroBon || '';
                const candidateNumBsd = candidate.readable_id_track_dechets || '';
                return (
                    (pdfNumBon && candidateNumBon && pdfNumBon === candidateNumBon) ||
                    (pdfNumBsd && candidateNumBsd && pdfNumBsd === candidateNumBsd)
                );
            });
            if (ultraStrictCandidates.length === 1) {
                console.log("NumBSD ou BON trouvé, on link");
                return {
                    action: 'to_link',
                    id_link: ultraStrictCandidates[0].id
                };
            }
            console.log("Pas de NumBSD ou BON trouvé");
        }
        console.log("laaaaa");
        // ÉTAPE 2: Liaison évidente (filtrage strict)
        if (rules.includeStrictStep) {
            console.log("check date");
            const strictCandidates = candidates.filter(candidate => {
                // Date stricte (priorité à takenOverAt si présent)
                if (rules.useDateStrict) {
                    const takenOverAt = candidate.infos_json?.formAPI?.createFormInput?.takenOverAt || '';
                    const candidateDate = takenOverAt || candidate.created_at;
                    console.log("candidateDate", candidateDate);
                    console.log("normalizedPdf.date", normalizedPdf.date);
                    console.log("isDateInRange", isDateInRange(candidateDate, normalizedPdf.date, rules.strictDays));
                    if (!isDateInRange(candidateDate, normalizedPdf.date, rules.strictDays)) {
                        return false;
                    }
                    console.log("Date trouvée");
                }

                // Prestataire (destinataire OU transporteur)
                if (rules.usePrestaStrict) {
                    const pdfDestinataire = normalizedPdf.destinataire || '';
                    const pdfTransporteur = normalizedPdf.transporteur || '';
                    const candidateRecipient = candidate.infos_json.formAPI.createFormInput.recipient.company.name || '';
                    const candidateTransporter = candidate.infos_json.formAPI.createFormInput.transporter.company.name || '';
                    const recipientOk = pdfDestinataire && candidateRecipient && candidateRecipient.toLowerCase() === pdfDestinataire;
                    const transporterOk = pdfTransporteur && candidateTransporter && candidateTransporter.toLowerCase() === pdfTransporteur;
                    if (!recipientOk && !transporterOk) {
                        return false;
                    }
                    console.log("Prestataire trouvé");
                }

                // Site strict (toujours emitter.company.name)
                if (rules.useSiteStrict) {
                    const candidateSite = (candidate.infos_json.formAPI.createFormInput.emitter.company?.name || '');
                    if (normalizedPdf.site && candidateSite.toLowerCase() !== normalizedPdf.site) {
                        return false;
                    }
                    console.log("Site trouvé");
                }

                // Matière: combinaison CED et/ou nom déchet (fuzzy)
                let cedOk = true;
                let wasteOk = true;

                if (rules.useCedStrict) {
                    if (normalizedPdf.ced && candidate.infos_json.formAPI.createFormInput.wasteDetails.code) {
                        const pdfCedNumbers = extractNumbersFromCed(normalizedPdf.ced);
                        const candidateCedNumbers = extractNumbersFromCed(candidate.infos_json.formAPI.createFormInput.wasteDetails.code);
                        cedOk = !(pdfCedNumbers && candidateCedNumbers) || pdfCedNumbers === candidateCedNumbers;
                    }
                    console.log("CED trouvé :", cedOk);
                }

                if (rules.useWasteNameStrict) {
                    const pdfWaste = normalizedPdf.waste_name || '';
                    const candidateWaste = candidate.infos_json.formAPI.createFormInput.wasteDetails.name || '';
                    const score = computeSimilarity(pdfWaste, candidateWaste);
                    wasteOk = score >= rules.wasteNameThresholdStrict;
                    console.log("Nom déchet trouvé :", wasteOk);
                }

                // Si aucun des deux filtres matière n'est activé, on n'en tient pas compte
                if (!rules.useCedStrict && !rules.useWasteNameStrict) {
                    console.log("Pas de CED ou de nom déchet trouvé");
                    return true;
                }

                // Si un seul est activé, utiliser celui-ci
                if (rules.useCedStrict && !rules.useWasteNameStrict) {
                    console.log("CED trouvé :", cedOk);
                    return cedOk;
                }
                if (!rules.useCedStrict && rules.useWasteNameStrict) {
                    console.log("Nom déchet trouvé :", wasteOk);
                    return wasteOk;
                }

                // Les deux sont activés: combiner selon l'opérateur
                console.log('cedOk', cedOk, 'wasteOk', wasteOk);
                return rules.wasteNameCedOperatorStrict === 'AND' ? (cedOk && wasteOk) : (cedOk || wasteOk);
            });

            if (strictCandidates.length === 1) {
                return {
                    action: 'to_link',
                    id_link: strictCandidates[0].id
                };
            }
        }

        // ÉTAPE 3: Vérification pour création (filtrage large)
        if (rules.includeLooseStep) {
            const looseCandidates = candidates.filter(candidate => {
                // Date large (priorité à takenOverAt si présent)
                if (rules.useDateLoose) {
                    const takenOverAt = candidate.infos_json?.formAPI?.createFormInput?.takenOverAt || '';
                    const candidateDate = takenOverAt || candidate.created_at;
                    if (!isDateInRange(candidateDate, normalizedPdf.date, rules.looseDays)) {
                        return false;
                    }
                }

                // Prestataire large
                if (rules.usePrestaLoose) {
                    const pdfDestinataire = normalizedPdf.destinataire || '';
                    const pdfTransporteur = normalizedPdf.transporteur || '';
                    const candidateRecipient = candidate.infos_json.formAPI.createFormInput.recipient.company.name || '';
                    const candidateTransporter = candidate.infos_json.formAPI.createFormInput.transporter.company.name || '';
                    const recipientOk = pdfDestinataire && candidateRecipient && candidateRecipient.toLowerCase() === pdfDestinataire;
                    const transporterOk = pdfTransporteur && candidateTransporter && candidateTransporter.toLowerCase() === pdfTransporteur;
                    if (!recipientOk && !transporterOk) {
                        return false;
                    }
                }

                // Site large (toujours emitter.company.name)
                if (rules.useSiteLoose) {
                    const candidateSite = (candidate.infos_json.formAPI.createFormInput.emitter.company?.name || '');
                    if (normalizedPdf.site && candidateSite.toLowerCase() !== normalizedPdf.site) {
                        return false;
                    }
                }

                // Matière: combinaison CED et/ou nom déchet (fuzzy) en large
                let cedOk = true;
                let wasteOk = true;

                if (rules.useCedLoose) {
                    if (normalizedPdf.ced && candidate.infos_json.formAPI.createFormInput.wasteDetails.code) {
                        const pdfCedNumbers = extractNumbersFromCed(normalizedPdf.ced);
                        const candidateCedNumbers = extractNumbersFromCed(candidate.infos_json.formAPI.createFormInput.wasteDetails.code);
                        cedOk = !(pdfCedNumbers && candidateCedNumbers) || pdfCedNumbers === candidateCedNumbers;
                    }
                }

                if (rules.useWasteNameLoose) {
                    const pdfWaste = normalizedPdf.waste_name || '';
                    const candidateWaste = candidate.infos_json.formAPI.createFormInput.wasteDetails.name || '';
                    const score = computeSimilarity(pdfWaste, candidateWaste);
                    wasteOk = score >= rules.wasteNameThresholdLoose;
                }

                if (!rules.useCedLoose && !rules.useWasteNameLoose) {
                    return true;
                }
                if (rules.useCedLoose && !rules.useWasteNameLoose) {
                    return cedOk;
                }
                if (!rules.useCedLoose && rules.useWasteNameLoose) {
                    return wasteOk;
                }
                return rules.wasteNameCedOperatorLoose === 'AND' ? (cedOk && wasteOk) : (cedOk || wasteOk);
            });

            if (looseCandidates.length === 1) {
                return {
                    action: 'to_check_by_user',
                    id_link: looseCandidates[0].id
                };
            }

            if (looseCandidates.length === 0) {
                return {
                    action: 'to_create'
                };
            }

            return {
                action: 'to_check_by_user'
            };
        }

        // Si les étapes précédentes sont désactivées ou n'ont rien donné
        return {
            action: 'to_check_by_user'
        };

    } catch (error) {
        console.error('Erreur dans LinkOrCreate:', error);
        return {
            action: 'to_check_by_user'
        };
    }
};
