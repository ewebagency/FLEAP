import { runMetaOcrForPdf } from './extract';
import { splitPdfByPages } from './split';
import { getPdfInfoById } from './bdd';
import { PdfInfo } from '../interface/pdf_interface';
import { createRagPlaceholder } from './rag';

// Type pour le callback de notification des retries
type RetryNotificationCallback = (attempt: number, delay: number, error: string) => void;

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
    pausedAtIndex?: number;
}

const isCriticalBackendError = (errorCode: string | undefined): boolean => {
    if (!errorCode) return false;
    return errorCode === 'BACKEND_ERROR' || errorCode === 'RESOURCE_EXHAUSTED';
};

/**
 * Traite une liste de PDFs : vérifie s'ils sont multipages, les divise si nécessaire,
 * puis extrait les métadonnées de chaque page
 */
export const processPdfList = async (
    pdfIds: string[],
    entrepriseId: number,
    mode: 'split_then_extract' | 'split_only' | 'extract_only' = 'split_then_extract',
    enable_rag: boolean = false,
    onRetry?: RetryNotificationCallback
): Promise<LoopResult> => {
    const results: LoopResult['results'] = [];
    const errors: LoopResult['errors'] = [];
    let processedCount = 0;

    for (let i = 0; i < pdfIds.length; i++) {
        const pdfId = pdfIds[i];
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
                        return await runMetaOcrForPdf(newPdfId, entrepriseId, false, onRetry);
                    });

                    const extractionResults = await Promise.all(extractionPromises);
                    const failedExtractions = extractionResults.filter(result => !result.success);
                    
                    // Filtrer les erreurs RAG pour le calcul du résultat final (si enable_rag=false)
                    const failedWithoutRag = enable_rag 
                        ? failedExtractions 
                        : failedExtractions.filter(f => f.error !== 'RAG_MISSING');

                    // Si une des pages a échoué pour cause RAG_MISSING
                    const ragMissing = extractionResults.find(r => r.success === false && r.error === 'RAG_MISSING');
                    if (ragMissing) {
                        // Si enable_rag est false, continuer sans arrêter
                        if (!enable_rag) {
                            errors.push({ pdfId, error: ragMissing.message || 'RAG_MISSING' });
                            // Créer un placeholder RAG pour ce PDF
                            if (pdfInfo && (pdfInfo as PdfInfo).user_id) {
                                try {
                                    await createRagPlaceholder(
                                        pdfId,
                                        entrepriseId,
                                        (pdfInfo as PdfInfo).user_id,
                                        (pdfInfo as PdfInfo).document_type || 'inconnu'
                                    );
                                } catch (ragErr) {
                                    console.error('Erreur lors de la création du placeholder RAG:', ragErr);
                                    // On continue même si la création du placeholder échoue
                                }
                            }
                            // Ajouter une erreur générale seulement s'il y a d'autres erreurs en plus du RAG
                            if (failedWithoutRag.length > 0) {
                                errors.push({
                                    pdfId,
                                    error: `Échec de l'extraction pour ${failedWithoutRag.length} pages sur ${splitResult.newPdfIds.length}`
                                });
                            }
                        } else {
                            // Si enable_rag est true, arrêter immédiatement
                            errors.push({ pdfId, error: ragMissing.message || 'RAG_MISSING' });
                            return {
                                success: false,
                                message: 'Arrêt: exemple RAG manquant',
                                processedCount,
                                errors,
                                results,
                                pausedAtIndex: i
                            };
                        }
                    } else {
                        // Si une des pages a échoué pour une erreur backend critique, stopper immédiatement
                        const backendError = extractionResults.find(r => r.success === false && isCriticalBackendError(r.error));
                        if (backendError) {
                            errors.push({ pdfId, error: backendError.message || backendError.error || 'BACKEND_ERROR' });
                            return {
                                success: false,
                                message: backendError.error === 'RESOURCE_EXHAUSTED'
                                    ? 'Arrêt: backend saturé (RESOURCE_EXHAUSTED)'
                                    : 'Arrêt: erreur backend',
                                processedCount,
                                errors,
                                results,
                                pausedAtIndex: i
                            };
                        }

                        if (failedExtractions.length > 0) {
                            errors.push({
                                pdfId,
                                error: `Échec de l'extraction pour ${failedExtractions.length} pages sur ${splitResult.newPdfIds.length}`
                            });
                        }
                    }

                    results.push({
                        pdfId,
                        success: failedWithoutRag.length === 0,
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
                        const extractionResult = await runMetaOcrForPdf(pdfId, entrepriseId, false, onRetry);
                        if (!extractionResult.success) {
                            // Gérer RAG_MISSING selon enable_rag
                            if (extractionResult.error === 'RAG_MISSING') {
                                errors.push({ pdfId, error: extractionResult.message });
                                // Si enable_rag est true, arrêter immédiatement
                                if (enable_rag) {
                                    return {
                                        success: false,
                                        message: 'Arrêt: exemple RAG manquant',
                                        processedCount,
                                        errors,
                                        results,
                                        pausedAtIndex: i
                                    };
                                }
                                // Si enable_rag est false, créer un placeholder RAG et continuer
                                if (pdfInfo && (pdfInfo as PdfInfo).user_id) {
                                    try {
                                        await createRagPlaceholder(
                                            pdfId,
                                            entrepriseId,
                                            (pdfInfo as PdfInfo).user_id,
                                            (pdfInfo as PdfInfo).document_type || 'inconnu'
                                        );
                                    } catch (ragErr) {
                                        console.error('Erreur lors de la création du placeholder RAG:', ragErr);
                                        // On continue même si la création du placeholder échoue
                                    }
                                }
                                // Si enable_rag est false, continuer avec les autres PDFs
                                continue;
                            }
                            // Stopper immédiatement si erreur backend critique
                            if (isCriticalBackendError(extractionResult.error)) {
                                errors.push({ pdfId, error: extractionResult.message });
                                return {
                                    success: false,
                                    message: extractionResult.error === 'RESOURCE_EXHAUSTED'
                                        ? 'Arrêt: backend saturé (RESOURCE_EXHAUSTED)'
                                        : 'Arrêt: erreur backend',
                                    processedCount,
                                    errors,
                                    results,
                                    pausedAtIndex: i
                                };
                            }
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
                const extractionResult = await runMetaOcrForPdf(pdfId, entrepriseId, false, onRetry);
                if (!extractionResult.success) {
                    if (extractionResult.error === 'RAG_MISSING') {
                        errors.push({ pdfId, error: extractionResult.message });
                        // Si enable_rag est true, arrêter immédiatement
                        if (enable_rag) {
                            return {
                                success: false,
                                message: 'Arrêt: exemple RAG manquant',
                                processedCount,
                                errors,
                                results,
                                pausedAtIndex: i
                            };
                        }
                        // Si enable_rag est false, créer un placeholder RAG et continuer
                        if (pdfInfo && (pdfInfo as PdfInfo).user_id) {
                            try {
                                await createRagPlaceholder(
                                    pdfId,
                                    entrepriseId,
                                    (pdfInfo as PdfInfo).user_id,
                                    (pdfInfo as PdfInfo).document_type || 'inconnu'
                                );
                            } catch (ragErr) {
                                console.error('Erreur lors de la création du placeholder RAG:', ragErr);
                                // On continue même si la création du placeholder échoue
                            }
                        }
                        // Si enable_rag est false, continuer avec les autres PDFs
                        continue;
                    }
                    if (isCriticalBackendError(extractionResult.error)) {
                        errors.push({ pdfId, error: extractionResult.message });
                        return {
                            success: false,
                            message: extractionResult.error === 'RESOURCE_EXHAUSTED'
                                ? 'Arrêt: backend saturé (RESOURCE_EXHAUSTED)'
                                : 'Arrêt: erreur backend',
                            processedCount,
                            errors,
                            results,
                            pausedAtIndex: i
                        };
                    }
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
