interface FactureLine {
    factureId: string;
    lineNumber: number;
    created_at: string;
    infos: {
        code_ced: string;
        description_adresse_site: string;
        linked_to_bsd: boolean;
        // autres propriétés...
    };
}

export default FactureLine;
