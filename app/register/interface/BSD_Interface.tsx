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

interface SiteWithoutOptions {
    nom: FirstField<string>;
    siret: FirstField<number | null>;
    raison: FirstField<string>;
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
    raison: FirstField<string>;
}

interface EcoOrganismeWithoutOptions {
    nom: FirstField<string>;
    siret: FirstField<string>;
    raison: FirstField<string>;
}

interface NegociantWithoutOptions {
    nom: FirstField<string | null>;
    siret: FirstField<number | null>;
    raison: FirstField<string>;
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
    raison: FirstField<string>;
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
    raison: FirstField<string>;
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
    raison: FirstField<string>;
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
