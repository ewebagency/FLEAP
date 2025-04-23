/*
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

export const contactEmetteurAttributes = {
    mainAttribute: {
      name: 'prenomNom',
      label: 'Prénom et Nom',
      type: 'string' as const,
      required: true,
      placeholder: 'Entrez le prénom et le nom',
    },
    secondaryAttributes: [
      {
        name: 'email',
        label: 'Email',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez l\'email',
      },
      {
        name: 'telephone',
        label: 'Téléphone',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le numéro de téléphone',
      },
      {
        name: 'respoTerrain',
        label: 'Responsable Terrain',
        type: 'boolean' as const,
        required: false,
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

export const ecoOrganismeAttributes = {
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

export const codeTraitementAttributes = {
    mainAttribute: {
      name: 'nom',
      label: 'Nom du code',
      type: 'string' as const,
      required: true,
      placeholder: 'Entrez le nom du code de traitement',
    },
    secondaryAttributes: [
      {
        name: 'code',
        label: 'Code',
        type: 'select' as const,
        required: true,
        placeholder: 'Sélectionnez le code de traitement',
        options: [
          { value: 'D1', label: 'Elimination - D1' },
          { value: 'D2', label: 'Elimination - D2' },
          { value: 'D3', label: 'Elimination - D3' },
          { value: 'D4', label: 'Elimination - D4' },
          { value: 'D5', label: 'Elimination - D5' },
          { value: 'D6', label: 'Elimination - D6' },
          { value: 'D7', label: 'Elimination - D7' },
          { value: 'D8', label: 'Elimination - D8' },
          { value: 'D9', label: 'Elimination - D9' },
          { value: 'D10', label: 'Elimination - D10' },
          { value: 'D11', label: 'Elimination - D11' },
          { value: 'D12', label: 'Elimination - D12' },
          { value: 'D13', label: 'Elimination - D13' },
          { value: 'D14', label: 'Elimination - D14' },
          { value: 'D15', label: 'Elimination - D15' },
          { value: 'R1', label: 'Valorisation énergétique - R1' },
          { value: 'R2', label: 'Valorisation matière - R2' },
          { value: 'R3', label: 'Valorisation matière - R3' },
          { value: 'R4', label: 'Valorisation matière - R4' },
          { value: 'R5', label: 'Valorisation matière - R5' },
          { value: 'R6', label: 'Valorisation matière - R6' },
          { value: 'R7', label: 'Valorisation matière - R7' },
          { value: 'R8', label: 'Valorisation matière - R8' },
          { value: 'R9', label: 'Valorisation matière - R9' },
          { value: 'R10', label: 'Valorisation matière - R10' },
          { value: 'R11', label: 'Valorisation matière - R11' },
          { value: 'R12', label: 'Préparation à la valorisation - R12' },
          { value: 'R13', label: 'Préparation à la valorisation - R13' },
          { value: 'PR', label: 'Réutilisation - PR' },
          { value: 'RX', label: 'Réemploi - RX' },
        ],
      },
    ],
  };
*/