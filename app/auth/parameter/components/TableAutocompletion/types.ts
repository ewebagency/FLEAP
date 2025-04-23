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




/*
// Types de base
export interface BaseEntity {
  id: string;
  nom?: string;
  nomBoite?: string;
}

export interface Site extends BaseEntity {
  siret: string;
  adresseSiege: string;
  pointsCollecte: {
    id: string;
    nom: string;
    adresse: string;
    codePostal: string;
    ville: string;
  }[];
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

export interface ContactEmetteur extends BaseEntity {
  prenomNom: string;
  email: string;
  telephone: string;
  respoTerrain: boolean;
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
}

// Types pour les liens
export interface BaseLink {
  id: string;
  site: string;
  dechet: string;
}

export interface TransportLink extends BaseLink {
  mail?: boolean;
}
export interface DestLink extends BaseLink {
  mail?: boolean;
}
export interface ContenantLink extends BaseLink {
  mail?: boolean;
}
export interface NegociantLink extends BaseLink {
  mail?: boolean;
}
export interface CourtierLink extends BaseLink {
  mail?: boolean;
}
export interface CodeTreatmentLink extends BaseLink {
  mail?: boolean;
}
export interface EcorganismeLink extends BaseLink {
  mail?: boolean;
}
export interface SiteContactLink {
  id: string;
  site: string;
  contact: string;
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
  transportLinks: TransportLink[];
  destLinks: DestLink[];
  negociantLinks: NegociantLink[];
  courtierLinks: CourtierLink[];
  contenantLinks: ContenantLink[];
  codeTreatmentLinks: CodeTreatmentLink[];
  ecoorganismeLinks: EcorganismeLink[];
  onTransportLink: (transportId: string, siteId: string, dechetId: string) => void;
  onDestLink: (destId: string, siteId: string, dechetId: string) => void;
  onNegociantLink: (negociantId: string, siteId: string, dechetId: string) => void;
  onCourtierLink: (courtierId: string, siteId: string, dechetId: string) => void;
  onContenantLink: (contenantId: string, siteId: string, dechetId: string) => void;
  onCodeTreatmentLink: (codeTreatmentId: string, siteId: string, dechetId: string) => void;
  onEcorganismeLink: (ecoorganismeId: string, siteId: string, dechetId: string) => void;
  onUpdateTransportLinks: (links: TransportLink[]) => void;
  onUpdateDestLinks: (links: DestLink[]) => void;
  onUpdateContenantLinks: (links: ContenantLink[]) => void;
  onUpdateNegociantLinks: (links: NegociantLink[]) => void;
  onUpdateCourtierLinks: (links: CourtierLink[]) => void;
  onUpdateCodeTreatmentLinks: (links: CodeTreatmentLink[]) => void;
  onUpdateEcorganismeLinks: (links: EcorganismeLink[]) => void;
  onDeleteTransportLink: (transportId: string, siteId: string, dechetId: string) => void;
  onDeleteDestLink: (destId: string, siteId: string, dechetId: string) => void;
  onDeleteNegociantLink: (negociantId: string, siteId: string, dechetId: string) => void;
  onDeleteCourtierLink: (courtierId: string, siteId: string, dechetId: string) => void;
  onDeleteContenantLink: (contenantId: string, siteId: string, dechetId: string) => void;
  onDeleteCodeTreatmentLink: (codeTreatmentId: string, siteId: string, dechetId: string) => void;
  onDeleteEcorganismeLink: (ecoorganismeId: string, siteId: string, dechetId: string) => void;
}

export interface SiteContactFormProps {
  sites: Site[];
  contactEmetteurs: ContactEmetteur[];
  linkedItems: SiteContactLink[];
  onLink: (siteId: string, contactId: string) => void;
} 
  */