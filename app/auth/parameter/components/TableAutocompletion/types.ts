/* 

AutocompletionTab.tsx : 
-useState pour les entités
-useState pour les liens

-fonction de toogle et de modifier pour les entités

- renderEntityList : component pour display les entités existantes

- render global : 
  - cartes d'entités existantes et en création
  - cartes de liens == LinkComponents

  LinkComponents = 
  - SiteContactForm : formulaire de création de lien entre site et contact émetteur
  - MultiLinkForm : formulaire de création de lien entre site + déchet et entités
  
*/





// Types de base
export interface BaseEntity {
  id: string;
  nom?: string;
  nomBoite?: string;
}

export interface Site extends BaseEntity {
  siret: string;
  adresseSiege: string;
  pointsCollecte: CollectionPoint[];
  contacts: Contact[];
}

export interface Dechet extends BaseEntity {
  codeCED: string;
  adr: string;
}

export interface Transporteur extends BaseEntity {
  contact: {
    email: string;
    telephone: string;
  };
  adresse: string;
}

export interface Destinataire extends BaseEntity {
  contact: {
    email: string;
    telephone: string;
  };
  adresse: string;
}

export interface Contenant extends BaseEntity {
  volume: number;
  uniteVolume: string;
}

export interface Negociant extends BaseEntity {
  contact: {
    email: string;
    telephone: string;
  };
  adresse: string;
}

export interface Courtier extends BaseEntity {
  contact: {
    email: string;
    telephone: string;
  };
  adresse: string;
}

export interface CodeTreatment extends BaseEntity {
  code: string;
}

export interface Ecorganisme extends BaseEntity {
  siret: string;
  contact: {
    email: string;
    telephone: string;
  };
  adresse: string;
}

export interface Contrat extends BaseEntity {
  num_client: string;
  tarifs: {
    id: string;
    dechet: string;
    code_ced: string;
    couts: {
      traitement: number;
      location: number;
      transport: number;
    };
  }[];
}

// Types pour les liens
export interface BaseLink {
  id?: string;
  site: string;
  dechet: string;
  mail?: boolean;
}

export interface TransportLink extends BaseLink {
  type: 'transport';
}

export interface DestLink extends BaseLink {
  type: 'dest';
}

export interface ContenantLink extends BaseLink {
  type: 'contenant';
}

export interface NegociantLink extends BaseLink {
  type: 'negociant';
}

export interface CourtierLink extends BaseLink {
  type: 'courtier';
}

export interface CodeTreatmentLink extends BaseLink {
  type: 'codeTreatment';
}

export interface EcorganismeLink extends BaseLink {
  type: 'ecorganisme';
}

export interface ContratLink extends BaseLink {
  type: 'contrat';
}

// Types pour les props des composants
export interface LinkFormProps<T extends BaseEntity> {
  title: string;
  items: T[];
  sites: Site[];
  dechets: Dechet[];
  linkedItems: BaseLink[];
  onLink: (itemId: string, siteId: string, dechetId: string) => void;
  mainField: keyof T;
}

export interface MultiLinkFormProps {
  sites: Site[];
  dechets: Dechet[];
  transporteurs: Transporteur[];
  destinataires: Destinataire[];
  negociants: Negociant[];
  courtiers: Courtier[];
  contenants: Contenant[];
  codeTreatments: CodeTreatment[];
  ecoorganismes: Ecorganisme[];
  contrat: Contrat[];
  transportLinks: BaseLink[];
  destLinks: BaseLink[];
  negociantLinks: BaseLink[];
  courtierLinks: BaseLink[];
  contenantLinks: BaseLink[];
  codeTreatmentLinks: BaseLink[];
  ecoorganismeLinks: BaseLink[];
  contratLinks: BaseLink[];
  onTransportLink: (transportId: string, siteId: string, dechetId: string) => void;
  onDestLink: (destId: string, siteId: string, dechetId: string) => void;
  onNegociantLink: (negociantId: string, siteId: string, dechetId: string) => void;
  onCourtierLink: (courtierId: string, siteId: string, dechetId: string) => void;
  onContenantLink: (contenantId: string, siteId: string, dechetId: string) => void;
  onCodeTreatmentLink: (codeTreatmentId: string, siteId: string, dechetId: string) => void;
  onEcorganismeLink: (ecoorganismeId: string, siteId: string, dechetId: string) => void;
  onContratLink: (contratId: string, siteId: string, dechetId: string) => void;
  onUpdateTransportLinks: (links: BaseLink[]) => void;
  onUpdateDestLinks: (links: BaseLink[]) => void;
  onUpdateContenantLinks: (links: BaseLink[]) => void;
  onUpdateNegociantLinks: (links: BaseLink[]) => void;
  onUpdateCourtierLinks: (links: BaseLink[]) => void;
  onUpdateCodeTreatmentLinks: (links: BaseLink[]) => void;
  onUpdateEcorganismeLinks: (links: BaseLink[]) => void;
  onUpdateContratLinks: (links: BaseLink[]) => void;
  onDeleteTransportLink: (transportId: string, siteId: string, dechetId: string) => void;
  onDeleteDestLink: (destId: string, siteId: string, dechetId: string) => void;
  onDeleteNegociantLink: (negociantId: string, siteId: string, dechetId: string) => void;
  onDeleteCourtierLink: (courtierId: string, siteId: string, dechetId: string) => void;
  onDeleteContenantLink: (contenantId: string, siteId: string, dechetId: string) => void;
  onDeleteCodeTreatmentLink: (codeTreatmentId: string, siteId: string, dechetId: string) => void;
  onDeleteEcorganismeLink: (ecoorganismeId: string, siteId: string, dechetId: string) => void;
  onDeleteContratLink: (contratId: string, siteId: string, dechetId: string) => void;
}

export interface CollectionPoint {
  id: string;
  nom: string;
  adresse: string;
  codePostal: string;
  ville: string;
}

export interface Contact {
  id: string;
  nom: string;
  email: string;
  telephone: string;
  respoTerrain: boolean;
}
