import { codeTraitementDefinitions } from "@/app/component/Analyse/Environnementale/codeTraitement";

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
        required: false,
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
        required: false,
        placeholder: 'Entrez le numéro de récépissé',
      },
      {
        name: 'email',
        label: 'Email',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez l\'email',
      },
      {
        name: 'nomPrenom',
        label: 'Prénom Nom',
        type: 'string' as const,
        required: false,
        placeholder: 'Entrez le nom et prénom',
      },
      {
        name: 'telephone',
        label: 'Téléphone',
        type: 'string' as const,
        required: false,
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
        name: 'masseVolumique',
        label: 'Masse volumique (t/m³)',
        type: 'number' as const,
        required: true,
        placeholder: 'Entrez la masse volumique',
      },
      {
        name: 'adr',
        label: 'Mention ADR',
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
        name: 'siret',
        label: 'SIRET',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le numéro SIRET',
      },
      {
        name: 'email',
        label: 'Email',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez l\'email',
      },
      {
        name: 'nomPrenom',
        label: 'Prénom Nom',
        type: 'string' as const,
        required: false,
        placeholder: 'Entrez le nom et prénom',
      },
      {
        name: 'telephone',
        label: 'Téléphone',
        type: 'string' as const,
        required: false,
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
        placeholder: 'Sélectionnez l\'unité, m3 ou L',
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
        required: false,
        placeholder: 'Entrez le numéro de récépissé',
      },
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
        required: false,
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
        required: false,
        placeholder: 'Entrez le numéro de récépissé',
      },
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
        required: false,
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
        required: false,
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


export const codeTraitementOptions = codeTraitementDefinitions;

export const codeTraitementAttributes = {
  mainAttribute: {
    name: 'code',
    label: 'Code de traitement',
    type: 'select' as const,
    required: true,
    placeholder: 'Sélectionnez le code de traitement',
    options: codeTraitementDefinitions.map(option => ({
      value: option.code,
      label: `${option.groupe} | ${option.code} - ${option.nom}`
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
      }
      /*{
        name: 'tarifs',
        label: 'Tarifs',
        type: 'tarifs' as const,
        required: false,
      },*/
    ],
  };
