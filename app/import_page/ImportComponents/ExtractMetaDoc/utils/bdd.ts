import { supabase } from "@/app/database/supabaseClient";
import { PdfInfo, NewPdfInfo, ParamsMapping } from '../interface/pdf_interface';
import { PDFDocument } from 'pdf-lib';

// Récupérer un PDF depuis le storage
export const downloadPdfFromStorage = async (pdfPath: string) => {
    return await supabase.storage
        .from('pdfs_bucket')
        .download(pdfPath);
};

// Récupérer les informations d'un PDF depuis la base de données
export const getPdfInfoById = async (pdfId: string, entrepriseId: number) => {
    // Utiliser maybeSingle() pour éviter l'erreur si plusieurs lignes ou aucune ligne
    const result = await supabase
        .from('pdf_infos')
        .select('*')
        .eq('id', pdfId)
        .eq('entreprise_id', entrepriseId)
        .maybeSingle();
    
    // Si maybeSingle() retourne null mais qu'on a des données (cas de plusieurs lignes), prendre la première
    if (!result.data && !result.error) {
        const { data: allData, error: allError } = await supabase
            .from('pdf_infos')
            .select('*')
            .eq('id', pdfId)
            .eq('entreprise_id', entrepriseId)
            .limit(1);
        
        if (allError) {
            return { data: null, error: allError };
        }
        
        return { data: allData?.[0] || null, error: null };
    }
    
    return result;
};

// Récupérer le nom de l'entreprise
export const getEntrepriseNameById = async (entrepriseId: number) => {
    return await supabase
        .from('entreprise')
        .select('name')
        .eq('id', entrepriseId)
        .single();
};

// Récupérer les mappings (sites et prestataires) pour une entreprise
export const getParamsMappingByEntreprise = async (entrepriseId: number) => {
    const { data, error } = await supabase
        .from('entreprise')
        .select('params_mapping_site, params_mapping_presta, params_mapping_operation, params_mapping_unite, params_mapping_contenant')
        .eq('id', entrepriseId)
        .single();

    if (error) {
        return { data: null, error };
    }

    const params: ParamsMapping = {
        params_mapping_site: data.params_mapping_site,
        params_mapping_presta: data.params_mapping_presta,
        params_mapping_operation: data.params_mapping_operation,
        params_mapping_unite: data.params_mapping_unite,
        params_mapping_contenant: data.params_mapping_contenant
    };

    return { data: params, error: null };
};

// Uploader un nouveau PDF dans le storage
export const uploadPdfToStorage = async (path: string, pdfBytes: Uint8Array) => {
    return await supabase.storage
        .from('pdfs_bucket')
        .upload(path, pdfBytes, {
            contentType: 'application/pdf',
            cacheControl: '3600'
        });
};

// Créer une URL signée pour un PDF
export const createSignedUrl = async (path: string, expiresIn: number = 3600) => {
    const { data, error } = await supabase.storage
        .from('pdfs_bucket')
        .createSignedUrl(path, expiresIn);
    
    return { data, error };
};

// Compter le nombre de pages d'un PDF à partir d'un File/Blob
export const getPdfPageCountFromFile = async (file: File | Blob): Promise<number> => {
    try {
        const buffer = await file.arrayBuffer();
        const doc = await PDFDocument.load(buffer);
        return doc.getPageCount();
    } catch {
        return 0;
    }
};

// Insérer une nouvelle entrée dans pdf_infos
export const insertPdfInfo = async (pdfInfo: NewPdfInfo) => {
    return await supabase
        .from('pdf_infos')
        .insert(pdfInfo)
        .select()
        .single();
};

// Supprimer un PDF du storage
export const deletePdfFromStorage = async (pdfPath: string) => {
    return await supabase.storage
        .from('pdfs_bucket')
        .remove([pdfPath]);
};

// Supprimer une entrée de pdf_infos
export const deletePdfInfo = async (pdfId: string, entrepriseId: number) => {
    return await supabase
        .from('pdf_infos')
        .delete()
        .eq('id', pdfId)
        .eq('entreprise_id', entrepriseId);
};

// Mettre à jour les colonnes infos_raw et alerte d'un PDF
export const updatePdfExtractionResults = async (
    pdfId: string, 
    entrepriseId: number,
    result : {
        alerte: Record<string, unknown>,
        structured_response: Record<string, unknown>,
        confidence: Record<string, unknown>,
        rag_example_id?: string | null,
    },
    status: string
) => {
    // Determine next status
    let newStatus = "read";
    if (status === "splitted") newStatus = "splitted_extracted";

    // 1) Read current pdf_infos to know current document_type
    const { data: existingPdf, error: fetchErr } = await supabase
        .from('pdf_infos')
        .select('document_type, site_siret_plus')
        .eq('id', pdfId)
        .eq('entreprise_id', entrepriseId)
        .single();
    if (fetchErr) {
        return { data: null, error: fetchErr };
    }

    // 2) Try to infer mapped site and provider from structured response using entreprise mappings
    interface MinimalStructuredResponse {
        type_doc?: string;
        site_raw?: string;
        presta_raw?: string;
    }

    const structured: MinimalStructuredResponse = (result.structured_response || {}) as MinimalStructuredResponse;

    // Get mappings
    const { data: mappings } = await getParamsMappingByEntreprise(entrepriseId);

    // Helper to translate using mappings (replicated to avoid cross-file coupling)
    const translateByMapping = (
        value: string,
        mapping: Record<string, string[]>
    ): { name: string; siret: string } => {
        if (!value) return { name: "", siret: "" };
        const normalized = value.toLowerCase().trim();
        for (const [key, originals] of Object.entries(mapping || {})) {
            const nameTranslated = (key || '').split('|')[0] || '';
            const siretTranslated = (key || '').split('|')[1] || '';
            if (Array.isArray(originals) && originals.some(o => (o || '').toLowerCase().trim() === normalized)) {
                return { name: nameTranslated, siret: siretTranslated };
            }
            if (nameTranslated.toLowerCase().trim() === normalized) {
                return { name: nameTranslated, siret: siretTranslated };
            }
        }
        return { name: value, siret: "" };
    };

    // Role detection from table_autocompletion for provider
    type ProviderRole = 'destinataire' | 'transporteur' | null;
    const detectProviderRole = async (entreprise: number, providerName: string): Promise<ProviderRole> => {
        try {
            if (!providerName) return null;
            const nameNorm = providerName.toLowerCase().trim();
            const { data, error } = await supabase
                .from('table_autocompletion')
                .select('transporteur, destinataire')
                .eq('entreprise_id', entreprise);
            if (error || !data) return null;

            const extractNames = (node: unknown): string[] => {
                const results: string[] = [];
                if (!node) return results;
                if (Array.isArray(node)) {
                    for (const item of node) results.push(...extractNames(item));
                } else if (typeof node === 'object') {
                    const obj = node as Record<string, unknown>;
                    if (typeof obj.nomBoite === 'string') results.push(obj.nomBoite);
                    for (const v of Object.values(obj)) results.push(...extractNames(v));
                }
                return results;
            };

            for (const row of data as Array<{ transporteur: unknown; destinataire: unknown }>) {
                const transNames = extractNames(row.transporteur).map(s => s.toLowerCase().trim());
                if (transNames.includes(nameNorm)) return 'transporteur';
                const destNames = extractNames(row.destinataire).map(s => s.toLowerCase().trim());
                if (destNames.includes(nameNorm)) return 'destinataire';
            }
            return null;
        } catch {
            return null;
        }
    };

    // Compute mapped values
    const siteRaw = structured.site_raw || '';
    const prestaRaw = structured.presta_raw || '';
    const siteTranslated = mappings ? translateByMapping(siteRaw, mappings.params_mapping_site || {}) : { name: '', siret: '' };
    const prestaTranslated = mappings ? translateByMapping(prestaRaw, mappings.params_mapping_presta || {}) : { name: '', siret: '' };

    const providerRole = await detectProviderRole(entrepriseId, prestaTranslated.name);

    type ProviderJSON = { name: string; siret: string; is_destination: boolean; is_transporter: boolean };

    // Build update payload
    const updatePayload: Partial<PdfInfo> & {
        infos_raw: Record<string, unknown>;
        alerte: Record<string, unknown>;
        confidence: Record<string, unknown>;
        status: string;
    } = {
        infos_raw: result.structured_response,
        alerte: result.alerte,
        confidence: result.confidence,
        status: newStatus
    };

    (updatePayload as { id_rag?: string | null }).id_rag = result.rag_example_id ?? null;

    // Overwrite document_type if unknown and backend inferred type is present in structured_response
    const currentDocType = (existingPdf?.document_type || '').toLowerCase();
    const structuredType = (structured.type_doc || '').toLowerCase();
    if (!currentDocType || currentDocType === 'inconnu') {
        if (structuredType) {
            // Normalize a bit
            const mapped = ['bon', 'bsd', 'facture', 'conformite', 'autre'].includes(structuredType)
                ? structuredType
                : structuredType;
            (updatePayload as { document_type?: string }).document_type = mapped;
        }
    }

    // If site mapping found, set site_siret_plus to only the siret
    if (siteTranslated.siret) {
        (updatePayload as { site_siret_plus?: string[] }).site_siret_plus = [siteTranslated.siret];
    }

    // If presta mapping found, set provider JSON
    if (prestaTranslated.name || prestaTranslated.siret) {
        const provider: ProviderJSON = {
            name: prestaTranslated.name,
            siret: prestaTranslated.siret,
            is_destination: providerRole === 'destinataire',
            is_transporter: providerRole === 'transporteur'
        };
        (updatePayload as { provider?: ProviderJSON }).provider = provider;
    }

    // 3) Apply update
    return await supabase
        .from('pdf_infos')
        .update(updatePayload)
        .eq('id', pdfId)
        .eq('entreprise_id', entrepriseId)
        .select()
        .single();
};

// Récupérer les BSDs candidats pour une entreprise dans une plage de dates
export const getBSDCandidates = async (
    entrepriseId: number,
    startDate: string,
    endDate: string,
    limit: number = 200
) => {
    return await supabase
        .from('bsd')
        .select(`
            id,
            created_at,
            readable_id_track_dechets,
            infos_json,
            other_infos
        `)
        .eq('entreprise_id', entrepriseId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false })
        .limit(limit);
};
