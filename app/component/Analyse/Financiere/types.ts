export interface Facture {
    id: string;
    user_id: string;
    entreprise_id: string;
    other_infos: {
        code_ced: string;
        date_collecte: string;
        siret_emetteur: string;
        siret_destinataire: string;
        siret_transporteur: string;
    };
    infos_json: {
        depart: {
            line_body: {
                montant_ht: number;
                type_operation: string;
            }[];
            line_header: {
                code_dechet: string;
                type_dechet: string;
                date_collecte: string;
                lieu_collecte: string;
            };
        };
        footer: {
            total_ht: number;
        };
        header: {
            prestataire_nom: string;
        };
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