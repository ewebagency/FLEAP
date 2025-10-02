'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSession } from '@/app/component/SessionProvider';
import { supabase } from '@/app/database/supabaseClient';
import { processPdfList } from '../utils/loop';
import { runMetaOcrForPdf } from '../utils/extract';
import { autoLinkDocs, BulkAutoLinkOutcome } from '../utils/bulk_autolink';
import { verifierEtMettreAJourAlerte } from '../utils/alerte';
import { LINK_CONFIGS, getLinkConfigById } from '../utils/default_auto_link_params';
import { toast } from 'react-hot-toast';
import Swal from 'sweetalert2';
import BoxIcon from '@/app/component/BoxIconWrapper';
import { normalizePdfData, buildFactureFromNormalized, push_in_facture_bdd, ParamsMapping } from '../utils/link';
import { getParamsMappingByEntreprise } from '../utils/bdd';
import ExtractDoc from './ExtractDoc';


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
                        
                        <div className="p-1.5 border-b border-gray-100 flex gap-1">
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-sm hover:bg-blue-100 transition-colors"
                            >
                                Tout sélectionner
                            </button>
                            <button
                                type="button"
                                onClick={handleClearAll}
                                className="text-xs px-2 py-0.5 bg-gray-50 text-gray-600 rounded-sm hover:bg-gray-100 transition-colors"
                            >
                                Tout effacer
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

// Composant Tooltip simple
const Tooltip: React.FC<{ children: React.ReactNode; content: string }> = ({ children, content }) => {
    const [show, setShow] = useState(false);
    
    return (
        <div 
            className="relative inline-block"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
        >
            {children}
            {show && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-50">
                    {content}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                </div>
            )}
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
    const [autoLinkPhase, setAutoLinkPhase] = useState<'idle' | 'simulation' | 'confirmation' | 'applying'>('idle');
    const [selectedPdfIds, setSelectedPdfIds] = useState<string[]>([]);
    const [processingResults, setProcessingResults] = useState<ProcessingResult[]>([]);
    const [showReview, setShowReview] = useState(false);
    
    // Configuration de linkage sélectionnée
    const [selectedConfigId, setSelectedConfigId] = useState<string>('normal');
    
    // Obtenir la configuration actuelle
    const currentConfig = useMemo(() => {
        return getLinkConfigById(selectedConfigId) || LINK_CONFIGS[1]; // fallback sur Normal
    }, [selectedConfigId]);
    
    // Pause/Reprise en cas d'absence d'exemple RAG
    const [paused, setPaused] = useState(false);
    const [pausedPdfId, setPausedPdfId] = useState<string | null>(null);
    const [pausedAtIndex, setPausedAtIndex] = useState<number | null>(null);
    const [canResume, setCanResume] = useState(false);
    const [resumeMode, setResumeMode] = useState<'split_then_extract' | 'extract_only' | null>(null);
    const [showExtractModal, setShowExtractModal] = useState(false);
    
    // États des filtres multiselect
    const [filters, setFilters] = useState<FilterState>({
        alerteStop: null,
        providers: [],
        siteSirets: [],
        documentTypes: [],
        statuses: [],
        pages: ''
    });

    // Options pour les filtres (seront remplies depuis la BDD)
    const [filterOptions, setFilterOptions] = useState<FilterOptions>({
        providers: [],
        sites: [],
        documentTypes: [],
        statuses: []
    });

    // Charger les PDFs et les options de filtres depuis la BDD
    useEffect(() => {
        const fetchData = async () => {
            if (!entreprise_id) return;
            
            setLoading(true);
            try {
                const entrepriseIdNumber = Number(entreprise_id);
                if (isNaN(entrepriseIdNumber)) {
                    console.error('entreprise_id invalide:', entreprise_id);
                    return;
                }
                
                // Récupérer les PDFs
                const { data: pdfData, error: pdfError } = await supabase
                    .from('pdf_infos')
                    .select('*')
                    .eq('entreprise_id', entrepriseIdNumber)
                    .order('created_at', { ascending: false });

                if (pdfError) throw pdfError;
                setPdfInfos(pdfData || []);

                // Récupérer les sites depuis table_autocompletion
                const { data: siteData, error: siteError } = await supabase
                    .from('table_autocompletion')
                    .select('site')
                    .eq('entreprise_id', entrepriseIdNumber);

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
                        label: type === 'bon' ? 'Bons de livraison' :
                               type === 'bsd' ? 'BSD' :
                               type === 'facture' ? 'Factures' :
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
                console.error('Erreur lors du chargement des données:', error);
                toast.error('Erreur lors du chargement des données');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [entreprise_id]);

    // Filtrer les PDFs selon les critères multiselect
    const filteredPdfs = useMemo(() => {
        return pdfInfos.filter(pdf => {
            // Exclure systématiquement les fichiers Excel
            if (pdf.document_type === 'excel') return false;
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
    }, [pdfInfos, filters]);

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

    const anyProcessing = processingSplitThenExtract || processingSplitOnly || processingExtractOnly || processingAutoPropose;

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
                // Enchaîner automatiquement avec la vérification des alertes
                try {
                    // Lancer la vérification pour les mêmes IDs sélectionnés
                    for (const pdfId of selectedPdfIds) {
                        await verifierEtMettreAJourAlerte(pdfId, entreprise_id);
                    }
                    toast.success('Vérification des alertes terminée');
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
                    let skipped = 0;

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
                                    skipped += 1;
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
                            skipped += 1;
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

            if (successCount > 0) toast.success(`${successCount} facture(s) poussée(s)`);
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

    // Charger les données détaillées d'un PDF après traitement
    const loadDetailedPdfData = async (pdfId: string) => {
        try {
            if (!entreprise_id) return null;
            const entrepriseIdNumber = Number(entreprise_id);
            if (isNaN(entrepriseIdNumber)) return null;
            
            const { data, error } = await supabase
                .from('pdf_infos')
                .select('*')
                .eq('id', pdfId)
                .eq('entreprise_id', entrepriseIdNumber)
                .single();

            if (error || !data) return null;

            return {
                confidence: data.confidence,
                alerte: data.alerte,
                infos_raw: data.infos_raw,
                status: data.status
            };
        } catch (error) {
            console.error('Erreur lors du chargement des données détaillées:', error);
            return null;
        }
    };

    // Obtenir le niveau de confiance en texte
    const getConfidenceLevel = (confidence: { brute: number; spec: number }) => {
        if (confidence.brute >= 80 && confidence.spec >= 80) return 'Élevée';
        if (confidence.brute >= 60 && confidence.spec >= 60) return 'Moyenne';
        return 'Faible';
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
            <div className="bg-white rounded-lg shadow-sm w-full max-w-6xl max-h-[90vh] overflow-y-auto border border-gray-100">
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

                    {/* Filtres multiselect en une ligne */}
                    <div className="mb-3">
                        <div className="grid grid-cols-6 gap-1.5">
                            {/* Filtre statuses multiselect */}
                            <MultiSelect
                                options={filterOptions.statuses}
                                selectedValues={filters.statuses}
                                onChange={(values) => setFilters(prev => ({ ...prev, statuses: values }))}
                                placeholder="Tous les statuts"
                                label="Statuts"
                            />

                            {/* Filtre document_types multiselect */}
                            <MultiSelect
                                options={filterOptions.documentTypes}
                                selectedValues={filters.documentTypes}
                                onChange={(values) => setFilters(prev => ({ ...prev, documentTypes: values }))}
                                placeholder="Tous les types"
                                label="Types"
                            />

                            {/* Filtre sites multiselect */}
                            <MultiSelect
                                options={filterOptions.sites}
                                selectedValues={filters.siteSirets}
                                onChange={(values) => setFilters(prev => ({ ...prev, siteSirets: values }))}
                                placeholder="Tous les sites"
                                label="Sites"
                            />

                            {/* Filtre providers multiselect */}
                            <MultiSelect
                                options={filterOptions.providers}
                                selectedValues={filters.providers}
                                onChange={(values) => setFilters(prev => ({ ...prev, providers: values }))}
                                placeholder="Tous les providers"
                                label="Providers"
                            />

                            {/* Filtre alerte.stop */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Alerte Stop
                                </label>
                                <select
                                    value={filters.alerteStop === null ? '' : filters.alerteStop.toString()}
                                    onChange={(e) => setFilters(prev => ({
                                        ...prev,
                                        alerteStop: e.target.value === '' ? null : e.target.value === 'true'
                                    }))}
                                    className="w-full p-1 text-xs border border-gray-200 rounded-sm focus:outline-none focus:ring-0.5 focus:ring-blue-300 hover:border-gray-300 transition-colors"
                                >
                                    <option value="">Tous</option>
                                    <option value="true">Avec alerte</option>
                                    <option value="false">Sans alerte</option>
                                </select>
                            </div>
                            {/* Filtre nombre de pages */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Nombre de pages
                                </label>
                                <select
                                    value={filters.pages}
                                    onChange={(e) => setFilters(prev => ({ ...prev, pages: e.target.value as FilterState['pages'] }))}
                                    className="w-full p-1 text-xs border border-gray-200 rounded-sm focus:outline-none focus:ring-0.5 focus:ring-blue-300 hover:border-gray-300 transition-colors"
                                >
                                    <option value="">Tous</option>
                                    <option value="one">1 page</option>
                                    <option value="multi">Plusieurs</option>
                                </select>
                            </div>
                        </div>
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
                                <span className="text-xs text-gray-400">
                                    {filteredPdfs.length} document{filteredPdfs.length > 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto">
                            {filteredPdfs.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    <BoxIcon name="bx-file" size="48" className="mx-auto mb-4 text-gray-300" />
                                    <p className="text-lg font-medium">Aucun PDF trouvé</p>
                                    <p className="text-sm">Aucun PDF ne correspond aux critères de filtrage sélectionnés</p>
                                </div>
                            ) : (
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-3 py-2 text-left">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPdfIds.length === filteredPdfs.length && filteredPdfs.length > 0}
                                                    onChange={handleSelectAll}
                                                    className="h-3.5 w-3.5 text-blue-500 focus:ring-0.5 focus:ring-blue-300 border-gray-200 rounded-sm"
                                                />
                                            </th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Nom du document</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Statut</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Type</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Pages</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Site</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Provider</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Date</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Alerte</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPdfs.map((pdf) => (
                                            <tr
                                                key={pdf.id}
                                                className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                                            >
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPdfIds.includes(pdf.id)}
                                                        onChange={() => handleSelectPdf(pdf.id)}
                                                        className="h-3.5 w-3.5 text-blue-500 focus:ring-0.5 focus:ring-blue-300 border-gray-200 rounded-sm"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="font-medium text-gray-900 text-sm truncate max-w-xs" title={pdf.name_pdf || 'Document sans nom'}>
                                                        {pdf.name_pdf || 'Document sans nom'}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className={`text-xs px-1.5 py-0.5 rounded-sm ${
                                                        pdf.status === 'processed' || pdf.status === 'extracted' ? 'bg-green-50 text-green-600' :
                                                        pdf.status === 'error' ? 'bg-red-50 text-red-600' :
                                                        pdf.status === 'splitted' || pdf.status === 'splitted_extracted' ? 'bg-blue-50 text-blue-600' :
                                                        'bg-yellow-50 text-yellow-600'
                                                    }`}>
                                                        {filterOptions.statuses.find(s => s.value === pdf.status)?.label || pdf.status}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className="text-xs bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded-sm">
                                                        {filterOptions.documentTypes.find(t => t.value === pdf.document_type)?.label || pdf.document_type || 'Inconnu'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className="text-xs text-gray-600">
                                                        {typeof pdf.nb_pages === 'number' ? pdf.nb_pages : '-'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    {pdf.site_siret_plus && pdf.site_siret_plus.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {pdf.site_siret_plus.slice(0, 2).map((siret, index) => (
                                                                <span
                                                                    key={index}
                                                                    className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-sm"
                                                                    title={getSiteName(siret)}
                                                                >
                                                                    {getSiteName(siret).length > 15 ? getSiteName(siret).substring(0, 15) + '...' : getSiteName(siret)}
                                                                </span>
                                                            ))}
                                                            {pdf.site_siret_plus.length > 2 && (
                                                                <span className="text-xs text-gray-400">
                                                                    +{pdf.site_siret_plus.length - 2}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {pdf.provider && typeof pdf.provider === 'object' ? (
                                                        <span className="text-xs bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded-sm">
                                                            {Object.values(pdf.provider).join(' ').length > 20 
                                                                ? Object.values(pdf.provider).join(' ').substring(0, 20) + '...' 
                                                                : Object.values(pdf.provider).join(' ')
                                                            }
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className="text-xs text-gray-500">
                                                        {new Date(pdf.created_at).toLocaleDateString()}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    {pdf.alerte && typeof pdf.alerte === 'object' && 'stop' in pdf.alerte && pdf.alerte.stop === true ? (
                                                        <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded-sm">
                                                            ⚠️ Stop
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>                    

                    {/* Résumé et statistiques en grid-2 */}
                    <div className="grid grid-cols-[1fr_4fr] gap-3 mb-3 mt-3">
                        {/* Résumé des paramètres */}
                        <div className="p-2.5 bg-gray-50 rounded-md">
                            <h3 className="text-xs font-medium text-gray-600 mb-1.5">Paramètres actifs :</h3>
                            <div className="text-xs text-gray-500 space-y-0.5">
                                <div>• Statuts: {filters.statuses.length > 0 ? filters.statuses.map(status => filterOptions.statuses.find(s => s.value === status)?.label || status).join(', ') : 'Tous'}</div>
                                <div>• Types: {filters.documentTypes.length > 0 ? filters.documentTypes.map(type => filterOptions.documentTypes.find(t => t.value === type)?.label || type).join(', ') : 'Tous'}</div>
                                <div>• Sites: {filters.siteSirets.length > 0 ? filters.siteSirets.map(siret => getSiteName(siret)).join(', ') : 'Tous'}</div>
                                <div>• Providers: {filters.providers.length > 0 ? filters.providers.join(', ') : 'Tous'}</div>
                                <div>• Alerte: {filters.alerteStop === null ? 'Tous' : filters.alerteStop ? 'Avec' : 'Sans'}</div>
                            </div>
                        </div>

                        {/* Statistiques et boutons d'action */}
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
                                        <div className="grid grid-cols-2 gap-2">
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
                                        <Tooltip content={`Config: ${currentConfig.name} - ${currentConfig.description}`}>
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
                                        </Tooltip>
                                        <Tooltip content={`Config: ${currentConfig.name} - ${currentConfig.description}`}>
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
                                        </Tooltip>
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

// Composant pour afficher les détails d'un PDF traité
const PdfDetailsReview: React.FC<{
    pdfId: string;
    newPdfIds?: string[];
    wasSplit?: boolean;
}> = ({ pdfId, newPdfIds, wasSplit }) => {
    const { entreprise_id } = useSession();
    const [details, setDetails] = useState<{
        confidence?: { brute: number; spec: number; handwritten: [number, boolean] };
        alerte?: { stop: boolean; message: string };
        status?: string;
    } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadDetails = async () => {
            if (!entreprise_id) return;
            
            try {
                const entrepriseIdNumber = Number(entreprise_id);
                if (isNaN(entrepriseIdNumber)) return;
                
                // Si le PDF a été divisé, charger les détails de la première page divisée
                const targetPdfId = wasSplit && newPdfIds && newPdfIds.length > 0 
                    ? newPdfIds[0] 
                    : pdfId;

                const { data, error } = await supabase
                    .from('pdf_infos')
                    .select('confidence, alerte, status')
                    .eq('id', targetPdfId)
                    .eq('entreprise_id', entrepriseIdNumber)
                    .single();

                if (!error && data) {
                    setDetails({
                        confidence: data.confidence,
                        alerte: data.alerte,
                        status: data.status
                    });
                }
            } catch (error) {
                console.error('Erreur lors du chargement des détails:', error);
            } finally {
                setLoading(false);
            }
        };

        loadDetails();
    }, [pdfId, newPdfIds, wasSplit, entreprise_id]);

    if (loading) {
        return (
            <div className="text-sm text-gray-500">
                Chargement des détails...
            </div>
        );
    }

    if (!details) {
        return (
            <div className="text-sm text-gray-500">
                Aucun détail disponible
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {/* Confidence */}
            {details.confidence && (
                <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">Confidence:</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                        details.confidence.brute >= 80 && details.confidence.spec >= 80
                            ? 'bg-green-100 text-green-800'
                            : details.confidence.brute >= 60 && details.confidence.spec >= 60
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                    }`}>
                        Brute: {details.confidence.brute}% | Spec: {details.confidence.spec}%
                    </span>
                    {details.confidence.handwritten && details.confidence.handwritten[1] && (
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                            Manuscrit: {details.confidence.handwritten[0]}%
                        </span>
                    )}
                </div>
            )}

            {/* Alerte */}
            {details.alerte && (
                <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">Alerte:</span>
                    {details.alerte.stop ? (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                            ⚠️ Stop: {details.alerte.message}
                        </span>
                    ) : details.alerte.message ? (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            ℹ️ {details.alerte.message}
                        </span>
                    ) : (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            ✅ Aucune alerte
                        </span>
                    )}
                </div>
            )}

            {/* Statut */}
            {details.status && (
                <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">Statut:</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                        details.status.includes('extracted') ? 'bg-green-100 text-green-800' :
                        details.status.includes('error') ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                    }`}>
                        {details.status}
                    </span>
                </div>
            )}

            {/* Informations sur le split */}
            {wasSplit && newPdfIds && newPdfIds.length > 0 && (
                <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">Pages créées:</span>
                    <div className="flex flex-wrap gap-1">
                        {newPdfIds.map((id, index) => (
                            <span key={index} className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                                Page {index + 1} (ID: {id})
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoopStarter;

// Floating resume button when paused and ready
// Rendered by parent component return above; adding conditional render near root would be preferable,
// but we place a top-level helper here for clarity.
