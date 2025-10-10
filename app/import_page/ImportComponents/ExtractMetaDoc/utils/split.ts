import { PDFDocument } from 'pdf-lib';
import { supabase } from "@/app/database/supabaseClient";
import {
    downloadPdfFromStorage,
    uploadPdfToStorage,
    createSignedUrl,
    insertPdfInfo,
    deletePdfFromStorage,
    deletePdfInfo
} from './bdd';
import { PdfInfo, SplitPdfResult } from '../interface/pdf_interface';

// Interface pour les segments de split intelligent
interface SmartSplitSegment {
    type: 'facture' | 'bon' | 'bsd' | 'autre';
    pages: number[];
}

interface SmartSplitAlert {
    page_idx: number;
    gemini_type: string;
    logic_type: string;
    logic_confidence: number;
    message: string;
    severity: string;
}

interface SmartSplitMetadata {
    processing_time: number;
    total_pages: number;
    parse_or_ocr?: string;
    check_logique_enabled: boolean;
    alerts?: SmartSplitAlert[];
}

interface SmartSplitResponse {
    success: boolean;
    segments?: SmartSplitSegment[];
    metadata?: SmartSplitMetadata;
    message?: string;
    error?: string;
}

interface SmartSplitResult {
    pdfId: string;
    success: boolean;
    segments?: SmartSplitSegment[];
    metadata?: SmartSplitMetadata;
    message: string;
    error?: string;
}

interface SmartSplitLoopResult {
    success: boolean;
    results: SmartSplitResult[];
    errors: Array<{ pdfId: string; error: string }>;
    processedCount: number;
    message: string;
}

// Fonction pour charger un PDF depuis le storage
const chargePdf = async (namePdfInBucket: string) => {
    const { data: pdfData, error: pdfError } = await downloadPdfFromStorage(namePdfInBucket);

    if (pdfError) {
        throw new Error(`Erreur lors de la récupération du PDF: ${pdfError.message}`);
    }

    if (!pdfData) {
        throw new Error('PDF non trouvé');
    }

    return pdfData;
};

// Fonction pour détecter si un PDF contient plusieurs pages
const detectIfMultipage = async (pdfData: Blob) => {
    const pdfBytes = await pdfData.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();
    
    return {
        pageCount,
        pdfDoc,
        isMultipage: pageCount > 1
    };
};

// splitPdfByPages(pdfInfos(id, entreprise_id, infos(status, type, provider))) -> plusieurs pdfs unipage dans bdd
export const splitPdfByPages = async (
    pdfInfo: PdfInfo,
    newStatus: string = 'splitted'
): Promise<SplitPdfResult> => {
    try {
        // 1. Charger le PDF
        if (!pdfInfo.name_pdf_in_bucket) {
            return {
                success: false,
                message: 'name_pdf_in_bucket est null ou vide',
                error: 'name_pdf_in_bucket manquant'
            };
        }
        const pdfData = await chargePdf(pdfInfo.name_pdf_in_bucket);

        // 2. Détecter si le PDF contient plusieurs pages
        const { pageCount, pdfDoc, isMultipage } = await detectIfMultipage(pdfData);

        // 3. Si une seule page, mettre nb_pages=1 si absent et ne rien faire
        if (!isMultipage) {
            try {
                await supabase
                    .from('pdf_infos')
                    .update({ nb_pages: 1 })
                    .eq('id', pdfInfo.id);
            } catch {}
            return {
                success: true,
                message: 'PDF contient une seule page, aucune division nécessaire'
            };
        }

        const newPdfIds: string[] = [];
        const timestamp = Date.now();

        // 4. Pour chaque page, créer un nouveau PDF
        for (let i = 0; i < pageCount; i++) {
            // Créer un nouveau PDF avec une seule page
            const newPdfDoc = await PDFDocument.create();
            const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [i]);
            newPdfDoc.addPage(copiedPage);

            // Convertir en bytes avec les options de sauvegarde appropriées
            const newPdfBytes = await newPdfDoc.save({
                useObjectStreams: false,
                addDefaultPage: false
            });

            // Générer un nom propre (affiché) et un nom unique (stockage)
            const originalName = pdfInfo.name_pdf || 'document';
            const cleanName = `${originalName}_page_${i + 1}.pdf`; // Nom propre
            const uniqueName = `${originalName}_page_${i + 1}_${timestamp}.pdf`; // Nom unique pour storage
            const newPath = uniqueName;

            // Uploader le nouveau PDF (comme dans les anciens fichiers)
            const { error: uploadError } = await supabase.storage
                .from('pdfs_bucket')
                .upload(newPath, newPdfBytes, {
                    contentType: 'application/pdf',
                    cacheControl: '3600'
                });

            if (uploadError) {
                return {
                    success: false,
                    message: `Erreur lors de l'upload de la page ${i + 1}`,
                    error: uploadError.message
                };
            }

            // Vérifier l'URL signée immédiatement après l'upload
            const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                .from('pdfs_bucket')
                .createSignedUrl(newPath, 3600);

            console.log('URL signée générée:', signedUrlData?.signedUrl);
            console.log('Erreur URL signée:', signedUrlError);

            // Créer une nouvelle entrée dans pdf_infos
            const { data: newPdfInfo, error: insertPdfError } = await supabase
                .from('pdf_infos')
                .insert({
                    user_id: pdfInfo.user_id,
                    pdf_path: newPath,
                    name_pdf: cleanName, // Nom propre affiché
                    name_pdf_in_bucket: uniqueName, // Nom unique dans le storage
                    status: 'splitted',
                    nb_pages: 1,
                    file_size: newPdfBytes.byteLength / 1024, // Taille en KB
                    site_siret: pdfInfo.site_siret,
                    document_type: pdfInfo.document_type,
                    provider: pdfInfo.provider,
                    entreprise_id: pdfInfo.entreprise_id,
                    site_siret_plus: pdfInfo.site_siret_plus
                })
                .select()
                .single();

            if (insertPdfError) {
                return {
                    success: false,
                    message: `Erreur lors de l'insertion de la page ${i + 1} dans pdf_infos`,
                    error: insertPdfError.message
                };
            }

            if (newPdfInfo) {
                newPdfIds.push(newPdfInfo.id);
            }
        }

        // 5. Supprimer l'ancien PDF du storage (comme dans les anciens fichiers)
        const { error: deleteError } = await supabase.storage
            .from('pdfs_bucket')
            .remove([pdfInfo.name_pdf_in_bucket]);

        if (deleteError) {
            return {
                success: false,
                message: 'Erreur lors de la suppression de l\'ancien PDF',
                error: deleteError.message
            };
        }

        // 6. Supprimer l'ancienne entrée dans pdf_infos (comme dans les anciens fichiers)
        const { error: deleteInfoError } = await supabase
            .from('pdf_infos')
            .delete()
            .eq('id', pdfInfo.id);

        if (deleteInfoError) {
            return {
                success: false,
                message: 'Erreur lors de la suppression de l\'ancienne entrée pdf_infos',
                error: deleteInfoError.message
            };
        }

        return {
            success: true,
            message: `PDF divisé en ${pageCount} pages avec succès`,
            newPdfIds
        };

    } catch (error) {
        console.error('Erreur lors de la division du PDF:', error);
        return {
            success: false,
            message: 'Erreur lors de la division du PDF',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
};

// =============================================
// SMART SPLIT - Division intelligente avec détection de type
// =============================================

/**
 * Appelle l'API Python smart-split pour obtenir les segments de division intelligente
 * Si le PDF contient une seule page, retourne directement le type depuis la BDD
 */
export const smart_split = async (
    pdfId: string,
    entrepriseId: number
): Promise<SmartSplitResult> => {
    try {
        // 1. Récupérer les infos du PDF depuis la BDD
        const { data: pdfInfo, error: pdfError } = await supabase
            .from('pdf_infos')
            .select('*')
            .eq('id', pdfId)
            .eq('entreprise_id', entrepriseId)
            .single();

        if (pdfError || !pdfInfo) {
            return {
                pdfId,
                success: false,
                message: 'PDF introuvable dans la base de données',
                error: pdfError?.message || 'PDF introuvable'
            };
        }

        // 2. Vérifier le nombre de pages
        const nbPages = typeof pdfInfo.nb_pages === 'number' ? pdfInfo.nb_pages : null;
        
        // Si une seule page, retourner directement sans appel API
        if (nbPages === 1) {
            const docType = pdfInfo.document_type || 'autre';
            return {
                pdfId,
                success: true,
                segments: [{
                    type: docType as 'facture' | 'bon' | 'bsd' | 'autre',
                    pages: [0]
                }],
                message: 'Document mono-page, aucune division nécessaire'
            };
        }

        // 3. Télécharger le PDF depuis le storage
        if (!pdfInfo.name_pdf_in_bucket) {
            return {
                pdfId,
                success: false,
                message: 'Nom du fichier PDF manquant',
                error: 'name_pdf_in_bucket manquant'
            };
        }

        const pdfData = await chargePdf(pdfInfo.name_pdf_in_bucket);

        // 4. Préparer le FormData pour l'envoi
        const formData = new FormData();
        formData.append('file', new Blob([await pdfData.arrayBuffer()], { type: 'application/pdf' }), pdfInfo.name_pdf || 'document.pdf');

        // 5. Appeler l'API Python smart-split
        const url = `${process.env.NEXT_PUBLIC_SERVER_PYTHON}/smart-split`;
        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            return {
                pdfId,
                success: false,
                message: 'Erreur lors de l\'appel à l\'API smart-split',
                error: errorText
            };
        }

        const apiResponse = await response.json() as SmartSplitResponse;

        // 6. Retourner le résultat avec métadonnées
        if (apiResponse.success && apiResponse.segments) {
            return {
                pdfId,
                success: true,
                segments: apiResponse.segments,
                metadata: apiResponse.metadata, // Inclure les métadonnées avec les alertes
                message: `Smart split réussi: ${apiResponse.segments.length} segment(s) détecté(s)`
            };
        } else {
            return {
                pdfId,
                success: false,
                message: apiResponse.message || 'Erreur lors du smart split',
                error: apiResponse.error
            };
        }

    } catch (error) {
        console.error('Erreur lors du smart split:', error);
        return {
            pdfId,
            success: false,
            message: 'Erreur lors du smart split',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
};

/**
 * Applique le split intelligent selon les segments proposés
 * Divise le PDF et attribue les types de documents
 */
export const apply_smart_split = async (
    pdfInfo: PdfInfo,
    segments: SmartSplitSegment[]
): Promise<SplitPdfResult> => {
    try {
        // 1. Charger le PDF
        if (!pdfInfo.name_pdf_in_bucket) {
            return {
                success: false,
                message: 'name_pdf_in_bucket est null ou vide',
                error: 'name_pdf_in_bucket manquant'
            };
        }

        const pdfData = await chargePdf(pdfInfo.name_pdf_in_bucket);
        const pdfBytes = await pdfData.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes);

        const newPdfIds: string[] = [];

        // 2. Pour chaque segment, créer un nouveau PDF
        for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
            const segment = segments[segmentIndex];
            
            // Créer un nouveau PDF avec les pages du segment
            const newPdfDoc = await PDFDocument.create();
            
            // Copier toutes les pages du segment
            for (const pageIndex of segment.pages) {
                const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageIndex]);
                newPdfDoc.addPage(copiedPage);
            }

            // Convertir en bytes
            const newPdfBytes = await newPdfDoc.save({
                useObjectStreams: false,
                addDefaultPage: false
            });

            // Générer un nom propre (affiché) et un nom unique (stockage)
            const originalName = pdfInfo.name_pdf || 'document';
            const segmentName = segment.pages.length === 1 
                ? `page_${segment.pages[0] + 1}` 
                : `pages_${segment.pages[0] + 1}_to_${segment.pages[segment.pages.length - 1] + 1}`;
            const timestamp = Date.now();
            const uniqueId = `${timestamp}_${segmentIndex}`;
            const cleanName = `${originalName}_${segmentName}.pdf`; // Nom propre affiché
            const uniqueName = `${originalName}_${segmentName}_${uniqueId}.pdf`; // Nom unique pour storage
            const newPath = uniqueName;

            // Uploader le nouveau PDF
            const { error: uploadError } = await supabase.storage
                .from('pdfs_bucket')
                .upload(newPath, newPdfBytes, {
                    contentType: 'application/pdf',
                    cacheControl: '3600'
                });

            if (uploadError) {
                return {
                    success: false,
                    message: `Erreur lors de l'upload du segment ${segmentIndex + 1}`,
                    error: uploadError.message
                };
            }

            // Créer une nouvelle entrée dans pdf_infos avec le type détecté
            const { data: newPdfInfo, error: insertPdfError } = await supabase
                .from('pdf_infos')
                .insert({
                    user_id: pdfInfo.user_id,
                    pdf_path: newPath,
                    name_pdf: cleanName, // Nom propre affiché à l'utilisateur
                    name_pdf_in_bucket: uniqueName, // Nom unique dans le storage
                    status: 'splitted',
                    nb_pages: segment.pages.length,
                    file_size: newPdfBytes.byteLength / 1024,
                    site_siret: pdfInfo.site_siret,
                    document_type: segment.type, // Type détecté par l'IA
                    provider: pdfInfo.provider,
                    entreprise_id: pdfInfo.entreprise_id,
                    site_siret_plus: pdfInfo.site_siret_plus
                })
                .select()
                .single();

            if (insertPdfError) {
                return {
                    success: false,
                    message: `Erreur lors de l'insertion du segment ${segmentIndex + 1} dans pdf_infos`,
                    error: insertPdfError.message
                };
            }

            if (newPdfInfo) {
                newPdfIds.push(newPdfInfo.id);
            }
        }

        // 3. Supprimer l'ancien PDF du storage
        const { error: deleteError } = await supabase.storage
            .from('pdfs_bucket')
            .remove([pdfInfo.name_pdf_in_bucket]);

        if (deleteError) {
            return {
                success: false,
                message: 'Erreur lors de la suppression de l\'ancien PDF',
                error: deleteError.message
            };
        }

        // 4. Supprimer l'ancienne entrée dans pdf_infos
        const { error: deleteInfoError } = await supabase
            .from('pdf_infos')
            .delete()
            .eq('id', pdfInfo.id);

        if (deleteInfoError) {
            return {
                success: false,
                message: 'Erreur lors de la suppression de l\'ancienne entrée pdf_infos',
                error: deleteInfoError.message
            };
        }

        return {
            success: true,
            message: `PDF divisé en ${segments.length} segment(s) avec succès`,
            newPdfIds
        };

    } catch (error) {
        console.error('Erreur lors de l\'application du smart split:', error);
        return {
            success: false,
            message: 'Erreur lors de l\'application du smart split',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
};

/**
 * Traite plusieurs PDFs avec smart split en boucle
 */
export const smart_split_loop = async (
    pdfIds: string[],
    entrepriseId: number
): Promise<SmartSplitLoopResult> => {
    const results: SmartSplitResult[] = [];
    const errors: Array<{ pdfId: string; error: string }> = [];
    let processedCount = 0;

    for (const pdfId of pdfIds) {
        try {
            const result = await smart_split(pdfId, entrepriseId);
            
            if (result.success) {
                results.push(result);
                processedCount++;
            } else {
                errors.push({
                    pdfId,
                    error: result.error || result.message
                });
            }
        } catch (error) {
            errors.push({
                pdfId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    return {
        success: errors.length === 0,
        results,
        errors,
        processedCount,
        message: errors.length === 0 
            ? `Smart split réussi pour ${processedCount} PDF(s)`
            : `Smart split terminé avec ${errors.length} erreur(s)`
    };
};

// Export des types pour utilisation dans les composants
export type { SmartSplitSegment, SmartSplitResponse, SmartSplitResult, SmartSplitLoopResult, SmartSplitAlert, SmartSplitMetadata };
