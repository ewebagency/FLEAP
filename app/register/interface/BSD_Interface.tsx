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
    pays: FirstField<string>;
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
                type: string;
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
                    //description: Anything;
                }[];
            };
        };
    };
}

export interface Form_API_Interface_Short {
    emitter: {
        type: string;
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




export interface BSDD_TrackDechets_DEPRECATED {
    // Identifiants et statut
    id: string;                     // Identifiant unique du bordereau dans Trackdéchets
    customId: string;               // Identifiant personnalisé défini par l'utilisateur
    readableId: string;             // Identifiant lisible du bordereau (ex: BSD-20201215-ABCDEFGH)
    status: string;                 // Statut actuel du bordereau
    
    // Informations sur l'émetteur (case 1)
    emitter: {
        type: string;               // Type d'émetteur (PRODUCER, OTHER, ECO_ORGANISME)
        workSite: {
            address: string;        // Adresse du chantier
            city: string;           // Ville du chantier
            postalCode: string;     // Code postal du chantier
            infos: string;          // Informations complémentaires
        };
        company: {
            siret: string;          // Numéro SIRET
            name: string;           // Nom de l'entreprise
            address: string;        // Adresse
            contact: string;        // Nom du contact
            mail: string;           // Email
            phone: string;          // Téléphone
        };
        isPrivateIndividual: boolean; // Si particulier
        isForeignShip: boolean;       // Si navire étranger
    };

    // Informations sur le destinataire (case 2)
    recipient: {
        company: {
            siret: string;          // Numéro SIRET
            name: string;           // Nom de l'entreprise
            address: string;        // Adresse
            contact: string;        // Nom du contact
            mail: string;           // Email
            phone: string;          // Téléphone
        };
        cap: string;               // Numéro CAP
        processingOperation: string; // Code opération (D/R)
    };

    // Informations sur le transporteur (case 8)
    transporter: {
        company: {
            siret: string;          // Numéro SIRET
            name: string;           // Nom de l'entreprise
            address: string;        // Adresse
            contact: string;        // Nom du contact
            mail: string;           // Email
            phone: string;          // Téléphone
        };
        recepisse: {
            number: string;         // Numéro récépissé
            department: string;     // Département
            validityLimit: string;  // Date limite validité
        };
        numberPlate: string;        // Plaque d'immatriculation
    };

    // Détails du déchet (cases 3-7)
    wasteDetails: {
        code: string;              // Code déchet
        name: string;              // Nom déchet
        onuCode: string;           // Code ONU
        packagingInfos: [{
            type: string;          // Type emballage
            other?: string;         // Autre description si type === AUTRE
            quantity: number;      // Quantité
        }];
        quantity: number;          // Quantité déchet
        quantityType: string;      // Type quantité (REAL/ESTIMATED)
        consistence: string;       // Consistance (SOLID/LIQUID/GASEOUS)
        pop: boolean;             // Présence POP
    };

    // Eco-organisme
    ecoOrganisme: {
        name: string;             // Nom
        siret: string;            // SIRET
    };

    // Négociant
    trader: {
        company: {
            siret: string;        // Numéro SIRET
            name: string;         // Nom entreprise
            address: string;      // Adresse
            contact: string;      // Contact
            mail: string;         // Email
            phone: string;        // Téléphone
        };
        recepisse: {
            number: string;       // Numéro récépissé
            department: string;   // Département
            validityLimit: string; // Date limite validité
        };
    };

    // Courtier
    broker: {
        company: {
            siret: string;        // Numéro SIRET
            name: string;         // Nom entreprise
            address: string;      // Adresse
            contact: string;      // Contact
            mail: string;         // Email
            phone: string;        // Téléphone
        };
        recepisse: {
            number: string;       // Numéro récépissé
            department: string;   // Département
            validityLimit: string; // Date limite validité
        };
    };

    // Entreposage provisoire
    temporaryStorageDetail: {
        destination: {
            company: {
                siret: string;    // Numéro SIRET
                name: string;     // Nom entreprise
                address: string;  // Adresse
                contact: string;  // Contact
                mail: string;     // Email
                phone: string;    // Téléphone
            };
            cap: string;         // Numéro CAP
        };
        transporter: {
            company: {
                siret: string;    // Numéro SIRET
                name: string;     // Nom entreprise
                address: string;  // Adresse
                contact: string;  // Contact
                mail: string;     // Email
                phone: string;    // Téléphone
            };
            recepisse: {
                number: string;   // Numéro récépissé
                department: string; // Département
                validityLimit: string; // Date limite validité
            };
            numberPlate: string;  // Plaque immatriculation
        };
    };

    // Regroupement
    grouping: string[];          // Liste des bordereaux groupés

    // Intermédiaires
    intermediaries: [{
        siret: string;           // Numéro SIRET
        name: string;            // Nom
        address: string;         // Adresse
        contact: string;         // Contact
        mail: string;            // Email
        phone: string;           // Téléphone
    }];

    // Statuts et quantités
    wasteAcceptationStatus: string; // Statut acceptation (ACCEPTED/REFUSED/PARTIALLY_REFUSED)
    wasteRefusalReason: string;    // Raison du refus
    quantityReceived: number;      // Quantité reçue
    quantityReceivedType : string // REAL ou ESTMATED
    quantityRefused: number;       // Quantité refusée

    // Traitement
    processingOperationDone: string; // Opération effectuée
    processingOperationDescription: string; // Description traitement
    noTraceability: boolean;       // Sans traçabilité ultérieure

    // Destination ultérieure
    nextDestination: {
        company: {
            siret: string;        // Numéro SIRET
            name: string;         // Nom entreprise
            address: string;      // Adresse
            country: string;      // Pays
            contact: string;      // Contact
            mail: string;         // Email
            phone: string;        // Téléphone
        };
        cap: string;             // Numéro CAP
        processingOperation: string; // Code opération
    };

    // Informations complémentaires
    notificationNumber: string;    // Numéro notification transfrontalière
    
    // Dates
    emittedAt: string;            // Date émission
    takenOverAt: string;          // Date prise en charge
    receivedAt: string;           // Date réception
    processedAt: string;          // Date traitement
    createdAt: string;            // Date création
    updatedAt: string;            // Date mise à jour
    
    // Statuts spéciaux
    isDeleted: boolean;           // Si supprimé
    hasCiterneBeenWashedOut: boolean; // Si citerne lavée
    citerneNotWashedOutReason: string; // Raison non-lavage
    emptyReturnADR: string;      // Si retour à vide ADR
}






//////////////////////////////////////////

export interface Company {
    name: string;
    givenName?: string; //Celui qu'on utilise nous
    orgId?: string; //SIRET ou TVA de l'entreprise
    siret: string;
    address: string;
    country: string;
    contact: string;
    phone: string;
    mail: string;
    vatNumber?: string;
    omiNumber?: string;
    extraEuropeanId?: string;
  }
  
interface WorkSite {
name: string;
address: string;
fullAddress?: string|undefined;
city: string;
postalCode: string;
infos: string;
}

interface Transporter {
id?: string;
company: Company;
isExemptedOfReceipt: boolean;
receipt: string;
department: string;
validityLimit: string;
numberPlate: string;
customInfo?: string;
mode: string;
takenOverAt?: string;
takenOverBy?: string;
}

interface WasteDetails {
code: string;
name: string;
isSubjectToADR: boolean;
onuCode: string;
nonRoadRegulationMention?: string;
packagingInfos: PackagingInfos[];
quantity: number; //en tonnes
quantityType: 'REAL'|'ESTIMATED';
consistence: string;
pop: boolean;
isDangerous: boolean;
parcelNumbers: ParcelNumber;
analysisReferences?: string; //OBLIGATOIIIIIRE NORMALEMENT    //Numéros de référence(s) d'analyse(s)
landIdentifiers?: string; //OBLIGATOIIIIIRE NORMALEMENT  // Identifiant(s) du ou des terrains lorsque les terres ont été extraites d'un terrain placé en secteur d'information sur les sols au titre de l'article L. 125-6
sampleNumber?: string;   //Numéro d'échantillon pour les huiles noires. Ne concerne que les bordereaux parmi les codes suivants: 13 02 04*, 13 02 05*, 13 02 06*, 13 02 07*, 13 02 08*
}

interface ParcelNumber {
    city: string; // Ville (obligatoire)
    postalCode: string; // Code postal (obligatoire)
    prefix?: string; // Préfixe cadastral (optionnel)
    section?: string; // Numéro de section cadastrale (optionnel)
    number?: string; // Numéro de parcelle cadastrale (optionnel)
    x?: number; // Coordonnée X au format WGS 84 (optionnel)
    y?: number; // Coordonnée Y au format WGS 84 (optionnel)
  }
  
interface PackagingInfos{
    type:'FUT'|'GRV'|'CITERNE'|'BENNE'|'PIPELINE'|'AUTRE',
    other?:string,
    quantity:number,
}

interface TemporaryStorer {
quantityType: string;
quantityReceived: number;
quantityRefused: number;
quantityAccepted: number;
wasteAcceptationStatus: string;
wasteRefusalReason: string;
receivedAt: string;
receivedBy: string;
}

interface Destination {
cap: string;
processingOperation: string;
company: Company;
}

interface StateSummary {
quantity: number;
quantityType: string;
packagingInfos: string;
isSubjectToADR: boolean;
onuCode: string;
nonRoadRegulationMention: string;
transporter: Transporter;
transporterNumberPlate: string;
transporterCustomInfo: string;
recipient: Company;
emitter: Company;
lastActionOn: string;
}

interface EcoOrganism {
name: string;
siret: string;
}

interface NextDestination {
processingOperation: string;
notificationNumber: string;
company: Company;
}

interface Grouping {
    form:{
        id: string;
    },
    quantity: number;
}

export interface BSDD_TrackDechets {

id?: string;
readableId: string;
customId: string;

status: string;

isImportedFromPaper?: boolean;

emitter: {
    type: string;
    workSite: WorkSite;
    company: Company;
    isPrivateIndividual?: boolean;
    isForeignShip?: boolean;
};

recipient: {
    company: Company;
    cap: string;
    processingOperation: string;
    isTempStorage?: boolean; //?????????????????????????????????????????
};

transporter: Transporter;

wasteDetails: WasteDetails;

trader: {
    company: Company;
    receipt: string; //numéro récépissé
    department: string;
    validityLimit: string;
};

broker: {
    company: Company;
    receipt: string;
    department: string;
    validityLimit: string;
};

ecoOrganisme: EcoOrganism;

transporters?: string[];  //liste des id des transporters

createdAt: string;
updatedAt: string;

emittedAt: string;
emittedBy: string;
emittedByEcoOrganisme: string;

takenOverAt?: string;
takenOverBy?: string;

wasteAcceptationStatus: string;
wasteRefusalReason: string;

hasCiterneBeenWashedOut: boolean;
citerneNotWashedOutReason?: string;

receivedBy: string;
receivedAt: string;

signedAt?: string;

quantityReceived?: number;
quantityReceivedType?: string;
quantityAccepted?: number;
quantityRefused?: number;

processingOperationDone: string;
processingOperationDescription: string;
processedBy: string;
processedAt: string;

noTraceability: boolean;

nextDestination?: NextDestination;

grouping?: Grouping;
quantityGrouped?: number;
groupedIn?: string; //En vrai pas string mais bon

temporaryStorageDetail?: {
    temporaryStorer: TemporaryStorer;
    destination: Destination;
    wasteDetails: WasteDetails;
    transporter: Transporter;
    emittedAt: string;
    emittedBy: string;
    takenOverAt: string;
    takenOverBy: string;
};

stateSummary?: StateSummary;

currentTransporterSiret?: string;
nextTransporterSiret?: string;

intermediaries?: string[];

metadata?: string;

emptyReturnADR?: boolean;
}
  

export interface FormInput {
    //id?: string;
    //customId?: string;
    //status?: string;
    //isImportedFromPaper?: boolean;
    quantityReceived?: number;
    filiere?:string;
    emittedAt?: string;
    createdAt?: string;
    updatedAt?: string;
    takenOverAt?: string;
  
    emitter: {
      type: string;
      workSite: WorkSite;
      company: Company;
      isPrivateIndividual?: boolean;
      isForeignShip?: boolean;
    };
  
    recipient: {
      cap?: string;
      processingOperation?: string;
      company: Company;
      isTempStorage?: boolean; //"Si c'est un entreprosage provisoire ou reconditionnement"
    };
  
    transporter: {
      company: Company;
      isExemptedOfReceipt: boolean;
      receipt?: string; //juste pour nous
      numberPlate?: string;
      customInfo?: string; //"Information libre, destinée aux transporteurs"
    };
  
    transporters?: string; // ID of transporters (assumed to be a scalar)
  
    wasteDetails: {
        code: string;
        name: string;
        isSubjectToADR: boolean;
        onuCode: string;
        nonRoadRegulationMention?: string;
        packagingInfos: PackagingInfos[];
        quantity: number; //en tonnes
        quantityType: 'REAL'|'ESTIMATED';
        consistence?: string;
        pop: boolean;
        isDangerous: boolean;
        parcelNumbers?: ParcelNumber;
        analysisReferences?: string; //OBLIGATOIIIIIRE NORMALEMENT    //Numéros de référence(s) d'analyse(s)
        landIdentifiers?: string; //OBLIGATOIIIIIRE NORMALEMENT  // Identifiant(s) du ou des terrains lorsque les terres ont été extraites d'un terrain placé en secteur d'information sur les sols au titre de l'article L. 125-6
        sampleNumber?: string;   //Numéro d'échantillon pour les huiles noires. Ne concerne que les bordereaux parmi les codes suivants: 13 02 04*, 13 02 05*, 13 02 06*, 13 02 07*, 13 02 08*
    };
    
    trader?: {
        receipt: string; //numéro récépissé
        department: string;
        validityLimit?: string;
        company: Company;
    };
    broker?: {
        receipt: string;
        department: string;
        validityLimit?: string;
        company: Company;
    };

    grouping?: Grouping;
    ecoOrganisme?: {name: string,  siret: string};
    temporaryStorageDetail?: {
        company: Company; // L'entreprise de destination
        cap?: string; // Numéro de CAP (obligatoire pour les déchets dangereux)
        processingOperation?: string; // Code de l'opération d'élimination/valorisation
      }
    intermediaries?: Company[];
  }

export interface OtherInfos {
    volume: string;
    melange?: {
        name: string;
        percent: string;
    }[];
    fillRate: string;
    inputMode?: 'volume' | 'tonnage';
    volumeUnit: string;
    automaticMode?: boolean;
    containerDescription: string;      
    recipientEmail?: string;
    comments?: string;
}

export interface CompleteFormInput{
    other_infos?: OtherInfos;
    json_row: FormInput;
}

export interface RowBSD {
    created_at:string;
    infos_json:{formAPI:{createFormInput:BSDD_TrackDechets}}
    other_infos : OtherInfos;
    status_track_dechets : string;
    id_track_dechets :string;
    entreprise_id :string;
    user_id:string;
}


export interface FastDataSupa {
    id: string;
    entreprise_id: string;
    user_id: string;
    created_at: string;
    status_track_dechets: string;
    readable_id_track_dechets: string;
    facture_infos: {
      footer: {
        total_ht: string;
      };
    };
    infos_json: {
      emitter: {
        siret: string;
        name: string;
      };
      recipient: {
        siret: string;
        name: string;
      };
      transporter: {
        siret: string;
        name: string;
      };
      wasteDetails: {
        code: string;
        name: string;
        quantity: string;
        processingOperation: string;
        isDangerous: string;
      };
      takenOverAt: string;
      other_infos: {
        fillRate: string;
      };
    };
    other_infos: {fillRate: string};
    on_track_dechets: boolean;
    created_on_fleap: string;
    facture_treated: boolean;
    id_track_dechets: string;
  } 