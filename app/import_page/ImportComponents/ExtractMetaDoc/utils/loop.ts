import { runMetaOcrForPdf } from './extract';
import { splitPdfByPages } from './split';
import { getPdfInfoById } from './bdd';
import { PdfInfo } from '../interface/pdf_interface';

interface LoopResult {
    success: boolean;
    message: string;
    processedCount: number;
    errors: Array<{
        pdfId: string;
        error: string;
    }>;
    results: Array<{
        pdfId: string;
        success: boolean;
        message: string;
        newPdfIds?: string[];
    }>;
}

/**
 * Traite une liste de PDFs : vérifie s'ils sont multipages, les divise si nécessaire,
 * puis extrait les métadonnées de chaque page
 */
export const processPdfList = async (
    pdfIds: string[],
    entrepriseId: number,
    mode: 'split_then_extract' | 'split_only' | 'extract_only' = 'split_then_extract'
): Promise<LoopResult> => {
    const results: LoopResult['results'] = [];
    const errors: LoopResult['errors'] = [];
    let processedCount = 0;

    for (const pdfId of pdfIds) {
        try {
            // 1. Récupérer les infos du PDF
            const { data: pdfInfo, error: pdfError } = await getPdfInfoById(pdfId, entrepriseId);
            
            if (pdfError || !pdfInfo) {
                errors.push({
                    pdfId,
                    error: pdfError?.message || 'PDF non trouvé'
                });
                continue;
            }

            if (mode !== 'extract_only') {
                // 2. Vérifier si le PDF est multipage en essayant de le diviser
                const splitResult = await splitPdfByPages(pdfInfo as PdfInfo, 'splitted');

                if (!splitResult.success) {
                    // Erreur lors de la vérification/division
                    errors.push({
                        pdfId,
                        error: splitResult.error || splitResult.message
                    });
                    continue;
                }

                if (splitResult.newPdfIds && splitResult.newPdfIds.length > 0) {
                    // Le PDF était multipage et a été divisé
                    if (mode === 'split_only') {
                        results.push({
                            pdfId,
                            success: true,
                            message: `PDF divisé en ${splitResult.newPdfIds.length} page(s)`,
                            newPdfIds: splitResult.newPdfIds
                        });
                        processedCount++;
                        continue;
                    }

                    // mode === 'split_then_extract' → Extraire chaque page divisée
                    const extractionPromises = splitResult.newPdfIds.map(async (newPdfId) => {
                        return await runMetaOcrForPdf(newPdfId, entrepriseId);
                    });

                    const extractionResults = await Promise.all(extractionPromises);
                    const failedExtractions = extractionResults.filter(result => !result.success);

                    if (failedExtractions.length > 0) {
                        errors.push({
                            pdfId,
                            error: `Échec de l'extraction pour ${failedExtractions.length} pages sur ${splitResult.newPdfIds.length}`
                        });
                    }

                    results.push({
                        pdfId,
                        success: failedExtractions.length === 0,
                        message: `PDF multipage divisé en ${splitResult.newPdfIds.length} pages et extrait`,
                        newPdfIds: splitResult.newPdfIds
                    });
                } else {
                    // Le PDF était unipage
                    if (mode === 'split_only') {
                        results.push({
                            pdfId,
                            success: true,
                            message: 'PDF unipage (aucune division nécessaire)'
                        });
                    } else {
                        const extractionResult = await runMetaOcrForPdf(pdfId, entrepriseId);
                        if (!extractionResult.success) {
                            errors.push({
                                pdfId,
                                error: extractionResult.error || extractionResult.message
                            });
                        }
                        results.push({
                            pdfId,
                            success: extractionResult.success,
                            message: extractionResult.message
                        });
                    }
                }
            } else {
                // mode === 'extract_only' → Extraire directement sans tentative de split
                const extractionResult = await runMetaOcrForPdf(pdfId, entrepriseId);
                if (!extractionResult.success) {
                    errors.push({
                        pdfId,
                        error: extractionResult.error || extractionResult.message
                    });
                }
                results.push({
                    pdfId,
                    success: extractionResult.success,
                    message: extractionResult.message
                });
            }

            processedCount++;

        } catch (error) {
            errors.push({
                pdfId,
                error: error instanceof Error ? error.message : 'Erreur inconnue'
            });
        }
    }

    return {
        success: errors.length === 0,
        message: `Traitement terminé : ${processedCount} PDFs traités, ${errors.length} erreurs`,
        processedCount,
        errors,
        results
    };
};
