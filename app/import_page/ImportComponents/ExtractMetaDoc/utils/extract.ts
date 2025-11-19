import { updatePdfExtractionResults, getPdfInfoById, getEntrepriseNameById, getParamsMappingByEntreprise, createSignedUrl } from './bdd';
import { supabase } from '@/app/database/supabaseClient';
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
        rag_example_id?: string | null;
    };
    error?: string;
}

// Cache mémoire simple pour éviter de multiplier les appels à table_autocompletion
const siteNameCacheByEntreprise: Record<string, Map<string, string>> = {};

const isResourceExhausted = (value: unknown): boolean => {
    if (!value) return false;
    if (typeof value === 'string') {
        return value.toLowerCase().includes('resource exhausted');
    }
    if (typeof value === 'object') {
        const candidate = value as { status?: string; message?: string };
        if (typeof candidate.status === 'string' && candidate.status.toUpperCase() === 'RESOURCE_EXHAUSTED') {
            return true;
        }
        if (typeof candidate.message === 'string' && candidate.message.toLowerCase().includes('resource exhausted')) {
            return true;
        }
    }
    return false;
};

const resolveSiteNameBySiret = async (entrepriseId: number, siret: string): Promise<string | null> => {
    const key = String(entrepriseId);
    if (!siteNameCacheByEntreprise[key]) {
        const { data } = await supabase
            .from('table_autocompletion')
            .select('site')
            .eq('entreprise_id', entrepriseId);
        const map = new Map<string, string>();
        (data || []).forEach((item: { site?: { siret?: string; nom?: string } }) => {
            const s = item.site?.siret?.replace(/\s/g, '');
            const n = item.site?.nom;
            if (s && n) map.set(s, n);
        });
        siteNameCacheByEntreprise[key] = map;
    }
    const normalized = siret.replace(/\s/g, '');
    return siteNameCacheByEntreprise[key].get(normalized) || null;
};

// Vérifie que l'objet ressemble au schéma complet attendu côté formulaire
const isCompleteDoc = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    const hasType = typeof v.type_doc === 'string' && v.type_doc.length > 0;
    const hasDechet = Array.isArray(v.dechet);
    const hasSite = typeof v.site_raw === 'string';
    const hasPresta = typeof v.presta_raw === 'string';
    return hasType && hasDechet && hasSite && hasPresta;
};

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
        formData.append('doc_type', params.type);
        formData.append('liste_nom_eviter', JSON.stringify(params.liste_nom_eviter));
        formData.append('pdfInfos', JSON.stringify(params.infos_pdf));
        formData.append('clusterParams', JSON.stringify(params.cluster_params));
        formData.append('entreprise_id', String(params.infos_pdf.entreprise_id));
        
        console.log('🔍 Debug extractMetaOcr - entreprise_id envoyé:', params.infos_pdf.entreprise_id, 'type:', typeof params.infos_pdf.entreprise_id);

        // Appeler l'API backend Python
        const url = `${process.env.NEXT_PUBLIC_SERVER_PYTHON}/meta-ocr`;
        
        // Détecter les erreurs réseau/backend
        let response;
        try {
            response = await fetch(url, {
                method: 'POST',
                body: formData,
            });
        } catch (fetchError) {
            // Erreur réseau (failed to fetch, network error, etc.)
            const errorMessage = fetchError instanceof Error ? fetchError.message : 'Network error';
            return {
                success: false,
                message: `Erreur réseau lors de l'appel au backend: ${errorMessage}`,
                error: 'BACKEND_ERROR'
            };
        }

        // Vérifier le statut HTTP
        if (!response.ok) {
            const statusText = response.statusText || 'Unknown error';
            return {
                success: false,
                message: `Erreur backend HTTP ${response.status}: ${statusText}`,
                error: 'BACKEND_ERROR'
            };
        }

    // Parser la réponse JSON
    let result: MetaOcrResponse;
    try {
        result = await response.json();
    } catch (parseError) {
        return {
            success: false,
            message: 'Erreur lors du parsing de la réponse JSON du backend',
            error: 'BACKEND_ERROR'
        };
    }
    console.log('🔍 Debug extractMetaOcr - réponse:', result);
    
    // Vérifier si la réponse contient une erreur (ex: Gemini overloaded)
    // IMPORTANT : on vérifie que c'est UNIQUEMENT un objet error, pas une réponse valide avec structured_response
    if (result && typeof result === 'object' && 'error' in result) {
        const errorObj = result as { error?: unknown; structured_response?: unknown };
        // Si on a une erreur MAIS PAS de structured_response, c'est une vraie erreur
        if (errorObj.error && !errorObj.structured_response) {
            const errorMessage = typeof errorObj.error === 'string' 
                ? errorObj.error 
                : JSON.stringify(errorObj.error);
            return {
                success: false,
                message: `Erreur du backend: ${errorMessage}`,
                error: isResourceExhausted(errorObj.error) ? 'RESOURCE_EXHAUSTED' : 'BACKEND_ERROR'
            };
        }
    }

        // Écraser site_raw / presta_raw avec les valeurs utilisateur si présentes dans pdf_infos
        try {
            const entrepriseId = params.infos_pdf.entreprise_id as number;
            // Override site_raw uniquement si le champ existe ET qu'il n'y a qu'une seule entité (exactement 1 SIRET)
            const siteSiret = Array.isArray(params.infos_pdf.site_siret_plus) && params.infos_pdf.site_siret_plus.length === 1
                ? params.infos_pdf.site_siret_plus[0]
                : null;
            const provider = (params.infos_pdf.provider || null) as { name?: string } | null;

            const structured = (result as { structured_response?: Record<string, unknown> }).structured_response || {};

            // Ne faire les overrides que si le JSON est complet
            if (isCompleteDoc(structured)) {
                // Résoudre le nom du site à partir du SIRET si disponible
                if (siteSiret && entrepriseId) {
                    const siteName = await resolveSiteNameBySiret(entrepriseId, siteSiret);
                    if (siteName) {
                        structured.site_raw = siteName;
                    }
                }

                // Utiliser le nom du prestataire depuis provider si fourni
                if (provider?.name) {
                    structured.presta_raw = provider.name;
                }

                (result as { structured_response?: Record<string, unknown> }).structured_response = structured;
            }
        } catch (e) {
            console.warn('Override site_raw/presta_raw skipped:', e);
        }

        // Mettre à jour la base de données avec les résultats
        const { error: updateError } = await updatePdfExtractionResults(
            params.infos_pdf.id,
            params.infos_pdf.entreprise_id,
            result,
            params.infos_pdf.status
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
                alerte: result.alerte,
                rag_example_id: result.rag_example_id ?? null,
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
    pdfId: string,
    entrepriseId: number,
    forceImage: boolean = false
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
    formData.append('doc_type', docType);
    formData.append('liste_nom_eviter', JSON.stringify([ent.name]));
    formData.append('pdfInfos', JSON.stringify(pdfInfo));
    formData.append('clusterParams', JSON.stringify(clusterParams));
    formData.append('entreprise_id', String(entrepriseId));
    formData.append('force_image', String(forceImage));
    
    console.log('🔍 Debug runMetaOcrForPdf - entreprise_id envoyé:', entrepriseId, 'type:', typeof entrepriseId);
    console.log('🔍 Debug runMetaOcrForPdf - force_image envoyé:', forceImage);

    const url = `${process.env.NEXT_PUBLIC_SERVER_PYTHON}/meta-ocr`;
    
    // Détecter les erreurs réseau/backend
    let response;
    try {
        response = await fetch(url, { method: 'POST', body: formData });
    } catch (fetchError) {
        // Erreur réseau (failed to fetch, network error, etc.)
        const errorMessage = fetchError instanceof Error ? fetchError.message : 'Network error';
        return { 
            success: false, 
            message: `Erreur réseau lors de l'appel au backend: ${errorMessage}`, 
            error: 'BACKEND_ERROR' 
        };
    }
    
    // Vérifier le statut HTTP
    if (!response.ok) {
        const statusText = response.statusText || 'Unknown error';
        return { 
            success: false, 
            message: `Erreur backend HTTP ${response.status}: ${statusText}`, 
            error: 'BACKEND_ERROR' 
        };
    }
    
    // Parser la réponse JSON
    let result: MetaOcrResponse;
    try {
        result = await response.json();
    } catch (parseError) {
        return { 
            success: false, 
            message: 'Erreur lors du parsing de la réponse JSON du backend', 
            error: 'BACKEND_ERROR' 
        };
    }
    
    // Vérifier si la réponse contient une erreur (ex: Gemini overloaded)
    // IMPORTANT : on vérifie que c'est UNIQUEMENT un objet error, pas une réponse valide avec structured_response
    if (result && typeof result === 'object' && 'error' in result) {
        const errorObj = result as { error?: unknown; structured_response?: unknown };
        // Si on a une erreur MAIS PAS de structured_response, c'est une vraie erreur
        if (errorObj.error && !errorObj.structured_response) {
            const errorMessage = typeof errorObj.error === 'string' 
                ? errorObj.error 
                : JSON.stringify(errorObj.error);
            return {
                success: false,
                message: `Erreur du backend: ${errorMessage}`,
                error: isResourceExhausted(errorObj.error) ? 'RESOURCE_EXHAUSTED' : 'BACKEND_ERROR'
            };
        }
    }

        // Écraser site_raw / presta_raw avec les valeurs utilisateur si présentes dans pdf_infos
        try {
            // Override site_raw uniquement si le champ existe ET qu'il n'y a qu'une seule entité (exactement 1 SIRET)
            const siteSiret = Array.isArray(pdfInfo.site_siret_plus) && pdfInfo.site_siret_plus.length === 1
                ? pdfInfo.site_siret_plus[0]
                : null;
            const provider = (pdfInfo.provider || null) as { name?: string } | null;

            const structured = (result as { structured_response?: Record<string, unknown> }).structured_response || {};

            // Ne faire les overrides que si le JSON est complet
            if (isCompleteDoc(structured)) {
                // Résoudre le nom du site à partir du SIRET si disponible
                if (siteSiret && entrepriseId) {
                    const siteName = await resolveSiteNameBySiret(entrepriseId, siteSiret);
                    if (siteName) {
                        structured.site_raw = siteName;
                    }
                }

                // Utiliser le nom du prestataire depuis provider si fourni
                if (provider?.name) {
                    structured.presta_raw = provider.name;
                }

                (result as { structured_response?: Record<string, unknown> }).structured_response = structured;
            }
        } catch (e) {
            console.warn('Override site_raw/presta_raw skipped:', e);
        }

    // 7) Update BDD
    const { error: updateError } = await updatePdfExtractionResults(pdfInfo.id, entrepriseId, result, pdfInfo.status);
    if (updateError) {
        return { success: false, message: 'Erreur lors de la mise à jour BDD', error: updateError.message };
    }

    // 8) Propager une erreur typée si l'exemple RAG manque et qu'une alerte stop est renvoyée
    try {
        const alerte = (result as { alerte?: { stop?: boolean; message?: string } }).alerte;
        if (alerte && alerte.stop === true && typeof alerte.message === 'string') {
            const msg = alerte.message.toLowerCase();
            if (msg.includes('exemple') || msg.includes('rag')) {
                return {
                    success: false,
                    message: alerte.message,
                    error: 'RAG_MISSING'
                };
            }
        }
    } catch {}

    return { 
        success: true, 
        message: 'Extraction réussie', 
        data: {
            structured_response: result.structured_response,
            confidence: result.confidence,
            alerte: result.alerte,
            rag_example_id: result.rag_example_id ?? null,
        }
    };
};
