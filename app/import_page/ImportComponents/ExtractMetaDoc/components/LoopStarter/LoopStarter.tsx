'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from '@/app/component/SessionProvider';
import { supabase } from '@/app/database/supabaseClient';
import { processPdfList } from '../../utils/loop';
import { LINK_CONFIGS, getLinkConfigById } from '../../utils/default_auto_link_params';
import { toast } from 'react-hot-toast';
import Swal from 'sweetalert2';
import BoxIcon from '@/app/component/BoxIconWrapper';
import ExtractDoc from '../ExtractDoc';
import MetaClusterParamsTab from '@/app/auth/parameter/components/MetaClusterParams/MetaClusterParamsTab';
import {
    PdfInfo,
    SiteInfo,
    FilterState,
    FilterOptions,
    ProcessingResult,
    LoopStarterProps,
    FilterState as FilterStateType
} from './LoopStarterTypes';
import { MultiSelect, getAlerteFlags, getAllPossibleAlerteFlags, getFlagValueFromLabel, getAllPossibleLinkageStatuses, getFlagsFromValues, getAllMustFlagValues, getAllNiceFlagValues } from './LoopStarterFilters';
import { calculateCoverage, getCoverageColor } from '../../utils/coverage';
import {
    refreshData,
    handleProcessPdfs,
    handleSplitOnly,
    handleSmartSplit,
    handleExtractOnly,
    handleAutoLinkSelected,
    handleAutoProposeSelected,
    handlePushSelected,
    handleCheckAlertes,
    handleDeleteLinksSelected,
    loadPauseState,
    clearPauseState
} from './LoopStarterHandlers';

const ALERT_TOOLTIP_MAPPING_KEYWORDS: readonly string[] = [
    'site',
    'site(s) facture',
    'prestataire',
    'presta',
    'contenant',
    'opération',
    'operation',
    'unité',
    'unite'
];

const ALERT_TOOLTIP_STATUS_KEYWORDS: readonly string[] = [
    'inconnu',
    'inconnue',
    'inconnus',
    'inconnues',
    'non reconnu',
    'non reconnue',
    'non reconnus',
    'non reconnues',
    'non affilié',
    'non affiliée',
    'non affiliés',
    'non affiliées'
];

const buildAlerteTooltip = (message: string): string => {
    if (!message) return '';

    const segments = message
        .split(/;\s*/)
        .map(segment => segment.trim())
        .filter(Boolean);

    const filteredSegments = segments.filter(segment => {
        const lowerSegment = segment.toLowerCase();
        const mentionsMappingKeyword = ALERT_TOOLTIP_MAPPING_KEYWORDS.some(keyword => lowerSegment.includes(keyword));
        if (!mentionsMappingKeyword) {
            return true;
        }
        const mentionsStatusKeyword = ALERT_TOOLTIP_STATUS_KEYWORDS.some(keyword => lowerSegment.includes(keyword));
        if (!mentionsStatusKeyword) {
            return true;
        }
        return false;
    });

    return filteredSegments.join('\n');
};

const LoopStarter: React.FC<LoopStarterProps> = ({ isOpen = true, onClose }) => {
    const { entreprise_id, user_id } = useSession();
    const [pdfInfos, setPdfInfos] = useState<PdfInfo[]>([]);
    const [sites, setSites] = useState<SiteInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingSplitThenExtract, setProcessingSplitThenExtract] = useState(false);
    const [processingSplitOnly, setProcessingSplitOnly] = useState(false);
    const [processingExtractOnly, setProcessingExtractOnly] = useState(false);
    const [processingAutoLink, setProcessingAutoLink] = useState(false);
    const [processingAutoPropose, setProcessingAutoPropose] = useState(false);
    const [processingAlertes, setProcessingAlertes] = useState(false);
    const [processingPush, setProcessingPush] = useState(false);
    const [processingSmartSplit, setProcessingSmartSplit] = useState(false);
    const [processingDeleteLinks, setProcessingDeleteLinks] = useState(false);
    const [autoLinkPhase, setAutoLinkPhase] = useState<'idle' | 'simulation' | 'confirmation' | 'applying'>('idle');
    const [selectedPdfIds, setSelectedPdfIds] = useState<string[]>([]);
    const [processingResults, setProcessingResults] = useState<ProcessingResult[]>([]);
    const [showReview, setShowReview] = useState(false);
    
    // Configuration de linkage sélectionnée
    const [selectedConfigId, setSelectedConfigId] = useState<string>('id_based');
    
    const normalConfig = useMemo(() => {
        return getLinkConfigById('normal') || LINK_CONFIGS[0];
    }, []);

    // Obtenir la configuration actuelle
    const currentConfig = useMemo(() => {
        return getLinkConfigById(selectedConfigId) || normalConfig; // fallback sur Normal
    }, [selectedConfigId, normalConfig]);
    
    // Pause/Reprise en cas d'absence d'exemple RAG
    const [paused, setPaused] = useState(false);
    const [pausedPdfId, setPausedPdfId] = useState<string | null>(null);
    const [pausedAtIndex, setPausedAtIndex] = useState<number | null>(null);
    const [resumeMode, setResumeMode] = useState<'split_then_extract' | 'extract_only' | null>(null);
    const [showExtractModal, setShowExtractModal] = useState(false);
    
    // Extraction manuelle depuis le bouton de la ligne
    const [manualExtractPdfId, setManualExtractPdfId] = useState<string | null>(null);
    const [manualExtractPdfData, setManualExtractPdfData] = useState<PdfInfo | null>(null);
    const [loadingManualPdf, setLoadingManualPdf] = useState(false);
    
    // Modal d'association des mots-clés
    const [showAssociationModal, setShowAssociationModal] = useState(false);
    
    // Vue des colonnes (pour simplifier l'affichage)
    const [columnView, setColumnView] = useState<'all' | 'info' | 'analyse' | 'actions'>('all');
    
    // Déterminer quelles colonnes afficher selon la vue
    const shouldShowColumn = (columnIndex: number): boolean => {
        // Masquer les colonnes Spec (13), Manuscrit (14) et Taille (4) pour l'instant
        if (columnIndex === 4 || columnIndex === 13 || columnIndex === 14) return false;
        
        if (columnView === 'all') return true;
        
        // Vue Info : colonnes 1-7 (Checkbox, Temps, Nom, Taille, Type, Statut, Site, Provider)
        if (columnView === 'info') {
            return [1,2,3,4,5,6,7,8,17].includes(columnIndex)
        }
        
        // Vue Analyse : colonnes 1, 8-14 (Checkbox + Presta, Pages, Déchets, Lignes, Brute, Spec, Manusc)
        if (columnView === 'analyse') {
            return [1,3,9,10,11,12,13,14,15,16,18,19].includes(columnIndex)
        }
        
        // Vue Actions : colonnes 1, 15-18 (Checkbox + Couvert, Type d'alerte, Linkage, Actions)
        if (columnView === 'actions') {
            return [1,3,16,17,18].includes(columnIndex)
        }
        
        return true;
    };
    
    // États des filtres multiselect - Chargés depuis localStorage
    const [filters, setFilters] = useState<FilterState>(() => {
        const defaultFilters: FilterState = {
            alerteStop: null,
            alerteFlags: [],
            providers: [],
            siteSirets: [],
            documentTypes: [],
            statuses: [],
            pages: '',
            confidenceBrute: '',
            confidenceSpec: '',
            handwrittenPercent: '',
            coveragePercent: '',
            importTimeValue: '',
            importTimeUnit: 'h',
            linkageStatuses: [],
            ragIds: [],
            confidenceBruteMode: 'gte',
            confidenceSpecMode: 'gte',
            handwrittenPercentMode: 'gte',
            coveragePercentMode: 'gte'
        };
        
        try {
            const saved = localStorage.getItem('loopStarter:filters');
            if (saved) {
                const parsedFilters = JSON.parse(saved);
                // Fusionner avec les valeurs par défaut pour s'assurer que tous les champs existent
                return {
                    ...defaultFilters,
                    ...parsedFilters,
                    // S'assurer que alerteFlags est toujours un array
                    alerteFlags: Array.isArray(parsedFilters.alerteFlags) ? parsedFilters.alerteFlags : [],
                    // S'assurer que linkageStatuses est toujours un array
                    linkageStatuses: Array.isArray(parsedFilters.linkageStatuses) ? parsedFilters.linkageStatuses : [],
                    ragIds: Array.isArray(parsedFilters.ragIds) ? parsedFilters.ragIds : []
                };
            }
        } catch (error) {
            console.error('Erreur chargement filtres:', error);
        }
        return defaultFilters;
    });
    
    // État pour la recherche par nom - Chargé depuis localStorage
    const [searchName, setSearchName] = useState(() => {
        try {
            return localStorage.getItem('loopStarter:searchName') || '';
        } catch (error) {
            console.error('Erreur chargement searchName:', error);
            return '';
        }
    });
    
    // Sauvegarder les filtres dans localStorage à chaque changement
    useEffect(() => {
        try {
            localStorage.setItem('loopStarter:filters', JSON.stringify(filters));
        } catch (error) {
            console.error('Erreur sauvegarde filtres:', error);
        }
    }, [filters]);
    
    // Sauvegarder la recherche par nom dans localStorage à chaque changement
    useEffect(() => {
        try {
            localStorage.setItem('loopStarter:searchName', searchName);
        } catch (error) {
            console.error('Erreur sauvegarde searchName:', error);
        }
    }, [searchName]);

    // Options pour les filtres (seront remplies depuis la BDD)
    const [filterOptions, setFilterOptions] = useState<FilterOptions>({
        providers: [],
        sites: [],
        documentTypes: [],
        statuses: [],
        alerteFlags: getAllPossibleAlerteFlags(),
        linkageStatuses: getAllPossibleLinkageStatuses(),
        ragIds: []
    });

    // Wrapper pour refreshData
    const handleRefreshData = useCallback(async () => {
        await refreshData(entreprise_id || undefined, setPdfInfos, setSites, setFilterOptions);
    }, [entreprise_id]);

    // Charger les PDFs et les options de filtres depuis la BDD au montage
    useEffect(() => {
        const fetchData = async () => {
            if (!entreprise_id) return;
            
            setLoading(true);
            try {
                await handleRefreshData();
            } catch (error) {
                console.error('Erreur lors du chargement initial des données:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [entreprise_id, handleRefreshData]);

    // Charger les données du PDF manuel si non disponibles localement
    useEffect(() => {
        const loadManualPdfData = async () => {
            if (!manualExtractPdfId || !entreprise_id) {
                setManualExtractPdfData(null);
                return;
            }

            // Vérifier si le PDF est déjà dans pdfInfos (snapshot au moment du clic)
            const localPdf = pdfInfos.find(p => p.id === manualExtractPdfId);
            if (localPdf) {
                setManualExtractPdfData(localPdf);
                return;
            }

            // Charger depuis la base de données seulement si pas trouvé localement
            setLoadingManualPdf(true);
            try {
                const { data: pdfData, error: pdfError } = await supabase
                    .from('pdf_infos')
                    .select('*')
                    .eq('id', manualExtractPdfId)
                    .eq('entreprise_id', entreprise_id)
                    .single();

                if (pdfError) {
                    console.error('Erreur chargement PDF:', pdfError);
                    toast.error('Erreur lors du chargement du PDF');
                    setManualExtractPdfId(null);
                    setManualExtractPdfData(null);
                    return;
                }

                if (pdfData) {
                    setManualExtractPdfData(pdfData as PdfInfo);
                } else {
                    toast.error('PDF non trouvé');
                    setManualExtractPdfId(null);
                    setManualExtractPdfData(null);
                }
            } catch (error) {
                console.error('Erreur lors du chargement du PDF:', error);
                toast.error('Erreur lors du chargement du PDF');
                setManualExtractPdfId(null);
                setManualExtractPdfData(null);
            } finally {
                setLoadingManualPdf(false);
            }
        };

        loadManualPdfData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [manualExtractPdfId, entreprise_id]);

    // Flag pour éviter d'afficher le Swal plusieurs fois
    const [pauseCheckDone, setPauseCheckDone] = useState(false);
    
    // Reset le flag quand le modal se ferme pour pouvoir revérifier à la prochaine ouverture
    useEffect(() => {
        if (!isOpen) {
            setPauseCheckDone(false);
        }
    }, [isOpen]);
    
    // Vérifier au mount s'il existe un état de pause sauvegardé dans localStorage
    useEffect(() => {
        const checkForPausedState = async () => {
            // Vérifications de base : ne rien faire si le LoopStarter n'est pas ouvert
            if (!isOpen || !entreprise_id || loading || pauseCheckDone) return;
            
            // Attendre que pdfInfos soit chargé (au moins 1 élément ou loading=false depuis assez longtemps)
            if (pdfInfos.length === 0 && !loading) {
                // On attend un peu pour être sûr que les données sont chargées
                setTimeout(() => checkForPausedState(), 500);
                return;
            }
            
            const pauseState = loadPauseState();
            if (!pauseState) {
                setPauseCheckDone(true);
                return;
            }
            
            // Vérifier que l'entreprise_id correspond
            if (pauseState.entreprise_id !== entreprise_id) {
                // Mauvaise entreprise, supprimer l'état
                clearPauseState();
                setPauseCheckDone(true);
                return;
            }
            
            // Marquer comme vérifié pour éviter de re-trigger
            setPauseCheckDone(true);
            
            // Afficher immédiatement le Swal de reprise
            const result = await Swal.fire({
                title: '⚠️ Traitement en pause',
                html: `
                    <div class="text-left">
                        <div class="mb-3 p-3 bg-yellow-50 rounded border-l-4 border-yellow-400">
                            <div class="font-medium text-yellow-800 mb-2">Un traitement a été interrompu</div>
                            <div class="text-sm text-yellow-700 mb-2">
                                Mode: <strong>${pauseState.resumeMode === 'split_then_extract' ? 'Split + Extract' : 'Extract Only'}</strong>
                            </div>
                            <div class="text-xs text-yellow-600 mb-2">
                                Document en pause: ${pauseState.pausedPdfId}
                            </div>
                            <div class="text-xs text-yellow-600 font-mono bg-yellow-100 p-2 rounded">
                                ${pauseState.errorMessage}
                            </div>
                        </div>
                        <div class="mb-3 p-2 bg-blue-50 rounded text-sm text-blue-800">
                            <div class="font-medium mb-1">📊 Progression:</div>
                            <div>• Documents sélectionnés: ${pauseState.selectedPdfIds.length}</div>
                            <div>• Index de pause: ${pauseState.pausedAtIndex}</div>
                            <div>• Documents restants: ${pauseState.selectedPdfIds.length - pauseState.pausedAtIndex}</div>
                        </div>
                        <div class="p-2 bg-gray-50 rounded text-xs text-gray-600">
                            💡 Voulez-vous reprendre le traitement là où il s'est arrêté ?
                        </div>
                    </div>
                `,
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: '🔄 Reprendre',
                denyButtonText: '⏭️ Sauter ce document',
                cancelButtonText: '❌ Annuler',
                confirmButtonColor: '#3b82f6',
                denyButtonColor: '#f59e0b',
                cancelButtonColor: '#6b7280',
                allowOutsideClick: false,
                width: '600px'
            });
            
            if (result.isConfirmed) {
                // Reprendre: NE PAS supprimer localStorage tout de suite (le succès le fera)
                setPaused(false);
                
                // Reprendre depuis pausedAtIndex (INCLUS pour réessayer le document échoué)
                const remainingPdfIds = pauseState.selectedPdfIds.slice(pauseState.pausedAtIndex);
                if (remainingPdfIds.length === 0) {
                    toast.success('Plus aucun document à traiter.');
                    clearPauseState();
                    return;
                }
                
                setSelectedPdfIds(remainingPdfIds);
                
                // Relancer en fonction du mode avec isResuming=true pour accumuler les résultats
                if (pauseState.resumeMode === 'split_then_extract') {
                    await handleProcessPdfs(
                        remainingPdfIds,
                        pauseState.entreprise_id,
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
                        handleRefreshData,
                        true // isResuming = true
                    );
                } else if (pauseState.resumeMode === 'extract_only') {
                    await handleExtractOnly(
                        remainingPdfIds,
                        pauseState.entreprise_id,
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
                        handleRefreshData,
                        true // isResuming = true
                    );
                }
            } else if (result.isDenied) {
                const skipIndex = pauseState.pausedAtIndex ?? 0;
                const skippedPdfId = pauseState.selectedPdfIds[skipIndex];
                const remainingPdfIds = pauseState.selectedPdfIds.slice(skipIndex + 1);

                clearPauseState();
                setPaused(false);
                setPausedPdfId(null);
                setPausedAtIndex(null);
                setResumeMode(null);

                if (skippedPdfId) {
                    const skippedPdf = pdfInfos.find(p => p.id === skippedPdfId);
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

                if (pauseState.resumeMode === 'split_then_extract') {
                    await handleProcessPdfs(
                        remainingPdfIds,
                        pauseState.entreprise_id,
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
                        handleRefreshData,
                        true
                    );
                } else if (pauseState.resumeMode === 'extract_only') {
                    await handleExtractOnly(
                        remainingPdfIds,
                        pauseState.entreprise_id,
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
                        handleRefreshData,
                        true
                    );
                }
            } else {
                // Annuler: supprimer localStorage
                clearPauseState();
                setPaused(false);
                setPausedPdfId(null);
                setPausedAtIndex(null);
                setResumeMode(null);
            }
        };
        
        // Ne se déclenche qu'une fois que loading passe à false ET que le modal est ouvert
        if (isOpen && !loading && !pauseCheckDone) {
            checkForPausedState();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, entreprise_id, loading, pauseCheckDone]);

    // Évaluer un filtre de pourcentage avec mode (gte = >=, lte = <=)
    const evaluatePercentageFilter = useCallback((value: number | undefined, filter: string, mode: 'gte' | 'lte' = 'gte'): boolean => {
        // Si pas de filtre, laisser passer
        if (!filter) return true;
        
        const trimmed = filter.trim();
        if (!trimmed) return true;

        // Si la valeur est undefined, la traiter comme 0
        const actualValue = value !== undefined ? value : 0;

        // Parser le seuil (nombre entier)
        const threshold = parseInt(trimmed, 10);
        
        // Si c'est un nombre valide, vérifier selon le mode
        if (!isNaN(threshold)) {
            return mode === 'gte' ? actualValue >= threshold : actualValue <= threshold;
        }
        
        return true;
    }, []);

    // Filtrer les PDFs selon les critères multiselect
    const filteredPdfs = useMemo(() => {
        return pdfInfos.filter(pdf => {
            // Exclure systématiquement les fichiers Excel
            if (pdf.document_type === 'excel') return false;
            
            // Filtre par nom (recherche)
            if (searchName.trim()) {
                const pdfName = (pdf.name_pdf || '').toLowerCase();
                if (!pdfName.includes(searchName.toLowerCase().trim())) {
                    return false;
                }
            }
            
            // Filtre alerte.stop
            if (filters.alerteStop !== null) {
                const alerteStop = pdf.alerte?.stop === true;
                if (alerteStop !== filters.alerteStop) return false;
            }

            // Filtre alertes par flags (multiselect granulaire)
            if (filters.alerteFlags && Array.isArray(filters.alerteFlags) && filters.alerteFlags.length > 0) {
                const alerteData = pdf.alerte && typeof pdf.alerte === 'object'
                    ? pdf.alerte as { message?: string; flags?: string[] }
                    : undefined;
                const alerteMessage = alerteData?.message || '';
                const explicitFlagValues = Array.isArray(alerteData?.flags)
                    ? (alerteData.flags as string[]).filter(flag => typeof flag === 'string')
                    : [];
                
                const pdfFlagValues = explicitFlagValues.length > 0
                    ? explicitFlagValues
                    : getAlerteFlags(alerteMessage).map(flag => getFlagValueFromLabel(flag.label));
                
                // Vérifier si au moins un des flags sélectionnés est présent
                const hasMatchingFlag = filters.alerteFlags.some(selectedFlag => 
                    pdfFlagValues.includes(selectedFlag)
                );
                
                if (!hasMatchingFlag) return false;
            }

            // Filtre id_rag (traité comme texte)
            if (filters.ragIds.length > 0) {
                const rawRagValue = typeof pdf.id_rag === 'string' ? pdf.id_rag : String(pdf.id_rag ?? '');
                const ragValue = rawRagValue.trim();
                const wantsNone = filters.ragIds.includes('__NONE__');
                const otherSelections = filters.ragIds.filter(value => value !== '__NONE__');

                if (!ragValue) {
                    if (!wantsNone) return false;
                } else {
                    if (
                        otherSelections.length === 0 ||
                        !otherSelections.some(selected => {
                            const normalizedSelected = typeof selected === 'string' ? selected : String(selected ?? '');
                            return ragValue.toLowerCase().includes(normalizedSelected.toLowerCase());
                        })
                    ) {
                        return false;
                    }
                }
            }

            // Filtre providers (multiselect) - filtrer sur nom ou SIRET uniquement
            if (filters.providers.length > 0 && pdf.provider) {
                const provider = pdf.provider as Record<string, unknown>;
                const nom = (provider.nom || provider.name || '').toString().toLowerCase();
                const siret = (provider.siret || '').toString().toLowerCase();
                const providerText = `${nom} ${siret}`.trim();
                
                const hasMatchingProvider = filters.providers.some(filterValue => {
                    // Le filterValue est au format "nom|siret"
                    const [filterNom, filterSiret] = filterValue.split('|').map(s => s.toLowerCase());
                    // Vérifier si le nom ou le SIRET correspond
                    return providerText.includes(filterNom) || (filterSiret && providerText.includes(filterSiret));
                });
                if (!hasMatchingProvider) return false;
            }

            // Filtre site_siret_plus (multiselect)
            if (filters.siteSirets.length > 0 && pdf.site_siret_plus) {
                const hasMatchingSite = pdf.site_siret_plus.some(siret => 
                    filters.siteSirets.some(filterSiret => siret.includes(filterSiret))
                );
                if (!hasMatchingSite) return false;
            }

            // Filtre document_type (multiselect)
            if (filters.documentTypes.length > 0 && pdf.document_type) {
                if (!filters.documentTypes.includes(pdf.document_type)) {
                    return false;
                }
            }

            // Filtre status (multiselect)
            if (filters.statuses.length > 0 && pdf.status) {
                if (!filters.statuses.includes(pdf.status)) {
                    return false;
                }
            }

            // Filtre nombre de pages
            if (filters.pages) {
                const pages = typeof pdf.nb_pages === 'number' ? pdf.nb_pages : 0;
                if (filters.pages === 'one' && pages !== 1) return false;
                if (filters.pages === 'multi' && pages <= 1) return false;
            }

            // Filtre temps depuis import
            if (filters.importTimeValue) {
                const timeValue = parseFloat(filters.importTimeValue);
                if (!isNaN(timeValue) && timeValue > 0) {
                    const timeElapsed = Date.now() - new Date(pdf.created_at).getTime();
                    const hoursElapsed = timeElapsed / (1000 * 60 * 60);
                    
                    // Convertir la valeur en heures selon l'unité
                    const maxHours = filters.importTimeUnit === 'd' 
                        ? timeValue * 24  // Convertir jours en heures
                        : timeValue;      // Déjà en heures
                    
                    if (hoursElapsed > maxHours) return false;
                }
            }

            // Filtres de pourcentage pour les scores de confiance
            const confidence = pdf.confidence as { brute?: number; spec?: number; handwritten?: [number, boolean] } | null | undefined;
            
            // Confiance brute : si pas de données, traiter comme 0
            if (filters.confidenceBrute) {
                const brutePct = confidence?.brute !== undefined ? Math.round(confidence.brute) : undefined;
                if (!evaluatePercentageFilter(brutePct, filters.confidenceBrute, filters.confidenceBruteMode || 'gte')) return false;
            }
            
            // Confiance spécifique : si pas de données, traiter comme 0
            if (filters.confidenceSpec) {
                const specPct = confidence?.spec !== undefined ? Math.round(confidence.spec) : undefined;
                if (!evaluatePercentageFilter(specPct, filters.confidenceSpec, filters.confidenceSpecMode || 'gte')) return false;
            }
            
            // Manuscrit : si pas de données ou manuscrit non détecté, traiter comme 0
            if (filters.handwrittenPercent) {
                const handwrittenPct = (confidence?.handwritten && confidence.handwritten[1]) 
                    ? Math.round(confidence.handwritten[0]) 
                    : undefined;
                if (!evaluatePercentageFilter(handwrittenPct, filters.handwrittenPercent, filters.handwrittenPercentMode || 'gte')) return false;
            }
            
            // Couverture : si pas de données, traiter comme 0
            if (filters.coveragePercent) {
                const coverage = calculateCoverage(pdf.infos_raw, pdf.document_type);
                if (!evaluatePercentageFilter(coverage.percentage, filters.coveragePercent, filters.coveragePercentMode || 'gte')) return false;
            }

            // Filtre statut de linkage
            if (filters.linkageStatuses && filters.linkageStatuses.length > 0) {
                const bsdLinked = pdf.bsd_linked as Array<{
                    index_dechet: number;
                    status: 'created' | 'linked' | 'pushed' | 'check_by_user' | 'to_check_by_user';
                    bsd_id?: string;
                }> | null | undefined;
                
                // Si le filtre "none" est sélectionné
                if (filters.linkageStatuses.includes('none')) {
                    // Si aucun lien n'existe et que 'none' est sélectionné, on garde
                    if (!bsdLinked || !Array.isArray(bsdLinked) || bsdLinked.length === 0) {
                        // Ne rien faire, on garde le PDF
                    } else if (filters.linkageStatuses.length === 1) {
                        // Si seulement 'none' est sélectionné et qu'il y a des liens, on filtre
                        return false;
                    }
                }
                
                // Si des liens existent, vérifier les statuts
                if (bsdLinked && Array.isArray(bsdLinked) && bsdLinked.length > 0) {
                    // Vérifier si au moins un lien a un statut correspondant
                    const hasMatchingStatus = bsdLinked.some(link => 
                        filters.linkageStatuses.includes(link.status)
                    );
                    
                    if (!hasMatchingStatus) {
                        // Si 'none' n'est pas dans les filtres et qu'aucun statut ne correspond
                        if (!filters.linkageStatuses.includes('none')) {
                            return false;
                        }
                    }
                } else {
                    // Pas de liens, garder seulement si 'none' est dans les filtres
                    if (!filters.linkageStatuses.includes('none')) {
                        return false;
                    }
                }
            }

            return true;
        });
    }, [pdfInfos, filters, searchName, evaluatePercentageFilter]);

    // Gérer la sélection/désélection de tous les PDFs
    const handleSelectAll = () => {
        if (selectedPdfIds.length === filteredPdfs.length) {
            setSelectedPdfIds([]);
        } else {
            setSelectedPdfIds(filteredPdfs.map(pdf => pdf.id));
        }
    };

    // Gérer la sélection d'un PDF individuel
    const handleSelectPdf = (pdfId: string) => {
        setSelectedPdfIds(prev => 
            prev.includes(pdfId) 
                ? prev.filter(id => id !== pdfId)
                : [...prev, pdfId]
        );
    };

    const anyProcessing = processingSplitThenExtract || processingSplitOnly || processingExtractOnly || processingAutoPropose || processingSmartSplit || processingDeleteLinks;

    // Obtenir le nom du site à partir du SIRET
    const getSiteName = (siret: string): string => {
        const site = sites.find(s => s.siret === siret);
        return site ? site.name : siret;
    };

    // Réinitialiser tous les filtres
    const handleResetFilters = () => {
        setFilters({
            alerteStop: null,
            alerteFlags: [],
            providers: [],
            siteSirets: [],
            documentTypes: [],
            statuses: [],
            pages: '',
            confidenceBrute: '',
            confidenceSpec: '',
            handwrittenPercent: '',
            coveragePercent: '',
            importTimeValue: '',
            importTimeUnit: 'h',
            linkageStatuses: [],
            ragIds: [],
            confidenceBruteMode: 'gte',
            confidenceSpecMode: 'gte',
            handwrittenPercentMode: 'gte',
            coveragePercentMode: 'gte'
        });
        setSearchName('');
    };

    if (!isOpen) return null;

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
                    <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-2">Chargement des PDFs...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-sm w-full h-full max-w-[99%] max-h-[99%] overflow-y-auto border border-gray-100">
                <div className="p-2">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-xl font-semibold text-gray-700">
                            Traitement des documents PDF
                        </h2>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-sm hover:bg-gray-50 transition-colors"
                            >
                                <BoxIcon name="x" size="20" />
                            </button>
                        )}
                    </div>

                    {/* Tableau des PDFs */}
                    <div className="bg-white border border-gray-100 rounded-md overflow-hidden">
                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3 hidden">
                                    <input
                                        type="checkbox"
                                        checked={selectedPdfIds.length === filteredPdfs.length && filteredPdfs.length > 0}
                                        onChange={handleSelectAll}
                                        className="h-3.5 w-3.5 text-blue-500 focus:ring-0.5 focus:ring-blue-300 border-gray-200 rounded-sm"
                                    />
                                    <span className="font-medium text-gray-600 text-sm">Sélectionner tous</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">
                                        {filteredPdfs.length} document{filteredPdfs.length > 1 ? 's' : ''}
                                    </span>
                                    <button
                                        onClick={async () => {
                                            toast.loading('Rafraîchissement manuel...', { id: 'refresh-manual' });
                                            await handleRefreshData();
                                            toast.success('Données rafraîchies !', { id: 'refresh-manual' });
                                        }}
                                        className="text-xs px-2 py-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-sm transition-colors flex items-center gap-1"
                                        title="Rafraîchir les données"
                                    >
                                        <BoxIcon name="bx-refresh" size="14" />
                                        Refresh
                                    </button>
                                    <button
                                        onClick={handleResetFilters}
                                        className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-sm transition-colors flex items-center gap-1"
                                        title="Réinitialiser les filtres"
                                    >
                                        <BoxIcon name="bx-reset" size="14" />
                                        Reset
                                    </button>
                                    <button
                                        onClick={() => setShowAssociationModal(true)}
                                        className="text-xs px-2 py-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-sm transition-colors flex items-center gap-1"
                                        title="Associer les mots-clés aux entités de référence"
                                    >
                                        <BoxIcon name="bx-link-alt" size="14" />
                                        Association
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="max-h-[calc(95vh-300px)] overflow-y-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-2 py-1.5 text-left bg-gray-50" style={{ display: shouldShowColumn(1) ? '' : 'none' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedPdfIds.length === filteredPdfs.length && filteredPdfs.length > 0}
                                                onChange={handleSelectAll}
                                                className="h-3.5 w-3.5 text-blue-500 focus:ring-0.5 focus:ring-blue-300 border-gray-200 rounded-sm"
                                            />
                                        </th>
                                        <th className="px-1 py-1.5 text-left bg-gray-50 w-[55px]" style={{ display: shouldShowColumn(2) ? '' : 'none' }}>
                                            <div className="text-xs font-medium text-gray-600 mb-0.5">Temps</div>
                                            <div className="flex gap-0.5">
                                                <input
                                                    type="number"
                                                    placeholder="≤"
                                                    value={filters.importTimeValue}
                                                    onChange={(e) => setFilters(prev => ({ ...prev, importTimeValue: e.target.value }))}
                                                    className="w-[28px] p-0.5 text-[10px] border border-gray-200 rounded-sm focus:outline-none focus:ring-0.5 focus:ring-blue-300 bg-white"
                                                    title="Filtrer par temps depuis import (ex: 6)"
                                                    min="0"
                                                    step="0.5"
                                                />
                                                <select
                                                    value={filters.importTimeUnit}
                                                    onChange={(e) => setFilters(prev => ({ ...prev, importTimeUnit: e.target.value as FilterStateType['importTimeUnit'] }))}
                                                    className="w-[20px] p-0.5 text-[10px] border border-gray-200 rounded-sm focus:outline-none focus:ring-0.5 focus:ring-blue-300 bg-white"
                                                    title="Unité de temps"
                                                >
                                                    <option value="h">h</option>
                                                    <option value="d">j</option>
                                                </select>
                                            </div>
                                        </th>
                                        <th className="px-2 py-1.5 text-left bg-gray-50 w-[140px]" style={{ display: shouldShowColumn(3) ? '' : 'none' }}>
                                            <div className="text-xs font-medium text-gray-600 mb-1">Nom</div>
                                            <input
                                                type="text"
                                                placeholder="Rechercher..."
                                                value={searchName}
                                                onChange={(e) => setSearchName(e.target.value)}
                                                className="w-full p-1 text-xs border border-gray-200 rounded-sm focus:outline-none focus:ring-0.5 focus:ring-blue-300 bg-white"
                                            />
                                        </th>
                                        <th className="px-2 py-1.5 text-left bg-gray-50 min-w-[60px]" style={{ display: shouldShowColumn(4) ? '' : 'none' }}>
                                            <div className="text-xs font-medium text-gray-600 mb-1">Taille</div>
                                        </th>
                                        <th className="px-2 py-1.5 text-left w-[100px] bg-gray-50" style={{ display: shouldShowColumn(5) ? '' : 'none' }}>
                                            <div className="text-xs font-medium text-gray-600 mb-1">Type</div>
                            <MultiSelect
                                options={filterOptions.documentTypes}
                                selectedValues={filters.documentTypes}
                                onChange={(values) => setFilters(prev => ({ ...prev, documentTypes: values }))}
                                                placeholder="Tous"
                                                label=""
                            />
                                        </th>
                                        <th className="px-2 py-1.5 text-left w-[100px] bg-gray-50" style={{ display: shouldShowColumn(6) ? '' : 'none' }}>
                                            <div className="text-xs font-medium text-gray-600 mb-1">Statut</div>
                            <MultiSelect
                                options={filterOptions.statuses}
                                selectedValues={filters.statuses}
                                onChange={(values) => setFilters(prev => ({ ...prev, statuses: values }))}
                                                placeholder="Tous"
                                                label=""
                            />
                                        </th>
                                        <th className="px-2 py-1.5 text-left bg-gray-50" style={{ display: shouldShowColumn(7) ? '' : 'none', width: '70px' }}>
                                            <div className="text-xs font-medium text-gray-600 mb-1">Site</div>
                            <MultiSelect
                                options={filterOptions.sites}
                                selectedValues={filters.siteSirets}
                                onChange={(values) => setFilters(prev => ({ ...prev, siteSirets: values }))}
                                                placeholder="Tous"
                                                label=""
                                className="w-[60px]"
                            />
                                        </th>
                                        <th className="px-2 py-1.5 text-left bg-gray-50" style={{ display: shouldShowColumn(8) ? '' : 'none', width: '70px' }}>
                                            <div className="text-xs font-medium text-gray-600 mb-1">Presta</div>
                            <MultiSelect
                                options={filterOptions.providers}
                                selectedValues={filters.providers}
                                onChange={(values) => setFilters(prev => ({ ...prev, providers: values }))}
                                                placeholder="Tous"
                                                label=""
                                className="w-[60px]"
                            />
                                        </th>
                                        <th className="px-1 py-1.5 text-left bg-gray-50 w-[45px]" style={{ display: shouldShowColumn(9) ? '' : 'none' }}>
                                            <div className="text-[10px] font-medium text-gray-600 mb-0.5">Pages</div>
                                            <select
                                                value={filters.pages}
                                                onChange={(e) => setFilters(prev => ({ ...prev, pages: e.target.value as FilterStateType['pages'] }))}
                                                className="w-full p-0.5 text-[10px] border border-gray-200 rounded-sm focus:outline-none focus:ring-0.5 focus:ring-blue-300 bg-white"
                                            >
                                                <option value="">Tous</option>
                                                <option value="one">1</option>
                                                <option value="multi">+</option>
                                            </select>
                                        </th>
                                        <th className="px-1 py-1.5 text-left bg-gray-50 w-[45px]" style={{ display: shouldShowColumn(10) ? '' : 'none' }}>
                                            <div className="text-[10px] font-medium text-gray-600 mb-0.5">Déchets</div>
                                        </th>
                                        <th className="px-1 py-1.5 text-left bg-gray-50 w-[45px]" style={{ display: shouldShowColumn(11) ? '' : 'none' }}>
                                            <div className="text-[10px] font-medium text-gray-600 mb-0.5">Lignes</div>
                                        </th>
                                        <th className="px-1 py-1.5 text-left bg-gray-50 w-[40px]" style={{ display: shouldShowColumn(12) ? '' : 'none' }}>
                                            <div className="text-[10px] font-medium text-gray-600 mb-0.5">Brute</div>
                                            <div className="flex gap-0.5">
                                                <input
                                                    type="number"
                                                    placeholder="%"
                                                    value={filters.confidenceBrute}
                                                    onChange={(e) => setFilters(prev => ({ ...prev, confidenceBrute: e.target.value }))}
                                                    className="w-[22px] p-0.5 text-[10px] border border-gray-200 rounded-sm focus:outline-none focus:ring-0.5 focus:ring-blue-300 bg-white"
                                                    title={filters.confidenceBruteMode === 'gte' ? 'Seuil minimum (ex: 80 pour ≥80%)' : 'Seuil maximum (ex: 80 pour ≤80%)'}
                                                    min="0"
                                                    max="100"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setFilters(prev => ({ ...prev, confidenceBruteMode: prev.confidenceBruteMode === 'gte' ? 'lte' : 'gte' }))}
                                                    className={`w-[14px] p-0.5 text-[10px] border rounded-sm transition-colors ${
                                                        filters.confidenceBruteMode === 'gte' 
                                                            ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100' 
                                                            : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                                                    }`}
                                                    title={filters.confidenceBruteMode === 'gte' ? 'Supérieur ou égal (≥)' : 'Inférieur ou égal (≤)'}
                                                >
                                                    {filters.confidenceBruteMode === 'gte' ? '≥' : '≤'}
                                                </button>
                                            </div>
                                        </th>
                                        <th className="px-2 py-1.5 text-left bg-gray-50 min-w-[80px]" style={{ display: shouldShowColumn(13) ? '' : 'none' }}>
                                            <div className="text-xs font-medium text-gray-600 mb-1">Spec</div>
                                            <div className="flex gap-1">
                                                <input
                                                    type="number"
                                                    placeholder="%"
                                                    value={filters.confidenceSpec}
                                                    onChange={(e) => setFilters(prev => ({ ...prev, confidenceSpec: e.target.value }))}
                                                    className="w-full p-1 text-xs border border-gray-200 rounded-sm focus:outline-none focus:ring-0.5 focus:ring-blue-300 bg-white"
                                                    title={filters.confidenceSpecMode === 'gte' ? 'Seuil minimum (ex: 80 pour ≥80%)' : 'Seuil maximum (ex: 80 pour ≤80%)'}
                                                    min="0"
                                                    max="100"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setFilters(prev => ({ ...prev, confidenceSpecMode: prev.confidenceSpecMode === 'gte' ? 'lte' : 'gte' }))}
                                                    className={`p-1 text-xs border rounded-sm transition-colors ${
                                                        filters.confidenceSpecMode === 'gte' 
                                                            ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100' 
                                                            : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                                                    }`}
                                                    title={filters.confidenceSpecMode === 'gte' ? 'Supérieur ou égal (≥)' : 'Inférieur ou égal (≤)'}
                                                >
                                                    {filters.confidenceSpecMode === 'gte' ? '≥' : '≤'}
                                                </button>
                                            </div>
                                        </th>
                                        <th className="px-2 py-1.5 text-left bg-gray-50 min-w-[80px]" style={{ display: shouldShowColumn(14) ? '' : 'none' }}>
                                            <div className="text-xs font-medium text-gray-600 mb-1">Manusc</div>
                                            <div className="flex gap-1">
                                                <input
                                                    type="number"
                                                    placeholder="%"
                                                    value={filters.handwrittenPercent}
                                                    onChange={(e) => setFilters(prev => ({ ...prev, handwrittenPercent: e.target.value }))}
                                                    className="w-full p-1 text-xs border border-gray-200 rounded-sm focus:outline-none focus:ring-0.5 focus:ring-blue-300 bg-white"
                                                    title={filters.handwrittenPercentMode === 'gte' ? 'Seuil minimum (ex: 50 pour ≥50%)' : 'Seuil maximum (ex: 50 pour ≤50%)'}
                                                    min="0"
                                                    max="100"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setFilters(prev => ({ ...prev, handwrittenPercentMode: prev.handwrittenPercentMode === 'gte' ? 'lte' : 'gte' }))}
                                                    className={`p-1 text-xs border rounded-sm transition-colors ${
                                                        filters.handwrittenPercentMode === 'gte' 
                                                            ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100' 
                                                            : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                                                    }`}
                                                    title={filters.handwrittenPercentMode === 'gte' ? 'Supérieur ou égal (≥)' : 'Inférieur ou égal (≤)'}
                                                >
                                                    {filters.handwrittenPercentMode === 'gte' ? '≥' : '≤'}
                                                </button>
                                            </div>
                                        </th>
                                        <th className="px-1 py-1.5 text-left bg-gray-50 w-[40px]" style={{ display: shouldShowColumn(15) ? '' : 'none' }}>
                                            <div className="text-[10px] font-medium text-gray-600 mb-0.5">Couvert</div>
                                            <div className="flex gap-0.5">
                                                <input
                                                    type="number"
                                                    placeholder="%"
                                                    value={filters.coveragePercent}
                                                    onChange={(e) => setFilters(prev => ({ ...prev, coveragePercent: e.target.value }))}
                                                    className="w-[22px] p-0.5 text-[10px] border border-gray-200 rounded-sm focus:outline-none focus:ring-0.5 focus:ring-blue-300 bg-white"
                                                    title={filters.coveragePercentMode === 'gte' ? 'Seuil minimum (ex: 70 pour ≥70%)' : 'Seuil maximum (ex: 70 pour ≤70%)'}
                                                    min="0"
                                                    max="100"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setFilters(prev => ({ ...prev, coveragePercentMode: prev.coveragePercentMode === 'gte' ? 'lte' : 'gte' }))}
                                                    className={`w-[14px] p-0.5 text-[10px] border rounded-sm transition-colors ${
                                                        filters.coveragePercentMode === 'gte' 
                                                            ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100' 
                                                            : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                                                    }`}
                                                    title={filters.coveragePercentMode === 'gte' ? 'Supérieur ou égal (≥)' : 'Inférieur ou égal (≤)'}
                                                >
                                                    {filters.coveragePercentMode === 'gte' ? '≥' : '≤'}
                                                </button>
                                            </div>
                                        </th>
                                        <th className="px-2 py-1.5 text-left min-w-[180px] bg-gray-50" style={{ display: shouldShowColumn(16) ? '' : 'none' }}>
                                            <div className="text-xs font-medium text-gray-600 mb-1">Type d&apos;alerte</div>
                                            <div className="flex gap-1 items-center">
                                                <div className="flex-1">
                                                    <MultiSelect
                                                        options={filterOptions.alerteFlags}
                                                        selectedValues={filters.alerteFlags}
                                                        onChange={(values) => setFilters(prev => ({ ...prev, alerteFlags: values }))}
                                                        placeholder="Tous"
                                                        label=""
                                                    />
                                                </div>
                                                <div className="flex gap-1">
                                                    {(() => {
                                                        const mustFlags = getAllMustFlagValues();
                                                        const niceFlags = getAllNiceFlagValues();
                                                        const allFlags = mustFlags.concat(niceFlags);
                                                        const currentFlags = new Set(filters.alerteFlags);
                                                        const allMustSelected = mustFlags.every(flag => currentFlags.has(flag));
                                                        const allNiceSelected = niceFlags.every(flag => currentFlags.has(flag)) && mustFlags.every(flag => currentFlags.has(flag));
                                                        
                                                        return (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (allMustSelected) {
                                                                            // Retirer tous les flags MUST
                                                                            setFilters(prev => ({
                                                                                ...prev,
                                                                                alerteFlags: prev.alerteFlags.filter(flag => !mustFlags.includes(flag))
                                                                            }));
                                                                        } else {
                                                                            // Ajouter tous les flags MUST
                                                                            const combinedFlags = filters.alerteFlags.concat(mustFlags);
                                                                            const newFlagsSet = new Set(combinedFlags);
                                                                            const newFlags = Array.from(newFlagsSet);
                                                                            setFilters(prev => ({ ...prev, alerteFlags: newFlags }));
                                                                        }
                                                                    }}
                                                                    className={`text-xs px-2 py-1 rounded-sm transition-colors border ${
                                                                        allMustSelected
                                                                            ? 'bg-red-500 text-white border-red-600 hover:bg-red-600'
                                                                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                                                    }`}
                                                                    title={allMustSelected ? "Désactiver tous les flags MUST" : "Activer tous les flags MUST"}
                                                                >
                                                                    MUST
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (allNiceSelected) {
                                                                            // Retirer tous les flags (MUST + NICE)
                                                                            setFilters(prev => ({
                                                                                ...prev,
                                                                                alerteFlags: []
                                                                            }));
                                                                        } else {
                                                                            // Ajouter tous les flags (MUST + NICE)
                                                                            setFilters(prev => ({ ...prev, alerteFlags: allFlags }));
                                                                        }
                                                                    }}
                                                                    className={`text-xs px-2 py-1 rounded-sm transition-colors border ${
                                                                        allNiceSelected
                                                                            ? 'bg-gray-500 text-white border-gray-600 hover:bg-gray-600'
                                                                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                                                    }`}
                                                                    title={allNiceSelected ? "Désactiver tous les flags (MUST + NICE)" : "Activer tous les flags (MUST + NICE)"}
                                                                >
                                                                    NICE
                                                                </button>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </th>
                                        <th className="px-2 py-1.5 text-left bg-gray-50 min-w-[120px]" style={{ display: shouldShowColumn(17) ? '' : 'none' }}>
                                            <div className="text-xs font-medium text-gray-600 mb-1">Linkage</div>
                            <MultiSelect
                                options={filterOptions.linkageStatuses}
                                selectedValues={filters.linkageStatuses}
                                onChange={(values) => setFilters(prev => ({ ...prev, linkageStatuses: values }))}
                                                placeholder="Tous"
                                                label=""
                            />
                                        </th>
                                        <th className="px-1 py-1.5 text-left bg-gray-50 w-[65px]" style={{ display: shouldShowColumn(19) ? '' : 'none' }}>
                                            <div className="text-[11px] font-medium text-gray-600 mb-1">RAG</div>
                                            <MultiSelect
                                                options={filterOptions.ragIds}
                                                selectedValues={filters.ragIds}
                                                onChange={(values) => setFilters(prev => ({ ...prev, ragIds: values }))}
                                                placeholder="Tous"
                                                label=""
                                            />
                                        </th>
                                        <th className="px-2 py-1.5 text-left bg-gray-50 min-w-[80px]" style={{ display: shouldShowColumn(18) ? '' : 'none' }}>
                                            <div className="text-xs font-medium text-gray-600 mb-1">Actions</div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                            {filteredPdfs.length === 0 ? (
                                        <tr>
                                            <td colSpan={18} className="p-8 text-center text-gray-500">
                                    <BoxIcon name="bx-file" size="48" className="mx-auto mb-4 text-gray-300" />
                                    <p className="text-lg font-medium">Aucun PDF trouvé</p>
                                    <p className="text-sm">Aucun PDF ne correspond aux critères de filtrage sélectionnés</p>
                                            </td>
                                        </tr>
                                    ) : 
                                        filteredPdfs.map((pdf: PdfInfo) => {
                                            // Calcul du temps écoulé
                                            const timeElapsed = Date.now() - new Date(pdf.created_at).getTime();
                                            const hours = Math.floor(timeElapsed / (1000 * 60 * 60));
                                            const days = Math.floor(hours / 24);
                                            const remainingHours = hours % 24;
                                            const timeDisplay = days > 0 ? `${days}j ${remainingHours}h` : `${hours}h`;
                                            
                                            // Code couleur selon le statut
                                            const timeColor = 
                                                pdf.status === 'linked' || pdf.status === 'pushed' ? 'text-green-600' :
                                                pdf.status === 'read' || pdf.status === 'splitted_extracted' || pdf.status === 'extracted' ? 'text-orange-600' :
                                                'text-red-600';
                                            
                                            // Extraction du nom du provider (nom + SIRET uniquement)
                                            const providerName = pdf.provider && typeof pdf.provider === 'object' 
                                                ? (() => {
                                                    const provider = pdf.provider as Record<string, unknown>;
                                                    const nom = provider.nom || provider.name || '';
                                                    const siret = provider.siret || '';
                                                    return [nom, siret].filter(Boolean).join(' - ') || null;
                                                })()
                                                : null;
                                            
                                            // Message d'alerte
                                            const alerteData = pdf.alerte && typeof pdf.alerte === 'object'
                                                ? pdf.alerte as { message?: string; flags?: string[] }
                                                : undefined;
                                            const alerteMessage = alerteData?.message || '';
                                            const explicitFlagValues = Array.isArray(alerteData?.flags)
                                                ? (alerteData.flags as string[]).filter(flag => typeof flag === 'string')
                                                : [];
                                            const alerteFlags = explicitFlagValues.length > 0
                                                ? getFlagsFromValues(explicitFlagValues)
                                                : getAlerteFlags(alerteMessage);
                                            const alerteTooltip = buildAlerteTooltip(alerteMessage);
                                            
                                            // Scores de confiance
                                            const confidence = pdf.confidence as { brute?: number; spec?: number; handwritten?: [number, boolean] } | null | undefined;
                                            
                                            // Calcul du taux de couverture
                                            const coverage = calculateCoverage(pdf.infos_raw, pdf.document_type);
                                            
                                            return (
                                            <tr
                                                key={pdf.id}
                                                className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                                            >
                                                    {/* 1. Checkbox */}
                                                    <td className="px-2 py-2 pt-3" style={{ display: shouldShowColumn(1) ? '' : 'none' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPdfIds.includes(pdf.id)}
                                                        onChange={() => handleSelectPdf(pdf.id)}
                                                        className="h-3.5 w-3.5 text-blue-500 focus:ring-0.5 focus:ring-blue-300 border-gray-200 rounded-sm"
                                                    />
                                                </td>
                                                    {/* 2. Temps */}
                                                    <td className="px-2 py-2" style={{ display: shouldShowColumn(2) ? '' : 'none' }}>
                                                        <span className={`text-xs font-medium ${timeColor}`}>
                                                            {timeDisplay}
                                                        </span>
                                                    </td>
                                                    {/* 3. Nom */}
                                                    <td className="px-2 py-2" style={{ display: shouldShowColumn(3) ? '' : 'none' }}>
                                                        <div className="font-medium text-gray-900 text-xs truncate max-w-[200px]" title={pdf.name_pdf || 'Document sans nom'}>
                                                        {pdf.name_pdf || 'Document sans nom'}
                                                    </div>
                                                </td>
                                                    {/* 4. Taille */}
                                                    <td className="px-2 py-2" style={{ display: shouldShowColumn(4) ? '' : 'none' }}>
                                                        <span className="text-xs text-gray-600">
                                                            {pdf.file_size ? `${Math.round(pdf.file_size / 1024)} KB` : '-'}
                                                        </span>
                                                    </td>
                                                    {/* 5. Type */}
                                                    <td className="px-2 py-2" style={{ display: shouldShowColumn(5) ? '' : 'none' }}>
                                                    <span className="text-xs bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded-sm">
                                                        {filterOptions.documentTypes.find(t => t.value === pdf.document_type)?.label || pdf.document_type || 'Inconnu'}
                                                    </span>
                                                </td>
                                                    {/* 6. Statut */}
                                                    <td className="px-2 py-2" style={{ display: shouldShowColumn(6) ? '' : 'none' }}>
                                                    <span className={`text-xs px-1.5 py-0.5 rounded-sm ${
                                                            pdf.status === 'processed' || pdf.status === 'extracted' || pdf.status === 'linked' || pdf.status === 'pushed' ? 'bg-green-50 text-green-600' :
                                                        pdf.status === 'error' ? 'bg-red-50 text-red-600' :
                                                        pdf.status === 'splitted' || pdf.status === 'splitted_extracted' ? 'bg-blue-50 text-blue-600' :
                                                        'bg-yellow-50 text-yellow-600'
                                                    }`}>
                                                        {filterOptions.statuses.find(s => s.value === pdf.status)?.label || pdf.status}
                                                    </span>
                                                </td>
                                                    {/* 7. Site */}
                                                    <td className="px-2 py-2" style={{ display: shouldShowColumn(7) ? '' : 'none', width: '70px' }}>
                                                    {pdf.site_siret_plus && pdf.site_siret_plus.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1 max-w-[70px]">
                                                                {pdf.site_siret_plus.slice(0, 1).map((siret: string, index: number) => (
                                                                <span
                                                                    key={index}
                                                                        className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-sm truncate max-w-[65px]"
                                                                    title={getSiteName(siret)}
                                                                >
                                                                        {getSiteName(siret)}
                                                                </span>
                                                            ))}
                                                                {pdf.site_siret_plus.length > 1 && (
                                                                <span className="text-xs text-gray-400">
                                                                        +{pdf.site_siret_plus.length - 1}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">-</span>
                                                    )}
                                                </td>
                                                    {/* 8. Presta */}
                                                    <td className="px-2 py-2" style={{ display: shouldShowColumn(8) ? '' : 'none', width: '70px' }}>
                                                        {providerName ? (
                                                            <span className="text-xs bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded-sm truncate max-w-[65px] block" title={String(providerName)}>
                                                                {String(providerName)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">-</span>
                                                    )}
                                                </td>
                                                    {/* 9. Pages */}
                                                    <td className="px-2 py-2" style={{ display: shouldShowColumn(9) ? '' : 'none' }}>
                                                    <span className="text-xs text-gray-600">
                                                        {typeof pdf.nb_pages === 'number' ? pdf.nb_pages : '-'}
                                                    </span>
                                                </td>
                                                    {/* 10. Déchets */}
                                                    <td className="px-2 py-2" style={{ display: shouldShowColumn(10) ? '' : 'none' }}>
                                                        <span className="text-xs text-gray-600">
                                                            {pdf.infos_raw && Array.isArray((pdf.infos_raw as { dechet?: unknown[] }).dechet) 
                                                                ? (pdf.infos_raw as { dechet: unknown[] }).dechet.length 
                                                                : '-'}
                                                        </span>
                                                    </td>
                                                    {/* 11. Lignes */}
                                                    <td className="px-2 py-2" style={{ display: shouldShowColumn(11) ? '' : 'none' }}>
                                                        <span className="text-xs text-gray-600">
                                                            {(() => {
                                                                if (!pdf.infos_raw) return '-';
                                                                const dechetArray = (pdf.infos_raw as { dechet?: unknown[] }).dechet;
                                                                if (!Array.isArray(dechetArray)) return '-';
                                                                
                                                                // Compter le total de lignes de facture pour tous les déchets
                                                                let totalLignes = 0;
                                                                for (const dechet of dechetArray) {
                                                                    if (dechet && typeof dechet === 'object') {
                                                                        const facture = (dechet as { facture?: { ligne?: unknown[] } }).facture;
                                                                        if (facture?.ligne && Array.isArray(facture.ligne)) {
                                                                            totalLignes += facture.ligne.length;
                                                                        }
                                                                    }
                                                                }
                                                                return totalLignes > 0 ? totalLignes : '-';
                                                            })()}
                                                        </span>
                                                    </td>
                                                    {/* 12. Brute */}
                                                    <td className="px-2 py-2" style={{ display: shouldShowColumn(12) ? '' : 'none' }}>
                                                        {confidence ? (
                                                            <span className={`text-xs px-1 py-0.5 rounded-sm ${
                                                                Math.round(confidence.brute || 0) >= 80 ? 'bg-green-100 text-green-700' :
                                                                Math.round(confidence.brute || 0) >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                                                'bg-red-100 text-red-700'
                                                            }`} title="Score de confiance brute">
                                                                {Math.round(confidence.brute || 0)}%
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">-</span>
                                                        )}
                                                    </td>
                                                    {/* 13. Spec */}
                                                    <td className="px-2 py-2" style={{ display: shouldShowColumn(13) ? '' : 'none' }}>
                                                        {confidence ? (
                                                            <span className={`text-xs px-1 py-0.5 rounded-sm ${
                                                                Math.round(confidence.spec || 0) >= 80 ? 'bg-green-100 text-green-700' :
                                                                Math.round(confidence.spec || 0) >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                                                'bg-red-100 text-red-700'
                                                            }`} title="Score de confiance spécifique">
                                                                {Math.round(confidence.spec || 0)}%
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">-</span>
                                                        )}
                                                    </td>
                                                    {/* 14. Manuscrit */}
                                                    <td className="px-2 py-2" style={{ display: shouldShowColumn(14) ? '' : 'none' }}>
                                                        {confidence?.handwritten && confidence.handwritten[1] ? (
                                                            <span className="text-xs px-1 py-0.5 bg-purple-100 text-purple-700 rounded-sm" title="Taux manuscrit détecté">
                                                                {Math.round(confidence.handwritten[0])}%
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">-</span>
                                                        )}
                                                    </td>
                                                    {/* 15. Couverture */}
                                                    <td className="px-2 py-2" style={{ display: shouldShowColumn(15) ? '' : 'none' }}>
                                                        {coverage.percentage > 0 ? (
                                                            <span 
                                                                className={`text-xs px-1 py-0.5 rounded-sm ${getCoverageColor(coverage.percentage)}`} 
                                                                title={`Couverture: ${coverage.filledCount}/${coverage.totalCount} champs remplis (${coverage.percentage}%)`}
                                                            >
                                                                {coverage.percentage}%
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">-</span>
                                                        )}
                                                    </td>
                                                    {/* 16. Type d'alerte */}
                                                    <td className="px-2 py-2" style={{ display: shouldShowColumn(16) ? '' : 'none' }}>
                                                        {alerteFlags.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1" title={alerteTooltip || undefined}>
                                                                {alerteFlags.map((flag, idx) => (
                                                                    <span key={idx} className={`text-xs px-1.5 py-0.5 rounded-sm ${flag.color}`}>
                                                                        {flag.label}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">-</span>
                                                    )}
                                                </td>
                                                    {/* 17. Linkage (BSDs) */}
                                                    <td className="px-2 py-2" style={{ display: shouldShowColumn(17) ? '' : 'none' }}>
                                                        {(() => {
                                                            const bsdLinked = pdf.bsd_linked as Array<{
                                                                index_dechet: number;
                                                                status: 'created' | 'linked' | 'pushed' | 'check_by_user' | 'to_check_by_user';
                                                                bsd_id?: string;
                                                            }> | null | undefined;
                                                            
                                                            if (!bsdLinked || !Array.isArray(bsdLinked) || bsdLinked.length === 0) {
                                                                return <span className="text-xs text-gray-400">-</span>;
                                                            }
                                                            
                                                            return (
                                                                <div className="flex flex-col gap-0.5">
                                                                    {bsdLinked.slice(0, 3).map((link, index) => {
                                                                        const statusColor = link.status === 'pushed' ? 'bg-purple-50 text-purple-600' :
                                                                                          link.status === 'linked' ? 'bg-green-50 text-green-600' :
                                                                                          link.status === 'check_by_user' || link.status === 'to_check_by_user' ? 'bg-yellow-50 text-yellow-600' :
                                                                                          'bg-blue-50 text-blue-600';
                                                                        const statusLabel = link.status === 'pushed' ? 'Push' :
                                                                                          link.status === 'linked' ? 'Link' :
                                                                                          link.status === 'check_by_user' || link.status === 'to_check_by_user' ? 'À vérifier' :
                                                                                          'Créé';
                                                                        return (
                                                                            <div key={index} className="flex items-center gap-1 flex-wrap">
                                                                                <span className={`text-xs px-1 py-0.5 rounded-sm ${statusColor}`}>
                                                                                    {statusLabel} D{link.index_dechet + 1}
                                                                                </span>
                                                                                {link.bsd_id && (
                                                                                    <span className="text-xs text-gray-500">
                                                                                        {link.bsd_id}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                    {bsdLinked.length > 3 && (
                                                                        <span className="text-xs text-gray-400">+{bsdLinked.length - 3}</span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </td>
                                                    {/* 19. RAG ID */}
                                                    <td className="px-2 py-2" style={{ display: shouldShowColumn(19) ? '' : 'none' }}>
                                                        <span className="text-[11px] font-mono text-gray-700 truncate block max-w-[70px]" title={pdf.id_rag ?? ''}>
                                                            {pdf.id_rag ?? ''}
                                                        </span>
                                                    </td>
                                                    {/* 18. Actions */}
                                                    <td className="px-2 py-2" style={{ display: shouldShowColumn(18) ? '' : 'none' }}>
                                                        <button
                                                            onClick={() => setManualExtractPdfId(pdf.id)}
                                                            className="text-xs px-2 py-1 bg-blue-500 text-white rounded-sm hover:bg-blue-600 transition-colors flex items-center gap-1"
                                                            title="Extraire les données de ce document"
                                                        >
                                                            <BoxIcon name="bx-export" size="14" />
                                                            <span>Extraire</span>
                                                        </button>
                                                    </td>
                                            </tr>
                                                            );
                                                        })
                                                    }
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Statistiques et boutons d'action */}
                    <div className="mb-3 mt-3">
                        <div className="p-2.5 bg-blue-50 rounded-md">
                            {/* Sélecteur de configuration */}
                            <div className="mb-1 border-b pb-1 border-b border-blue-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-medium text-blue-700">Configuration de linkage :</span>
                                        <div className="text-xs text-blue-600 mt-0.5 hidden">{currentConfig.description}</div>
                                    </div>
                                    <select
                                        value={selectedConfigId}
                                        onChange={(e) => setSelectedConfigId(e.target.value)}
                                        className="text-xs border border-blue-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                                    >
                                        {LINK_CONFIGS.map(config => (
                                            <option key={config.id} value={config.id}>
                                                {config.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center justify-between h-full pb-4">
                                <div className="flex items-center space-x-3">
                                    <div className="text-center">
                                        <div className="text-base font-semibold text-blue-500">{filteredPdfs.length}</div>
                                        <div className="text-xs text-blue-500">PDFs filtrés</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-base font-semibold text-green-500">{selectedPdfIds.length}</div>
                                        <div className="text-xs text-green-500">Sélectionnés</div>
                                    </div>
                                    {/* Boutons de vue des colonnes */}
                                    <div className="flex items-center gap-1 ml-4 pl-4 border-l border-blue-200">
                                        <span className="text-xs text-blue-600 font-medium">Vue :</span>
                                        <button
                                            onClick={() => setColumnView('all')}
                                            className={`text-xs px-2 py-1 rounded-sm transition-colors ${
                                                columnView === 'all' 
                                                    ? 'bg-blue-500 text-white' 
                                                    : 'bg-white text-blue-600 hover:bg-blue-100'
                                            }`}
                                            title="Afficher toutes les colonnes"
                                        >
                                            Toutes
                                        </button>
                                        <button
                                            onClick={() => setColumnView('info')}
                                            className={`text-xs px-2 py-1 rounded-sm transition-colors ${
                                                columnView === 'info' 
                                                    ? 'bg-blue-500 text-white' 
                                                    : 'bg-white text-blue-600 hover:bg-blue-100'
                                            }`}
                                            title="Infos de base (7 colonnes)"
                                        >
                                            Info
                                        </button>
                                        <button
                                            onClick={() => setColumnView('analyse')}
                                            className={`text-xs px-2 py-1 rounded-sm transition-colors ${
                                                columnView === 'analyse' 
                                                    ? 'bg-blue-500 text-white' 
                                                    : 'bg-white text-blue-600 hover:bg-blue-100'
                                            }`}
                                            title="Analyse et scores (7 colonnes)"
                                        >
                                            Analyse
                                        </button>
                                        <button
                                            onClick={() => setColumnView('actions')}
                                            className={`text-xs px-2 py-1 rounded-sm transition-colors ${
                                                columnView === 'actions' 
                                                    ? 'bg-blue-500 text-white' 
                                                    : 'bg-white text-blue-600 hover:bg-blue-100'
                                            }`}
                                            title="Linkage et actions (4 colonnes)"
                                        >
                                            Actions
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-1.5">
                                    <div className="flex flex-col items-stretch gap-2">
                                        <button
                                            onClick={() => handleProcessPdfs(
                                                selectedPdfIds,
                                                entreprise_id || '',
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
                                                handleRefreshData
                                            )}
                                            disabled={anyProcessing || processingAlertes || selectedPdfIds.length === 0}
                                            className="w-full px-3 py-1.5 bg-blue-500 text-white rounded-sm text-xs hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5 transition-colors"
                                        >
                                            {processingSplitThenExtract ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                                    <span>Traitement...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <BoxIcon name="bx-play" size="16" />
                                                    <span>Diviser puis extraire ({selectedPdfIds.length})</span>
                                                </>
                                            )}
                                        </button>
                                        <div className="grid grid-cols-3 gap-2">
                                            <button
                                                onClick={() => handleSplitOnly(
                                                    selectedPdfIds,
                                                    entreprise_id || '',
                                                    pdfInfos,
                                                    setProcessingSplitOnly,
                                                    setProcessingResults,
                                                    setShowReview,
                                                    setSelectedPdfIds,
                                                    handleRefreshData
                                                )}
                                                disabled={anyProcessing || processingAlertes || processingAutoLink || selectedPdfIds.length === 0}
                                                className="w-full px-3 py-1.5 bg-purple-500 text-white rounded-sm text-xs hover:bg-purple-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5 transition-colors"
                                            >
                                                {processingSplitOnly ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                                        <span>Division...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <BoxIcon name="bx-copy-alt" size="16" />
                                                        <span>Diviser</span>
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleSmartSplit(
                                                    selectedPdfIds,
                                                    entreprise_id || '',
                                                    pdfInfos,
                                                    setProcessingSmartSplit,
                                                    setSelectedPdfIds,
                                                    handleRefreshData
                                                )}
                                                disabled={anyProcessing || processingAlertes || processingAutoLink || selectedPdfIds.length === 0}
                                                className="w-full px-3 py-1.5 bg-indigo-600 text-white rounded-sm text-xs hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5 transition-colors"
                                                title="Division intelligente avec détection automatique des types de documents"
                                            >
                                                {processingSmartSplit ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                                        <span>Smart split...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <BoxIcon name="bx-brain" size="16" />
                                                        <span>Smart split</span>
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleExtractOnly(
                                                    selectedPdfIds,
                                                    entreprise_id || '',
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
                                                    handleRefreshData
                                                )}
                                                disabled={anyProcessing || processingAlertes || processingAutoLink || selectedPdfIds.length === 0}
                                                className="w-full px-3 py-1.5 bg-green-600 text-white rounded-sm text-xs hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5 transition-colors"
                                            >
                                                {processingExtractOnly ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                                        <span>Extraction...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <BoxIcon name="bx-export" size="16" />
                                                        <span>Extraire</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleCheckAlertes(
                                            selectedPdfIds,
                                            entreprise_id || '',
                                            pdfInfos,
                                            setProcessingAlertes,
                                            setProcessingResults,
                                            setShowReview,
                                            setSelectedPdfIds,
                                            handleRefreshData
                                        )}
                                        disabled={processingAlertes || selectedPdfIds.length === 0 || anyProcessing}
                                        className="px-2.5 py-1.5 bg-orange-500 text-white rounded-sm text-xs hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center space-x-1.5 transition-colors"
                                        title="Mettre à jour les notifications après changement dans les cluster parameters"
                                    >
                                        {processingAlertes ? (
                                            <>
                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                                <span>Vérification...</span>
                                            </>
                                        ) : (
                                            <>
                                                <BoxIcon name="bx-error-circle" size="16" />
                                                <span>Vérifier alertes</span>
                                            </>
                                        )}
                                    </button>
                                    <div className='flex flex-col gap-2'>
                                        <button
                                            onClick={() => handleAutoProposeSelected(
                                                selectedPdfIds,
                                                entreprise_id || '',
                                                user_id || '',
                                                pdfInfos,
                                                currentConfig,
                                                setProcessingAutoPropose,
                                                setProcessingResults,
                                                setShowReview,
                                                setSelectedPdfIds
                                            )}
                                            disabled={processingAutoPropose || anyProcessing || processingAlertes || selectedPdfIds.length === 0}
                                            className="hidden px-2.5 py-1.5 bg-orange-500 text-white rounded-sm text-xs hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center space-x-1.5 transition-colors"
                                            title="Simuler l'auto-link des documents sélectionnés (mode simulation)"
                                        >
                                        {processingAutoPropose ? (
                                            <>
                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                                <span>Auto-propose...</span>
                                            </>
                                        ) : (
                                            <>
                                                <BoxIcon name="bx-search" size="16" />
                                                <span>Auto-propose ({selectedPdfIds.length})</span>
                                            </>
                                        )}
                                    </button>
                                        <button
                                            onClick={() => handleAutoLinkSelected(
                                                selectedPdfIds,
                                                entreprise_id || '',
                                                user_id || '',
                                                pdfInfos,
                                                currentConfig,
                                                setProcessingAutoLink,
                                                setAutoLinkPhase,
                                                setProcessingResults,
                                                setShowReview,
                                                setSelectedPdfIds,
                                                handleRefreshData
                                            )}
                                            disabled={processingAutoLink || anyProcessing || processingAlertes || selectedPdfIds.length === 0}
                                            className="px-2.5 py-1.5 bg-indigo-500 text-white rounded-sm text-xs hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center space-x-1.5 transition-colors"
                                            title="Auto-linker les documents sélectionnés (simulation puis confirmation)"
                                        >
                                        {processingAutoLink ? (
                                            <>
                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                                <span>
                                                    {autoLinkPhase === 'simulation' && 'Simulation...'}
                                                    {autoLinkPhase === 'confirmation' && 'En attente confirmation...'}
                                                    {autoLinkPhase === 'applying' && 'Application...'}
                                                    {autoLinkPhase === 'idle' && 'Auto-link...'}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <BoxIcon name="bx-link" size="16" />
                                                <span>Auto-link ({selectedPdfIds.length})</span>
                                            </>
                                        )}
                                    </button>
                                        <button
                                            onClick={() => handlePushSelected(
                                                selectedPdfIds,
                                                entreprise_id || '',
                                                user_id || '',
                                                pdfInfos,
                                                setProcessingPush,
                                                setSelectedPdfIds,
                                                handleRefreshData
                                            )}
                                            disabled={processingPush || anyProcessing || processingAlertes || selectedPdfIds.length === 0}
                                            className="px-2.5 py-1.5 bg-purple-600 text-white rounded-sm text-xs hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center space-x-1.5 transition-colors"
                                            title="Pousser les factures sélectionnées"
                                        >
                                            {processingPush ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                                    <span>Push...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <BoxIcon name="bx-upload" size="16" />
                                                    <span>Push ({selectedPdfIds.length})</span>
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteLinksSelected(
                                                selectedPdfIds,
                                                entreprise_id || '',
                                                user_id || '',
                                                pdfInfos,
                                                setProcessingDeleteLinks,
                                                setSelectedPdfIds,
                                                handleRefreshData
                                            )}
                                            disabled={processingDeleteLinks || anyProcessing || processingAlertes || selectedPdfIds.length === 0}
                                            className="px-2.5 py-1.5 bg-red-600 text-white rounded-sm text-xs hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center space-x-1.5 transition-colors"
                                            title="Supprimer les liens BSD des documents sélectionnés"
                                        >
                                            {processingDeleteLinks ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                                    <span>Suppression...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <BoxIcon name="bx-trash" size="16" />
                                                    <span>Supprimer liens ({selectedPdfIds.length})</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section Review des résultats */}
                    {showReview && processingResults.length > 0 && (
                        <div className="mt-4 p-4 bg-white rounded-md shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-700">
                                    {autoLinkPhase === 'confirmation' ? '🔍 Propositions d\'auto-link' : 
                                     autoLinkPhase === 'applying' ? '⚡ Application en cours' :
                                     '📊 Résultats du traitement'}
                                </h3>
                                <button
                                    onClick={() => setShowReview(false)}
                                    className="text-gray-400 hover:text-gray-600 p-1.5 rounded-sm hover:bg-gray-50 transition-colors"
                                >
                                    <BoxIcon name="bx-x" size="18" />
                                </button>
                            </div>

                            {/* Message informatif pour la phase de confirmation */}
                            {autoLinkPhase === 'confirmation' && (
                                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                                    <div className="flex items-center space-x-2">
                                        <BoxIcon name="bx-info-circle" size="16" className="text-yellow-600" />
                                        <span className="text-sm text-yellow-800 font-medium">
                                            Propositions générées - En attente de votre confirmation pour appliquer les changements
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Résumé statistiques */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                <div className="bg-blue-50 p-3 rounded-md text-center">
                                    <div className="text-lg font-semibold text-blue-500">{processingResults.length}</div>
                                    <div className="text-xs text-blue-500">Total traité</div>
                                </div>
                                <div className="bg-green-50 p-3 rounded-md text-center">
                                    <div className="text-lg font-semibold text-green-500">{processingResults.filter(r => r.success).length}</div>
                                    <div className="text-xs text-green-500">Succès</div>
                                </div>
                                <div className="bg-red-50 p-3 rounded-md text-center">
                                    <div className="text-lg font-semibold text-red-500">{processingResults.filter(r => !r.success).length}</div>
                                    <div className="text-xs text-red-500">Échecs</div>
                                </div>
                                <div className="bg-purple-50 p-3 rounded-md text-center">
                                    <div className="text-lg font-semibold text-purple-500">{processingResults.filter(r => r.wasSplit).length}</div>
                                    <div className="text-xs text-purple-500">Divisés</div>
                                </div>
                            </div>

                            {/* Détails des traitements */}
                            <div className="space-y-2">
                                <h4 className="font-medium text-gray-600 text-sm">Détails par document :</h4>
                                <div className="max-h-80 overflow-y-auto space-y-1.5">
                                    {processingResults.map((result, index) => (
                                        <div
                                            key={index}
                                            className={`p-3 rounded-md border ${
                                                result.success
                                                    ? 'bg-green-50 border-green-100'
                                                    : 'bg-red-50 border-red-100'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="font-medium text-xs mb-1.5">{result.originalPdfName}</div>
                                                    {result.error && (
                                                        <div className="text-xs text-red-500 mb-1.5">{result.error}</div>
                                                    )}
                                                    {/* Liste des déchets auto-linkés */}
                                                    {Array.isArray(result.autoLinkDetails) && result.autoLinkDetails.length > 0 ? (
                                                        <ul className="space-y-0.5">
                                                            {result.autoLinkDetails.map((item, i) => {
                                                                const label = item.performed === 'linked' ? 'Lié au BSD'
                                                                    : item.performed === 'created' ? 'BSD créé'
                                                                    : item.performed === 'to_check_by_user' ? 'À vérifier manuellement'
                                                                    : 'Déjà traité';
                                                                const icon = item.performed === 'linked' ? '🔗'
                                                                    : item.performed === 'created' ? '✨'
                                                                    : item.performed === 'to_check_by_user' ? '👀'
                                                                    : '⏭️';
                                                                const badgeClass = item.performed === 'linked' ? 'bg-green-50 text-green-600'
                                                                    : item.performed === 'created' ? 'bg-blue-50 text-blue-600'
                                                                    : item.performed === 'to_check_by_user' ? 'bg-yellow-50 text-yellow-600'
                                                                    : 'bg-gray-50 text-gray-600';
                                                                return (
                                                                    <li key={i} className="flex items-center justify-between text-xs">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-gray-400">Déchet #{item.index + 1}</span>
                                                                            <span className={`px-1.5 py-0.5 rounded-sm text-xs ${badgeClass}`}>
                                                                                {icon} {label}
                                                                            </span>
                                                                        </div>
                                                                        {item.bsd_id && (
                                                                            <span className="text-xs text-gray-400">BSD: {item.bsd_id}</span>
                                                                        )}
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    ) : (
                                                        <div className="text-xs text-gray-500">{result.message}</div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {result.success && (
                                                        <span className={`px-1.5 py-0.5 rounded-sm text-xs font-medium ${
                                                            result.wasSplit
                                                                ? 'bg-purple-50 text-purple-600'
                                                                : 'bg-green-50 text-green-600'
                                                        }`}>
                                                            {result.wasSplit ? 'Divisé' : 'Succès'}
                                                        </span>
                                                    )}
                                                    {!result.success && (
                                                        <span className="px-1.5 py-0.5 rounded-sm text-xs font-medium bg-red-50 text-red-600">
                                                            Échec
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* Modal d'extraction si pause RAG */}
            {showExtractModal && paused && pausedPdfId && (
                <div className="fixed inset-0 z-[60]">
                    {(() => {
                        const blocking = pdfInfos.find(p => p.id === pausedPdfId);
                        if (!blocking) return null;
                        console.log('🔍 PDF bloqué trouvé:', {
                            id: blocking.id,
                            name_pdf_in_bucket: blocking.name_pdf_in_bucket,
                            pdf_path: blocking.pdf_path
                        });
                        const handleResume = async () => {
                            let didPause = false;
                            try {
                                const idx = (pausedAtIndex ?? -1) + 1;
                                const entrepriseIdNumber = Number(entreprise_id);
                                const remainingPdfIds = selectedPdfIds.slice(idx);
                                
                                if (remainingPdfIds.length === 0) {
                                    toast.success('Plus aucun document à traiter.');
                                    setPaused(false);
                                    setPausedPdfId(null);
                                    setPausedAtIndex(null);
                                    setResumeMode(null);
                                    return;
                                }
                                
                                // Activer le loader
                                setProcessingExtractOnly(resumeMode === 'extract_only');
                                setProcessingSplitThenExtract(resumeMode === 'split_then_extract');
                                
                                const mode = resumeMode === 'extract_only' ? 'extract_only' : 'split_then_extract';
                                const resumeResult = await processPdfList(remainingPdfIds, entrepriseIdNumber, mode);
                                
                                setProcessingResults(prev => [
                                    ...prev,
                                    ...resumeResult.results.map(r => ({
                                        pdfId: r.pdfId,
                                        success: r.success,
                                        message: r.message,
                                        error: r.success ? undefined : r.message
                                    })),
                                    ...resumeResult.errors.map(e => ({
                                        pdfId: e.pdfId,
                                        success: false,
                                        message: e.error,
                                        error: e.error
                                    }))
                                ]);
                                
                                if (resumeResult.success) {
                                    toast.success(`Reprise terminée. ${resumeResult.processedCount} PDFs traités.`);
                                } else {
                                    const ragErr = resumeResult.errors.find(e => {
                                        const msg = (e.error || '').toLowerCase();
                                        return msg.includes('rag') || msg.includes('exemple');
                                    });
                                    if (ragErr && typeof ragErr.pdfId === 'string') {
                                        const globalIdx = (pausedAtIndex ?? -1) + 1 + (resumeResult.pausedAtIndex ?? 0);
                                        setPaused(true);
                                        setPausedPdfId(ragErr.pdfId);
                                        setPausedAtIndex(globalIdx);
                                        try {
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
                                        const blockingName = pdfInfos.find(p => p.id === ragErr.pdfId)?.name_pdf || ragErr.pdfId;
                                        toast.error(`Stop: Exemple RAG manquant pour ${blockingName}`);
                                        didPause = true;
                                        return;
                                    }
                                    toast.error(`Reprise terminée avec des erreurs: ${resumeResult.message}`);
                                }
                            } catch (e) {
                                console.error('❌ Erreur lors de la reprise:', e);
                                toast.error('Erreur lors de la reprise');
                            } finally {
                                if (!didPause) {
                                    setPaused(false);
                                    setPausedPdfId(null);
                                    setPausedAtIndex(null);
                                    setResumeMode(null);
                                }
                                setProcessingExtractOnly(false);
                                setProcessingSplitThenExtract(false);
                            }
                        };

                        const onAfterSave = async () => {
                            try {
                                setShowExtractModal(false);
                                
                                const result = await Swal.fire({
                                    title: 'Exemple RAG sauvegardé',
                                    html: `
                                        <div class="text-left">
                                            <p class="mb-3">L'exemple a été enregistré avec succès.</p>
                                            <p class="mb-2"><strong>Voulez-vous reprendre le traitement des documents suivants ?</strong></p>
                                        </div>
                                    `,
                                    icon: 'success',
                                    showCancelButton: true,
                                    confirmButtonText: '▶️ Reprendre l\'extraction',
                                    cancelButtonText: 'Plus tard',
                                    confirmButtonColor: '#3b82f6',
                                    cancelButtonColor: '#6b7280'
                                });

                                if (result.isConfirmed) {
                                    await handleResume();
                                } else {
                                    setPaused(false);
                                    setPausedPdfId(null);
                                    setPausedAtIndex(null);
                                    setResumeMode(null);
                                    toast('Extraction en pause. Vous pouvez la reprendre plus tard.', { icon: 'ℹ️' });
                                }
                            } catch (e) {
                                console.error('❌ Erreur post-sauvegarde:', e);
                                toast.error('Erreur post-sauvegarde');
                            }
                        };
                        return (
                            <ExtractDoc
                                pdf_id={pausedPdfId}
                                pdf_path={blocking.name_pdf_in_bucket}
                                autoOpen={true}
                                openedFromLoopStarter={true}
                                onClose={() => {
                                    setShowExtractModal(false);
                                    setPaused(false);
                                    setPausedPdfId(null);
                                    setPausedAtIndex(null);
                                }}
                                onSave={onAfterSave}
                            />
                        );
                    })()}
                </div>
            )}
            {/* Modal d'extraction manuelle depuis le bouton */}
            {manualExtractPdfId && (() => {
                // Afficher un loader pendant le chargement
                if (loadingManualPdf) {
                    return (
                        <div className="fixed inset-0 z-[60] bg-black bg-opacity-50 flex items-center justify-center">
                            <div className="bg-white rounded-lg p-6 shadow-xl">
                                <div className="flex items-center gap-3">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                    <span className="text-gray-700">Chargement du PDF...</span>
                                </div>
                            </div>
                        </div>
                    );
                }

                // Utiliser les données chargées (locales ou depuis la BDD)
                if (!manualExtractPdfData) return null;
                
                return (
                    <div className="fixed inset-0 z-[60]">
                        <ExtractDoc
                            pdf_id={manualExtractPdfId}
                            pdf_path={manualExtractPdfData.name_pdf_in_bucket}
                            autoOpen={true}
                            openedFromLoopStarter={false}
                            onClose={() => {
                                setManualExtractPdfId(null);
                                setManualExtractPdfData(null);
                            }}
                            onSave={async () => {
                                setManualExtractPdfId(null);
                                setManualExtractPdfData(null);
                                toast.success('Document extrait avec succès');
                                await handleRefreshData();
                            }}
                        />
                    </div>
                );
            })()}
            {/* Modal d'association des mots-clés */}
            {showAssociationModal && (
                <div className="fixed inset-0 z-[70] bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-[95%] max-h-[95%] overflow-hidden flex flex-col">
                        {/* Header du modal */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-800">Association des mots-clés</h2>
                            <button
                                onClick={() => setShowAssociationModal(false)}
                                className="text-gray-400 hover:text-gray-600 p-2 rounded-sm hover:bg-gray-100 transition-colors"
                                title="Fermer"
                            >
                                <BoxIcon name="bx-x" size="24" />
                            </button>
                        </div>
                        
                        {/* Contenu du modal avec scroll */}
                        <div className="flex-1 overflow-y-auto p-4">
                            <MetaClusterParamsTab />
                        </div>
                        
                        {/* Footer du modal */}
                        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 bg-gray-50">
                            <button
                                onClick={() => {
                                    setShowAssociationModal(false);
                                    toast('💡 Pensez à vérifier les alertes pour appliquer les nouveaux mappings', { 
                                        duration: 2000,
                                        icon: '⚠️'
                                    });
                                }}
                                className="px-4 py-2 bg-blue-500 text-white rounded-sm hover:bg-blue-600 transition-colors flex items-center gap-2"
                            >
                                <BoxIcon name="bx-check" size="16" />
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoopStarter;

