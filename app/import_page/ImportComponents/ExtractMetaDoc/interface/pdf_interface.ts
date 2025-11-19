export interface PdfInfo {
    id: string; // uuid
    name_pdf: string | null;
    status: string;
    document_type: string | null;
    entreprise_id: number | null; // bigint
    pdf_path: string;
    user_id: string; // uuid
    name_pdf_in_bucket: string | null;
    file_size: number | null; // real
    nb_pages?: number | null; // integer
    site_siret: string | null;
    provider: Record<string, unknown> | null; // jsonb
    site_siret_plus: string[] | null; // text[]
    infos_raw?: Record<string, unknown> | null; // jsonb
    alerte?: Record<string, unknown> | null; // jsonb
    bsd_linked?: Record<string, unknown> | null; // jsonb
    created_at: string; // timestamp
    id_rag?: string | null;
}

export interface NewPdfInfo {
    user_id: string; // uuid
    pdf_path: string;
    name_pdf: string | null;
    name_pdf_in_bucket: string | null;
    status: string;
    file_size: number | null; // real
    nb_pages?: number | null; // integer
    site_siret: string | null;
    document_type: string | null;
    provider: Record<string, unknown> | null; // jsonb
    entreprise_id: number | null; // bigint
    site_siret_plus: string[] | null; // text[]
    infos_raw?: Record<string, unknown> | null; // jsonb
    alerte?: Record<string, unknown> | null; // jsonb
    id_rag?: string | null;
}

export interface SplitPdfResult {
    success: boolean;
    message: string;
    newPdfIds?: string[];
    error?: string;
}

export interface MetaOcrResponse {
    structured_response: Record<string, unknown>;
    confidence: {
        brute: number;
        spec: number;
        handwritten: [number, boolean];
    };
    alerte: {
        stop: boolean;
        message: string;
    };
    rag_example_id?: string | null;
}

export interface MetaOcrParams {
    file: File;
    type: string;
    liste_nom_eviter: string[];
    infos_pdf: PdfInfo;
    cluster_params: {
        data: {
            params_mapping_site: Record<string, string[]>;
            params_mapping_presta: Record<string, string[]>;
        };
    };
}

export interface ParamsMapping {
    params_mapping_site: Record<string, string[]>;
    params_mapping_presta: Record<string, string[]>;
    params_mapping_operation: Record<string, string[]>;
    params_mapping_unite: Record<string, string[]>;
    params_mapping_contenant: Record<string, string[]>;
}
