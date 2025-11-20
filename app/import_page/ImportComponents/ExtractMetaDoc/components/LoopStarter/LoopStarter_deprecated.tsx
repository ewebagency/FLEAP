'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSession } from '@/app/component/SessionProvider';
import { supabase } from '@/app/database/supabaseClient';
import { processPdfList } from '../../utils/loop';
import { autoLinkDocs, BulkAutoLinkOutcome } from '../../utils/bulk_autolink';
import { verifierEtMettreAJourAlerte } from '../../utils/alerte';
import { LINK_CONFIGS, getLinkConfigById } from '../../utils/default_auto_link_params';
import { toast } from 'react-hot-toast';
import Swal from 'sweetalert2';
import BoxIcon from '@/app/component/BoxIconWrapper';
import { normalizePdfData, buildFactureFromNormalized, push_in_facture_bdd, ParamsMapping } from '../../utils/link';
import { getParamsMappingByEntreprise } from '../../utils/bdd';
import ExtractDoc from '../ExtractDoc';
import { smart_split_loop, apply_smart_split } from '../../utils/split';


interface PdfInfo {
    id: string;
    name_pdf: string;
    name_pdf_in_bucket: string;
    pdf_path: string;
    created_at: string;
    status: string;
    document_type: string | null;
    file_size: number | null;
    nb_pages?: number | null;
    site_siret: string | null;
    provider: Record<string, unknown> | null;
    site_siret_plus: string[] | null;
    alerte: Record<string, unknown> | null;
    confidence?: {
        brute?: number;
        spec?: number;
        handwritten?: [number, boolean];
    } | null;
    entreprise_id: number;
    user_id: string;
}

interface SiteInfo {
    siret: string;
    name: string;
}

interface FilterState {
    alerteStop: boolean | null;
    providers: string[];
    siteSirets: string[];
    documentTypes: string[];
    statuses: string[];
    pages: '' | 'one' | 'multi';
}

interface FilterOptions {
    providers: Array<{id: string, name: string}>;
    sites: Array<{id: string, name: string}>;
    documentTypes: Array<{value: string, label: string}>;
    statuses: Array<{value: string, label: string}>;
}

interface ProcessingResult {
    pdfId: string;
    success: boolean;
    message: string;
    error?: string;
    newPdfIds?: string[];
    confidence?: {
        brute: number;
        spec: number;
        handwritten: [number, boolean];
    };
    alerte?: {
        stop: boolean;
        message: string;
    };
    wasSplit?: boolean;
    originalPdfName?: string;
    autoLinkDetails?: Array<{ index: number; performed: 'linked' | 'created' | 'to_check_by_user' | 'skipped'; bsd_id?: string }>;
}

interface LoopStarterProps {
    isOpen?: boolean;
    onClose?: () => void;
}

// Composant multiselect personnalisé
interface MultiSelectProps {
    options: Array<{id: string, name: string} | {value: string, label: string}>;
    selectedValues: string[];
    onChange: (values: string[]) => void;
    placeholder: string;
    label: string;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ options, selectedValues, onChange, placeholder, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fermer le dropdown quand on clique en dehors
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(option => {
        const name = 'name' in option ? option.name : option.label;
        return name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const handleToggleOption = (value: string) => {
        const newValues = selectedValues.includes(value)
            ? selectedValues.filter(v => v !== value)
            : [...selectedValues, value];
        onChange(newValues);
    };

    const handleSelectAll = () => {
        const allValues = options.map(option => 'id' in option ? option.id : option.value);
        onChange(allValues);
    };

    const handleClearAll = () => {
        onChange([]);
    };

    const getDisplayText = () => {
        if (selectedValues.length === 0) return placeholder;
        if (selectedValues.length === 1) {
            const option = options.find(opt => ('id' in opt ? opt.id : opt.value) === selectedValues[0]);
            if (option) {
                return 'name' in option ? option.name : option.label;
            }
            return selectedValues[0];
        }
        return `${selectedValues.length} sélectionné(s)`;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <label className="block text-xs font-medium text-gray-700 mb-1">
                {label}
            </label>
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full p-1 text-xs border border-gray-200 rounded-sm focus:outline-none focus:ring-0.5 focus:ring-blue-300 bg-white text-left flex items-center justify-between hover:border-gray-300 transition-colors"
                >
                    <span className="truncate">{getDisplayText()}</span>
                    <BoxIcon name="bx-chevron-down" size="16" className="text-gray-400" />
                </button>
                
                {isOpen && (
                    <div className="absolute z-50 w-full mt-0.5 bg-white border border-gray-200 rounded-md shadow-sm max-h-60 overflow-hidden">
                        {options.length >= 6 && (
                        <div className="p-1.5 border-b border-gray-100">
                            <input
                                type="text"
                                placeholder="Rechercher..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full p-1 text-xs border border-gray-200 rounded-sm focus:outline-none focus:ring-0.5 focus:ring-blue-300 hover:border-gray-300 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        )}
                        
                        <div className="p-1.5 border-b border-gray-100 flex gap-1">
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-sm hover:bg-blue-100 transition-colors"
                            >
                                Tout
                            </button>
                            <button
                                type="button"
                                onClick={handleClearAll}
                                className="text-xs px-2 py-0.5 bg-gray-50 text-gray-600 rounded-sm hover:bg-gray-100 transition-colors"
                            >
                                Rien
                            </button>
                        </div>
                        
                        <div className="max-h-40 overflow-y-auto">
                            {filteredOptions.length === 0 ? (
                                <div className="p-2 text-xs text-gray-500 text-center">
                                    Aucune option trouvée
                                </div>
                            ) : (
                                filteredOptions.map((option) => {
                                    const value = 'id' in option ? option.id : option.value;
                                    const name = 'name' in option ? option.name : option.label;
                                    const isSelected = selectedValues.includes(value);
                                    
                                    return (
                                        <label
                                            key={value}
                                            className="flex items-center px-2 py-1.5 hover:bg-gray-50 cursor-pointer transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleToggleOption(value)}
                                                className="w-3 h-3 text-blue-500 border-gray-200 rounded-sm focus:ring-0.5 focus:ring-blue-300"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <span className="ml-2 text-xs text-gray-600 truncate">
                                                {name}
                                            </span>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
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
    const [canResume, setCanResume] = useState(false);
    const [resumeMode, setResumeMode] = useState<'split_then_extract' | 'extract_only' | null>(null);
    const [showExtractModal, setShowExtractModal] = useState(false);
    
    // États des filtres multiselect - Chargés depuis localStorage
    const [filters, setFilters] = useState<FilterState>(() => {
        try {
            const saved = localStorage.getItem('loopStarter:filters');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error('Erreur chargement filtres:', error);
        }
        return {
        alerteStop: null,
        providers: [],
        siteSirets: [],
        documentTypes: [],
        statuses: [],
        pages: ''
        };
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
        statuses: []
    });

    // Fonction pour rafraîchir les données depuis la BDD
    const refreshData = useCallback(async () => {
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

            // Extraire les providers uniques des PDFs
            const uniqueProviders = new Set<string>();
            pdfData?.forEach(pdf => {
                if (pdf.provider && typeof pdf.provider === 'object') {
                    const providerName = Object.values(pdf.provider).join(' ').trim();
                    if (providerName) {
                        uniqueProviders.add(providerName);
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

            // Mettre à jour les options de filtres avec les données de la BDD
            setFilterOptions({
                providers: Array.from(uniqueProviders).map(name => ({ id: name, name })),
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
                }))
            });

        } catch (error) {
            console.error('❌ Erreur lors du rafraîchissement des données:', error);
            toast.error('Erreur lors du rafraîchissement des données');
            return;
        }
        
        // Confirmation finale
        console.log('✅ Refresh data terminé avec succès');
    }, [entreprise_id]);

    // Charger les PDFs et les options de filtres depuis la BDD au montage
    useEffect(() => {
        const fetchData = async () => {
            if (!entreprise_id) return;
            
            setLoading(true);
            try {
                await refreshData();
            } catch (error) {
                console.error('Erreur lors du chargement initial des données:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [entreprise_id, refreshData]);

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

            // Filtre providers (multiselect)
            if (filters.providers.length > 0 && pdf.provider) {
                const providerName = typeof pdf.provider === 'object' && pdf.provider !== null
                    ? Object.values(pdf.provider).join(' ').toLowerCase()
                    : '';
                const hasMatchingProvider = filters.providers.some(provider => 
                    providerName.includes(provider.toLowerCase())
                );
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

            return true;
        });
    }, [pdfInfos, filters, searchName]);

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

    const anyProcessing = processingSplitThenExtract || processingSplitOnly || processingExtractOnly || processingAutoPropose || processingSmartSplit;

    // Traiter les PDFs sélectionnés
    const handleProcessPdfs = async () => {
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
        setProcessingResults([]);
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
            
            setProcessingResults(detailedResults);
            setShowReview(true);
            
            if (result.success) {
                toast.success(`Traitement terminé : ${result.processedCount} PDFs traités avec succès`);
                // Rafraîchir les données
                toast.loading('Rafraîchissement des données...', { id: 'refresh-split-extract' });
                await refreshData();
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
                    await refreshData();
                    toast.success('Données rafraîchies', { id: 'refresh-post-alertes' });
                } catch (e) {
                    console.error('Erreur lors de la vérification automatique des alertes:', e);
                    toast.error('Erreur lors de la vérification des alertes');
                }
                setSelectedPdfIds([]);
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
                    toast.error(`Traitement terminé avec des erreurs : ${result.message}`);
                    if (result.errors.length > 0) {
                        console.error('Erreurs détaillées:', result.errors);
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
    const handleSplitOnly = async () => {
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
                await refreshData();
                toast.success('Données rafraîchies', { id: 'refresh-split' });
                setSelectedPdfIds([]);
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
    const handleSmartSplit = async () => {
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

            // Phase 2: Préparer la preview pour SweetAlert2
            const previewHtml = analysisResult.results.map(result => {
                const pdf = pdfInfos.find(p => p.id === result.pdfId);
                const pdfName = pdf?.name_pdf || result.pdfId;

                if (!result.segments || result.segments.length === 0) {
                    return `<div class="mb-2 p-2 bg-gray-50 rounded text-sm text-gray-600">📄 ${pdfName} - Aucun segment</div>`;
                }

                const segmentsHtml = result.segments.map((segment) => {
                    const typeEmoji = segment.type === 'facture' ? '💰' : segment.type === 'bon' ? '📦' : segment.type === 'bsd' ? '📋' : '📄';
                    const pagesText = segment.pages.length === 1 ? `P${segment.pages[0] + 1}` : `P${segment.pages[0] + 1}-${segment.pages[segment.pages.length - 1] + 1}`;
                    return `<div class="flex items-center justify-between text-xs py-1"><span>${typeEmoji} ${segment.type}</span><span class="text-gray-500">${pagesText}</span></div>`;
                }).join('');

                return `<div class="mb-2 p-2 bg-gray-50 rounded"><div class="font-medium text-sm mb-1">📄 ${pdfName}</div>${segmentsHtml}</div>`;
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
                        
                        <div class="mb-2 max-h-80 overflow-y-auto">
                            ${previewHtml}
                        </div>
                        
                        <div class="p-2 bg-yellow-50 rounded text-xs text-yellow-800">
                            ⚠️ Action irréversible - Les PDFs seront divisés selon les segments détectés
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
                }
            });

            if (!confirmed.isConfirmed) {
                toast('Smart split annulé par l\'utilisateur', { icon: '❌' });
                setSelectedPdfIds([]);
                return;
            }

            // Phase 4: Appliquer le split intelligent
            toast('Application du smart split...', { icon: '⏳' });
            
            let successCount = 0;
            let errorCount = 0;
            
            for (const result of analysisResult.results) {
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
                await refreshData();
                toast.success('Données rafraîchies', { id: 'refresh-smart-split' });
                setSelectedPdfIds([]);
            }
            
            if (errorCount > 0) {
                toast.error(`${errorCount} erreur(s) lors du smart split`);
            }

        } catch (error) {
            console.error('Erreur smart split:', error);
            toast.error('Erreur lors du smart split');
        } finally {
            setProcessingSmartSplit(false);
        }
    };

    // Extraire uniquement
    const handleExtractOnly = async () => {
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
        setProcessingResults([]);
        setShowReview(false);

        try {
            const result = await processPdfList(selectedPdfIds, parseInt(entreprise_id), 'extract_only');

            const detailedResults: ProcessingResult[] = [];
            result.results.forEach(item => {
                const originalPdf = pdfInfos.find(pdf => pdf.id === item.pdfId);
                detailedResults.push({
                    pdfId: item.pdfId,
                    success: item.success,
                    message: item.message,
                    newPdfIds: item.newPdfIds,
                    wasSplit: false,
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
                toast.success(`Extraction terminée : ${result.processedCount} PDF(s)`);
                toast.loading('Rafraîchissement des données...', { id: 'refresh-extract' });
                await refreshData();
                toast.success('Données rafraîchies', { id: 'refresh-extract' });
                setSelectedPdfIds([]);
            } else {
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
                    toast.error(result.message || 'Extraction terminée avec des erreurs');
                }
            }
        } catch (error) {
            console.error('Erreur extraction:', error);
            toast.error('Erreur lors de l\'extraction des PDFs');
        } finally {
            setProcessingExtractOnly(false);
        }
    };

    // Auto-link selected PDFs (nouveau workflow en 2 étapes)
    const handleAutoLinkSelected = async () => {
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

        // Phase 1: Simulation pour obtenir les propositions
        setProcessingAutoLink(true);
        setAutoLinkPhase('simulation');
        setProcessingResults([]);
        setShowReview(false);

        try {
            // D'abord, faire une simulation pour voir ce qui sera fait
            const simulationOutcome: BulkAutoLinkOutcome = await autoLinkDocs(selectedPdfIds, parseInt(entreprise_id), user_id, true, currentConfig.params);

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
                setSelectedPdfIds([]);
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

            // Créer le HTML détaillé
            const detailsHtml = Object.entries(actionSummary).map(([pdfName, actions]) => {
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
                        <div class="font-medium text-gray-800 mb-2">📄 ${pdfName}</div>
                        ${actionsHtml}
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
                        
                        <div class="mb-4">
                            <div class="font-medium text-gray-800 mb-2">📋 Détail par document:</div>
                            <div class="max-h-60 overflow-y-auto">
                                ${detailsHtml}
                            </div>
                        </div>
                        
                        <div class="p-3 bg-yellow-50 rounded border-l-4 border-yellow-400">
                            <div class="text-sm text-yellow-800">
                                <strong>⚠️ Attention:</strong> Ces actions vont modifier la base de données. 
                                Assurez-vous que ces propositions sont correctes avant de confirmer.
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
                }
            });

            if (!confirmed.isConfirmed) {
                toast('Auto-link annulé par l\'utilisateur', { icon: '❌' });
                setAutoLinkPhase('idle');
                setSelectedPdfIds([]);
                return;
            }

            // Phase 2: Appliquer les changements en mode réel
            setAutoLinkPhase('applying');
            toast('Application des changements en cours...', { icon: '⏳' });
            const realOutcome: BulkAutoLinkOutcome = await autoLinkDocs(selectedPdfIds, parseInt(entreprise_id), user_id, false, currentConfig.params);

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
                await refreshData();
                toast.success('Données rafraîchies', { id: 'refresh-autolink' });
                setSelectedPdfIds([]);
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
    const handleAutoProposeSelected = async () => {
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
                setSelectedPdfIds([]);
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
    const handlePushSelected = async () => {
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
                await refreshData();
                toast.success('Données rafraîchies', { id: 'refresh-push' });
            }
            if (errorCount > 0) toast.error(`${errorCount} erreur(s) lors du push`);
            setSelectedPdfIds([]);
        } catch (error) {
            console.error('Erreur push factures:', error);
            toast.error('Erreur lors du push des factures');
        } finally {
            setProcessingPush(false);
        }
    };

    // Vérifier les alertes des PDFs sélectionnés
    const handleCheckAlertes = async () => {
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
            await refreshData();
            toast.success('Données rafraîchies', { id: 'refresh-alertes' });
            
            if (errorCount === 0) {
                toast.success(`Vérification des alertes terminée : ${successCount} PDFs vérifiés avec succès`);
            } else {
                toast.error(`Vérification terminée : ${successCount} succès, ${errorCount} erreurs`);
            }
            
            setSelectedPdfIds([]);
        } catch (error) {
            console.error('Erreur lors de la vérification des alertes:', error);
            toast.error('Erreur lors de la vérification des alertes');
        } finally {
            setProcessingAlertes(false);
        }
    };

    // Obtenir le nom du site à partir du SIRET
    const getSiteName = (siret: string): string => {
        const site = sites.find(s => s.siret === siret);
        return site ? site.name : siret;
    };

    // Réinitialiser tous les filtres
    const handleResetFilters = () => {
        setFilters({
            alerteStop: null,
            providers: [],
            siteSirets: [],
            documentTypes: [],
            statuses: [],
            pages: ''
        });
        setSearchName('');
    };
    
    // Générer les flags d'alertes basés sur le message
    const getAlerteFlags = (message: string): Array<{label: string, color: string}> => {
        if (!message) return [];
        
        const flags: Array<{label: string, color: string}> = [];
        const lowerMessage = message.toLowerCase();
        
        // Associations manquantes (non reconnu = lu mais pas de mapping)
        if (lowerMessage.includes('non reconnu')) {
            if (lowerMessage.includes('site')) flags.push({ label: 'Site inconnu', color: 'bg-red-100 text-red-700' });
            if (lowerMessage.includes('prestataire')) flags.push({ label: 'Presta inconnu', color: 'bg-red-100 text-red-700' });
            if (lowerMessage.includes('opération')) flags.push({ label: 'Opération inconnue', color: 'bg-red-100 text-red-700' });
            if (lowerMessage.includes('unité')) flags.push({ label: 'Unité inconnue', color: 'bg-red-100 text-red-700' });
            if (lowerMessage.includes('contenant')) flags.push({ label: 'Contenant inconnu', color: 'bg-red-100 text-red-700' });
            if (lowerMessage.includes('déchet')) flags.push({ label: 'Déchet inconnu', color: 'bg-red-100 text-red-700' });
        }
        
        // Tonnage
        if (lowerMessage.includes('tonnage')) {
            if (lowerMessage.includes('manquant')) flags.push({ label: 'Tonnage non lu', color: 'bg-orange-100 text-orange-700' });
            else if (lowerMessage.includes('non numérique')) flags.push({ label: 'Tonnage invalide', color: 'bg-orange-100 text-orange-700' });
            else if (lowerMessage.includes('négatif')) flags.push({ label: 'Tonnage négatif', color: 'bg-orange-100 text-orange-700' });
            else if (lowerMessage.includes('trop élevé')) flags.push({ label: 'Tonnage >50t', color: 'bg-orange-100 text-orange-700' });
        }
        
        // Date
        if (lowerMessage.includes('date')) {
            if (lowerMessage.includes('manquante')) flags.push({ label: 'Date non lue', color: 'bg-yellow-100 text-yellow-700' });
            else if (lowerMessage.includes('invalide')) flags.push({ label: 'Date invalide', color: 'bg-yellow-100 text-yellow-700' });
        }
        
        // Numéros
        if (lowerMessage.includes('numéro bsd') || lowerMessage.includes('num_bsd')) {
            if (lowerMessage.includes('manquant')) flags.push({ label: 'N° BSD non lu', color: 'bg-purple-100 text-purple-700' });
            else if (lowerMessage.includes('insuffisant')) flags.push({ label: 'N° BSD invalide', color: 'bg-purple-100 text-purple-700' });
        }
        if (lowerMessage.includes('numéro de bon') || lowerMessage.includes('num_bon')) {
            if (lowerMessage.includes('manquant')) flags.push({ label: 'N° Bon non lu', color: 'bg-purple-100 text-purple-700' });
            else if (lowerMessage.includes('insuffisant')) flags.push({ label: 'N° Bon invalide', color: 'bg-purple-100 text-purple-700' });
        }
        if (lowerMessage.includes('numéro de facture') || lowerMessage.includes('num_facture')) {
            if (lowerMessage.includes('manquant')) flags.push({ label: 'N° Facture non lu', color: 'bg-purple-100 text-purple-700' });
            else if (lowerMessage.includes('insuffisant')) flags.push({ label: 'N° Facture invalide', color: 'bg-purple-100 text-purple-700' });
        }
        
        // Code CED
        if (lowerMessage.includes('code ced') || lowerMessage.includes('ced')) {
            if (lowerMessage.includes('manquant')) flags.push({ label: 'CED non lu', color: 'bg-pink-100 text-pink-700' });
            else if (lowerMessage.includes('invalide')) flags.push({ label: 'CED invalide', color: 'bg-pink-100 text-pink-700' });
        }
        
        // Calculs
        if (lowerMessage.includes('calcul incorrect')) {
            flags.push({ label: 'Calcul erroné', color: 'bg-blue-100 text-blue-700' });
        }
        if (lowerMessage.includes('somme incorrecte')) {
            flags.push({ label: 'Somme erronée', color: 'bg-blue-100 text-blue-700' });
        }
        
        return flags;
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
            <div className="bg-white rounded-lg shadow-sm w-full h-full max-w-[95%] max-h-[95%] overflow-y-auto border border-gray-100">
                <div className="p-3">
                    <div className="flex items-center justify-between mb-3">
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
                                <div className="flex items-center space-x-3">
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
                                            await refreshData();
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
                                </div>
                            </div>
                        </div>

                        <div className="max-h-[calc(95vh-350px)] overflow-y-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-2 py-1.5 text-left bg-gray-50">
                                            <input
                                                type="checkbox"
                                                checked={selectedPdfIds.length === filteredPdfs.length && filteredPdfs.length > 0}
                                                onChange={handleSelectAll}
                                                className="h-3.5 w-3.5 text-blue-500 focus:ring-0.5 focus:ring-blue-300 border-gray-200 rounded-sm"
                                            />
                                        </th>
                                        <th className="px-2 py-1.5 text-left bg-gray-50 min-w-[200px]">
                                            <div className="text-xs font-medium text-gray-600 mb-1">Nom</div>
                                            <input
                                                type="text"
                                                placeholder="Rechercher..."
                                                value={searchName}
                                                onChange={(e) => setSearchName(e.target.value)}
                                                className="w-full p-1 text-xs border border-gray-200 rounded-sm focus:outline-none focus:ring-0.5 focus:ring-blue-300 bg-white"
                                            />
                                        </th>
                                        <th className="px-2 py-1.5 text-left min-w-[140px] bg-gray-50">
                                            <div className="text-xs font-medium text-gray-600 mb-1">Statut</div>
                            <MultiSelect
                                options={filterOptions.statuses}
                                selectedValues={filters.statuses}
                                onChange={(values) => setFilters(prev => ({ ...prev, statuses: values }))}
                                                placeholder="Tous"
                                                label=""
                            />
                                        </th>
                                        <th className="px-2 py-1.5 text-left min-w-[120px] bg-gray-50">
                                            <div className="text-xs font-medium text-gray-600 mb-1">Type</div>
                            <MultiSelect
                                options={filterOptions.documentTypes}
                                selectedValues={filters.documentTypes}
                                onChange={(values) => setFilters(prev => ({ ...prev, documentTypes: values }))}
                                                placeholder="Tous"
                                                label=""
                                            />
                                        </th>
                                        <th className="px-2 py-1.5 text-left bg-gray-50">
                                            <div className="text-xs font-medium text-gray-600 mb-1">Pages</div>
                                            <select
                                                value={filters.pages}
                                                onChange={(e) => setFilters(prev => ({ ...prev, pages: e.target.value as FilterState['pages'] }))}
                                                className="w-full p-1 text-xs border border-gray-200 rounded-sm focus:outline-none focus:ring-0.5 focus:ring-blue-300 bg-white"
                                            >
                                                <option value="">Tous</option>
                                                <option value="one">1</option>
                                                <option value="multi">+</option>
                                            </select>
                                        </th>
                                        <th className="px-2 py-1.5 text-left min-w-[140px] bg-gray-50">
                                            <div className="text-xs font-medium text-gray-600 mb-1">Site</div>
                            <MultiSelect
                                options={filterOptions.sites}
                                selectedValues={filters.siteSirets}
                                onChange={(values) => setFilters(prev => ({ ...prev, siteSirets: values }))}
                                                placeholder="Tous"
                                                label=""
                            />
                                        </th>
                                        <th className="px-2 py-1.5 text-left min-w-[140px] bg-gray-50">
                                            <div className="text-xs font-medium text-gray-600 mb-1">Provider</div>
                            <MultiSelect
                                options={filterOptions.providers}
                                selectedValues={filters.providers}
                                onChange={(values) => setFilters(prev => ({ ...prev, providers: values }))}
                                                placeholder="Tous"
                                                label=""
                                            />
                                        </th>
                                        <th className="px-2 py-1.5 text-left bg-gray-50 min-w-[100px]">
                                            <div className="text-xs font-medium text-gray-600 mb-1">Confiance</div>
                                        </th>
                                        <th className="px-2 py-1.5 text-left bg-gray-50">
                                            <div className="text-xs font-medium text-gray-600 mb-1">Temps</div>
                                        </th>
                                        <th className="px-2 py-1.5 text-left min-w-[180px] bg-gray-50">
                                            <div className="text-xs font-medium text-gray-600 mb-1">Alerte</div>
                                <select
                                    value={filters.alerteStop === null ? '' : filters.alerteStop.toString()}
                                    onChange={(e) => setFilters(prev => ({
                                        ...prev,
                                        alerteStop: e.target.value === '' ? null : e.target.value === 'true'
                                    }))}
                                                className="w-full p-1 text-xs border border-gray-200 rounded-sm focus:outline-none focus:ring-0.5 focus:ring-blue-300 bg-white"
                                >
                                    <option value="">Tous</option>
                                                <option value="true">Avec</option>
                                                <option value="false">Sans</option>
                                </select>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                            {filteredPdfs.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="p-8 text-center text-gray-500">
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
                                            
                                            // Extraction du nom du provider
                                            const providerName = pdf.provider && typeof pdf.provider === 'object' 
                                                ? (pdf.provider as Record<string, unknown>).nom || (pdf.provider as Record<string, unknown>).name || Object.values(pdf.provider)[0]
                                                : null;
                                            
                                            // Message d'alerte
                                            const alerteMessage = pdf.alerte && typeof pdf.alerte === 'object' && 'message' in pdf.alerte 
                                                ? (pdf.alerte as { message?: string }).message || ''
                                                : '';
                                            const alerteFlags = getAlerteFlags(alerteMessage);
                                            
                                            // Scores de confiance
                                            const confidence = pdf.confidence as { brute?: number; spec?: number; handwritten?: [number, boolean] } | null | undefined;
                                            
                                            return (
                                            <tr
                                                key={pdf.id}
                                                className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                                            >
                                                    <td className="px-2 py-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPdfIds.includes(pdf.id)}
                                                        onChange={() => handleSelectPdf(pdf.id)}
                                                        className="h-3.5 w-3.5 text-blue-500 focus:ring-0.5 focus:ring-blue-300 border-gray-200 rounded-sm"
                                                    />
                                                </td>
                                                    <td className="px-2 py-2">
                                                        <div className="font-medium text-gray-900 text-xs truncate max-w-[200px]" title={pdf.name_pdf || 'Document sans nom'}>
                                                        {pdf.name_pdf || 'Document sans nom'}
                                                    </div>
                                                </td>
                                                    <td className="px-2 py-2">
                                                    <span className={`text-xs px-1.5 py-0.5 rounded-sm ${
                                                            pdf.status === 'processed' || pdf.status === 'extracted' || pdf.status === 'linked' || pdf.status === 'pushed' ? 'bg-green-50 text-green-600' :
                                                        pdf.status === 'error' ? 'bg-red-50 text-red-600' :
                                                        pdf.status === 'splitted' || pdf.status === 'splitted_extracted' ? 'bg-blue-50 text-blue-600' :
                                                        'bg-yellow-50 text-yellow-600'
                                                    }`}>
                                                        {filterOptions.statuses.find(s => s.value === pdf.status)?.label || pdf.status}
                                                    </span>
                                                </td>
                                                    <td className="px-2 py-2">
                                                    <span className="text-xs bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded-sm">
                                                        {filterOptions.documentTypes.find(t => t.value === pdf.document_type)?.label || pdf.document_type || 'Inconnu'}
                                                    </span>
                                                </td>
                                                    <td className="px-2 py-2">
                                                    <span className="text-xs text-gray-600">
                                                        {typeof pdf.nb_pages === 'number' ? pdf.nb_pages : '-'}
                                                    </span>
                                                </td>
                                                    <td className="px-2 py-2">
                                                    {pdf.site_siret_plus && pdf.site_siret_plus.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                                {pdf.site_siret_plus.slice(0, 1).map((siret: string, index: number) => (
                                                                <span
                                                                    key={index}
                                                                        className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-sm truncate max-w-[120px]"
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
                                                    <td className="px-2 py-2">
                                                        {providerName ? (
                                                            <span className="text-xs bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded-sm truncate max-w-[120px] block" title={String(providerName)}>
                                                                {String(providerName)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">-</span>
                                                    )}
                                                </td>
                                                    <td className="px-2 py-2">
                                                        {confidence ? (
                                                            <div className="flex flex-col gap-0.5">
                                                                <div className="flex items-center gap-1">
                                                                    <span className={`text-xs px-1 py-0.5 rounded-sm ${
                                                                        Math.round(confidence.brute || 0) >= 80 ? 'bg-green-100 text-green-700' :
                                                                        Math.round(confidence.brute || 0) >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                                                        'bg-red-100 text-red-700'
                                                                    }`} title="Confiance brute">
                                                                        B:{Math.round(confidence.brute || 0)}%
                                                                    </span>
                                                                    <span className={`text-xs px-1 py-0.5 rounded-sm ${
                                                                        Math.round(confidence.spec || 0) >= 80 ? 'bg-green-100 text-green-700' :
                                                                        Math.round(confidence.spec || 0) >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                                                        'bg-red-100 text-red-700'
                                                                    }`} title="Confiance spécifique">
                                                                        S:{Math.round(confidence.spec || 0)}%
                                                                    </span>
                                                                </div>
                                                                {confidence.handwritten && confidence.handwritten[1] && (
                                                                    <span className="text-xs px-1 py-0.5 bg-purple-100 text-purple-700 rounded-sm" title="Manuscrit détecté">
                                                                        ✍️ {Math.round(confidence.handwritten[0])}%
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <span className={`text-xs font-medium ${timeColor}`}>
                                                            {timeDisplay}
                                                        </span>
                                                </td>
                                                    <td className="px-2 py-2">
                                                        {alerteFlags.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1" title={alerteMessage}>
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
                            <div className="mb-0 border-b pb-1 border-b border-blue-200">
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
                                </div>
                                <div className="flex items-center space-x-1.5">
                                    <div className="flex flex-col items-stretch gap-2">
                                        <button
                                            onClick={handleProcessPdfs}
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
                                                onClick={handleSplitOnly}
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
                                                onClick={handleSmartSplit}
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
                                                onClick={handleExtractOnly}
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
                                    {paused && canResume && (
                                        <button
                                            onClick={async () => {
                                                let didPause = false;
                                                try {
                                                    const idx = (pausedAtIndex ?? -1) + 1;
                                                    const entrepriseIdNumber = Number(entreprise_id);
                                                    const remainingPdfIds = selectedPdfIds.slice(idx);
                                                    setCanResume(false);
                                                    if (remainingPdfIds.length === 0) {
                                                        toast.success('Plus aucun document à traiter.');
                                                        setPaused(false);
                                                        setPausedPdfId(null);
                                                        setPausedAtIndex(null);
                                                        setResumeMode(null);
                                                        return;
                                                    }
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
                                                        // Vérifier si la reprise s'est arrêtée à cause d'un RAG manquant
                                                        const ragErr = resumeResult.errors.find(e => {
                                                            const msg = (e.error || '').toLowerCase();
                                                            return msg.includes('rag') || msg.includes('exemple');
                                                        });
                                                        if (ragErr && typeof ragErr.pdfId === 'string') {
                                                            // Calculer l'index global du nouveau blocage
                                                            const globalIdx = (pausedAtIndex ?? -1) + 1 + (resumeResult.pausedAtIndex ?? 0);
                                                            setPaused(true);
                                                            setPausedPdfId(ragErr.pdfId);
                                                            setPausedAtIndex(globalIdx);
                                                            // Préremplir brouillon depuis backend pour ce nouveau PDF bloqué
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
                                                            return; // Ne pas nettoyer l'état de pause
                                                        }
                                                        // Erreurs sans RAG: afficher un toast générique
                                                        toast.error(`Reprise terminée avec des erreurs: ${resumeResult.message}`);
                                                    }
                                                } catch (e) {
                                                    console.error('❌ Erreur lors de la reprise:', e);
                                                    toast.error('Erreur lors de la reprise');
                                                } finally {
                                                    // Nettoyer uniquement si on n'a PAS re-déclenché une pause pour un nouveau doc
                                                    if (!didPause) {
                                                        setPaused(false);
                                                        setPausedPdfId(null);
                                                        setPausedAtIndex(null);
                                                        setResumeMode(null);
                                                    }
                                                }
                                            }}
                                            className="px-3 py-1.5 bg-blue-600 text-white rounded-sm text-xs hover:bg-blue-700 flex items-center justify-center space-x-1.5 transition-colors"
                                        >
                                            <>
                                                <BoxIcon name="bx-play-circle" size="16" />
                                                <span>Reprendre</span>
                                            </>
                                        </button>
                                    )}
                                    <button
                                        onClick={handleCheckAlertes}
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
                                            onClick={handleAutoProposeSelected}
                                            disabled={processingAutoPropose || anyProcessing || processingAlertes || selectedPdfIds.length === 0}
                                            className="px-2.5 py-1.5 bg-orange-500 text-white rounded-sm text-xs hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center space-x-1.5 transition-colors"
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
                                            onClick={handleAutoLinkSelected}
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
                                            onClick={handlePushSelected}
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
                        const onAfterSave = async () => {
                            try {
                                // Après sauvegarde, on ne re-extrait pas le PDF bloqué.
                                // On ferme le modal et on affiche un bouton "Reprendre" pour continuer au PDF suivant.
                                setShowExtractModal(false);
                                setCanResume(true);
                                toast.success('Données sauvegardées. Prêt à reprendre au document suivant.');
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
        </div>
    );
};

export default LoopStarter;
