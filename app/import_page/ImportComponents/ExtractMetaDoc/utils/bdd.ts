import { supabase } from "@/app/database/supabaseClient";
import { PdfInfo, NewPdfInfo, ParamsMapping } from '../interface/pdf_interface';

// Récupérer un PDF depuis le storage
export const downloadPdfFromStorage = async (pdfPath: string) => {
    return await supabase.storage
        .from('pdfs_bucket')
        .download(pdfPath);
};

// Récupérer les informations d'un PDF depuis la base de données
export const getPdfInfoById = async (pdfId: number, entrepriseId: number) => {
    return await supabase
        .from('pdf_infos')
        .select('*')
        .eq('id', pdfId)
        .eq('entreprise_id', entrepriseId)
        .single();
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
        .select('params_mapping_site, params_mapping_presta')
        .eq('id', entrepriseId)
        .single();

    if (error) {
        return { data: null, error };
    }

    const params: ParamsMapping = {
        params_mapping_site: data.params_mapping_site,
        params_mapping_presta: data.params_mapping_presta
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
    infosRaw: Record<string, unknown>, 
    alerte: Record<string, unknown>
) => {
    return await supabase
        .from('pdf_infos')
        .update({
            infos_raw: infosRaw,
            alerte: alerte
        })
        .eq('id', pdfId)
        .eq('entreprise_id', entrepriseId)
        .select()
        .single();
};
