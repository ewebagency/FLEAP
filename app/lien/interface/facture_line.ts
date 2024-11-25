interface FactureLine {
    factureId: string;
    lineNumber: number;
    created_at: string;
    infos: {
        code_dechet: string;
        type_dechet: string;
        type_operation: string;
        lieu_collecte: string;
        date_collecte: string;
        montant_ht: number;
        linked_to_bsd: boolean;
        prestataire_nom: string;
        // autres propriétés...
    };
}

export default FactureLine;
