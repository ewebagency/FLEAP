// Codes de traitement associés au recyclage
export const codesRecyclage = [
    'R2', // Régénération ou récupération des solvants
    'R3', // Recyclage ou récupération des substances organiques qui ne sont pas utilisées comme solvants
    'R4', // Recyclage ou récupération des métaux et des composés métalliques
    'R5', // Recyclage ou récupération d’autres matières inorganiques
    'R6', // Régénération des acides ou des bases
    'R7', // Valorisation des produits utilisés pour capter les polluants
    'R8', // Valorisation des composants catalytiques
    'R9', // Régénération ou autres réemplois des huiles
    'R10', // Épandage sur le sol au profit de l’agriculture ou de l’écologie
    'R11', // Utilisation de déchets obtenus à partir de l’une des opérations numérotées R1 à R10
    'R12', // Échange de déchets en vue de les soumettre à l’une des opérations numérotées R1 à R11
    'R13'  // Stockage de déchets en attente de l’une des opérations numérotées R1 à R12
  ];
  
// Codes de traitement associés à la réutilisation
export const codesReutilisation = [
    'R3', // Recyclage ou récupération des substances organiques qui ne sont pas utilisées comme solvants
    'R4', // Recyclage ou récupération des métaux et des composés métalliques
    'R5', // Recyclage ou récupération d’autres matières inorganiques
    'R6', // Régénération des acides ou des bases
    'R7', // Valorisation des produits utilisés pour capter les polluants
    'R8', // Valorisation des composants catalytiques
    'R9'  // Régénération ou autres réemplois des huiles
  ];


export const tauxValorisationGlobale = [
    'R1', // Valorisation énergétique
    'R2', // Régénération ou récupération des solvants
    'R3', // Recyclage ou récupération des substances organiques qui ne sont pas utilisées comme solvants
    'R4', // Recyclage ou récupération des métaux et des composés métalliques
    'R5', // Recyclage ou récupération d’autres matières inorganiques
    'R6', // Régénération des acides ou des bases
    'R7', // Valorisation des produits utilisés pour capter les polluants
    'R8', // Valorisation des composants catalytiques
    'R9', // Régénération ou autres réemplois des huiles
    'R10', // Épandage sur le sol au profit de l’agriculture ou de l’écologie
    'R11', // Utilisation de déchets obtenus à partir de l’une des opérations numérotées R1 à R10
]

export const tauxValorisationMatière = [
  'R2', // Régénération ou récupération des solvants
  'R3', // Recyclage ou récupération des substances organiques qui ne sont pas utilisées comme solvants
  'R4', // Recyclage ou récupération des métaux et des composés métalliques
  'R5', // Recyclage ou récupération d’autres matières inorganiques
  'R6', // Régénération des acides ou des bases
  'R7', // Valorisation des produits utilisés pour capter les polluants
  'R8', // Valorisation des composants catalytiques
  'R9', // Régénération ou autres réemplois des huiles
  'R10', // Épandage sur le sol au profit de l’agriculture ou de l’écologie
  'R11', // Utilisation de déchets obtenus à partir de l’une des opérations numérotées R1 à R10
]




export const typeTraitement = {
  "Élimination": ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'D14', 'D15'],
  "Valorisation énergétique": ['R1'],
  "Valorisation matière": ['R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11'],
  "Préparation à la valorisation": ['R12', 'R13'],
  "Réutilisation": ['PR'],
  "Réemploi": ['RX'],
  "Inconnu": ['']
}