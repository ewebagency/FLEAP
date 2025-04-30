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
  { groupe: 'Élimination', code: 'D1', nom: 'Mise en décharge' },
  { groupe: 'Élimination', code: 'D2', nom: 'Traitement en sol' },
  { groupe: 'Élimination', code: 'D3', nom: 'Injection en profondeur' },
  { groupe: 'Élimination', code: 'D4', nom: 'Lagunage' },
  { groupe: 'Élimination', code: 'D5', nom: 'Décharge aménagée' },
  { groupe: 'Élimination', code: 'D6', nom: 'Rejet en eau (hors immersion)' },
  { groupe: 'Élimination', code: 'D7', nom: 'Immersion en mer' },
  { groupe: 'Élimination', code: 'D8', nom: 'Traitement bio. avant élimination' },
  { groupe: 'Élimination', code: 'D9', nom: 'Traitement physico-chimique avant élimination' },
  { groupe: 'Élimination', code: 'D10', nom: 'Incinération à terre' },
  { groupe: 'Élimination', code: 'D11', nom: 'Incinération en mer (interdit)' },
  { groupe: 'Élimination', code: 'D12', nom: 'Stockage permanent' },
  { groupe: 'Élimination', code: 'D13', nom: 'Regroupement/mélange avant D1-D12' },
  { groupe: 'Élimination', code: 'D14', nom: 'Reconditionnement avant D1-D13' },
  { groupe: 'Élimination', code: 'D15', nom: 'Stockage avant D1-D14' },
  { groupe: 'Valorisation énergétique', code: 'R1', nom: 'Valorisation énergétique' },
  { groupe: 'Valorisation matière', code: 'R2', nom: 'Régénération solvants' },
  { groupe: 'Valorisation matière', code: 'R3', nom: 'Recyclage organique (hors solvants)' },
  { groupe: 'Valorisation matière', code: 'R4', nom: 'Recyclage métaux' },
  { groupe: 'Valorisation matière', code: 'R5', nom: 'Recyclage inorganique' },
  { groupe: 'Valorisation matière', code: 'R6', nom: 'Régénération acides/bases' },
  { groupe: 'Valorisation matière', code: 'R7', nom: 'Récup. agents de dépollution' },
  { groupe: 'Valorisation matière', code: 'R8', nom: 'Récup. catalyseurs' },
  { groupe: 'Valorisation matière', code: 'R9', nom: 'Régénération huiles' },
  { groupe: 'Valorisation matière', code: 'R10', nom: 'Épandage agricole/écologique' },
  { groupe: 'Valorisation matière', code: 'R11', nom: 'Réutilisation résidus R1-R10' },
  { groupe: 'Préparation à la valorisation', code: 'R12', nom: 'Échange de déchets avant R1-R11' },
  { groupe: 'Préparation à la valorisation', code: 'R13', nom: 'Stockage avant R1-R12' },
  { groupe: 'Réutilisation', code: 'PR', nom: 'Réutilisation' },
  { groupe: 'Réemploi', code: 'RX', nom: 'Réemploi' }
];