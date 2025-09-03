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
    site_siret: string | null;
    provider: Record<string, unknown> | null; // jsonb
    site_siret_plus: string[] | null; // text[]
    infos_raw?: Record<string, unknown> | null; // jsonb
    alerte?: Record<string, unknown> | null; // jsonb
    bsd_linked?: Record<string, unknown> | null; // jsonb
}

export interface NewPdfInfo {
    user_id: string; // uuid
    pdf_path: string;
    name_pdf: string | null;
    name_pdf_in_bucket: string | null;
    status: string;
    file_size: number | null; // real
    site_siret: string | null;
    document_type: string | null;
    provider: Record<string, unknown> | null; // jsonb
    entreprise_id: number | null; // bigint
    site_siret_plus: string[] | null; // text[]
    infos_raw?: Record<string, unknown> | null; // jsonb
    alerte?: Record<string, unknown> | null; // jsonb
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
}
