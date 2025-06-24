export interface FactureLineHeader {
    prestataire_nom: string;
    prestataire_description?: string;
    prestataire_siret?: string;
    prestataire_num_client?: string;
    num_facture?: string;
    date_facture?: string;
}

export interface FactureLineBody {
    type_operation: string;
    unite: string;
    quantite: number;
    prix_unitaire: number;
    montant_ht: number;
}

export interface FactureLineDepart {
    site_nom: string;
    site_siret: string;
    dechet_nom: string;
    code_ced: string;
    date_collecte: string;
    contenant_nom: string;
    contenant_volume: string;
    contenant_unite: string;
    body: FactureLineBody[];
}

export interface FactureLine {
    header: FactureLineHeader;
    departs: FactureLineDepart[];
    footer: {
        total_ht: number;
    };
}

export interface Option {
    value: string;
    isSuggested?: boolean;
}
