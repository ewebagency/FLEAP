// Définir l'interface pour les entrées du tableau
interface EmissionEntry {
    CED: string;
    Méthode: string;
    "Carbone (kg CO₂/tonne)": number;
}

// Tableau de correspondance
const EMISSIONS_TABLE: EmissionEntry[] = [
    {"CED": "15 01 01", "Méthode": "R5", "Carbone (kg CO₂/tonne)": 45},
    {"CED": "20 03 01", "Méthode": "D1", "Carbone (kg CO₂/tonne)": 450},
    {"CED": "20 03 01", "Méthode": "R1", "Carbone (kg CO₂/tonne)": 250},
    {"CED": "19 12 10", "Méthode": "R1", "Carbone (kg CO₂/tonne)": 140},
    {"CED": "19 12 10", "Méthode": "D10", "Carbone (kg CO₂/tonne)": 350},
    {"CED": "17 01 07", "Méthode": "R5", "Carbone (kg CO₂/tonne)": 25},
    {"CED": "17 01 07", "Méthode": "D1", "Carbone (kg CO₂/tonne)": 300},
    {"CED": "16 01 03", "Méthode": "R4", "Carbone (kg CO₂/tonne)": 190},
    {"CED": "16 01 03", "Méthode": "R1", "Carbone (kg CO₂/tonne)": 250},
    {"CED": "13 02 08", "Méthode": "R9", "Carbone (kg CO₂/tonne)": 90},
    {"CED": "13 02 08", "Méthode": "D9", "Carbone (kg CO₂/tonne)": 350},
    {"CED": "20 01 01", "Méthode": "R3", "Carbone (kg CO₂/tonne)": 18},
    {"CED": "20 01 38", "Méthode": "R1", "Carbone (kg CO₂/tonne)": 175},
    {"CED": "20 01 38", "Méthode": "D10", "Carbone (kg CO₂/tonne)": 400},
    {"CED": "10 01 01", "Méthode": "D10", "Carbone (kg CO₂/tonne)": 600},
    {"CED": "10 01 01", "Méthode": "R1", "Carbone (kg CO₂/tonne)": 300},
    {"CED": "02 01 04", "Méthode": "R10", "Carbone (kg CO₂/tonne)": 50},
    {"CED": "02 01 04", "Méthode": "D6", "Carbone (kg CO₂/tonne)": 180},
    {"CED": "08 03 17", "Méthode": "R3", "Carbone (kg CO₂/tonne)": 120},
    {"CED": "08 03 17", "Méthode": "D15", "Carbone (kg CO₂/tonne)": 350},
    {"CED": "06 13 01", "Méthode": "D8", "Carbone (kg CO₂/tonne)": 300},
    {"CED": "06 13 01", "Méthode": "R5", "Carbone (kg CO₂/tonne)": 40},
    {"CED": "12 01 03", "Méthode": "R4", "Carbone (kg CO₂/tonne)": 70},
    {"CED": "12 01 03", "Méthode": "D1", "Carbone (kg CO₂/tonne)": 350},
    {"CED": "15 02 02", "Méthode": "D15", "Carbone (kg CO₂/tonne)": 250},
    {"CED": "15 02 02", "Méthode": "D1", "Carbone (kg CO₂/tonne)": 500},
    {"CED": "18 01 03", "Méthode": "D1", "Carbone (kg CO₂/tonne)": 500},
    {"CED": "18 01 03", "Méthode": "D9", "Carbone (kg CO₂/tonne)": 350},
    {"CED": "19 08 12", "Méthode": "D6", "Carbone (kg CO₂/tonne)": 320},
    {"CED": "19 08 12", "Méthode": "R1", "Carbone (kg CO₂/tonne)": 200},
    {"CED": "07 02 13", "Méthode": "D9", "Carbone (kg CO₂/tonne)": 400},
    {"CED": "07 02 13", "Méthode": "R3", "Carbone (kg CO₂/tonne)": 150},
    {"CED": "01 03 06", "Méthode": "R5", "Carbone (kg CO₂/tonne)": 15},
    {"CED": "01 03 06", "Méthode": "D1", "Carbone (kg CO₂/tonne)": 250},
    {"CED": "00 00 00", "Méthode": "RX", "Carbone (kg CO₂/tonne)": 0},
    {"CED": "15 01 01", "Méthode": "PR", "Carbone (kg CO₂/tonne)": 0}
];

// Valeurs par défaut pour chaque méthode de traitement
const DEFAULT_EMISSIONS = {
    'D1': 450,   // Mise en décharge
    'D10': 400,  // Incinération sans valorisation
    'R1': 200,   // Incinération avec valorisation énergétique
    'R3': 100,   // Recyclage organique
    'R4': 130,   // Recyclage métaux
    'R5': 30,    // Recyclage minéral
    'R9': 90,    // Régénération huiles
    'R10': 50,   // Épandage
    'D6': 250,   // Rejet dans l'eau
    'D8': 300,   // Traitement biologique
    'D9': 350,   // Traitement physico-chimique
    'D15': 300,  // Stockage
    'RX': 0,     // Réemploi
    'PR': 0,     // Réutilisation
    'default': 0 // Valeur par défaut si code inconnu
};

export function estimerCarbone(ced: string, valorisationCode: string, poids: number) {
    if (!ced || !poids) {
        return '0.00';  // Retourner juste le nombre pour faciliter le parsing
    }

    const operationCode = valorisationCode?.replaceAll(' ', '') || 'default';
    const quantite = poids > 0 ? poids : 0;

    // Chercher dans le tableau de correspondance
    const entry = EMISSIONS_TABLE.find(e => 
        e.CED === ced && e.Méthode === operationCode
    );

    // Si une correspondance exacte est trouvée, utiliser cette valeur
    if (entry) {
        const emissionsCarbone = (quantite * entry["Carbone (kg CO₂/tonne)"]) / 1000; // Conversion kg -> tonnes
        return `${emissionsCarbone.toFixed(2)}`;
    }

    // Sinon, utiliser la valeur par défaut pour la méthode de traitement
    const defaultFactor = DEFAULT_EMISSIONS[operationCode as keyof typeof DEFAULT_EMISSIONS] 
        || DEFAULT_EMISSIONS.default;
    
    const emissionsCarbone = (quantite * defaultFactor) / 1000; // Conversion kg -> tonnes
    return `${emissionsCarbone.toFixed(2)}`;
}
