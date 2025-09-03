// Codes de traitement simplifiés
export const CODES_VALORISATION_ENERGETIQUE = ['R1'];
export const CODES_VALORISATION_MATIERE = ['RM','R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'R2-R10'];
export const CODES_REEMPLOI = ['RX'];
export const CODES_REUTILISATION = ['PR'];
export const CODES_ELIMINATION = ['DE', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'D14', 'D15'];

// Exports pour ReportGenerator.ts
// Valorisation globale = énergétique + matière (exclut PR et RX)
export const tauxValorisationGlobale = [...CODES_VALORISATION_ENERGETIQUE, ...CODES_VALORISATION_MATIERE];
export const tauxValorisationMatière = CODES_VALORISATION_MATIERE;
// Réemploi et réutilisation (PR et RX) - séparés de la valorisation
export const tauxValorisationReemploiReutilisation = [...CODES_REEMPLOI, ...CODES_REUTILISATION];

// Fonction simple pour classifier un code de traitement
export const classifyTreatmentCode = (code: string): 'energetique' | 'matiere' | 'reemploi' | 'reutilisation' | 'elimination' | 'autre' => {
    const cleanCode = code.replace(/\s/g, '').toUpperCase();
    
    if (CODES_VALORISATION_ENERGETIQUE.includes(cleanCode)) {
        return 'energetique';
    }
    
    if (CODES_VALORISATION_MATIERE.includes(cleanCode)) {
        return 'matiere';
    }
    
    if (CODES_REEMPLOI.includes(cleanCode)) {
        return 'reemploi';
    }
    
    if (CODES_REUTILISATION.includes(cleanCode)) {
        return 'reutilisation';
    }
    
    if (CODES_ELIMINATION.includes(cleanCode)) {
        return 'elimination';
    }
    
    return 'autre';
};

// Métagroupes simplifiés pour EnvBarChart.tsx
export const typeTraitement = {
    "Élimination": CODES_ELIMINATION,
    "Valorisation énergétique": CODES_VALORISATION_ENERGETIQUE,
    "Valorisation matière": CODES_VALORISATION_MATIERE,
    "Réemploi": CODES_REEMPLOI,
    "Réutilisation": CODES_REUTILISATION
};

// Définitions simplifiées pour les couleurs
export const codeTraitementDefinitions = [
    { groupe: "Élimination", code: "D1-D15", nom: "Élimination", couleur: "#1a1a1a" },
    { groupe: "Valorisation énergétique", code: "R1", nom: "Valorisation énergétique", couleur: "#4a8b18" },
    { groupe: "Valorisation matière", code: "R2-R13", nom: "Valorisation matière", couleur: "#5fa626" },
    { groupe: "Réemploi", code: "RX", nom: "Réemploi", couleur: "#8B5A2B" },
    { groupe: "Réutilisation", code: "PR", nom: "Réutilisation", couleur: "#D2691E" }
];

// Définitions pour l'affichage (optionnel)
export const treatmentLabels = {
    "R1": "R1 - Valorisation énergétique",
    "RM": "RM - Valorisation matière",
    "RX": "RX - Réemploi",
    "PR": "PR - Réutilisation",
    "R2": "R2 - Récupération de solvants",
    "R3": "R3 - Recyclage substances organiques",
    "R4": "R4 - Recyclage des métaux",
    "R5": "R5 - Recyclage matières inorganiques",
    "R6": "R6 - Régénération acides/bases",
    "R7": "R7 - Valorisation composants antipollution",
    "R8": "R8 - Valorisation catalyseurs",
    "R9": "R9 - Régénération des huiles",
    "R10": "R10 - Épandage agricole/écologique",
    "R11": "R11 - Utilisation après R1-R10",
    "R12": "R12 - Échange avant R1-R11",
    "R13": "R13 - Stockage avant R1-R12",
    "R2-R10": "R2-R10 - Valorisation matière générale",
    "DE": "DE - Élimination",
    "D1": "D1 - Mise en décharge",
    "D2": "D2 - Traitement terrestre",
    "D3": "D3 - Injection en profondeur",
    "D4": "D4 - Lagunage",
    "D5": "D5 - Confinement spécial",
    "D6": "D6 - Rejet dans les eaux",
    "D7": "D7 - Immersion en mer",
    "D8": "D8 - Traitement biologique",
    "D9": "D9 - Traitement physico-chimique",
    "D10": "D10 - Incinération sur terre",
    "D11": "D11 - Incinération en mer",
    "D12": "D12 - Stockage permanent",
    "D13": "D13 - Regroupement avant D1-D12",
    "D14": "D14 - Reconditionnement avant D1-D13",
    "D15": "D15 - Stockage en attente D1-D14"
};