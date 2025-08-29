import { PDFDocument } from 'pdf-lib';
import {
    downloadPdfFromStorage,
    uploadPdfToStorage,
    createSignedUrl,
    insertPdfInfo,
    deletePdfFromStorage,
    deletePdfInfo
} from './bdd';
import { PdfInfo, SplitPdfResult } from '../interface/pdf_interface';

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

        // 3. Si une seule page, ne rien faire
        if (!isMultipage) {
            return {
                success: true,
                message: 'PDF contient une seule page, aucune division nécessaire'
            };
        }

        const newPdfIds: string[] = [];

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

            // Générer un nouveau nom de fichier
            const originalName = pdfInfo.name_pdf || 'document';
            const newFileName = `${originalName}_page_${i + 1}.pdf`;
            const newPath = newFileName;

            // Uploader le nouveau PDF
            const { error: uploadError } = await uploadPdfToStorage(newPath, newPdfBytes);

            if (uploadError) {
                return {
                    success: false,
                    message: `Erreur lors de l'upload de la page ${i + 1}`,
                    error: uploadError.message
                };
            }

            // Vérifier l'URL signée immédiatement après l'upload
            const { data: signedUrlData, error: signedUrlError } = await createSignedUrl(newPath, 3600);

            console.log('URL signée générée:', signedUrlData?.signedUrl);
            console.log('Erreur URL signée:', signedUrlError);

            // Créer une nouvelle entrée dans pdf_infos avec toutes les colonnes copiées
            const { data: newPdfInfo, error: insertPdfError } = await insertPdfInfo({
                user_id: pdfInfo.user_id,
                pdf_path: newPath,
                name_pdf: newFileName,
                name_pdf_in_bucket: newFileName,
                status: newStatus,
                file_size: newPdfBytes.byteLength / 1024, // Taille en KB
                site_siret: pdfInfo.site_siret,
                document_type: pdfInfo.document_type,
                provider: pdfInfo.provider,
                entreprise_id: pdfInfo.entreprise_id,
                site_siret_plus: pdfInfo.site_siret_plus
            });

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

        // 5. Supprimer l'ancien PDF du storage
        const { error: deleteError } = await deletePdfFromStorage(pdfInfo.name_pdf_in_bucket);

        if (deleteError) {
            return {
                success: false,
                message: 'Erreur lors de la suppression de l\'ancien PDF',
                error: deleteError.message
            };
        }

        // 6. Supprimer l'ancienne entrée dans pdf_infos
        const { error: deleteInfoError } = await deletePdfInfo(pdfInfo.id, pdfInfo.entreprise_id || 0);

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
