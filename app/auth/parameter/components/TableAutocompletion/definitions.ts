export const siteAttributes = {
    mainAttribute: {
      name: 'nom',
      label: 'Nom du site',
      type: 'string' as const,
      required: true,
      placeholder: 'Entrez le nom du site',
    },
    secondaryAttributes: [
      {
        name: 'siret',
        label: 'SIRET',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le numéro SIRET',
      },
      {
        name: 'adresseSiege',
        label: 'Adresse du siège',
        type: 'address' as const,
        required: true,
      },
      {
        name: 'pointsCollecte',
        label: 'Points de collecte',
        type: 'collectionPoint' as const,
        required: false,
      },
      {
        name: 'contacts',
        label: 'Contacts',
        type: 'contact' as const,
        required: false,
      },
    ],
  };

export const transporteurAttributes = {
    mainAttribute: {
      name: 'nomBoite',
      label: 'Nom de la société',
      type: 'string' as const,
      required: true,
      placeholder: 'Entrez le nom de la société',
    },
    secondaryAttributes: [
      {
        name: 'siret',
        label: 'SIRET',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le numéro SIRET',
      },
      {
        name: 'recepisse',
        label: 'Récépissé',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le numéro de récépissé',
      },
      {
        name: 'contact.email',
        label: 'Email',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez l\'email',
      },
      {
        name: 'contact.nomPrenom',
        label: 'Prénom Nom',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le nom et prénom',
      },
      {
        name: 'contact.telephone',
        label: 'Téléphone',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le téléphone',
      },
      {
        name: 'adresse',
        label: 'Adresse',
        type: 'address' as const,
        required: false,
      },
    ],
  };

export const dechetAttributes = {
    mainAttribute: {
      name: 'nom',
      label: 'Nom du déchet',
      type: 'string' as const,
      required: true,
      placeholder: 'Entrez le nom du déchet',
    },
    secondaryAttributes: [
      {
        name: 'codeCED',
        label: 'Code CED',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le code CED',
      },
      {
        name: 'adr',
        label: 'ADR',
        type: 'string' as const,
        required: false,
        placeholder: 'Entrez le code ADR',
      },
    ],
  };

export const destinataireAttributes = {
    mainAttribute: {
      name: 'nomBoite',
      label: 'Nom de la société',
      type: 'string' as const,
      required: true,
      placeholder: 'Entrez le nom de la société',
    },
    secondaryAttributes: [
      {
        name: 'contact.email',
        label: 'Email',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez l\'email',
      },
      {
        name: 'contact.nomPrenom',
        label: 'Prénom Nom',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le nom et prénom',
      },
      {
        name: 'contact.telephone',
        label: 'Téléphone',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le téléphone',
      },
      {
        name: 'adresse',
        label: 'Adresse',
        type: 'address' as const,
        required: true,
      },
    ],
  };

export const contenantAttributes = {
    mainAttribute: {
      name: 'nom',
      label: 'Nom du contenant',
      type: 'string' as const,
      required: true,
      placeholder: 'Entrez le nom du contenant',
    },
    secondaryAttributes: [
      {
        name: 'volume',
        label: 'Volume',
        type: 'number' as const,
        required: true,
        placeholder: 'Entrez le volume',
      },
      {
        name: 'uniteVolume',
        label: 'Unité du volume',
        type: 'select' as const,
        required: true,
        placeholder: 'Sélectionnez l\'unité',
        options: [
          { value: 'm3', label: 'm³' },
          { value: 'L', label: 'Litre (L)' }
        ],
      },
    ],
  };

export const negociantAttributes = {
    mainAttribute: {
      name: 'nomBoite',
      label: 'Nom de la société',
      type: 'string' as const,
      required: true,
      placeholder: 'Entrez le nom de la société',
    },
    secondaryAttributes: [
      {
        name: 'siret',
        label: 'SIRET',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le numéro SIRET',
      },
      {
        name: 'recepisse',
        label: 'Récépissé',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le numéro de récépissé',
      },
      {
        name: 'contact.email',
        label: 'Email',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez l\'email',
      },
      {
        name: 'contact.telephone',
        label: 'Téléphone',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le téléphone',
      },
      {
        name: 'adresse',
        label: 'Adresse',
        type: 'address' as const,
        required: false,
      },
    ],
  };

export const courtierAttributes = {
    mainAttribute: {
      name: 'nomBoite',
      label: 'Nom de la société',
      type: 'string' as const,
      required: true,
      placeholder: 'Entrez le nom de la société',
    },
    secondaryAttributes: [
      {
        name: 'siret',
        label: 'SIRET',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le numéro SIRET',
      },
      {
        name: 'recepisse',
        label: 'Récépissé',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le numéro de récépissé',
      },
      {
        name: 'contact.email',
        label: 'Email',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez l\'email',
      },
      {
        name: 'contact.telephone',
        label: 'Téléphone',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le téléphone',
      },
      {
        name: 'adresse',
        label: 'Adresse',
        type: 'address' as const,
        required: true,
      },
    ],
  };

export const ecoorganismeAttributes = {
    mainAttribute: {
      name: 'nomBoite',
      label: 'Nom de la société',
      type: 'string' as const,
      required: true,
      placeholder: 'Entrez le nom de la société',
    },
    secondaryAttributes: [
      {
        name: 'siret',
        label: 'SIRET',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le numéro SIRET',
      },
      {
        name: 'contact.email',
        label: 'Email',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez l\'email',
      },
      {
        name: 'contact.telephone',
        label: 'Téléphone',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le téléphone',
      },
      {
        name: 'adresse',
        label: 'Adresse',
        type: 'address' as const,
        required: false,
      },
    ],
  };

export const codeTraitementOptions = [
  { code: 'D1', nom: 'Mise en décharge' },
  { code: 'D2', nom: 'Traitement en sol' },
  { code: 'D3', nom: 'Injection en profondeur' },
  { code: 'D4', nom: 'Lagunage' },
  { code: 'D5', nom: 'Décharge aménagée' },
  { code: 'D6', nom: 'Rejet en eau (hors immersion)' },
  { code: 'D7', nom: 'Immersion en mer' },
  { code: 'D8', nom: 'Traitement bio. avant élimination' },
  { code: 'D9', nom: 'Traitement physico-chimique avant élimination' },
  { code: 'D10', nom: 'Incinération à terre' },
  { code: 'D11', nom: 'Incinération en mer (interdit)' },
  { code: 'D12', nom: 'Stockage permanent' },
  { code: 'D13', nom: 'Regroupement/mélange avant D1-D12' },
  { code: 'D14', nom: 'Reconditionnement avant D1-D13' },
  { code: 'D15', nom: 'Stockage avant D1-D14' },
  { code: 'R1', nom: 'Valorisation énergétique' },
  { code: 'R2', nom: 'Régénération solvants' },
  { code: 'R3', nom: 'Recyclage organique (hors solvants)' },
  { code: 'R4', nom: 'Recyclage métaux' },
  { code: 'R5', nom: 'Recyclage inorganique' },
  { code: 'R6', nom: 'Régénération acides/bases' },
  { code: 'R7', nom: 'Récup. agents de dépollution' },
  { code: 'R8', nom: 'Récup. catalyseurs' },
  { code: 'R9', nom: 'Régénération huiles' },
  { code: 'R10', nom: 'Épandage agricole/écologique' },
  { code: 'R11', nom: 'Réutilisation résidus R1-R10' },
  { code: 'R12', nom: 'Échange de déchets avant R1-R11' },
  { code: 'R13', nom: 'Stockage avant R1-R12' },
  { code: 'PR', nom: 'Réutilisation' },
  { code: 'RX', nom: 'Réemploi' }
];

export const codeTraitementAttributes = {
  mainAttribute: {
    name: 'code',
    label: 'Code de traitement',
    type: 'select' as const,
    required: true,
    placeholder: 'Sélectionnez le code de traitement',
    options: codeTraitementOptions.map(option => ({
      value: option.code,
      label: `${option.code} | ${option.nom}`
    }))
  },
  secondaryAttributes: []
};

export const contratAttributes = {
    mainAttribute: {
      name: 'nom',
      label: 'Nom du contrat',
      type: 'string' as const,
      required: true,
      placeholder: 'Entrez le nom du contrat',
    },
    secondaryAttributes: [
      {
        name: 'num_client',
        label: 'Numéro client',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le numéro client',
      },
      {
        name: 'tarifs',
        label: 'Tarifs',
        type: 'tarifs' as const,
        required: false,
      },
    ],
  };
