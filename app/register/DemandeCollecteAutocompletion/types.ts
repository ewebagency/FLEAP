interface PointCollecteInterface {
  id: string;
  nom: string;
  adresse: string;
}

interface SiteInterface {
  table_id: number;
  value: {
    nom: string;
    siret: string;
    adresseSiege: string;
    pointsCollecte: PointCollecteInterface[];
  }
}

interface TransporteurInterface {
  table_id: number;
  value: {
      nomBoite?: string;
      adresse?: string;
      siret?: string;
      contact?: {
        nomPrenom?: string;
        email?: string;
        telephone?: string;
    }
  }
}

interface DestinataireInterface {
  table_id: number;
  value: {
    nomBoite?: string;
    adresse?: string;
    siret?: string;
    contact?: {
      nomPrenom?: string;
      email?: string;
      telephone?: string;
    }
  }
}

interface DechetInterface {
  table_id: number;
  value: {
    nom: string;
    codeCED: string;
    onu: string;
    adr: string;
  }
}

interface ContenantInterface {
  table_id: number;
  value: {
    nom: string;
    volume: string;
    uniteVolume: string;
  }
}

interface ContactInterface {
  table_id: number;
  value: {
    prenomNom?: string;
    email?: string;
    telephone?: string;
    respoTerrain?: boolean;
  }
}

interface NegociantInterface {
  table_id: number;
  value: {
    nomBoite?: string;
    adresse?: string;
    siret?: string;
    contact?: {
      nomPrenom?: string;
      email?: string;
      telephone?: string;
    }
  }
}

interface CourtierInterface {
  table_id: number;
  value: {
    nomBoite?: string;
    adresse?: string;
    siret?: string;
    contact?: {
      nomPrenom?: string;
      email?: string;
      telephone?: string;
    }
  }
} 
export interface SelectedFields {
  site: SiteInterface | null;
  pointCollecte: PointCollecteInterface | null;
  contactEmetteur: ContactInterface[] | null;
  dechet: DechetInterface | null;
  contenant: ContenantInterface | null;
  date: Date | null;
  transporteur: TransporteurInterface | null;
  destinataire: DestinataireInterface | null;
  negociant: NegociantInterface | null;
  courtier: CourtierInterface | null;
  nombreContenant: number;
  destinataireMail: string;
  typePrestation: string;
  showNegociant: boolean;
}

export interface AutocompletionData {
  sites: SiteInterface[];
  contacts: ContactInterface[];
  transporteurs: TransporteurInterface[];
  destinataires: DestinataireInterface[];
  dechets: DechetInterface[];
  contenants: ContenantInterface[];
  negociants: NegociantInterface[];
  courtiers: CourtierInterface[];
}

interface TransportLinkInterface {
  table_id: number;
  transport_link: {
    site: string;
    dechet: string;
  }[];
}

interface DestinataireLinkInterface {
  table_id: number;
  dest_link: {
    site: string;
    dechet: string;
  }[];
}

interface ContenantLinkInterface {
  table_id: number;
  contenant_link: {
    site: string;
    dechet: string;
  }[];
}

interface CodeTraitementLinkInterface {
  table_id: number;
  code_traitement_link: {
    site: string;
    dechet: string;
  }[];
}

interface ContactLinkInterface {
  table_id: number;
  contact_link: {
    site: string; //inutile il faudrait l'enlever pour que ce soit cohérent avec le reste
    contact: string;
  }[];
}

interface NegociantLinkInterface {
  table_id: number;
  negociant_link: {
    site: string;
    dechet: string;
  }[];
}

interface CourtierLinkInterface {
  table_id: number;
  courtier_link: {
    site: string;
    dechet: string;
  }[];
}


export interface AutocompletionLinks {
  transportLinks: TransportLinkInterface[];
  destinataireLinks: DestinataireLinkInterface[];
  contenantLinks: ContenantLinkInterface[];
  codeTraitementLinks: CodeTraitementLinkInterface[];
  contactLinks: ContactLinkInterface[];
  negociantLinks: NegociantLinkInterface[];
  courtierLinks: CourtierLinkInterface[];
}

export interface RawAutocompletionData {
  id: number;
  created_at: string;
  entreprise_id: number;
  site: SiteInterface["value"] | null;
  transporteur: TransporteurInterface["value"] | null;
  destinataire: DestinataireInterface["value"] | null;
  dechet: DechetInterface["value"] | null;
  contenant: ContenantInterface["value"] | null;
  negociant: NegociantInterface["value"] | null;
  courtier: CourtierInterface["value"] | null;
  contact_emetteur: ContactInterface["value"] | null;
  transport_link: TransportLinkInterface["transport_link"] | null;
  dest_link: DestinataireLinkInterface["dest_link"] | null;
  contenant_link: ContenantLinkInterface["contenant_link"] | null;
  code_traitement_link: CodeTraitementLinkInterface["code_traitement_link"] | null;
  contact_link: ContactLinkInterface["contact_link"] | null;
  negociant_link: NegociantLinkInterface["negociant_link"] | null;
  courtier_link: CourtierLinkInterface["courtier_link"] | null;
} 