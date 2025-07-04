import { 
    getSiretByPrestataire, 
    getPrestataireBySiret, 
    getCodeCedByDechet, 
    getDechetByCodeCed, 
    getSiretBySite, 
    getSiteBySiret,
    fetchAutocompletionData
} from './FormulaireExtractFactureFunctionnal';

interface MatchResult {
    bestMatch: string;
    score: number;
    confidence: 'exact' | 'high' | 'medium' | 'low' | 'none';
    details: {
        exactMatch: boolean;
        includesMatch: boolean;
        tokenMatches: number;
        totalTokens: number;
        charSimilarity: number;
        lengthRatio: number;
        commonPrefix: number;
        commonSuffix: number;
    };
}

interface TokenMatch {
    searchToken: string;
    bestOptionToken: string;
    score: number;
    matchType: 'exact' | 'includes' | 'similar' | 'none';
}

// Types pour les données Gemini
interface GeminiLineHeader {
    filiere?: string;
    site_nom?: string;
    bon_pesee?: string;
    site_siret?: string;
    code_dechet?: string;
    date_depart?: string;
    num_dossier?: string;
    type_dechet?: string;
    bon_intention?: string;
    site_description?: string;
    site_num_affaire?: string;
    dechet_description?: string;
}

interface GeminiLineBody {
    unite?: string;
    quantite?: number;
    montant_ht?: number;
    prix_unitaire?: number;
    type_operation?: string;
}

interface GeminiDepart {
    line_header?: GeminiLineHeader;
    line_body?: GeminiLineBody[];
    linked_to_bsd?: boolean;
}

interface GeminiData {
    extracted_data?: {
        header?: {
            num_facture?: string;
            date_facture?: string;
            prestataire_nom?: string;
            prestataire_siret?: string;
            prestataire_num_client?: string;
            prestataire_description?: string;
        };
        departs?: GeminiDepart[];
        footer?: {
            total_ht?: number;
        };
    };
    header?: {
        num_facture?: string;
        date_facture?: string;
        prestataire_nom?: string;
        prestataire_siret?: string;
        prestataire_num_client?: string;
        prestataire_description?: string;
    };
    departs?: GeminiDepart[];
    footer?: {
        total_ht?: number;
    };
}

// Types pour le formulaire
interface FactureLineHeader {
    prestataire_nom: string;
    prestataire_description: string;
    prestataire_siret: string;
    prestataire_num_client: string;
    num_facture: string;
    date_facture: string;
}

interface FactureLineBody {
    type_operation: string;
    unite: string;
    quantite: number;
    prix_unitaire: number;
    montant_ht: number;
}

interface FactureLineDepart {
    site_nom: string;
    site_siret: string;
    dechet_nom: string;
    code_ced: string;
    date_collecte: string;
    contenant_nom: string;
    contenant_volume: string;
    contenant_unite: string;
    body: FactureLineBody[];
}

interface FactureLine {
    header: FactureLineHeader;
    departs: FactureLineDepart[];
    footer: {
        total_ht: number;
    };
}

// Types pour l'autocomplétion
interface RawAutocompletionData {
    id: number;
    created_at: string;
    entreprise_id: number;
    site: { nom: string; siret: string; adresseSiege: string } | null;
    transporteur: { nomBoite?: string; siret?: string; adresse?: string } | null;
    destinataire: { nomBoite?: string; siret?: string; adresse?: string } | null;
    dechet: { nom: string; codeCED: string; onu: string; adr: string } | null;
    contrat: { nom: string; num_client: string } | null;
    contenant?: { nom: string; volume: string; uniteVolume: string } | null;
}

// Constantes pour les options
const ALL_OPERATIONS = ['Collecte', 'Transport', 'Traitement', 'Élimination'];
const UNITES = ['kg', 'tonnes', 'm³', 'L', 'unités'];

// Fonction pour obtenir les données initiales du formulaire
const getInitialFormData = (): FactureLine => ({
    header: {
        prestataire_nom: '',
        prestataire_description: '',
        prestataire_siret: '',
        prestataire_num_client: '',
        num_facture: '',
        date_facture: new Date().toISOString().split('T')[0]
    },
    departs: [{
        site_nom: '',
        site_siret: '',
        dechet_nom: '',
        code_ced: '',
        date_collecte: new Date().toISOString().split('T')[0],
        contenant_nom: '',
        contenant_volume: '',
        contenant_unite: '',
        body: [{
            type_operation: ALL_OPERATIONS[0],
            unite: UNITES[0],
            quantite: 0,
            prix_unitaire: 0,
            montant_ht: 0
        }]
    }],
    footer: {
        total_ht: 0
    }
});

// Fonction pour convertir en nombre flottant
const safeParseFloat = (value: unknown): number => {
    if (value === null || value === undefined || value === '') return 0;
    const num = parseFloat(String(value));
    return isNaN(num) ? 0 : num;
};

// Normalisation agressive : garder seulement lettres, chiffres et espaces
function aggressiveNormalize(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ') // Remplacer caractères spéciaux par espaces
        .replace(/\s+/g, ' ') // Normaliser espaces multiples
        .trim();
}

// Tokenisation intelligente : diviser en tokens significatifs
function tokenize(text: string): string[] {
    return text
        .split(/\s+/)
        .filter(token => token.length > 0)
        .map(token => token.trim());
}

// Calcul de similarité de caractères avec algorithme de Levenshtein simplifié
function calculateCharSimilarity(str1: string, str2: string): number {
    if (str1.length === 0 || str2.length === 0) return 0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    // Correspondance caractère par caractère
    let matches = 0;
    let consecutiveMatches = 0;
    let maxConsecutive = 0;
    
    for (let i = 0; i < shorter.length; i++) {
        if (shorter[i] === longer[i]) {
            matches++;
            consecutiveMatches++;
            maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
        } else {
            consecutiveMatches = 0;
        }
    }
    
    // Bonus pour les correspondances consécutives (plus importantes)
    const consecutiveBonus = (maxConsecutive / shorter.length) * 0.5;
    const baseScore = matches / longer.length;
    
    return Math.min(1, baseScore + consecutiveBonus);
}

// Trouver le meilleur match pour un token
function findBestTokenMatch(searchToken: string, optionTokens: string[]): TokenMatch {
    let bestMatch: TokenMatch = {
        searchToken,
        bestOptionToken: '',
        score: 0,
        matchType: 'none'
    };
    
    for (const optionToken of optionTokens) {
        // 1. Match exact
        if (searchToken === optionToken) {
            return {
                searchToken,
                bestOptionToken: optionToken,
                score: 1.0,
                matchType: 'exact'
            };
        }
        
        // 2. Match par inclusion
        if (optionToken.includes(searchToken) || searchToken.includes(optionToken)) {
            const ratio = Math.min(searchToken.length, optionToken.length) / Math.max(searchToken.length, optionToken.length);
            if (ratio > bestMatch.score) {
                bestMatch = {
                    searchToken,
                    bestOptionToken: optionToken,
                    score: ratio * 0.9,
                    matchType: 'includes'
                };
            }
        }
        
        // 3. Match par similarité
        const similarity = calculateCharSimilarity(searchToken, optionToken);
        if (similarity > bestMatch.score) {
            bestMatch = {
                searchToken,
                bestOptionToken: optionToken,
                score: similarity * 0.7,
                matchType: 'similar'
            };
        }
    }
    
    return bestMatch;
}

// Calculer les métriques globales
function calculateGlobalMetrics(searchText: string, optionText: string) {
    const searchLower = searchText.toLowerCase();
    const optionLower = optionText.toLowerCase();
    
    // Ratio de longueur
    const lengthRatio = Math.min(searchText.length, optionText.length) / Math.max(searchText.length, optionText.length);
    
    // Préfixe commun
    let commonPrefix = 0;
    for (let i = 0; i < Math.min(searchLower.length, optionLower.length); i++) {
        if (searchLower[i] === optionLower[i]) {
            commonPrefix++;
        } else {
            break;
        }
    }
    const prefixRatio = commonPrefix / Math.max(searchText.length, optionText.length);
    
    // Suffixe commun
    let commonSuffix = 0;
    for (let i = 1; i <= Math.min(searchLower.length, optionLower.length); i++) {
        if (searchLower[searchLower.length - i] === optionLower[optionLower.length - i]) {
            commonSuffix++;
        } else {
            break;
        }
    }
    const suffixRatio = commonSuffix / Math.max(searchText.length, optionText.length);
    
    return { lengthRatio, prefixRatio, suffixRatio };
}

export const findBestMatch = (searchTerm: string, options: string[]): string => {
    console.log(`\n🎯 === DÉBUT MATCHING EXPERT POUR "${searchTerm}" ===`);
    console.log(`📊 Options disponibles (${options.length}):`, options);
    
    if (!searchTerm || !options || options.length === 0) {
        console.log('❌ Terme de recherche ou options manquants');
        return '';
    }

    // Normalisation agressive
    const normalizedSearch = aggressiveNormalize(searchTerm);
    const searchTokens = tokenize(normalizedSearch);
    
    console.log(`📝 Terme normalisé: "${normalizedSearch}"`);
    console.log(`🔤 Tokens extraits: [${searchTokens.join(', ')}]`);

    let bestMatch = '';
    let bestScore = 0;
    let bestDetails: {
        tokenMatches: TokenMatch[];
        globalMetrics: { lengthRatio: number; prefixRatio: number; suffixRatio: number };
        finalScore: number;
    } | null = null;

    for (const option of options) {
        console.log(`\n🔍 === ANALYSE OPTION: "${option}" ===`);
        
        const normalizedOption = aggressiveNormalize(option);
        const optionTokens = tokenize(normalizedOption);
        
        console.log(`   Normalisé: "${normalizedOption}"`);
        console.log(`   Tokens: [${optionTokens.join(', ')}]`);

        // 1. Correspondance exacte (après normalisation)
        if (normalizedSearch === normalizedOption) {
            console.log(`   ✅ CORRESPONDANCE EXACTE PARFAITE!`);
            return option;
        }

        // 2. Correspondance par inclusion
        if (normalizedOption.includes(normalizedSearch) || normalizedSearch.includes(normalizedOption)) {
            const inclusionScore = Math.max(normalizedSearch.length / normalizedOption.length, normalizedOption.length / normalizedSearch.length);
            console.log(`   ✅ CORRESPONDANCE PAR INCLUSION! (score: ${inclusionScore.toFixed(3)})`);
            if (inclusionScore > 0.7) {
                return option;
            }
        }

        // 3. Analyse token par token
        console.log(`   🔤 Analyse token par token:`);
        const tokenMatches: TokenMatch[] = [];
        let totalTokenScore = 0;
        
        for (const searchToken of searchTokens) {
            const tokenMatch = findBestTokenMatch(searchToken, optionTokens);
            tokenMatches.push(tokenMatch);
            totalTokenScore += tokenMatch.score;
            
            console.log(`      "${searchToken}" → "${tokenMatch.bestOptionToken}" (${tokenMatch.matchType}, score: ${tokenMatch.score.toFixed(3)})`);
        }

        // 4. Métriques globales
        const globalMetrics = calculateGlobalMetrics(normalizedSearch, normalizedOption);
        console.log(`   📊 Métriques globales:`);
        console.log(`      Ratio longueur: ${globalMetrics.lengthRatio.toFixed(3)}`);
        console.log(`      Préfixe commun: ${globalMetrics.prefixRatio.toFixed(3)}`);
        console.log(`      Suffixe commun: ${globalMetrics.suffixRatio.toFixed(3)}`);

        // 5. Calcul du score final avec pondération experte
        const tokenScore = (totalTokenScore / searchTokens.length) * 0.6; // 60% du score
        const lengthScore = globalMetrics.lengthRatio * 0.2; // 20% du score
        const prefixScore = globalMetrics.prefixRatio * 0.1; // 10% du score
        const suffixScore = globalMetrics.suffixRatio * 0.1; // 10% du score
        
        const finalScore = tokenScore + lengthScore + prefixScore + suffixScore;
        
        console.log(`   🎯 Scores finaux:`);
        console.log(`      Tokens: ${tokenScore.toFixed(3)} (${(tokenScore/finalScore*100).toFixed(1)}%)`);
        console.log(`      Longueur: ${lengthScore.toFixed(3)} (${(lengthScore/finalScore*100).toFixed(1)}%)`);
        console.log(`      Préfixe: ${prefixScore.toFixed(3)} (${(prefixScore/finalScore*100).toFixed(1)}%)`);
        console.log(`      Suffixe: ${suffixScore.toFixed(3)} (${(suffixScore/finalScore*100).toFixed(1)}%)`);
        console.log(`      TOTAL: ${finalScore.toFixed(3)}`);

        if (finalScore > bestScore) {
            bestScore = finalScore;
            bestMatch = option;
            bestDetails = {
                tokenMatches,
                globalMetrics,
                finalScore
            };
            console.log(`   🏆 NOUVEAU MEILLEUR MATCH!`);
        }
    }

    // Seuil adaptatif basé sur le nombre de tokens
    const adaptiveThreshold = Math.max(0.1, 0.3 - (searchTokens.length * 0.05));
    const confidence = bestScore >= 0.8 ? 'exact' : 
                      bestScore >= 0.6 ? 'high' : 
                      bestScore >= 0.4 ? 'medium' : 
                      bestScore >= adaptiveThreshold ? 'low' : 'none';

    console.log(`\n🏆 === RÉSULTAT FINAL ===`);
    console.log(`   Meilleur match: "${bestMatch}"`);
    console.log(`   Score: ${bestScore.toFixed(3)}`);
    console.log(`   Confiance: ${confidence}`);
    console.log(`   Seuil adaptatif: ${adaptiveThreshold.toFixed(3)}`);
    console.log(`   Tokens matchés: ${bestDetails?.tokenMatches.filter((t: TokenMatch) => t.score > 0).length}/${searchTokens.length}`);
    
    if (bestDetails) {
        console.log(`   Détails des matches:`);
        bestDetails.tokenMatches.forEach((match: TokenMatch, index: number) => {
            console.log(`      ${index + 1}. "${match.searchToken}" → "${match.bestOptionToken}" (${match.matchType}, ${match.score.toFixed(3)})`);
        });
    }
    
    console.log(`🎯 === FIN MATCHING EXPERT POUR "${searchTerm}" ===\n`);
    
    return bestMatch;
};

export const transformGeminiDataToFormData = async (
    geminiData: GeminiData, 
    autocompletionOptions?: {
        prestataireOptions: { value: string; isSuggested: boolean }[];
        siretOptions: { value: string; isSuggested: boolean }[];
        siteOptions: { value: string; isSuggested: boolean }[];
        siteSiretOptions: { value: string; isSuggested: boolean }[];
        dechetOptions: { value: string; isSuggested: boolean }[];
        codeCedOptions: { value: string; isSuggested: boolean }[];
        numClientOptions: { value: string; isSuggested: boolean }[];
        contenantOptions: { value: string; isSuggested: boolean }[];
    },
    entrepriseId?: string
): Promise<FactureLine> => {
    console.log('📊 Données Gemini reçues:', geminiData);
    
    // Extraire les données réelles depuis extracted_data
    const actualData = geminiData.extracted_data || geminiData;
    
    const initialData = getInitialFormData();
    
    // Extraire les valeurs des options d'autocomplétion
    const prestataireValues = autocompletionOptions?.prestataireOptions?.map(opt => opt.value) || [];
    const siretValues = autocompletionOptions?.siretOptions?.map(opt => opt.value) || [];
    const siteValues = autocompletionOptions?.siteOptions?.map(opt => opt.value) || [];
    const siteSiretValues = autocompletionOptions?.siteSiretOptions?.map(opt => opt.value) || [];
    const dechetValues = autocompletionOptions?.dechetOptions?.map(opt => opt.value) || [];
    const codeCedValues = autocompletionOptions?.codeCedOptions?.map(opt => opt.value) || [];
    const numClientValues = autocompletionOptions?.numClientOptions?.map(opt => opt.value) || [];
    const contenantValues = autocompletionOptions?.contenantOptions?.map(opt => opt.value) || [];

    // Récupérer les données brutes pour l'auto-complétion
    let rawAutocompletionData: RawAutocompletionData[] = [];
    if (entrepriseId) {
        rawAutocompletionData = await fetchAutocompletionData(entrepriseId);
        console.log('📋 Données d\'auto-complétion récupérées:', rawAutocompletionData.length, 'entrées');
    }

    // Mapper le header avec fuzzy matching pour les selects
    if (actualData.header) {
        const header = actualData.header;
        
        // Trouver la meilleure correspondance pour les champs select
        const bestPrestataire = prestataireValues.length > 0
            ? findBestMatch(header.prestataire_nom || '', prestataireValues)
            : header.prestataire_nom || '';
            
        const bestSiret = siretValues.length > 0
            ? findBestMatch(header.prestataire_siret || '', siretValues)
            : header.prestataire_siret || '';
            
        const bestNumClient = numClientValues.length > 0
            ? findBestMatch(header.prestataire_num_client || '', numClientValues)
            : header.prestataire_num_client || '';
        
        initialData.header = {
            ...initialData.header,
            prestataire_nom: bestPrestataire,
            prestataire_siret: bestSiret,
            prestataire_description: header.prestataire_description || '',
            prestataire_num_client: bestNumClient,
            num_facture: header.num_facture || '',
            date_facture: header.date_facture || ''
        };

        // Auto-complétion des champs liés du header
        // Vérifier si le prestataire a été trouvé par matching mais pas le SIRET
        if (bestPrestataire && bestPrestataire !== '' && (header.prestataire_siret === '' || !header.prestataire_siret)) {
            console.log('🔄 Auto-complétion: Prestataire -> SIRET', { prestataire: bestPrestataire, siretOriginal: header.prestataire_siret });
            const siret = getSiretByPrestataire(rawAutocompletionData, bestPrestataire);
            if (siret) {
                initialData.header.prestataire_siret = siret;
                console.log('✅ SIRET auto-complété:', siret);
            }
        }
    }

    // Mapper les départs avec fuzzy matching
    if (actualData.departs && Array.isArray(actualData.departs)) {
        initialData.departs = actualData.departs.map((depart: GeminiDepart, index: number) => {
            const mappedDepart = {
                site_nom: '',
                site_siret: '',
                dechet_nom: '',
                code_ced: '',
                date_collecte: '',
                contenant_nom: '',
                contenant_volume: '',
                contenant_unite: '',
                body: [] as FactureLineBody[]
            };

            // Mapper line_header vers les champs du départ avec fuzzy matching
            if (depart.line_header) {
                const lineHeader = depart.line_header;
                
                mappedDepart.site_nom = siteValues.length > 0
                    ? findBestMatch(lineHeader.site_nom || '', siteValues)
                    : lineHeader.site_nom || '';
                    
                mappedDepart.site_siret = siteSiretValues.length > 0
                    ? findBestMatch(lineHeader.site_siret || '', siteSiretValues)
                    : lineHeader.site_siret || '';
                    
                mappedDepart.dechet_nom = dechetValues.length > 0
                    ? findBestMatch(lineHeader.type_dechet || '', dechetValues)
                    : lineHeader.type_dechet || '';
                    
                mappedDepart.code_ced = codeCedValues.length > 0
                    ? findBestMatch(lineHeader.code_dechet || '', codeCedValues)
                    : lineHeader.code_dechet || '';
                    
                mappedDepart.date_collecte = lineHeader.date_depart || '';
                
                mappedDepart.contenant_nom = contenantValues.length > 0
                    ? findBestMatch('', contenantValues) // Pas de donnée contenant dans Gemini
                    : '';

                // Auto-complétion des champs liés du départ
                // Vérifier si le site a été trouvé par matching mais pas le SIRET
                if (mappedDepart.site_nom && mappedDepart.site_nom !== '' && (lineHeader.site_siret === '' || !lineHeader.site_siret)) {
                    console.log('🔄 Auto-complétion: Site -> SIRET', { site: mappedDepart.site_nom, siretOriginal: lineHeader.site_siret });
                    const siteSiret = getSiretBySite(rawAutocompletionData, mappedDepart.site_nom);
                    if (siteSiret) {
                        mappedDepart.site_siret = siteSiret;
                        console.log('✅ SIRET site auto-complété:', siteSiret);
                    }
                }

                // Vérifier si le déchet a été trouvé par matching mais pas le code CED
                if (mappedDepart.dechet_nom && mappedDepart.dechet_nom !== '' && (lineHeader.code_dechet === '' || !lineHeader.code_dechet)) {
                    console.log('🔄 Auto-complétion: Déchet -> Code CED', { dechet: mappedDepart.dechet_nom, codeCedOriginal: lineHeader.code_dechet });
                    const codeCed = getCodeCedByDechet(rawAutocompletionData, mappedDepart.dechet_nom);
                    if (codeCed) {
                        mappedDepart.code_ced = codeCed;
                        console.log('✅ Code CED auto-complété:', codeCed);
                    }
                }
            }

            // Mapper line_body vers body avec conversion en nombres
            if (depart.line_body && Array.isArray(depart.line_body)) {
                mappedDepart.body = depart.line_body.map((line: GeminiLineBody) => ({
                    type_operation: line.type_operation || '',
                    unite: line.unite || '',
                    quantite: safeParseFloat(line.quantite),
                    prix_unitaire: safeParseFloat(line.prix_unitaire),
                    montant_ht: safeParseFloat(line.montant_ht)
                }));
            }

            return mappedDepart;
        });
    }

    // Mettre à jour le total avec conversion en nombre
    initialData.footer.total_ht = safeParseFloat(actualData.footer?.total_ht);

    console.log('✅ Données transformées:', initialData);
    return initialData;
};
