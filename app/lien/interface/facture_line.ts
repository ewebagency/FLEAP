interface FactureLine {
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

export default FactureLine;
