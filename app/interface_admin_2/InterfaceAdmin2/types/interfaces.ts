export interface FormulaireManoProps { 
    currentPdfId: string | null;
    onNextPdf: () => void;
}

export interface SelectInputProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: string[];
    className?: string;
}

export interface FactureLineHeader {
    prestataire_nom: string;
    prestataire_description?: string;
    prestataire_siret?: string;
    prestataire_num_client?: string;
    num_facture?: string;
    date_facture?: string;
}

export interface DepartLineHeader {
    site_description?: string;
    site_num_affaire?: string;
    site_nom?: string;
    dechet_description?: string;
    type_dechet: string;
    code_dechet: string;
    filiere?: string;
    num_dossier?: string;
    bon_intention?: string;
    bon_pesee?: string;
    lieu_vidage?: string;
    date_depart: string;
}

export interface DepartLineBody {
    type_operation: string;
    quantite: number;
    unite: string;
    prix_unitaire: number;
    montant_ht: number;
    description_contenant?: string;
    type_contenant?: string;
}

export interface DepartLine {
    line_header: DepartLineHeader;
    line_body: DepartLineBody[];
    commentaire?: string;
    linked_to_bsd: boolean;
}

export interface FactureLine {
    header: FactureLineHeader;
    departs: DepartLine[];
    footer: {
        total_ht: number;
    };
} 