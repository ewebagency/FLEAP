export interface Adresse {
    street: string;
    postal_code: string;
    city: string;
    fulladdress: string;
}

interface FieldOptions<T> {
    options: T[];
    first: T;
}

interface Site {
    nom: FieldOptions<string>;
    siret: FieldOptions<number | null>;
    adresse: {
      options: string[];
      first: Adresse;
    };
    gerep: FieldOptions<string | null>;
}

interface Filiere {
    nom: FieldOptions<string>;
    ced: FieldOptions<string>;
    consistance: FieldOptions<string>;
    cap: FieldOptions<string>;
}

interface DechetDangereux {
    ced: FieldOptions<string>;
    onu: FieldOptions<number | string>;
    denomination: FieldOptions<string>;
    danger: FieldOptions<number | string>;
    emballage: FieldOptions<string>;
    collecte: FieldOptions<string | null>;
}

interface ProducteurPersonne {
    lastname: FieldOptions<string>;
    firstname: FieldOptions<string>;
    tel: FieldOptions<string>;
    email: FieldOptions<string>;
}

interface OperationnellePersonne {
    lastname: FieldOptions<string>;
    firstname: FieldOptions<string>;
    tel: FieldOptions<string>;
    email: FieldOptions<string>;
}

interface Contenant {
    nom: FieldOptions<string | null>;
    code: FieldOptions<string>;
    identifiant: FieldOptions<string | null>;
    description: FieldOptions<string>;
    unitaire: FieldOptions<string>;
    indicatif: FieldOptions<number>;
    location: FieldOptions<string>;
    siret: FieldOptions<number | null>;
}

interface EcoOrganisme {
    nom: FieldOptions<string>;
    siret: FieldOptions<string>;
}

interface Negociant {
    nom: FieldOptions<string | null>;
    siret: FieldOptions<number | null>;
    adresse: FieldOptions<string>;
    numero: FieldOptions<string | null>;
    lastname: FieldOptions<string>;
    firstname: FieldOptions<string>;
    tel: FieldOptions<string | null>;
    email: FieldOptions<string | null>;
}

interface Transporteur {
    nom: FieldOptions<string>;
    siret: FieldOptions<number>;
    adresse: FieldOptions<string>;
    numero: FieldOptions<string>;
    lastname: FieldOptions<string>;
    firstname: FieldOptions<string>;
    tel: FieldOptions<string>;
    email: FieldOptions<string>;
}

interface InstallationIntermediaire {
    nom: FieldOptions<string>;
    siret: FieldOptions<string>;
    adresse: FieldOptions<string>;
    numero: FieldOptions<string | null>;
    traitement: FieldOptions<string>;
    lastname: FieldOptions<string>;
    firstname: FieldOptions<string>;
    tel: FieldOptions<string>;
    email: FieldOptions<string>;
}

interface PrestataireFinal {
    nom: FieldOptions<string>;
    siret: FieldOptions<number | null>;
    adresse: FieldOptions<string>;
    numero: FieldOptions<string | null>;
    traitement: FieldOptions<string>;
    qualification: FieldOptions<string>;
    lastname: FieldOptions<string>;
    firstname: FieldOptions<string>;
    tel: FieldOptions<string>;
    email: FieldOptions<string>;
}

// L'interface complète regroupant toutes les sections :
export interface BSD_Data_Interface {
    site: Site;
    filiere: Filiere;
    dechet_dangereux: DechetDangereux;
    producteur_personne: ProducteurPersonne;
    operationnelle_personne: OperationnellePersonne;
    contenant: Contenant;
    eco_organisme: EcoOrganisme;
    negociant: Negociant;
    transporteur: Transporteur;
    installation_intermediaire: InstallationIntermediaire;
    prestataire_final: PrestataireFinal;
    date : { collecte: FirstField<string> }
}


//-----------------------------------------------------

interface FirstField<T> {
    first: T;
}

export interface Gouv {
    raison: FirstField<string>;
    adresse: FirstField<string>;
}

interface SiteWithoutOptions {
    nom: FirstField<string>;
    siret: FirstField<number | null>;
    gouv: Gouv;
    adresse: FirstField<Adresse>;
    gerep: FirstField<string | null>;
}

interface FiliereWithoutOptions {
    nom: FirstField<string>;
    ced: FirstField<string>;
    consistance: FirstField<string>;
    cap: FirstField<string>;
}

interface DechetDangereuxWithoutOptions {
    ced: FirstField<string>;
    onu: FirstField<number | string>;
    denomination: FirstField<string>;
    danger: FirstField<number | string>;
    emballage: FirstField<string>;
    collecte: FirstField<string | null>;
}

interface PersonneWithoutOptions {
    lastname: FirstField<string>;
    firstname: FirstField<string>;
    tel: FirstField<string>;
    email: FirstField<string>;
}

interface ContenantWithoutOptions {
    nom: FirstField<string | null>;
    code: FirstField<string>;
    identifiant: FirstField<string | null>;
    description: FirstField<string>;
    unitaire: FirstField<string>;
    indicatif: FirstField<number>;
    location: FirstField<string>;
    siret: FirstField<number | null>;
    gouv: Gouv;
}

interface EcoOrganismeWithoutOptions {
    nom: FirstField<string>;
    siret: FirstField<string>;
    gouv: Gouv;
}

interface NegociantWithoutOptions {
    nom: FirstField<string | null>;
    siret: FirstField<number | null>;
    gouv: Gouv;
    adresse: FirstField<string>;
    numero: FirstField<string | null>;
    lastname: FirstField<string>;
    firstname: FirstField<string>;
    tel: FirstField<string | null>;
    email: FirstField<string | null>;
}

interface TransporteurWithoutOptions {
    nom: FirstField<string>;
    siret: FirstField<number>;
    gouv: Gouv;
    adresse: FirstField<string>;
    numero: FirstField<string>;
    lastname: FirstField<string>;
    firstname: FirstField<string>;
    tel: FirstField<string>;
    email: FirstField<string>;
}

interface InstallationIntermediaireWithoutOptions {
    nom: FirstField<string>;
    siret: FirstField<string>;
    gouv: Gouv;
    adresse: FirstField<string>;
    numero: FirstField<string | null>;
    traitement: FirstField<string>;
    lastname: FirstField<string>;
    firstname: FirstField<string>;
    tel: FirstField<string>;
    email: FirstField<string>;
}

interface PrestataireFinalWithoutOptions {
    nom: FirstField<string>;
    siret: FirstField<number | null>;
    gouv: Gouv;
    adresse: FirstField<string>;
    numero: FirstField<string | null>;
    traitement: FirstField<string>;
    qualification: FirstField<string>;
    lastname: FirstField<string>;
    firstname: FirstField<string>;
    tel: FirstField<string>;
    email: FirstField<string>;
}

export interface BSD_Data_Interface_WithoutOptions {
    site: SiteWithoutOptions;
    filiere: FiliereWithoutOptions;
    dechet_dangereux: DechetDangereuxWithoutOptions;
    producteur_personne: PersonneWithoutOptions;
    operationnelle_personne: PersonneWithoutOptions;
    contenant: ContenantWithoutOptions;
    eco_organisme: EcoOrganismeWithoutOptions;
    negociant: NegociantWithoutOptions;
    transporteur: TransporteurWithoutOptions;
    installation_intermediaire: InstallationIntermediaireWithoutOptions;
    prestataire_final: PrestataireFinalWithoutOptions;
    date: { collecte: FirstField<string> }
    volume: FirstField<number>;
    estimated_weight: FirstField<number>;
}

//---------------------Form API---------------------

export type Anything = string | number | boolean;

//Le format principal
export interface Form_API_Interface_New {
    formAPI: {
        createFormInput: {
            emitter: {
                company: {
                    siret: Anything;
                    name: Anything;
                    address: Anything;
                    contact: Anything;
                    phone: Anything;
                    mail: Anything;
                };
                workSite: {
                    address: Anything;
                    postalCode: Anything;
                    city: Anything;
                };
            };
            recipient: {
                cap: Anything;
                company: {
                    siret: Anything;
                    name: Anything;
                    address: Anything;
                    contact: Anything;
                    phone: Anything;
                    mail: Anything;
                };
                processingOperation: Anything;
            };
            transporter: {
                company: {
                    siret: Anything;
                    name: Anything;
                    address: Anything;
                    contact: Anything;
                    phone: Anything;
                    mail: Anything;
                };
            };
            wasteDetails: {
                code: Anything;
                name: Anything;
                onuCode: Anything;
                quantity: Anything;
                quantityType: Anything;
                consistence: Anything;
                packagingInfos: {
                    type: Anything;
                    quantity: Anything;
                }[];
            };
        };
    };
}

export interface Form_API_Interface_Short {
    emitter: {
        company: {
            siret: Anything;
            name: Anything;
            address: Anything;
            contact: Anything;
            phone: Anything;
            mail: Anything;
        };
        workSite: {
            address: Anything;
            postalCode: Anything;
            city: Anything;
        };
    };
    recipient: {
        cap: Anything;
        company: {
            siret: Anything;
            name: Anything;
            address: Anything;
            contact: Anything;
            phone: Anything;
            mail: Anything;
        };
        processingOperation: Anything;
    };
    transporter: {
        company: {
            siret: Anything;
            name: Anything;
            address: Anything;
            contact: Anything;
            phone: Anything;
            mail: Anything;
        };
    };
    wasteDetails: {
        code: Anything;
        name: Anything;
        onuCode: Anything;
        quantity: Anything;
        quantityType: Anything;
        consistence: Anything;
        packagingInfos: {
            type: Anything;
            quantity: Anything;
        }[];
    };
};

export interface DataParametrageInterface {
    adr: string;
    cap: string;
    ced: string;
    onu: number;
    site_nom: string;
    site_siret: number;
    consistance: string;
    filiere_nom: string;
    site_adresse: string;
    contenant_nom: string;
    contenant_code: string;
    classe_de_danger: number;
    denomination_ced: string;
    description_ced: string;
    groupe_emballage: string;
    onu_denomination: string;
    transporteur_nom: string;
    eco_organisme_nom: string;
    transporteur_siret: number | string;
    eco_organisme_siret: number | string;
    transporteur_adresse: string;
    contenant_description: string;
    prestataire_final_nom: string;
    prestataire_final_siret: number | string;
    prestataire_final_adresse: string;
    producteur_personne_tel: string;
    contenant_volume_unitaire: string;
    producteur_personne_email: string;
    transporteur_personne_tel: string;
    contenant_nombre_indicatif: number;
    operationelle_personne_tel: string;
    transporteur_personne_email: string;
    operationelle_personne_email: string;
    producteur_personne_lastname: string;
    producteur_nom: string;
    contenant_proprio_ou_location: string;
    producteur_personne_firstname: string;
    transporteur_recipisse_numero: string;
    installation_intermediaire_nom: string;
    prestataire_final_personne_tel: string;
    transporteur_personne_lastname: string;
    operationelle_personne_lastname: string;
    transporteur_personne_firstname: string;
    installation_intermediaire_siret: string;
    operationelle_personne_firstname: string;
    prestataire_final_personne_email: string;
    prestataire_final_code_traitement: string;
    installation_intermediaire_adresse: string;
    transporteur_personne_collecte_tel: string;
    prestataire_final_personne_lastname: string;
    prestataire_final_personne_firstname: string;
    transporteur_personne_collecte_email: string;
    installation_intermediaire_personne_tel: string;
    transporteur_personne_collecte_lastname: string;
    transporteur_personne_collecte_firstname: string;
    installation_intermediaire_personne_email: string;
    installation_intermediaire_code_traitement: string;
    prestataire_final_traitement_qualification: string;
    installation_intermediaire_personne_lastname: string;
    installation_intermediaire_personne_firstname: string;
  }
  
export interface DataSupplementaireInterface {
    site: string;
    filiere: string;
    description: Anything;
    unitVolume: Anything;
}


export interface DataTotalInterface {
    dataFormAPI: Form_API_Interface_New;
    dataSupplementaire: DataSupplementaireInterface;
}

export interface DataOnSupabase_infos_json {
    formAPI: {createFormInput: Form_API_Interface_Short};
    dataSupplementaire: DataSupplementaireInterface;
}
