// Types et interfaces pour LoopStarter

export interface PdfInfo {
    id: string;
    name_pdf: string;
    name_pdf_in_bucket: string;
    pdf_path: string;
    created_at: string;
    status: string;
    document_type: string | null;
    file_size: number | null;
    nb_pages?: number | null;
    site_siret: string | null;
    provider: Record<string, unknown> | null;
    site_siret_plus: string[] | null;
    alerte: Record<string, unknown> | null;
    confidence?: {
        brute?: number;
        spec?: number;
        handwritten?: [number, boolean];
    } | null;
    entreprise_id: number;
    user_id: string;
    infos_raw?: Record<string, unknown>;
    bsd_linked?: Record<string, unknown> | null;
}

export interface SiteInfo {
    siret: string;
    name: string;
}

export interface FilterState {
    alerteStop: boolean | null;
    alerteFlags: string[];  // Nouveau filtre granulaire pour les types d'alertes
    providers: string[];
    siteSirets: string[];
    documentTypes: string[];
    statuses: string[];
    pages: '' | 'one' | 'multi';
    confidenceBrute: string;  // Filtre pour score brute (ex: ">80", "<60", "80-90")
    confidenceSpec: string;   // Filtre pour score spécifique
    handwrittenPercent: string;  // Filtre pour taux manuscrit
    coveragePercent: string;  // Filtre pour taux de couverture
}

export interface FilterOptions {
    providers: Array<{id: string, name: string}>;
    sites: Array<{id: string, name: string}>;
    documentTypes: Array<{value: string, label: string}>;
    statuses: Array<{value: string, label: string}>;
    alerteFlags: Array<{value: string, label: string}>;
}

export interface ProcessingResult {
    pdfId: string;
    success: boolean;
    message: string;
    error?: string;
    newPdfIds?: string[];
    confidence?: {
        brute: number;
        spec: number;
        handwritten: [number, boolean];
    };
    alerte?: {
        stop: boolean;
        message: string;
    };
    wasSplit?: boolean;
    originalPdfName?: string;
    autoLinkDetails?: Array<{ index: number; performed: 'linked' | 'created' | 'to_check_by_user' | 'skipped'; bsd_id?: string }>;
}

export interface LoopStarterProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export interface MultiSelectProps {
    options: Array<{id: string, name: string} | {value: string, label: string}>;
    selectedValues: string[];
    onChange: (values: string[]) => void;
    placeholder: string;
    label: string;
}

export interface AlerteFlag {
    label: string;
    color: string;
}

