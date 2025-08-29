import { updatePdfExtractionResults, getPdfInfoById, getEntrepriseNameById, getParamsMappingByEntreprise, createSignedUrl } from './bdd';
import { MetaOcrParams, MetaOcrResponse, PdfInfo, ParamsMapping } from '../interface/pdf_interface';
import useSWR from 'swr';

interface ExtractMetaOcrResult {
    success: boolean;
    message: string;
    data?: {
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
    };
    error?: string;
}

/**
 * Hook SWR pour récupérer et mémoriser les mappings lourds par entreprise
 */
export const useParamsMapping = (entrepriseId: number | null) => {
    const key = entrepriseId ? `params-mapping-${entrepriseId}` : null;
    const fetcher = async (): Promise<ParamsMapping> => {
        const { data, error } = await getParamsMappingByEntreprise(entrepriseId as number);
        if (error || !data) {
            throw new Error(error?.message || 'Erreur lors du chargement des mappings');
        }
        return data;
    };
    return useSWR(key, fetcher, { revalidateOnFocus: false, revalidateOnReconnect: false });
};

/**
 * Extrait les métadonnées d'un PDF en utilisant l'API meta-ocr du backend Python
 * et met à jour la base de données avec les résultats
 */
export const extractMetaOcr = async (params: MetaOcrParams): Promise<ExtractMetaOcrResult> => {
    try {
        if (params.infos_pdf.entreprise_id == null) {
            return {
                success: false,
                message: "entreprise_id manquant pour la mise à jour BDD",
                error: "entreprise_id is null"
            };
        }

        // Préparer les données pour l'API
        const formData = new FormData();
        formData.append('file', params.file);
        formData.append('type', params.type);
        formData.append('liste_nom_eviter', JSON.stringify(params.liste_nom_eviter));
        formData.append('pdfInfos', JSON.stringify(params.infos_pdf));
        formData.append('clusterParams', JSON.stringify(params.cluster_params));

        // Appeler l'API backend Python
        const url = `${process.env.NEXT_PUBLIC_SERVER_PYTHON}/meta-ocr`;
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
        }

        // Parser la réponse JSON
        const result: MetaOcrResponse = await response.json();

        // Mettre à jour la base de données avec les résultats
        const { error: updateError } = await updatePdfExtractionResults(
            params.infos_pdf.id,
            params.infos_pdf.entreprise_id,
            result.structured_response,
            result.alerte
        );

        if (updateError) {
            return {
                success: false,
                message: 'Erreur lors de la mise à jour de la base de données',
                error: updateError.message
            };
        }

        return {
            success: true,
            message: 'Extraction des métadonnées réussie',
            data: {
                structured_response: result.structured_response,
                confidence: result.confidence,
                alerte: result.alerte
            }
        };

    } catch (error) {
        console.error('Erreur lors de l\'extraction des métadonnées:', error);
        return {
            success: false,
            message: 'Erreur lors de l\'extraction des métadonnées',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
};

/**
 * Version simplifiée de la fonction avec des paramètres individuels
 */
export const extractMetaOcrSimple = async (
    file: File,
    type: string,
    entrepriseName: string,
    pdfInfo: PdfInfo,
    clusterParams: {
        data: {
            params_mapping_site: Record<string, string[]>;
            params_mapping_presta: Record<string, string[]>;
        };
    }
): Promise<ExtractMetaOcrResult> => {
    const params: MetaOcrParams = {
        file,
        type,
        liste_nom_eviter: [entrepriseName],
        infos_pdf: pdfInfo,
        cluster_params: clusterParams
    };

    return await extractMetaOcr(params);
};

/**
 * Orchestrateur: récupère les données nécessaires puis appelle extractMetaOcrSimple
 */
export const runMetaOcrForPdf = async (
    pdfId: number,
    entrepriseId: number
): Promise<ExtractMetaOcrResult> => {
    // 1) Récupérer pdf_info
    const { data: pdfInfo, error: pdfErr } = await getPdfInfoById(pdfId, entrepriseId);
    if (pdfErr || !pdfInfo) {
        return { success: false, message: 'Impossible de récupérer pdf_infos', error: pdfErr?.message || 'not found' };
    }

    // 2) Récupérer nom entreprise
    const { data: ent, error: entErr } = await getEntrepriseNameById(entrepriseId);
    if (entErr || !ent?.name) {
        return { success: false, message: 'Impossible de récupérer le nom de l\'entreprise', error: entErr?.message || 'not found' };
    }

    // 3) Récupérer signed URL et File à partir du name_pdf_in_bucket
    if (!pdfInfo.name_pdf_in_bucket) {
        return { success: false, message: 'name_pdf_in_bucket est null ou vide', error: 'name_pdf_in_bucket manquant' };
    }
    const { data: signedUrlData, error: signedUrlError } = await createSignedUrl(pdfInfo.name_pdf_in_bucket, 3600);
    if (signedUrlError || !signedUrlData?.signedUrl) {
        return { success: false, message: 'Impossible d\'obtenir l\'URL signée du PDF', error: signedUrlError?.message || 'URL signée non générée' };
    }
    
    const blobResp = await fetch(signedUrlData.signedUrl);
    if (!blobResp.ok) {
        return { success: false, message: 'Impossible de télécharger le PDF', error: `${blobResp.status} ${blobResp.statusText}` };
    }
    const pdfBlob = await blobResp.blob();
    const file = new File([pdfBlob], pdfInfo.name_pdf || 'document.pdf', { type: 'application/pdf' });

    // 4) Construire cluster_params dans le format attendu par le backend
    const { data: paramsMap, error: mapErr } = await getParamsMappingByEntreprise(entrepriseId);
    if (mapErr || !paramsMap) {
        return { success: false, message: 'Impossible de récupérer les mappings', error: mapErr?.message || 'not found' };
    }

    const clusterParams = {
        data: {
            params_mapping_site: paramsMap.params_mapping_site,
            params_mapping_presta: paramsMap.params_mapping_presta
        }
    };

    // 5) Type de document
    const docType = pdfInfo.document_type || 'inconnu';

    // 6) Appel extraction
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', docType);
    formData.append('liste_nom_eviter', JSON.stringify([ent.name]));
    formData.append('pdfInfos', JSON.stringify(pdfInfo));
    formData.append('clusterParams', JSON.stringify(clusterParams));

    const url = `${process.env.NEXT_PUBLIC_SERVER_PYTHON}/meta-ocr`;
    const response = await fetch(url, { method: 'POST', body: formData });
    if (!response.ok) {
        return { success: false, message: 'Erreur appel meta-ocr', error: `${response.status} ${response.statusText}` };
    }
    const result: MetaOcrResponse = await response.json();

    // 7) Update BDD
    const { error: updateError } = await updatePdfExtractionResults(pdfInfo.id, entrepriseId, result.structured_response, result.alerte);
    if (updateError) {
        return { success: false, message: 'Erreur lors de la mise à jour BDD', error: updateError.message };
    }

    return { 
        success: true, 
        message: 'Extraction réussie', 
        data: {
            structured_response: result.structured_response,
            confidence: result.confidence,
            alerte: result.alerte
        }
    };
};
