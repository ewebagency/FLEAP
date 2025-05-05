export interface PointCollecteInterface {
  id: string;
  nom: string;
  adresse: string;
}

export interface ContactInterface {
  nom: string;
  email: string;
  telephone: string;
  respoTerrain: boolean;
}

export interface SiteInterface {
  table_id: number;
  value: {
    nom: string;
    siret: string;
    adresseSiege: string;
    pointsCollecte: PointCollecteInterface[];
    contacts: ContactInterface[];
  }
}

export interface TransporteurInterface {
  table_id: number;
  value: {
      nomBoite?: string;
      adresse?: string;
      siret?: string;
      nomPrenom?: string;
      email?: string;
      telephone?: string;
    }
}

export interface DestinataireInterface {
  table_id: number;
  value: {
    nomBoite?: string;
    adresse?: string;
    siret?: string;
    nomPrenom?: string;
    email?: string;
    telephone?: string;
  }
}

export interface DechetInterface {
  table_id: number;
  value: {
    nom: string;
    codeCED: string;
    onu: string;
    adr: string;
  }
}

export interface ContenantInterface {
  table_id: number;
  value: {
    nom: string;
    volume: string;
    uniteVolume: string;
  }
}


export interface NegociantInterface {
  table_id: number;
  value: {
    nomBoite?: string;
    adresse?: string;
    siret?: string;
    //nomPrenom?: string;
    email?: string;
    telephone?: string;
    recepisse?: string;
  }
}

export interface CourtierInterface {
  table_id: number;
  value: {
    nomBoite?: string;
    adresse?: string;
    siret?: string;
    //nomPrenom?: string;
    email?: string;
    telephone?: string;
    recepisse?: string;
  }
} 

export interface EcorganismeInterface {
  table_id: number;
  value: {
    nomBoite?: string;
    adresse?: string;
    siret?: string;
    nomPrenom?: string;
    email?: string;
    telephone?: string;
  }
} 

export interface CodeTraitementInterface {
  table_id: number;
  value: {
    nom: string;
    code: string;
  }
}

export interface ContratInterface {
  table_id: number;
  value: {
    nom: string;
    num_client: string;
    tarifs?:{
      dechet: string;
      code_ced: string;
      couts: {
        traitement: number;
        location: number;
        transport: number;
      }
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
  ecoorganisme: EcorganismeInterface | null;
  codeTraitement: CodeTraitementInterface | null;
  contrat: ContratInterface | null;
  nombreContenant: number;
  destinataireMail: string;
  typePrestation: string;
  showNegociant: boolean;
  mention: { toMentionned: boolean; mentionType: string; mentionCompany: string; mentionAddress: string } | null;
}

export interface AutocompletionData {
  sites: SiteInterface[];
  transporteurs: TransporteurInterface[];
  destinataires: DestinataireInterface[];
  dechets: DechetInterface[];
  contenants: ContenantInterface[];
  negociants: NegociantInterface[];
  courtiers: CourtierInterface[];
  ecoorganismes: EcorganismeInterface[];
  codeTraitements: CodeTraitementInterface[];
  contrats: ContratInterface[];
}

interface TransportLinkInterface {
  table_id: number;
  transport_link: {
    site: string;
    dechet: string;
    mail?: boolean;
  }[];
}

interface DestinataireLinkInterface {
  table_id: number;
  dest_link: {
    site: string;
    dechet: string;
    mail?: boolean;
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

interface NegociantLinkInterface {
  table_id: number;
  negociant_link: {
    site: string;
    dechet: string;
    mail?: boolean;
  }[];
}

interface CourtierLinkInterface {
  table_id: number;
  courtier_link: {
    site: string;
    dechet: string;
    mail?: boolean;
  }[];
}

interface EcorganismeLinkInterface {
  table_id: number;
  eco_organisme_link: {
    site: string;
    dechet: string;
    mail?: boolean;
  }[];
}
interface ContratLinkInterface {
  table_id: number;
  contrat_link: {
    site: string;
    dechet: string;
  }[];
}


export interface AutocompletionLinks {
  transportLinks: TransportLinkInterface[];
  destinataireLinks: DestinataireLinkInterface[];
  contenantLinks: ContenantLinkInterface[];
  codeTraitementLinks: CodeTraitementLinkInterface[];
  negociantLinks: NegociantLinkInterface[];
  courtierLinks: CourtierLinkInterface[];
  ecoorganismeLinks: EcorganismeLinkInterface[];
  contratLinks: ContratLinkInterface[];
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
  eco_organisme: EcorganismeInterface["value"] | null;
  code_traitement: CodeTraitementInterface["value"] | null;
  contrat: ContratInterface["value"] | null;
  transport_link: TransportLinkInterface["transport_link"] | null;
  dest_link: DestinataireLinkInterface["dest_link"] | null;
  contenant_link: ContenantLinkInterface["contenant_link"] | null;
  code_traitement_link: CodeTraitementLinkInterface["code_traitement_link"] | null;
  negociant_link: NegociantLinkInterface["negociant_link"] | null;
  courtier_link: CourtierLinkInterface["courtier_link"] | null;
  eco_organisme_link: EcorganismeLinkInterface["eco_organisme_link"] | null;
  contrat_link: ContratLinkInterface["contrat_link"] | null;
} 