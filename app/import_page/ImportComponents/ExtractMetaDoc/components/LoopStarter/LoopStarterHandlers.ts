import { toast } from 'react-hot-toast';
import Swal from 'sweetalert2';
import { supabase } from '@/app/database/supabaseClient';
import { processPdfList } from '../../utils/loop';
import { autoLinkDocs, applyPreComputedAutoLink, BulkAutoLinkOutcome } from '../../utils/bulk_autolink';
import { verifierEtMettreAJourAlerte } from '../../utils/alerte';
import { normalizePdfData, buildFactureFromNormalized, push_in_facture_bdd, ParamsMapping } from '../../utils/link';
import { getParamsMappingByEntreprise } from '../../utils/bdd';
import { smart_split_loop, apply_smart_split } from '../../utils/split';
import { LinkConfig } from '../../utils/default_auto_link_params';
import { PdfInfo, ProcessingResult, SiteInfo, FilterOptions } from './LoopStarterTypes';
import { getAllPossibleAlerteFlags, getAllPossibleLinkageStatuses } from './LoopStarterFilters';
import { invalidateCache } from '@/app/utils/invalidateCache';

// Interface pour l'état de pause sauvegardé dans localStorage
interface PauseState {
    selectedPdfIds: string[];
    pausedAtIndex: number;
    pausedPdfId: string;
    resumeMode: 'split_then_extract' | 'extract_only';
    entreprise_id: string;
    errorMessage: string;
    timestamp: number;
}

// Clé localStorage
const PAUSE_STATE_KEY = 'loopStarter:pauseState';

// Durée d'expiration: 24h en millisecondes
const EXPIRATION_MS = 24 * 60 * 60 * 1000;

export const isBackendPauseError = (error?: string | null): boolean => {
    if (!error) return false;
    if (error === 'RESOURCE_EXHAUSTED') return true;
    const normalized = error.toLowerCase();
    return (
        normalized.includes('backend') ||
        normalized.includes('resource exhausted') ||
        normalized.includes('resource_exhausted')
    );
};

// Sauvegarder l'état de pause dans localStorage
export const savePauseState = (state: PauseState): void => {
    try {
        localStorage.setItem(PAUSE_STATE_KEY, JSON.stringify(state));
    } catch (error) {
        console.error('Erreur sauvegarde état de pause:', error);
    }
};

// Charger l'état de pause depuis localStorage
export const loadPauseState = (): PauseState | null => {
    try {
        const saved = localStorage.getItem(PAUSE_STATE_KEY);
        if (!saved) return null;
        
        const state: PauseState = JSON.parse(saved);
        
        // Vérifier l'expiration (24h)
        const now = Date.now();
        if (now - state.timestamp > EXPIRATION_MS) {
            // Expiré, supprimer
            clearPauseState();
            return null;
        }
        
        return state;
    } catch (error) {
        console.error('Erreur chargement état de pause:', error);
        return null;
    }
};

// Supprimer l'état de pause du localStorage
export const clearPauseState = (): void => {
    try {
        localStorage.removeItem(PAUSE_STATE_KEY);
    } catch (error) {
        console.error('Erreur suppression état de pause:', error);
    }
};

// Fonction pour rafraîchir les données depuis la BDD
export const refreshData = async (
    entreprise_id: string | undefined,
    setPdfInfos: (pdfs: PdfInfo[]) => void,
    setSites: (sites: SiteInfo[]) => void,
    setFilterOptions: (options: FilterOptions) => void
) => {
    if (!entreprise_id) return;
    
    try {
        console.log('🔄 Début refresh data pour entreprise:', entreprise_id);
        
        // Récupérer les PDFs
        const { data: pdfData, error: pdfError } = await supabase
            .from('pdf_infos')
            .select('*')
            .eq('entreprise_id', entreprise_id)
            .order('created_at', { ascending: false });

        if (pdfError) throw pdfError;
        
        console.log('📊 PDFs récupérés:', pdfData?.length, 'documents');
        if (pdfData && pdfData.length > 0) {
            console.log('📋 Exemple premier PDF:', {
                id: pdfData[0].id,
                name: pdfData[0].name_pdf,
                status: pdfData[0].status,
                alerte: pdfData[0].alerte,
                confidence: pdfData[0].confidence
            });
        }
        
        setPdfInfos(pdfData || []);

        // Récupérer les sites depuis table_autocompletion
        const { data: siteData, error: siteError } = await supabase
            .from('table_autocompletion')
            .select('site')
            .eq('entreprise_id', entreprise_id);

        if (siteError) throw siteError;
        
        const siteInfos: SiteInfo[] = [];
        const uniqueSites = new Set<string>();
        siteData?.forEach(item => {
            if (item.site?.siret && item.site?.nom) {
                siteInfos.push({
                    siret: item.site.siret,
                    name: item.site.nom
                });
                uniqueSites.add(item.site.siret);
            }
        });
        setSites(siteInfos);

        // Extraire les providers uniques des PDFs (nom + SIRET uniquement)
        const uniqueProviders = new Map<string, string>(); // id -> display name
        pdfData?.forEach(pdf => {
            if (pdf.provider && typeof pdf.provider === 'object') {
                const provider = pdf.provider as Record<string, unknown>;
                const nom = provider.nom || provider.name || '';
                const siret = provider.siret || '';
                
                // Créer un identifiant unique et un label d'affichage
                const displayName = [nom, siret].filter(Boolean).join(' - ');
                const id = [nom, siret].filter(Boolean).join('|'); // Identifiant pour le filtrage
                
                if (displayName) {
                    uniqueProviders.set(id, displayName);
                }
            }
        });

        // Extraire les types de documents uniques depuis la BDD (exclure excel)
        const uniqueDocumentTypes = new Set<string>();
        pdfData?.forEach(pdf => {
            if (pdf.document_type && pdf.document_type !== 'excel') {
                uniqueDocumentTypes.add(pdf.document_type);
            }
        });

        // Extraire les statuts uniques depuis la BDD
        const uniqueStatuses = new Set<string>();
        pdfData?.forEach(pdf => {
            if (pdf.status) {
                uniqueStatuses.add(pdf.status);
            }
        });

        // Construire les options pour les RAG IDs
        const uniqueRagIds = new Set<string>();
        let hasPdfWithoutRag = false;
        pdfData?.forEach(pdf => {
            if (pdf.id_rag) {
                uniqueRagIds.add(pdf.id_rag);
            } else {
                hasPdfWithoutRag = true;
            }
        });
        const ragIdOptions: Array<{ value: string, label: string }> = Array.from(uniqueRagIds).map(id => ({
            value: id,
            label: id
        }));
        if (hasPdfWithoutRag) {
            ragIdOptions.unshift({ value: '__NONE__', label: 'Sans RAG' });
        }

        // Mettre à jour les options de filtres avec les données de la BDD
        setFilterOptions({
            providers: Array.from(uniqueProviders.entries()).map(([id, name]) => ({ id, name })),
            sites: Array.from(uniqueSites).map(siret => {
                const site = siteInfos.find(s => s.siret === siret);
                return { id: siret, name: site?.name || siret };
            }),
            documentTypes: Array.from(uniqueDocumentTypes).map(type => ({ 
                value: type, 
                label: type === 'bon' ? 'Bon' :
                       type === 'bsd' ? 'BSD' :
                       type === 'facture' ? 'Facture' :
                       type === 'inconnu' ? 'Inconnu' :
                       type === 'conformite' ? 'Conformité' :
                       type === 'autre' ? 'Autre' : type
            })),
            statuses: Array.from(uniqueStatuses).map(status => ({ 
                value: status, 
                label: status === 'unread' ? 'Non lu' :
                       status === 'read' ? 'Lu' :
                       status === 'extracted' ? 'Extrait' :
                       status === 'linked' ? 'Lié' :
                       status === 'splitted' ? 'Splitted' :
                       status === 'splitted_extracted' ? 'Splitted Extrait' :
                       status === 'processed' ? 'Traité' :
                       status === 'error' ? 'Erreur' : status
            })),
            alerteFlags: getAllPossibleAlerteFlags(),
            linkageStatuses: getAllPossibleLinkageStatuses(),
            ragIds: ragIdOptions
        });

    } catch (error) {
        console.error('❌ Erreur lors du rafraîchissement des données:', error);
        toast.error('Erreur lors du rafraîchissement des données');
        return;
    }
    
    // Confirmation finale
    console.log('✅ Refresh data terminé avec succès');
};

// Traiter les PDFs sélectionnés (split + extract)
export const handleProcessPdfs = async (
    selectedPdfIds: string[],
    entreprise_id: string,
    pdfInfos: PdfInfo[],
    setProcessingSplitThenExtract: (value: boolean) => void,
    setResumeMode: (mode: 'split_then_extract' | 'extract_only' | null) => void,
    setProcessingResults: (results: ProcessingResult[] | ((prev: ProcessingResult[]) => ProcessingResult[])) => void,
    setShowReview: (value: boolean) => void,
    setPaused: (value: boolean) => void,
    setPausedPdfId: (id: string | null) => void,
    setPausedAtIndex: (index: number | null) => void,
    setShowExtractModal: (value: boolean) => void,
    setSelectedPdfIds: (ids: string[]) => void,
    onRefreshData: () => Promise<void>,
    isResuming: boolean = false
) => {
    if (selectedPdfIds.length === 0) {
        toast.error('Veuillez sélectionner au moins un PDF');
        return;
    }

    if (!entreprise_id) {
        toast.error('ID entreprise manquant');
        return;
    }

    setProcessingSplitThenExtract(true);
    setResumeMode('split_then_extract');
    // Si ce n'est pas une reprise, on réinitialise les résultats
    if (!isResuming) {
        setProcessingResults([]);
    }
    setShowReview(false);
    
    try {
        const result = await processPdfList(selectedPdfIds, parseInt(entreprise_id), 'split_then_extract');
        
        // Construire les résultats détaillés
        const detailedResults: ProcessingResult[] = [];
        
        // Ajouter les résultats réussis
        result.results.forEach(item => {
            const originalPdf = pdfInfos.find(pdf => pdf.id === item.pdfId);
            detailedResults.push({
                pdfId: item.pdfId,
                success: item.success,
                message: item.message,
                newPdfIds: item.newPdfIds,
                wasSplit: item.newPdfIds && item.newPdfIds.length > 0,
                originalPdfName: originalPdf?.name_pdf || 'Inconnu'
            });
        });
        
        // Ajouter les erreurs
        result.errors.forEach(error => {
            const originalPdf = pdfInfos.find(pdf => pdf.id === error.pdfId);
            detailedResults.push({
                pdfId: error.pdfId,
                success: false,
                message: error.error,
                error: error.error,
                originalPdfName: originalPdf?.name_pdf || 'Inconnu'
            });
        });
        
        // Si c'est une reprise, accumuler les résultats, sinon les écraser
        if (isResuming) {
            setProcessingResults(prev => [...prev, ...detailedResults]);
        } else {
            setProcessingResults(detailedResults);
        }
        setShowReview(true);
        
        if (result.success) {
            // Nettoyer le localStorage si succès
            clearPauseState();
            
            toast.success(`Traitement terminé : ${result.processedCount} PDFs traités avec succès`);
            // Rafraîchir les données
            toast.loading('Rafraîchissement des données...', { id: 'refresh-split-extract' });
            await onRefreshData();
            toast.success('Données rafraîchies', { id: 'refresh-split-extract' });
            // Enchaîner automatiquement avec la vérification des alertes
            try {
                // Lancer la vérification pour les mêmes IDs sélectionnés
                for (const pdfId of selectedPdfIds) {
                    await verifierEtMettreAJourAlerte(pdfId, entreprise_id);
                }
                toast.success('Vérification des alertes terminée');
                // Rafraîchir à nouveau après les alertes
                toast.loading('Rafraîchissement des données...', { id: 'refresh-post-alertes' });
                await onRefreshData();
                toast.success('Données rafraîchies', { id: 'refresh-post-alertes' });
            } catch (e) {
                console.error('Erreur lors de la vérification automatique des alertes:', e);
                toast.error('Erreur lors de la vérification des alertes');
            }
            // setSelectedPdfIds([]); // Gardé sélectionné pour enchaîner les actions
        } else {
            // Si pause pour RAG manquant, ouvrir le modal d'extraction pour le PDF fautif
            const ragErr = result.errors.find(e => e.error && e.error.toLowerCase && e.error.toLowerCase().includes('rag'));
            if (ragErr && typeof ragErr.pdfId === 'string') {
                const blockingPdf = pdfInfos.find(p => p.id === ragErr.pdfId);
                toast.error(`Stop: Exemple RAG manquant pour ${blockingPdf?.name_pdf || ragErr.pdfId}`);
                setPaused(true);
                setPausedPdfId(ragErr.pdfId);
                setPausedAtIndex(result.pausedAtIndex ?? null);
                // Préremplir le brouillon avec les dernières données du backend
                try {
                    const entrepriseIdNumber = Number(entreprise_id);
                    const { data: latest } = await supabase
                        .from('pdf_infos')
                        .select('infos_raw')
                        .eq('id', ragErr.pdfId)
                        .eq('entreprise_id', entrepriseIdNumber)
                        .single();
                    if (latest?.infos_raw) {
                        try {
                            localStorage.setItem(`extractDoc:form:${ragErr.pdfId}`, JSON.stringify(latest.infos_raw));
                        } catch {}
                    }
                } catch {}
                setShowExtractModal(true);
            } else {
                // Si pause pour erreur backend, sauvegarder l'état et afficher Swal
                const backendErr = result.errors.find(e => isBackendPauseError(e.error));
                if (backendErr && typeof backendErr.pdfId === 'string') {
                    const blockingPdf = pdfInfos.find(p => p.id === backendErr.pdfId);
                    const errorMessage = backendErr.error || 'Erreur backend inconnue';
                    
                    setPaused(true);
                    setPausedPdfId(backendErr.pdfId);
                    setPausedAtIndex(result.pausedAtIndex ?? null);
                    
                    // Sauvegarder l'état dans localStorage
                    savePauseState({
                        selectedPdfIds,
                        pausedAtIndex: result.pausedAtIndex ?? 0,
                        pausedPdfId: backendErr.pdfId,
                        resumeMode: 'split_then_extract',
                        entreprise_id,
                        errorMessage,
                        timestamp: Date.now()
                    });
                    
                    // Afficher Swal avec option de reprise
                    Swal.fire({
                        title: '⚠️ Erreur Backend',
                        html: `
                            <div class="text-left">
                                <div class="mb-3 p-3 bg-red-50 rounded border-l-4 border-red-400">
                                    <div class="font-medium text-red-800 mb-2">Le backend a rencontré une erreur</div>
                                    <div class="text-sm text-red-700 mb-2">
                                        Document: <strong>${blockingPdf?.name_pdf || backendErr.pdfId}</strong>
                                    </div>
                                    <div class="text-xs text-red-600 font-mono bg-red-100 p-2 rounded">
                                        ${errorMessage}
                                    </div>
                                </div>
                                <div class="mb-3 p-2 bg-blue-50 rounded text-sm text-blue-800">
                                    <div class="font-medium mb-1">📊 Progression:</div>
                                    <div>• Documents traités: ${result.processedCount}/${selectedPdfIds.length}</div>
                                    <div>• Documents restants: ${selectedPdfIds.length - (result.pausedAtIndex ?? 0)}</div>
                                </div>
                                <div class="p-2 bg-gray-50 rounded text-xs text-gray-600">
                                    💡 L'état est sauvegardé pendant 24h. Vous pouvez reprendre plus tard en ouvrant ce menu.
                                </div>
                            </div>
                        `,
                        showCancelButton: true,
                        showDenyButton: true,
                        confirmButtonText: '🔄 Reprendre maintenant',
                        denyButtonText: '⏭️ Sauter ce document',
                        cancelButtonText: '❌ Annuler',
                        confirmButtonColor: '#3b82f6',
                        denyButtonColor: '#f59e0b',
                        cancelButtonColor: '#6b7280',
                        allowOutsideClick: false,
                        width: '600px'
                    }).then(async (swalResult) => {
                        if (swalResult.isConfirmed) {
                            // Reprendre: NE PAS supprimer localStorage tout de suite (le succès le fera)
                            setPaused(false);
                            
                            // Reprendre depuis pausedAtIndex (INCLUS pour réessayer le document échoué)
                            const remainingPdfIds = selectedPdfIds.slice(result.pausedAtIndex ?? 0);
                            if (remainingPdfIds.length === 0) {
                                toast.success('Plus aucun document à traiter.');
                                clearPauseState();
                                return;
                            }
                            
                            // Relancer le traitement en mode reprise pour accumuler les résultats
                            await handleProcessPdfs(
                                remainingPdfIds,
                                entreprise_id,
                                pdfInfos,
                                setProcessingSplitThenExtract,
                                setResumeMode,
                                setProcessingResults,
                                setShowReview,
                                setPaused,
                                setPausedPdfId,
                                setPausedAtIndex,
                                setShowExtractModal,
                                setSelectedPdfIds,
                                onRefreshData,
                                true // isResuming = true
                            );
                        } else if (swalResult.isDenied) {
                            const skipIndex = result.pausedAtIndex ?? 0;
                            const skippedPdfId = selectedPdfIds[skipIndex];
                            const remainingPdfIds = selectedPdfIds.slice(skipIndex + 1);

                            clearPauseState();
                            setPaused(false);
                            setPausedPdfId(null);
                            setPausedAtIndex(null);
                            setResumeMode(null);

                            if (skippedPdfId) {
                                const skippedPdf = pdfInfos.find(pdf => pdf.id === skippedPdfId);
                                setProcessingResults(prev => [
                                    ...prev,
                                    {
                                        pdfId: skippedPdfId,
                                        success: false,
                                        message: 'Document sauté par l\'utilisateur',
                                        error: 'Document sauté par l\'utilisateur',
                                        originalPdfName: skippedPdf?.name_pdf || 'Inconnu'
                                    }
                                ]);
                                setShowReview(true);
                                toast('Document sauté, reprise en cours...', { icon: '⏭️' });
                            }

                            if (remainingPdfIds.length === 0) {
                                toast.success('Plus aucun document à traiter.');
                                setSelectedPdfIds([]);
                                return;
                            }

                            setSelectedPdfIds(remainingPdfIds);

                            await handleProcessPdfs(
                                remainingPdfIds,
                                entreprise_id,
                                pdfInfos,
                                setProcessingSplitThenExtract,
                                setResumeMode,
                                setProcessingResults,
                                setShowReview,
                                setPaused,
                                setPausedPdfId,
                                setPausedAtIndex,
                                setShowExtractModal,
                                setSelectedPdfIds,
                                onRefreshData,
                                true
                            );
                        } else {
                            // Annuler: supprimer localStorage et état de pause
                            clearPauseState();
                            setPaused(false);
                            setPausedPdfId(null);
                            setPausedAtIndex(null);
                            setResumeMode(null);
                        }
                    });
                } else {
                    toast.error(`Traitement terminé avec des erreurs : ${result.message}`);
                    if (result.errors.length > 0) {
                        console.error('Erreurs détaillées:', result.errors);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Erreur lors du traitement:', error);
        toast.error('Erreur lors du traitement des PDFs');
    } finally {
        setProcessingSplitThenExtract(false);
    }
};

// Diviser uniquement
export const handleSplitOnly = async (
    selectedPdfIds: string[],
    entreprise_id: string,
    pdfInfos: PdfInfo[],
    setProcessingSplitOnly: (value: boolean) => void,
    setProcessingResults: (results: ProcessingResult[]) => void,
    setShowReview: (value: boolean) => void,
    setSelectedPdfIds: (ids: string[]) => void,
    onRefreshData: () => Promise<void>
) => {
    if (selectedPdfIds.length === 0) {
        toast.error('Veuillez sélectionner au moins un PDF');
        return;
    }

    if (!entreprise_id) {
        toast.error('ID entreprise manquant');
        return;
    }

    setProcessingSplitOnly(true);
    setProcessingResults([]);
    setShowReview(false);

    try {
        const result = await processPdfList(selectedPdfIds, parseInt(entreprise_id), 'split_only');

        const detailedResults: ProcessingResult[] = [];
        result.results.forEach(item => {
            const originalPdf = pdfInfos.find(pdf => pdf.id === item.pdfId);
            detailedResults.push({
                pdfId: item.pdfId,
                success: item.success,
                message: item.message,
                newPdfIds: item.newPdfIds,
                wasSplit: item.newPdfIds && item.newPdfIds.length > 0,
                originalPdfName: originalPdf?.name_pdf || 'Inconnu'
            });
        });
        result.errors.forEach(error => {
            const originalPdf = pdfInfos.find(pdf => pdf.id === error.pdfId);
            detailedResults.push({
                pdfId: error.pdfId,
                success: false,
                message: error.error,
                error: error.error,
                originalPdfName: originalPdf?.name_pdf || 'Inconnu'
            });
        });

        setProcessingResults(detailedResults);
        setShowReview(true);

        if (result.success) {
            toast.success(`Division terminée : ${result.processedCount} PDF(s)`);
            toast.loading('Rafraîchissement des données...', { id: 'refresh-split' });
            await onRefreshData();
            toast.success('Données rafraîchies', { id: 'refresh-split' });
            // setSelectedPdfIds([]); // Gardé sélectionné pour enchaîner les actions
        } else {
            toast.error(result.message || 'Division terminée avec des erreurs');
        }
    } catch (error) {
        console.error('Erreur division:', error);
        toast.error('Erreur lors de la division des PDFs');
    } finally {
        setProcessingSplitOnly(false);
    }
};

// Smart Split - Division intelligente avec détection de type
export const handleSmartSplit = async (
    selectedPdfIds: string[],
    entreprise_id: string,
    pdfInfos: PdfInfo[],
    setProcessingSmartSplit: (value: boolean) => void,
    setSelectedPdfIds: (ids: string[]) => void,
    onRefreshData: () => Promise<void>
) => {
    if (selectedPdfIds.length === 0) {
        toast.error('Veuillez sélectionner au moins un PDF');
        return;
    }

    if (!entreprise_id) {
        toast.error('ID entreprise manquant');
        return;
    }

    setProcessingSmartSplit(true);
    
    try {
        const entrepriseIdNumber = parseInt(entreprise_id);
        
        // Phase 1: Analyser les PDFs et obtenir les propositions de segmentation
        toast('Analyse des documents en cours...', { icon: '🔍' });
        const analysisResult = await smart_split_loop(selectedPdfIds, entrepriseIdNumber);

        // Afficher les erreurs s'il y en a, mais continuer si on a au moins un résultat
        if (analysisResult.errors.length > 0) {
            analysisResult.errors.forEach(err => {
                const pdfName = pdfInfos.find(p => p.id === err.pdfId)?.name_pdf || err.pdfId;
                toast.error(`${pdfName}: ${err.error}`);
            });
        }

        // S'arrêter UNIQUEMENT si AUCUN PDF n'a réussi
        if (analysisResult.results.length === 0) {
            toast.error('Aucun PDF n\'a pu être analysé');
            return;
        }

        // Phase 2: Préparer la preview pour SweetAlert2 avec checkboxes
        const previewHtml = analysisResult.results.map(result => {
            const pdf = pdfInfos.find(p => p.id === result.pdfId);
            const pdfName = pdf?.name_pdf || result.pdfId;

            if (!result.segments || result.segments.length === 0) {
                return `<div class="mb-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" class="smart-split-checkbox" data-pdf-id="${result.pdfId}" checked disabled style="cursor: not-allowed; opacity: 0.5;">
                        <span>📄 ${pdfName} - Aucun segment</span>
                    </label>
                </div>`;
            }

            const segmentsHtml = result.segments.map((segment) => {
                const typeEmoji = segment.type === 'facture' ? '💰' : segment.type === 'bon' ? '📦' : segment.type === 'bsd' ? '📋' : '📄';
                const pagesText = segment.pages.length === 1 ? `P${segment.pages[0] + 1}` : `P${segment.pages[0] + 1}-${segment.pages[segment.pages.length - 1] + 1}`;
                return `<div class="flex items-center justify-between text-xs py-1"><span>${typeEmoji} ${segment.type}</span><span class="text-gray-500">${pagesText}</span></div>`;
            }).join('');

            return `<div class="mb-2 p-2 bg-gray-50 rounded">
                <label class="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" class="smart-split-checkbox mt-1" data-pdf-id="${result.pdfId}" checked>
                    <div class="flex-1">
                        <div class="font-medium text-sm mb-1">📄 ${pdfName}</div>
                        ${segmentsHtml}
                    </div>
                </label>
            </div>`;
        }).join('');

        // Compter les segments totaux et temps de traitement
        const totalSegments = analysisResult.results.reduce((sum, r) => sum + (r.segments?.length || 0), 0);
        const totalTime = analysisResult.results.reduce((sum, r) => sum + (r.metadata?.processing_time || 0), 0);

        // Collecter toutes les alertes de vérification logique
        const allAlerts = analysisResult.results.flatMap(r => r.metadata?.alerts || []);
        const hasAlerts = allAlerts.length > 0;

        // HTML pour les alertes de cohérence (compact)
        const alertsHtml = hasAlerts ? `
            <div class="mb-2 p-2 bg-orange-50 rounded border-l-2 border-orange-400">
                <div class="font-medium text-sm text-orange-800 mb-1">⚠️ ${allAlerts.length} incohérence(s) Gemini/Logique</div>
                <div class="max-h-24 overflow-y-auto text-xs text-orange-700 space-y-0.5">
                    ${allAlerts.map(alert => `<div>P${alert.page_idx + 1}: ${alert.gemini_type} vs ${alert.logic_type}</div>`).join('')}
                </div>
            </div>
        ` : `
            <div class="mb-2 p-2 bg-green-50 rounded border-l-2 border-green-400">
                <div class="text-sm text-green-800">✅ Vérification OK</div>
            </div>
        `;

        // Phase 3: Afficher la preview et demander confirmation
        const confirmed = await Swal.fire({
            title: 'Smart Split',
            html: `
                <div class="text-left">
                    <div class="mb-2 p-2 bg-blue-50 rounded text-sm">
                        <span class="font-medium">📊</span> ${analysisResult.results.length} doc(s) • ${totalSegments} segment(s) • ${totalTime.toFixed(1)}s
                    </div>
                    
                    ${alertsHtml}
                    
                    <div class="mb-3 p-2 bg-purple-50 rounded border-l-2 border-purple-400">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" id="select-all-smart-split" checked>
                            <span class="font-medium text-sm text-purple-800">✅ Tout sélectionner / Tout désélectionner</span>
                        </label>
                    </div>
                    
                    <div class="mb-2 max-h-80 overflow-y-auto">
                        ${previewHtml}
                    </div>
                    
                    <div class="p-2 bg-yellow-50 rounded text-xs text-yellow-800">
                        ⚠️ Action irréversible - Seuls les PDFs cochés seront divisés selon les segments détectés
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '✅ Confirmer',
            cancelButtonText: '❌ Annuler',
            confirmButtonColor: '#3b82f6',
            cancelButtonColor: '#ef4444',
            width: '700px',
            customClass: {
                popup: 'text-left',
                htmlContainer: 'text-left'
            },
            didOpen: () => {
                // Ajouter un gestionnaire pour "Tout sélectionner / Tout désélectionner"
                const selectAllCheckbox = document.getElementById('select-all-smart-split') as HTMLInputElement;
                const allCheckboxes = document.querySelectorAll('.smart-split-checkbox:not([disabled])') as NodeListOf<HTMLInputElement>;
                
                if (selectAllCheckbox) {
                    selectAllCheckbox.addEventListener('change', (e) => {
                        const checked = (e.target as HTMLInputElement).checked;
                        allCheckboxes.forEach(cb => {
                            cb.checked = checked;
                        });
                    });
                }
                
                // Mettre à jour la checkbox "Tout sélectionner" si une checkbox individuelle change
                allCheckboxes.forEach(cb => {
                    cb.addEventListener('change', () => {
                        if (selectAllCheckbox) {
                            const allChecked = Array.from(allCheckboxes).every(checkbox => checkbox.checked);
                            selectAllCheckbox.checked = allChecked;
                        }
                    });
                });
            }
        });

        if (!confirmed.isConfirmed) {
            toast('Smart split annulé par l\'utilisateur', { icon: '❌' });
            setSelectedPdfIds([]);
            return;
        }

        // Récupérer les PDFs cochés
        const checkedPdfIds = Array.from(document.querySelectorAll('.smart-split-checkbox:checked:not([disabled])') as NodeListOf<HTMLInputElement>)
            .map(cb => cb.getAttribute('data-pdf-id'))
            .filter(id => id !== null) as string[];

        if (checkedPdfIds.length === 0) {
            toast('Aucun document sélectionné pour le split', { icon: '⚠️' });
            setSelectedPdfIds([]);
            return;
        }

        // Phase 4: Appliquer le split intelligent uniquement pour les PDFs cochés
        toast(`Application du smart split pour ${checkedPdfIds.length} document(s)...`, { icon: '⏳' });
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const result of analysisResult.results) {
            // Ne traiter que les PDFs cochés
            if (!checkedPdfIds.includes(result.pdfId)) continue;
            if (!result.segments || result.segments.length === 0) continue;

            try {
                const pdf = pdfInfos.find(p => p.id === result.pdfId);
                if (!pdf) {
                    errorCount++;
                    continue;
                }

                const splitResult = await apply_smart_split(pdf as PdfInfo, result.segments);
                
                if (splitResult.success) {
                    successCount++;
                } else {
                    errorCount++;
                    console.error('Erreur apply_smart_split:', splitResult.error);
                }
            } catch (error) {
                errorCount++;
                console.error('Erreur lors du smart split:', error);
            }
        }

        if (successCount > 0) {
            toast.success(`Smart split réussi : ${successCount} document(s) divisé(s)`);
            toast.loading('Rafraîchissement des données...', { id: 'refresh-smart-split' });
            await onRefreshData();
            toast.success('Données rafraîchies', { id: 'refresh-smart-split' });
            // setSelectedPdfIds([]); // Gardé sélectionné pour enchaîner les actions
        }
        
        if (errorCount > 0) {
            toast.error(`${errorCount} erreur(s) lors du smart split`);
        }

    } catch (error) {
        console.error('Erreur smart split:', error);
        toast.error('Erreur lors du smart split');
        // setSelectedPdfIds([]); // Gardé sélectionné même en cas d'erreur
    } finally {
        setProcessingSmartSplit(false);
    }
};

// Extraire uniquement
export const handleExtractOnly = async (
    selectedPdfIds: string[],
    entreprise_id: string,
    pdfInfos: PdfInfo[],
    setProcessingExtractOnly: (value: boolean) => void,
    setResumeMode: (mode: 'split_then_extract' | 'extract_only' | null) => void,
    setProcessingResults: (results: ProcessingResult[] | ((prev: ProcessingResult[]) => ProcessingResult[])) => void,
    setShowReview: (value: boolean) => void,
    setPaused: (value: boolean) => void,
    setPausedPdfId: (id: string | null) => void,
    setPausedAtIndex: (index: number | null) => void,
    setShowExtractModal: (value: boolean) => void,
    setSelectedPdfIds: (ids: string[]) => void,
    onRefreshData: () => Promise<void>,
    isResuming: boolean = false
) => {
    if (selectedPdfIds.length === 0) {
        toast.error('Veuillez sélectionner au moins un PDF');
        return;
    }

    if (!entreprise_id) {
        toast.error('ID entreprise manquant');
        return;
    }

    setProcessingExtractOnly(true);
    setResumeMode('extract_only');
    // Si ce n'est pas une reprise, on réinitialise les résultats
    if (!isResuming) {
        setProcessingResults([]);
    }
    setShowReview(false);

    try {
        const result = await processPdfList(selectedPdfIds, parseInt(entreprise_id), 'extract_only');

        const detailedResults: ProcessingResult[] = [];
        result.results.forEach(item => {
            const originalPdf = pdfInfos.find(pdf => pdf.id === item.pdfId);
            const resultItem: ProcessingResult = {
                pdfId: item.pdfId,
                success: item.success,
                message: item.message,
                originalPdfName: originalPdf?.name_pdf || 'Inconnu'
            };
            // Ajouter confidence et alerte s'ils existent
            if ('confidence' in item && item.confidence) {
                resultItem.confidence = item.confidence as { brute: number; spec: number; handwritten: [number, boolean] };
            }
            if ('alerte' in item && item.alerte) {
                resultItem.alerte = item.alerte as { stop: boolean; message: string };
            }
            detailedResults.push(resultItem);
        });

        result.errors.forEach(error => {
            const originalPdf = pdfInfos.find(pdf => pdf.id === error.pdfId);
            detailedResults.push({
                pdfId: error.pdfId,
                success: false,
                message: error.error,
                error: error.error,
                originalPdfName: originalPdf?.name_pdf || 'Inconnu'
            });
        });

        // Si c'est une reprise, accumuler les résultats, sinon les écraser
        if (isResuming) {
            setProcessingResults(prev => [...prev, ...detailedResults]);
        } else {
            setProcessingResults(detailedResults);
        }
        setShowReview(true);

        if (result.success) {
            // Nettoyer le localStorage si succès
            clearPauseState();
            
            toast.success(`Extraction terminée : ${result.processedCount} PDFs extraits avec succès`);
            toast.loading('Rafraîchissement des données...', { id: 'refresh-extract' });
            await onRefreshData();
            toast.success('Données rafraîchies', { id: 'refresh-extract' });
            // Enchaîner automatiquement avec la vérification des alertes
            try {
                for (const pdfId of selectedPdfIds) {
                    await verifierEtMettreAJourAlerte(pdfId, entreprise_id);
                }
                toast.success('Vérification des alertes terminée');
                toast.loading('Rafraîchissement des données...', { id: 'refresh-post-extract-alertes' });
                await onRefreshData();
                toast.success('Données rafraîchies', { id: 'refresh-post-extract-alertes' });
            } catch (e) {
                console.error('Erreur lors de la vérification automatique des alertes:', e);
                toast.error('Erreur lors de la vérification des alertes');
            }
            // setSelectedPdfIds([]); // Gardé sélectionné pour enchaîner les actions
        } else {
            const ragErr = result.errors.find(e => e.error && e.error.toLowerCase && e.error.toLowerCase().includes('rag'));
            if (ragErr && typeof ragErr.pdfId === 'string') {
                const blockingPdf = pdfInfos.find(p => p.id === ragErr.pdfId);
                toast.error(`Stop: Exemple RAG manquant pour ${blockingPdf?.name_pdf || ragErr.pdfId}`);
                setPaused(true);
                setPausedPdfId(ragErr.pdfId);
                setPausedAtIndex(result.pausedAtIndex ?? null);
                try {
                    const entrepriseIdNumber = Number(entreprise_id);
                    const { data: latest } = await supabase
                        .from('pdf_infos')
                        .select('infos_raw')
                        .eq('id', ragErr.pdfId)
                        .eq('entreprise_id', entrepriseIdNumber)
                        .single();
                    if (latest?.infos_raw) {
                        try {
                            localStorage.setItem(`extractDoc:form:${ragErr.pdfId}`, JSON.stringify(latest.infos_raw));
                        } catch {}
                    }
                } catch {}
                setShowExtractModal(true);
            } else {
                // Si pause pour erreur backend, sauvegarder l'état et afficher Swal
                const backendErr = result.errors.find(e => isBackendPauseError(e.error));
                if (backendErr && typeof backendErr.pdfId === 'string') {
                    const blockingPdf = pdfInfos.find(p => p.id === backendErr.pdfId);
                    const errorMessage = backendErr.error || 'Erreur backend inconnue';
                    
                    setPaused(true);
                    setPausedPdfId(backendErr.pdfId);
                    setPausedAtIndex(result.pausedAtIndex ?? null);
                    
                    // Sauvegarder l'état dans localStorage
                    savePauseState({
                        selectedPdfIds,
                        pausedAtIndex: result.pausedAtIndex ?? 0,
                        pausedPdfId: backendErr.pdfId,
                        resumeMode: 'extract_only',
                        entreprise_id,
                        errorMessage,
                        timestamp: Date.now()
                    });
                    
                    // Afficher Swal avec option de reprise
                    Swal.fire({
                        title: '⚠️ Erreur Backend',
                        html: `
                            <div class="text-left">
                                <div class="mb-3 p-3 bg-red-50 rounded border-l-4 border-red-400">
                                    <div class="font-medium text-red-800 mb-2">Le backend a rencontré une erreur</div>
                                    <div class="text-sm text-red-700 mb-2">
                                        Document: <strong>${blockingPdf?.name_pdf || backendErr.pdfId}</strong>
                                    </div>
                                    <div class="text-xs text-red-600 font-mono bg-red-100 p-2 rounded">
                                        ${errorMessage}
                                    </div>
                                </div>
                                <div class="mb-3 p-2 bg-blue-50 rounded text-sm text-blue-800">
                                    <div class="font-medium mb-1">📊 Progression:</div>
                                    <div>• Documents traités: ${result.processedCount}/${selectedPdfIds.length}</div>
                                    <div>• Documents restants: ${selectedPdfIds.length - (result.pausedAtIndex ?? 0)}</div>
                                </div>
                                <div class="p-2 bg-gray-50 rounded text-xs text-gray-600">
                                    💡 L'état est sauvegardé pendant 24h. Vous pouvez reprendre plus tard en ouvrant ce menu.
                                </div>
                            </div>
                        `,
                        showCancelButton: true,
                        showDenyButton: true,
                        confirmButtonText: '🔄 Reprendre maintenant',
                        denyButtonText: '⏭️ Sauter ce document',
                        cancelButtonText: '❌ Annuler',
                        confirmButtonColor: '#3b82f6',
                        denyButtonColor: '#f59e0b',
                        cancelButtonColor: '#6b7280',
                        allowOutsideClick: false,
                        width: '600px'
                    }).then(async (swalResult) => {
                        if (swalResult.isConfirmed) {
                            // Reprendre: NE PAS supprimer localStorage tout de suite (le succès le fera)
                            setPaused(false);
                            
                            // Reprendre depuis pausedAtIndex (INCLUS pour réessayer le document échoué)
                            const remainingPdfIds = selectedPdfIds.slice(result.pausedAtIndex ?? 0);
                            if (remainingPdfIds.length === 0) {
                                toast.success('Plus aucun document à traiter.');
                                clearPauseState();
                                return;
                            }
                            
                            // Relancer le traitement en mode reprise pour accumuler les résultats
                            await handleExtractOnly(
                                remainingPdfIds,
                                entreprise_id,
                                pdfInfos,
                                setProcessingExtractOnly,
                                setResumeMode,
                                setProcessingResults,
                                setShowReview,
                                setPaused,
                                setPausedPdfId,
                                setPausedAtIndex,
                                setShowExtractModal,
                                setSelectedPdfIds,
                                onRefreshData,
                                true // isResuming = true
                            );
                        } else if (swalResult.isDenied) {
                            const skipIndex = result.pausedAtIndex ?? 0;
                            const skippedPdfId = selectedPdfIds[skipIndex];
                            const remainingPdfIds = selectedPdfIds.slice(skipIndex + 1);

                            clearPauseState();
                            setPaused(false);
                            setPausedPdfId(null);
                            setPausedAtIndex(null);
                            setResumeMode(null);

                            if (skippedPdfId) {
                                const skippedPdf = pdfInfos.find(pdf => pdf.id === skippedPdfId);
                                setProcessingResults(prev => [
                                    ...prev,
                                    {
                                        pdfId: skippedPdfId,
                                        success: false,
                                        message: 'Document sauté par l\'utilisateur',
                                        error: 'Document sauté par l\'utilisateur',
                                        originalPdfName: skippedPdf?.name_pdf || 'Inconnu'
                                    }
                                ]);
                                setShowReview(true);
                                toast('Document sauté, reprise en cours...', { icon: '⏭️' });
                            }

                            if (remainingPdfIds.length === 0) {
                                toast.success('Plus aucun document à traiter.');
                                setSelectedPdfIds([]);
                                return;
                            }

                            setSelectedPdfIds(remainingPdfIds);

                            await handleExtractOnly(
                                remainingPdfIds,
                                entreprise_id,
                                pdfInfos,
                                setProcessingExtractOnly,
                                setResumeMode,
                                setProcessingResults,
                                setShowReview,
                                setPaused,
                                setPausedPdfId,
                                setPausedAtIndex,
                                setShowExtractModal,
                                setSelectedPdfIds,
                                onRefreshData,
                                true
                            );
                        } else {
                            // Annuler: supprimer localStorage et état de pause
                            clearPauseState();
                            setPaused(false);
                            setPausedPdfId(null);
                            setPausedAtIndex(null);
                            setResumeMode(null);
                        }
                    });
                } else {
                    toast.error(`Extraction terminée avec des erreurs : ${result.message}`);
                }
            }
        }
    } catch (error) {
        console.error('Erreur extraction:', error);
        toast.error('Erreur lors de l\'extraction des PDFs');
    } finally {
        setProcessingExtractOnly(false);
    }
};

// Auto-link selected PDFs (simulation + confirmation + application)
export const handleAutoLinkSelected = async (
    selectedPdfIds: string[],
    entreprise_id: string,
    user_id: string,
    pdfInfos: PdfInfo[],
    currentConfig: LinkConfig,
    setProcessingAutoLink: (value: boolean) => void,
    setAutoLinkPhase: (phase: 'idle' | 'simulation' | 'confirmation' | 'applying') => void,
    setProcessingResults: (results: ProcessingResult[]) => void,
    setShowReview: (value: boolean) => void,
    setSelectedPdfIds: (ids: string[]) => void,
    onRefreshData: () => Promise<void>
) => {
    if (selectedPdfIds.length === 0) {
        toast.error('Veuillez sélectionner au moins un PDF');
        return;
    }

    if (!entreprise_id) {
        toast.error('ID entreprise manquant');
        return;
    }

    if (!user_id) {
        console.error('[handleAutoLinkSelected] user_id manquant dans la session');
        toast.error('Utilisateur manquant pour l\'auto-link');
        return;
    }

    setProcessingAutoLink(true);
    setAutoLinkPhase('simulation');
    setProcessingResults([]);
    setShowReview(false);

    try {
        // Phase 1: Simuler l'auto-link
        toast('Simulation de l\'auto-link en cours...', { icon: '🔍' });
        const simulationOutcome: BulkAutoLinkOutcome = await autoLinkDocs(selectedPdfIds, parseInt(entreprise_id), user_id, true, currentConfig.params);

        // Construire les résultats détaillés
        const detailedResults: ProcessingResult[] = [];
        simulationOutcome.results.forEach(item => {
            const originalPdf = pdfInfos.find(pdf => pdf.id === item.pdfId);
            const autoLinkDetails = (item.results || []).map(r => ({
                index: r.index_dechet,
                performed: r.performed,
                bsd_id: r.bsd_id
            }));
            detailedResults.push({
                pdfId: item.pdfId,
                success: item.success,
                message: item.message,
                originalPdfName: originalPdf?.name_pdf || 'Inconnu',
                autoLinkDetails
            });
        });

        simulationOutcome.errors.forEach(err => {
            const originalPdf = pdfInfos.find(pdf => pdf.id === err.pdfId);
            detailedResults.push({
                pdfId: err.pdfId,
                success: false,
                message: err.error,
                error: err.error,
                originalPdfName: originalPdf?.name_pdf || 'Inconnu'
            });
        });

        setProcessingResults(detailedResults);
        setShowReview(true);
        setAutoLinkPhase('confirmation');

        // Demander confirmation avant d'appliquer les changements
        const totalActions = detailedResults.reduce((sum, result) => 
            sum + (result.autoLinkDetails?.length || 0), 0);
        
        if (totalActions === 0) {
            toast('Aucune action d\'auto-link proposée', { icon: 'ℹ️' });
            setAutoLinkPhase('idle');
            // setSelectedPdfIds([]); // Gardé sélectionné
            return;
        }

        // Attendre un peu pour que l'utilisateur puisse voir les résultats
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Préparer les détails pour SweetAlert2
        const actionSummary = detailedResults.reduce((acc, result) => {
            if (result.autoLinkDetails && result.autoLinkDetails.length > 0) {
                acc[result.originalPdfName || 'Document inconnu'] = result.autoLinkDetails.map(detail => ({
                    index: detail.index,
                    action: detail.performed,
                    bsdId: detail.bsd_id
                }));
            }
            return acc;
        }, {} as Record<string, Array<{index: number, action: string, bsdId?: string}>>);

        const actionCounts = detailedResults.reduce((acc, result) => {
            if (result.autoLinkDetails) {
                result.autoLinkDetails.forEach(detail => {
                    acc[detail.performed] = (acc[detail.performed] || 0) + 1;
                });
            }
            return acc;
        }, {} as Record<string, number>);

        // Créer le HTML détaillé avec checkboxes
        const detailsHtml = Object.entries(actionSummary).map(([pdfName, actions]) => {
            // Trouver le pdfId correspondant
            const resultItem = detailedResults.find(r => r.originalPdfName === pdfName);
            const pdfId = resultItem?.pdfId || '';
            
            const actionsHtml = actions.map(action => {
                const actionLabel = action.action === 'linked' ? '🔗 Lié au BSD'
                    : action.action === 'created' ? '✨ BSD créé'
                    : action.action === 'to_check_by_user' ? '👀 À vérifier manuellement'
                    : '⏭️ Déjà traité';
                
                const bsdInfo = action.bsdId ? ` (BSD: ${action.bsdId})` : '';
                return `<div class="ml-4 mb-1 text-sm">• Déchet #${action.index + 1}: ${actionLabel}${bsdInfo}</div>`;
            }).join('');
            
            return `
                <div class="mb-3 p-2 bg-gray-50 rounded">
                    <label class="flex items-start gap-2 cursor-pointer">
                        <input type="checkbox" class="auto-link-checkbox mt-1" data-pdf-id="${pdfId}" checked>
                        <div class="flex-1">
                            <div class="font-medium text-gray-800 mb-2">📄 ${pdfName}</div>
                            ${actionsHtml}
                        </div>
                    </label>
                </div>
            `;
        }).join('');

        const confirmed = await Swal.fire({
            title: 'Confirmer l\'auto-link',
            html: `
                <div class="text-left">
                    <div class="mb-4 p-3 bg-blue-50 rounded border-l-4 border-blue-400">
                        <div class="font-medium text-blue-800">Configuration: ${currentConfig.name}</div>
                        <div class="text-sm text-blue-600 mt-1">${currentConfig.description}</div>
                    </div>
                    
                    <div class="mb-4">
                        <div class="font-medium text-gray-800 mb-2">📊 Résumé des actions:</div>
                        <div class="grid grid-cols-2 gap-2 text-sm">
                            ${Object.entries(actionCounts).map(([action, count]) => {
                                const label = action === 'linked' ? '🔗 Liés' 
                                    : action === 'created' ? '✨ Créés'
                                    : action === 'to_check_by_user' ? '👀 À vérifier'
                                    : '⏭️ Autres';
                                return `<div class="flex justify-between"><span>${label}:</span><span class="font-medium">${count}</span></div>`;
                            }).join('')}
                            <div class="flex justify-between font-medium border-t pt-1"><span>Total:</span><span>${totalActions}</span></div>
                        </div>
                    </div>
                    
                    <div class="mb-3 p-2 bg-purple-50 rounded border-l-2 border-purple-400">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" id="select-all-auto-link" checked>
                            <span class="font-medium text-sm text-purple-800">✅ Tout sélectionner / Tout désélectionner</span>
                        </label>
                    </div>
                    
                    <div class="mb-4">
                        <div class="font-medium text-gray-800 mb-2">📋 Détail par document:</div>
                        <div class="max-h-60 overflow-y-auto">
                            ${detailsHtml}
                        </div>
                    </div>
                    
                    <div class="p-3 bg-yellow-50 rounded border-l-4 border-yellow-400">
                        <div class="text-sm text-yellow-800">
                            <strong>⚠️ Attention:</strong> Ces actions vont modifier la base de données. 
                            Seuls les documents cochés seront traités.
                        </div>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '✅ Confirmer et appliquer',
            cancelButtonText: '❌ Annuler',
            confirmButtonColor: '#3b82f6',
            cancelButtonColor: '#ef4444',
            width: '800px',
            customClass: {
                popup: 'text-left',
                htmlContainer: 'text-left'
            },
            didOpen: () => {
                // Ajouter un gestionnaire pour "Tout sélectionner / Tout désélectionner"
                const selectAllCheckbox = document.getElementById('select-all-auto-link') as HTMLInputElement;
                const allCheckboxes = document.querySelectorAll('.auto-link-checkbox') as NodeListOf<HTMLInputElement>;
                
                if (selectAllCheckbox) {
                    selectAllCheckbox.addEventListener('change', (e) => {
                        const checked = (e.target as HTMLInputElement).checked;
                        allCheckboxes.forEach(cb => {
                            cb.checked = checked;
                        });
                    });
                }
                
                // Mettre à jour la checkbox "Tout sélectionner" si une checkbox individuelle change
                allCheckboxes.forEach(cb => {
                    cb.addEventListener('change', () => {
                        if (selectAllCheckbox) {
                            const allChecked = Array.from(allCheckboxes).every(checkbox => checkbox.checked);
                            selectAllCheckbox.checked = allChecked;
                        }
                    });
                });
            }
        });

        if (!confirmed.isConfirmed) {
            toast('Auto-link annulé par l\'utilisateur', { icon: '❌' });
            setAutoLinkPhase('idle');
            // setSelectedPdfIds([]); // Gardé sélectionné
            return;
        }

        // Récupérer les PDFs cochés
        const checkedPdfIds = Array.from(document.querySelectorAll('.auto-link-checkbox:checked') as NodeListOf<HTMLInputElement>)
            .map(cb => cb.getAttribute('data-pdf-id'))
            .filter(id => id !== null) as string[];

        if (checkedPdfIds.length === 0) {
            toast('Aucun document sélectionné pour l\'auto-link', { icon: '⚠️' });
            setAutoLinkPhase('idle');
            return;
        }

        // Phase 2: Appliquer les changements pré-calculés uniquement pour les PDFs cochés
        // IMPORTANT: On applique directement les décisions de la simulation sans recalculer
        // pour éviter des divergences si la BDD a changé entre la simulation et la confirmation
        setAutoLinkPhase('applying');
        toast(`Application de l'auto-link pour ${checkedPdfIds.length} document(s)...`, { icon: '⏳' });
        const realOutcome: BulkAutoLinkOutcome = await applyPreComputedAutoLink(
            simulationOutcome,
            checkedPdfIds,
            parseInt(entreprise_id),
            user_id
        );

        // Mettre à jour les résultats avec les actions réelles
        const finalResults: ProcessingResult[] = [];
        realOutcome.results.forEach(item => {
            const originalPdf = pdfInfos.find(pdf => pdf.id === item.pdfId);
            const autoLinkDetails = (item.results || []).map(r => ({
                index: r.index_dechet,
                performed: r.performed,
                bsd_id: r.bsd_id
            }));
            finalResults.push({
                pdfId: item.pdfId,
                success: item.success,
                message: item.message,
                originalPdfName: originalPdf?.name_pdf || 'Inconnu',
                autoLinkDetails
            });
        });

        realOutcome.errors.forEach(err => {
            const originalPdf = pdfInfos.find(pdf => pdf.id === err.pdfId);
            finalResults.push({
                pdfId: err.pdfId,
                success: false,
                message: err.error,
                error: err.error,
                originalPdfName: originalPdf?.name_pdf || 'Inconnu'
            });
        });

        setProcessingResults(finalResults);

        if (realOutcome.success) {
            toast.success(`Auto-link appliqué : ${realOutcome.processedCount} document(s) traités`);
            toast.loading('Rafraîchissement des données...', { id: 'refresh-autolink' });
            await onRefreshData();
            toast.success('Données rafraîchies', { id: 'refresh-autolink' });
            // setSelectedPdfIds([]); // Gardé sélectionné pour enchaîner les actions
        } else {
            toast.error(realOutcome.message || 'Auto-link appliqué avec des erreurs');
        }

    } catch (error) {
        console.error('Erreur auto-link:', error);
        toast.error('Erreur lors de l\'auto-link des PDFs');
    } finally {
        setProcessingAutoLink(false);
        setAutoLinkPhase('idle');
    }
};

// Auto-propose selected PDFs (simulation mode)
export const handleAutoProposeSelected = async (
    selectedPdfIds: string[],
    entreprise_id: string,
    user_id: string,
    pdfInfos: PdfInfo[],
    currentConfig: LinkConfig,
    setProcessingAutoPropose: (value: boolean) => void,
    setProcessingResults: (results: ProcessingResult[]) => void,
    setShowReview: (value: boolean) => void,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setSelectedPdfIds: (ids: string[]) => void
) => {
    if (selectedPdfIds.length === 0) {
        toast.error('Veuillez sélectionner au moins un PDF');
        return;
    }

    if (!entreprise_id) {
        toast.error('ID entreprise manquant');
        return;
    }

    if (!user_id) {
        console.error('[handleAutoProposeSelected] user_id manquant dans la session');
        toast.error('Utilisateur manquant pour l\'auto-proposition');
        return;
    }

    setProcessingAutoPropose(true);
    setProcessingResults([]);
    setShowReview(false);

    try {
        const outcome: BulkAutoLinkOutcome = await autoLinkDocs(selectedPdfIds, parseInt(entreprise_id), user_id, true, currentConfig.params); // simulationMode = true

        const detailedResults: ProcessingResult[] = [];
        outcome.results.forEach(item => {
            const originalPdf = pdfInfos.find(pdf => pdf.id === item.pdfId);
            const autoLinkDetails = (item.results || []).map(r => ({
                index: r.index_dechet,
                performed: r.performed,
                bsd_id: r.bsd_id
            }));
            detailedResults.push({
                pdfId: item.pdfId,
                success: item.success,
                message: item.message,
                originalPdfName: originalPdf?.name_pdf || 'Inconnu',
                autoLinkDetails
            });
        });

        outcome.errors.forEach(err => {
            const originalPdf = pdfInfos.find(pdf => pdf.id === err.pdfId);
            detailedResults.push({
                pdfId: err.pdfId,
                success: false,
                message: err.error,
                error: err.error,
                originalPdfName: originalPdf?.name_pdf || 'Inconnu'
            });
        });

        setProcessingResults(detailedResults);
        setShowReview(true);

        if (outcome.success) {
            toast.success(`Auto-proposition terminée : ${outcome.processedCount} document(s) simulés`);
            // setSelectedPdfIds([]); // Gardé sélectionné pour enchaîner les actions
        } else {
            toast.error(outcome.message || 'Auto-proposition terminée avec des erreurs');
        }
    } catch (error) {
        console.error('Erreur auto-proposition:', error);
        toast.error('Erreur lors de l\'auto-proposition des PDFs');
    } finally {
        setProcessingAutoPropose(false);
    }
};

// Push factures for selected PDFs (only if all selected are factures)
export const handlePushSelected = async (
    selectedPdfIds: string[],
    entreprise_id: string,
    user_id: string,
    pdfInfos: PdfInfo[],
    setProcessingPush: (value: boolean) => void,
    setSelectedPdfIds: (ids: string[]) => void,
    onRefreshData: () => Promise<void>
) => {
    if (selectedPdfIds.length === 0) {
        toast.error('Veuillez sélectionner au moins un PDF');
        return;
    }
    if (!entreprise_id) {
        toast.error('ID entreprise manquant');
        return;
    }
    // Check all selected are invoices
    const selectedPdfs = pdfInfos.filter(p => selectedPdfIds.includes(p.id));
    const allFactures = selectedPdfs.every(p => (p.document_type || '').toLowerCase() === 'facture');
    if (!allFactures) {
        toast.error('La sélection doit contenir uniquement des factures');
        return;
    }

    setProcessingPush(true);
    try {
        const entrepriseIdNumber = Number(entreprise_id);
        const { data: mappings, error: mappingError } = await getParamsMappingByEntreprise(entrepriseIdNumber);
        if (mappingError || !mappings) {
            throw new Error('Impossible de récupérer les mappings');
        }
        const paramsMapping = mappings as ParamsMapping;

        let successCount = 0;
        let errorCount = 0;

        for (const pdfId of selectedPdfIds) {
            try {
                // Load infos_raw for this pdf
                const { data: pdfRow, error: pdfErr } = await supabase
                    .from('pdf_infos')
                    .select('id, infos_raw')
                    .eq('entreprise_id', entrepriseIdNumber)
                    .eq('id', pdfId)
                    .maybeSingle();
                if (pdfErr || !pdfRow || !pdfRow.infos_raw) {
                    throw new Error(pdfErr?.message || 'infos_raw introuvable');
                }

                const doc = pdfRow.infos_raw as Record<string, unknown>;
                const dechets = Array.isArray((doc as { dechet?: unknown[] }).dechet)
                    ? ((doc as { dechet: unknown[] }).dechet)
                    : [];
                const indices: number[] = dechets.map((_, i) => i);

                // Fetch existings for this pdf
                const { data: existingRows, error: existingFetchErr } = await supabase
                    .from('facture')
                    .select('id,index_dechet_pdf')
                    .eq('entreprise_id', entrepriseIdNumber)
                    .eq('pdf_infos_id', pdfId);
                if (existingFetchErr) throw existingFetchErr;
                const existingIndexToId = new Map<number, string>();
                for (const row of existingRows || []) {
                    const idx = (row as { index_dechet_pdf?: number }).index_dechet_pdf;
                    const id = (row as { id?: string }).id;
                    if (typeof idx === 'number' && id) existingIndexToId.set(idx, id);
                }

                // Single confirm per pdf if any exist
                const indicesExisting = indices.filter(i => existingIndexToId.has(i));
                let overwriteAllowed = false;
                if (indicesExisting.length > 0) {
                    overwriteAllowed = window.confirm(`Le PDF ${pdfId} contient déjà ${indicesExisting.length} ligne(s) de facture. Écraser ?`);
                }

                let created = 0;
                let updated = 0;

                for (const idx of indices) {
                    try {
                        const normalized = normalizePdfData(
                            doc,
                            paramsMapping.params_mapping_site || {},
                            paramsMapping.params_mapping_presta || {},
                            idx,
                            true
                        );
                        const factureJson = buildFactureFromNormalized(
                            normalized,
                            doc,
                            idx,
                            paramsMapping
                        );

                        const existingId = existingIndexToId.get(idx);
                        if (existingId) {
                            if (!overwriteAllowed) {
                                continue;
                            }
                            const { error: updateErr } = await supabase
                                .from('facture')
                                .update({ infos_json: factureJson, user_id: user_id || undefined })
                                .eq('id', existingId);
                            if (updateErr) throw updateErr;
                            updated += 1;
                        } else {
                            await push_in_facture_bdd(entrepriseIdNumber, pdfId, idx, factureJson, user_id || undefined);
                            created += 1;
                        }
                    } catch (e) {
                        console.error('Erreur push facture index', idx, e);
                        continue;
                    }
                }

                const total = indices.length;
                const processed = created + updated;
                if (processed === total) {
                    const pushedArray = indices.map(idx => ({ index_dechet: idx, status: 'pushed' as const }));
                    const { error: updatePdfErr } = await supabase
                        .from('pdf_infos')
                        .update({ status: 'pushed', bsd_linked: pushedArray })
                        .eq('entreprise_id', entrepriseIdNumber)
                        .eq('id', pdfId);
                    if (updatePdfErr) console.error('Erreur maj pdf_infos', updatePdfErr);
                }

                successCount++;
            } catch (e) {
                errorCount++;
                console.error('Erreur push facture pour PDF', pdfId, e);
            }
        }

        if (successCount > 0) {
            toast.success(`${successCount} facture(s) poussée(s)`);
            toast.loading('Rafraîchissement des données...', { id: 'refresh-push' });
            await onRefreshData();
            toast.success('Données rafraîchies', { id: 'refresh-push' });
        }
        if (errorCount > 0) toast.error(`${errorCount} erreur(s) lors du push`);
        // setSelectedPdfIds([]); // Gardé sélectionné pour enchaîner les actions
    } catch (error) {
        console.error('Erreur push factures:', error);
        toast.error('Erreur lors du push des factures');
    } finally {
        setProcessingPush(false);
    }
};

// Vérifier les alertes des PDFs sélectionnés
export const handleCheckAlertes = async (
    selectedPdfIds: string[],
    entreprise_id: string,
    pdfInfos: PdfInfo[],
    setProcessingAlertes: (value: boolean) => void,
    setProcessingResults: (results: ProcessingResult[]) => void,
    setShowReview: (value: boolean) => void,
    setSelectedPdfIds: (ids: string[]) => void,
    onRefreshData: () => Promise<void>
) => {
    if (selectedPdfIds.length === 0) {
        toast.error('Veuillez sélectionner au moins un PDF');
        return;
    }

    if (!entreprise_id) {
        toast.error('ID entreprise manquant');
        return;
    }

    setProcessingAlertes(true);
    setProcessingResults([]);
    setShowReview(false);
    
    try {
        const detailedResults: ProcessingResult[] = [];
        let successCount = 0;
        let errorCount = 0;

        // Traiter chaque PDF individuellement
        for (const pdfId of selectedPdfIds) {
            try {
                const originalPdf = pdfInfos.find(pdf => pdf.id === pdfId);
                const result = await verifierEtMettreAJourAlerte(pdfId, entreprise_id);
                
                detailedResults.push({
                    pdfId: pdfId,
                    success: true,
                    message: result.hasTranslation 
                        ? "Toutes les traductions sont disponibles" 
                        : `Traductions manquantes détectées et alerte mise à jour`,
                    originalPdfName: originalPdf?.name_pdf || 'Inconnu',
                    alerte: {
                        stop: !result.hasTranslation,
                        message: result.hasTranslation ? "" : "Traductions manquantes détectées"
                    }
                });
                successCount++;
            } catch (error) {
                const originalPdf = pdfInfos.find(pdf => pdf.id === pdfId);
                detailedResults.push({
                    pdfId: pdfId,
                    success: false,
                    message: `Erreur lors de la vérification des alertes`,
                    error: error instanceof Error ? error.message : 'Erreur inconnue',
                    originalPdfName: originalPdf?.name_pdf || 'Inconnu'
                });
                errorCount++;
            }
        }
        
        setProcessingResults(detailedResults);
        setShowReview(true);
        
        // Rafraîchir les données dans tous les cas
        toast.loading('Rafraîchissement des données...', { id: 'refresh-alertes' });
        await onRefreshData();
        toast.success('Données rafraîchies', { id: 'refresh-alertes' });
        
        if (errorCount === 0) {
            toast.success(`Vérification des alertes terminée : ${successCount} PDFs vérifiés avec succès`);
        } else {
            toast.error(`Vérification terminée : ${successCount} succès, ${errorCount} erreurs`);
        }
        
        // setSelectedPdfIds([]); // Gardé sélectionné pour enchaîner les actions
    } catch (error) {
        console.error('Erreur lors de la vérification des alertes:', error);
        toast.error('Erreur lors de la vérification des alertes');
    } finally {
        setProcessingAlertes(false);
    }
};

// Supprimer les liens BSD des PDFs sélectionnés
export const handleDeleteLinksSelected = async (
    selectedPdfIds: string[],
    entreprise_id: string,
    user_id: string,
    pdfInfos: PdfInfo[],
    setProcessingDeleteLinks: (value: boolean) => void,
    setSelectedPdfIds: (ids: string[]) => void,
    onRefreshData: () => Promise<void>
) => {
    if (selectedPdfIds.length === 0) {
        toast.error('Veuillez sélectionner au moins un PDF');
        return;
    }

    if (!entreprise_id) {
        toast.error('ID entreprise manquant');
        return;
    }

    const entrepriseIdNum = parseInt(entreprise_id);

    // Analyser ce qui va être supprimé pour chaque PDF
    const analysisResults: Array<{
        pdfId: string;
        pdfName: string;
        actions: Array<{
            indexDechet: number;
            status: string;
            bsdId: string;
            actionType: 'delete_bsd' | 'unlink_bsd' | 'remove_to_check';
            actionLabel: string;
        }>;
    }> = [];

    for (const pdfId of selectedPdfIds) {
        const pdf = pdfInfos.find(p => p.id === pdfId);
        if (!pdf) continue;

        const bsdLinked = pdf.bsd_linked as Array<{
            index_dechet: number;
            status?: string;
            bsd_id?: string;
        }> | null | undefined;

        if (!bsdLinked || !Array.isArray(bsdLinked) || bsdLinked.length === 0) {
            continue;
        }

        const actions: Array<{
            indexDechet: number;
            status: string;
            bsdId: string;
            actionType: 'delete_bsd' | 'unlink_bsd' | 'remove_to_check';
            actionLabel: string;
        }> = [];

        for (const item of bsdLinked) {
            const status = item.status || 'unknown';
            const bsdId = item.bsd_id || 'N/A';
            
            if (status === 'created') {
                actions.push({
                    indexDechet: item.index_dechet,
                    status,
                    bsdId,
                    actionType: 'delete_bsd',
                    actionLabel: '🗑️ Supprimer le BSD'
                });
            } else if (status === 'linked') {
                actions.push({
                    indexDechet: item.index_dechet,
                    status,
                    bsdId,
                    actionType: 'unlink_bsd',
                    actionLabel: '🔓 Délier du BSD'
                });
            } else if (status === 'check_by_user' || status === 'to_check_by_user') {
                actions.push({
                    indexDechet: item.index_dechet,
                    status,
                    bsdId: bsdId !== 'N/A' ? bsdId : '',
                    actionType: 'remove_to_check',
                    actionLabel: '❌ Retirer "À vérifier"'
                });
            } else if (status === 'pushed') {
                // Ne rien faire pour les pushs - on les garde
                continue;
            }
        }

        if (actions.length > 0) {
            analysisResults.push({
                pdfId,
                pdfName: pdf.name_pdf || 'Document sans nom',
                actions
            });
        }
    }

    if (analysisResults.length === 0) {
        toast('Aucun lien à supprimer pour les PDFs sélectionnés', { icon: 'ℹ️' });
        return;
    }

    // Préparer le HTML pour SweetAlert
    const detailsHtml = analysisResults.map(result => {
        const actionsHtml = result.actions.map(action => {
            const bsdInfo = action.bsdId && action.bsdId !== 'N/A' ? ` (BSD: ${action.bsdId})` : '';
            return `<div class="ml-4 mb-1 text-sm">• Déchet #${action.indexDechet + 1}: ${action.actionLabel}${bsdInfo}</div>`;
        }).join('');

        return `
            <div class="mb-3 p-2 bg-gray-50 rounded">
                <div class="font-medium text-gray-800 mb-2">📄 ${result.pdfName}</div>
                ${actionsHtml}
            </div>
        `;
    }).join('');

    // Compter les actions
    const totalDeleteBsd = analysisResults.reduce((sum, r) => sum + r.actions.filter(a => a.actionType === 'delete_bsd').length, 0);
    const totalUnlinkBsd = analysisResults.reduce((sum, r) => sum + r.actions.filter(a => a.actionType === 'unlink_bsd').length, 0);
    const totalRemoveToCheck = analysisResults.reduce((sum, r) => sum + r.actions.filter(a => a.actionType === 'remove_to_check').length, 0);

    // Afficher la confirmation
    const confirmed = await Swal.fire({
        title: 'Supprimer les liens BSD',
        html: `
            <div class="text-left">
                <div class="mb-4 p-3 bg-yellow-50 rounded border-l-4 border-yellow-400">
                    <div class="font-medium text-yellow-800 mb-2">⚠️ Actions à effectuer:</div>
                    <div class="text-sm text-yellow-700 space-y-1">
                        ${totalDeleteBsd > 0 ? `<div>🗑️ <strong>${totalDeleteBsd}</strong> BSD(s) seront <strong>supprimés</strong> (statut "Créé")</div>` : ''}
                        ${totalUnlinkBsd > 0 ? `<div>🔓 <strong>${totalUnlinkBsd}</strong> BSD(s) seront <strong>déliés</strong> (statut "Lié")</div>` : ''}
                        ${totalRemoveToCheck > 0 ? `<div>❌ <strong>${totalRemoveToCheck}</strong> marqueur(s) "À vérifier" seront <strong>retirés</strong></div>` : ''}
                    </div>
                </div>
                
                <div class="mb-4">
                    <div class="font-medium text-gray-800 mb-2">📋 Détail par document:</div>
                    <div class="max-h-60 overflow-y-auto">
                        ${detailsHtml}
                    </div>
                </div>
                
                <div class="p-3 bg-red-50 rounded border-l-4 border-red-400">
                    <div class="text-sm text-red-800">
                        <strong>⚠️ Attention:</strong> Cette action est irréversible. Les BSDs créés seront définitivement supprimés. Les BSDs liés seront simplement déliés (ils resteront dans la base).
                    </div>
                </div>
                
                <div class="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
                    ℹ️ Le statut des PDFs sera mis à jour automatiquement. La table facture ne sera pas modifiée.
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '✅ Confirmer la suppression',
        cancelButtonText: '❌ Annuler',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        width: '800px',
        customClass: {
            popup: 'text-left',
            htmlContainer: 'text-left'
        }
    });

    if (!confirmed.isConfirmed) {
        toast('Suppression annulée', { icon: '❌' });
        return;
    }

    // Appliquer les suppressions
    setProcessingDeleteLinks(true);
    
    try {
        let successCount = 0;
        let errorCount = 0;

        for (const result of analysisResults) {
            try {
                const pdfId = result.pdfId;
                
                // Récupérer les données actuelles du PDF
                const { data: currentPdf, error: fetchError } = await supabase
                    .from('pdf_infos')
                    .select('bsd_linked')
                    .eq('id', pdfId)
                    .eq('entreprise_id', entrepriseIdNum)
                    .single();

                if (fetchError || !currentPdf) {
                    errorCount++;
                    console.error('Erreur récupération PDF:', fetchError);
                    continue;
                }

                const currentBsdLinked = currentPdf.bsd_linked as Array<{
                    index_dechet: number;
                    status?: string;
                    bsd_id?: string;
                }> | null | undefined;

                if (!currentBsdLinked || !Array.isArray(currentBsdLinked)) {
                    continue;
                }

                // Traiter chaque action
                for (const action of result.actions) {
                    if (action.actionType === 'delete_bsd' && action.bsdId && action.bsdId !== 'N/A') {
                        // Supprimer le BSD de la table bsd
                        const { error: deleteError } = await supabase
                            .from('bsd')
                            .delete()
                            .eq('id', action.bsdId)
                            .eq('entreprise_id', entrepriseIdNum);

                        if (deleteError) {
                            console.error('Erreur suppression BSD:', deleteError);
                        }
                    } else if (action.actionType === 'unlink_bsd' && action.bsdId && action.bsdId !== 'N/A') {
                        // Délier le BSD (nettoyer les colonnes pdf_infos_id, index_dechet_pdf, pdf_ids)
                        const { data: bsdData, error: bsdFetchError } = await supabase
                            .from('bsd')
                            .select('pdf_ids')
                            .eq('id', action.bsdId)
                            .eq('entreprise_id', entrepriseIdNum)
                            .single();

                        if (!bsdFetchError && bsdData) {
                            const currentPdfIds = Array.isArray(bsdData.pdf_ids) ? bsdData.pdf_ids : [];
                            const updatedPdfIds = currentPdfIds.filter(id => id !== pdfId);

                            const updateData: Record<string, unknown> = {
                                pdf_infos_id: null,
                                index_dechet_pdf: null,
                                pdf_ids: updatedPdfIds.length > 0 ? updatedPdfIds : []
                            };

                            const { error: unlinkError } = await supabase
                                .from('bsd')
                                .update(updateData)
                                .eq('id', action.bsdId)
                                .eq('entreprise_id', entrepriseIdNum);

                            if (unlinkError) {
                                console.error('Erreur déliage BSD:', unlinkError);
                            }
                        }
                    }
                }

                // Mettre à jour bsd_linked du PDF (retirer les entrées traitées)
                const updatedBsdLinked = currentBsdLinked.filter(item => {
                    // Garder uniquement les entrées qui ne sont pas dans les actions traitées
                    return !result.actions.some(action => action.indexDechet === item.index_dechet);
                });

                // Déterminer le nouveau statut du PDF
                let newStatus = 'read';
                if (updatedBsdLinked.length > 0) {
                    // S'il reste des liens, garder le statut actuel ou mettre 'linked' si au moins un est linked
                    const hasLinked = updatedBsdLinked.some(item => item.status === 'linked' || item.status === 'pushed');
                    newStatus = hasLinked ? 'linked' : 'read';
                } else {
                    // Plus aucun lien, revenir à read
                    newStatus = 'read';
                }

                const { error: updatePdfError } = await supabase
                    .from('pdf_infos')
                    .update({
                        bsd_linked: updatedBsdLinked,
                        status: newStatus
                    })
                    .eq('id', pdfId)
                    .eq('entreprise_id', entrepriseIdNum);

                if (updatePdfError) {
                    errorCount++;
                    console.error('Erreur mise à jour PDF:', updatePdfError);
                } else {
                    successCount++;
                }

            } catch (error) {
                errorCount++;
                console.error('Erreur traitement PDF:', error);
            }
        }

        // Afficher les résultats
        if (successCount > 0 && errorCount === 0) {
            toast.success(`${successCount} PDF(s) traité(s) avec succès`);
        } else if (successCount > 0 && errorCount > 0) {
            toast(`${successCount} succès, ${errorCount} erreur(s)`, { icon: '⚠️' });
        } else if (errorCount > 0) {
            toast.error(`${errorCount} erreur(s) lors de la suppression des liens`);
        }

        // Invalider le cache et rafraîchir (même si erreurs partielles)
        if (successCount > 0) {
            try {
                await invalidateCache(entreprise_id, user_id);
                toast.loading('Rafraîchissement des données...', { id: 'refresh-delete-links' });
                await onRefreshData();
                toast.success('Données rafraîchies', { id: 'refresh-delete-links' });
                setSelectedPdfIds([]);
            } catch (refreshError) {
                console.error('Erreur lors du rafraîchissement:', refreshError);
                toast.error('Erreur lors du rafraîchissement (les suppressions ont été effectuées)');
            }
        }

    } catch (error) {
        console.error('Erreur inattendue lors de la suppression des liens:', error);
        toast.error('Erreur inattendue lors de la suppression des liens BSD');
    } finally {
        setProcessingDeleteLinks(false);
    }
};

