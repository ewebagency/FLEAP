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
import {
    PdfInfo,
    SiteInfo,
    FilterState,
    FilterOptions,
    ProcessingResult,
    LoopStarterProps,
    FilterState as FilterStateType
} from './LoopStarterTypes';
import { MultiSelect, getAlerteFlags } from './LoopStarterFilters';
import {
    refreshData,
    handleProcessPdfs,
    handleSplitOnly,
    handleSmartSplit,
    handleExtractOnly,
    handleAutoLinkSelected,
    handleAutoProposeSelected,
    handlePushSelected,
    handleCheckAlertes
} from './LoopStarterHandlers';

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
    const [selectedConfigId, setSelectedConfigId] = useState<string>('normal');
    
    // Obtenir la configuration actuelle
    const currentConfig = useMemo(() => {
        return getLinkConfigById(selectedConfigId) || LINK_CONFIGS[1]; // fallback sur Normal
    }, [selectedConfigId]);
    
    // Pause/Reprise en cas d'absence d'exemple RAG
    const [paused, setPaused] = useState(false);
    const [pausedPdfId, setPausedPdfId] = useState<string | null>(null);
    const [pausedAtIndex, setPausedAtIndex] = useState<number | null>(null);
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
                                                onChange={(e) => setFilters(prev => ({ ...prev, pages: e.target.value as FilterStateType['pages'] }))}
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
        </div>
    );
};

export default LoopStarter;

