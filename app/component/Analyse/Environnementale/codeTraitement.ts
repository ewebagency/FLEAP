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


export const codeTraitementDefinitions = [
  { groupe: "Élimination", code: "D1", nom: "Mise en décharge", couleur: "#1a1a1a" },
  { groupe: "Élimination", code: "D2", nom: "Traitement en sol", couleur: "#2b2b2b" },
  { groupe: "Élimination", code: "D3", nom: "Injection en profondeur", couleur: "#2b2b2b" },
  { groupe: "Élimination", code: "D4", nom: "Lagunage", couleur: "#333333" },
  { groupe: "Élimination", code: "D5", nom: "Décharge aménagée", couleur: "#262626" },
  { groupe: "Élimination", code: "D6", nom: "Rejet en eau (hors immersion)", couleur: "#333333" },
  { groupe: "Élimination", code: "D7", nom: "Immersion en mer", couleur: "#1a1a1a" },
  { groupe: "Élimination", code: "D8", nom: "Traitement bio. avant élimination", couleur: "#444444" },
  { groupe: "Élimination", code: "D9", nom: "Traitement physico-chimique avant élimination", couleur: "#444444" },
  { groupe: "Élimination", code: "D10", nom: "Incinération à terre", couleur: "#3d3d3d" },
  { groupe: "Élimination", code: "D11", nom: "Incinération en mer (interdit)", couleur: "#111111" },
  { groupe: "Élimination", code: "D12", nom: "Stockage permanent", couleur: "#202020" },
  { groupe: "Élimination", code: "D13", nom: "Regroupement/mélange avant D1-D12", couleur: "#393939" },
  { groupe: "Élimination", code: "D14", nom: "Reconditionnement avant D1-D13", couleur: "#3f3f3f" },
  { groupe: "Élimination", code: "D15", nom: "Stockage avant D1-D14", couleur: "#3f3f3f" },
  { groupe: "Valorisation énergétique", code: "R1", nom: "Valorisation énergétique", couleur: "#4a8b18" },
  { groupe: "Valorisation matière", code: "R2", nom: "Régénération solvants", couleur: "#5fa626" },
  { groupe: "Valorisation matière", code: "R3", nom: "Recyclage organique (hors solvants)", couleur: "#60aa2e" },
  { groupe: "Valorisation matière", code: "R4", nom: "Recyclage métaux", couleur: "#66b032" },
  { groupe: "Valorisation matière", code: "R5", nom: "Recyclage inorganique", couleur: "#6ec239" },
  { groupe: "Valorisation matière", code: "R6", nom: "Régénération acides/bases", couleur: "#7bd03f" },
  { groupe: "Valorisation matière", code: "R7", nom: "Récup. agents de dépollution", couleur: "#81d742" },
  { groupe: "Valorisation matière", code: "R8", nom: "Récup. catalyseurs", couleur: "#85dd45" },
  { groupe: "Valorisation matière", code: "R9", nom: "Régénération huiles", couleur: "#92e14a" },
  { groupe: "Valorisation matière", code: "R10", nom: "Épandage agricole/écologique", couleur: "#8edf4b" },
  { groupe: "Valorisation matière", code: "R11", nom: "Réutilisation résidus R1-R10", couleur: "#a5ea58" },
  { groupe: "Préparation à la valorisation", code: "R12", nom: "Échange de déchets avant R1-R11", couleur: "#b4ef6b" },
  { groupe: "Préparation à la valorisation", code: "R13", nom: "Stockage avant R1-R12", couleur: "#c1f381" },
  { groupe: "Réutilisation", code: "PR", nom: "Réutilisation", couleur: "#c9f79a" },
  { groupe: "Réemploi", code: "RX", nom: "Réemploi", couleur: "#2874a6" }
];