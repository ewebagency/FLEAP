export interface Operation {
    unite: string;
    quantite: number;
    montant_ht: number;
    prix_unitaire: number;
    type_operation: string;
}

export interface DepartLineHeader {
    filiere: string;
    site_nom: string;
    bon_pesee: string;
    site_siret: string;
    code_dechet: string;
    date_depart: string;
    num_dossier: string;
    type_dechet: string;
    bon_intention: string;
    site_description: string;
    site_num_affaire: string;
    dechet_description: string;
}

export interface Depart {
    line_body: Operation[];
    line_header: DepartLineHeader;
    linked_to_bsd: boolean;
}

export interface Facture {
    id: string;
    user_id: string;
    entreprise_id: string;
    created_at: string;
    infos_json: {
        footer: {
            total_ht: number;
        };
        header: {
            num_facture: string;
            date_facture: string;
            prestataire_nom: string;
            prestataire_siret: string;
            prestataire_num_client: string;
            prestataire_description: string;
        };
        departs: Depart[];
    };
}

export interface ChartData {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        backgroundColor?: string[];
        borderColor?: string;
        fill?: boolean;
    }[];
}