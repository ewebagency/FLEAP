interface FactureLineOutdated {
    id: string;
    created_at: string;
    infos_json: {
        header: {
            prestataire_nom: string;
        };
        depart: {
            type_operation: string;
            type_dechet: string;
            code_dechet: string;
            date_collecte: string;
            lieu_collecte: string;
            montant_ht: number;
            linked_to_bsd: boolean;
        };
        footer: {
            total_ht: number;
        };
    };
}



export interface DepartLine {
    line_header: DepartLineHeader;
    line_body: DepartLineBody[];
    commentaire?: string;
}

export interface DepartLineHeader {
    type_dechet: string;
    code_dechet: string;
    date_collecte: string;
    lieu_collecte: string;
    periode_debut: string;
    periode_fin: string;
}

export interface DepartLineBody {
    type_operation: string;
    montant_ht: number;
    is_expanded?: boolean;
}

export interface FactureLine {
    header: {
        prestataire_nom: string;
    };
    footer: {
        total_ht: number;
    };
    departs: DepartLine[];
}


export interface FactureLineOnSupabase {
    id: string;
    created_at: string;
    infos_json: {
        header: {
            prestataire_nom: string;
        };
        depart: {
            line_header: {
                code_dechet: string;
                type_dechet: string;
                date_collecte: string;
                lieu_collecte: string;
            };
            line_body: Array<{
                montant_ht: number;
                type_operation: string;
            }>;
            commentaire?: string;
            linked_to_bsd: boolean;
        };
        footer: {
            total_ht: number;
        };
    };
}