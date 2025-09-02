'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSession } from '@/app/component/SessionProvider';
import { supabase } from '@/app/database/supabaseClient';
import { processPdfList } from '../utils/loop';
import { verifierEtMettreAJourAlerte } from '../utils/alerte';
import { toast } from 'react-hot-toast';
import BoxIcon from '@/app/component/BoxIconWrapper';

interface PdfInfo {
    id: string;
    name_pdf: string;
    name_pdf_in_bucket: string;
    pdf_path: string;
    created_at: string;
    status: string;
    document_type: string | null;
    file_size: number | null;
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
                    className="w-full p-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-left flex items-center justify-between"
                >
                    <span className="truncate">{getDisplayText()}</span>
                    <BoxIcon name="bx-chevron-down" size="16" className="text-gray-400" />
                </button>
                
                {isOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
                        <div className="p-2 border-b border-gray-200">
                            <input
                                type="text"
                                placeholder="Rechercher..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full p-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        
                        <div className="p-2 border-b border-gray-200 flex gap-1">
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            >
                                Tout sélectionner
                            </button>
                            <button
                                type="button"
                                onClick={handleClearAll}
                                className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
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
                                            className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleToggleOption(value)}
                                                className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <span className="ml-2 text-xs text-gray-700 truncate">
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
    const { entreprise_id } = useSession();
    const [pdfInfos, setPdfInfos] = useState<PdfInfo[]>([]);
    const [sites, setSites] = useState<SiteInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [processingAlertes, setProcessingAlertes] = useState(false);
    const [selectedPdfIds, setSelectedPdfIds] = useState<string[]>([]);
    const [processingResults, setProcessingResults] = useState<ProcessingResult[]>([]);
    const [showReview, setShowReview] = useState(false);
    
    // États des filtres multiselect
    const [filters, setFilters] = useState<FilterState>({
        alerteStop: null,
        providers: [],
        siteSirets: [],
        documentTypes: [],
        statuses: []
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

                // Extraire les types de documents uniques depuis la BDD
                const uniqueDocumentTypes = new Set<string>();
                pdfData?.forEach(pdf => {
                    if (pdf.document_type) {
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

        setProcessing(true);
        setProcessingResults([]);
        setShowReview(false);
        
        try {
            const result = await processPdfList(selectedPdfIds, parseInt(entreprise_id));
            
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
                setSelectedPdfIds([]);
            } else {
                toast.error(`Traitement terminé avec des erreurs : ${result.message}`);
                if (result.errors.length > 0) {
                    console.error('Erreurs détaillées:', result.errors);
                }
            }
        } catch (error) {
            console.error('Erreur lors du traitement:', error);
            toast.error('Erreur lors du traitement des PDFs');
        } finally {
            setProcessing(false);
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
                <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold text-gray-800">
                            Extraction en boucle - Sélection des PDFs
                        </h2>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="text-gray-500 hover:text-gray-700 p-2"
                            >
                                <BoxIcon name="x" size="24" />
                            </button>
                        )}
                    </div>

                    {/* Filtres multiselect en une ligne */}
                    <div className="mb-4">
                        <div className="grid grid-cols-5 gap-2">
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
                                    className="w-full p-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="">Tous</option>
                                    <option value="true">Avec alerte</option>
                                    <option value="false">Sans alerte</option>
                                </select>
                            </div>

                            {/* Filtre providers multiselect */}
                            <MultiSelect
                                options={filterOptions.providers}
                                selectedValues={filters.providers}
                                onChange={(values) => setFilters(prev => ({ ...prev, providers: values }))}
                                placeholder="Tous les providers"
                                label="Providers"
                            />

                            {/* Filtre sites multiselect */}
                            <MultiSelect
                                options={filterOptions.sites}
                                selectedValues={filters.siteSirets}
                                onChange={(values) => setFilters(prev => ({ ...prev, siteSirets: values }))}
                                placeholder="Tous les sites"
                                label="Sites"
                            />

                            {/* Filtre document_types multiselect */}
                            <MultiSelect
                                options={filterOptions.documentTypes}
                                selectedValues={filters.documentTypes}
                                onChange={(values) => setFilters(prev => ({ ...prev, documentTypes: values }))}
                                placeholder="Tous les types"
                                label="Types"
                            />

                            {/* Filtre statuses multiselect */}
                            <MultiSelect
                                options={filterOptions.statuses}
                                selectedValues={filters.statuses}
                                onChange={(values) => setFilters(prev => ({ ...prev, statuses: values }))}
                                placeholder="Tous les statuts"
                                label="Statuts"
                            />
                        </div>
                    </div>

                    {/* Liste des PDFs */}
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <input
                                        type="checkbox"
                                        checked={selectedPdfIds.length === filteredPdfs.length && filteredPdfs.length > 0}
                                        onChange={handleSelectAll}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <span className="font-medium text-gray-700">Sélectionner tous</span>
                                </div>
                                <span className="text-sm text-gray-500">
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
                                filteredPdfs.map((pdf) => (
                                    <div
                                        key={pdf.id}
                                        className="flex items-center space-x-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedPdfIds.includes(pdf.id)}
                                            onChange={() => handleSelectPdf(pdf.id)}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mb-1"
                                        />
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <span className="font-medium text-gray-900 truncate text-sm">
                                                    {pdf.name_pdf || 'Document sans nom'}
                                                </span>
                                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                                    {filterOptions.documentTypes.find(t => t.value === pdf.document_type)?.label || pdf.document_type || 'Inconnu'}
                                                </span>
                                                <span className={`text-xs px-2 py-1 rounded ${
                                                    pdf.status === 'processed' || pdf.status === 'extracted' ? 'bg-green-100 text-green-800' :
                                                    pdf.status === 'error' ? 'bg-red-100 text-red-800' :
                                                    pdf.status === 'splitted' || pdf.status === 'splitted_extracted' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                    {filterOptions.statuses.find(s => s.value === pdf.status)?.label || pdf.status}
                                                </span>

                                                <span className="flex items-center space-x-4 text-sm text-gray-500">
                                                    <span>{new Date(pdf.created_at).toLocaleDateString()}</span>
                                                    {pdf.alerte && typeof pdf.alerte === 'object' && 'stop' in pdf.alerte && pdf.alerte.stop === true && (
                                                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                                            ⚠️ Alerte stop
                                                        </span>
                                                    )}
                                                </span>                                                
                                            </div>
                                            

                                            
                                            {pdf.site_siret_plus && pdf.site_siret_plus.length > 0 && (
                                                <div className="flex items-center space-x-2 mt-1 hidden">
                                                    <span className="text-xs text-gray-400">📍 Sites:</span>
                                                    <div className="flex flex-wrap gap-1">
                                                        {pdf.site_siret_plus.map((siret, index) => (
                                                            <span
                                                                key={index}
                                                                className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded"
                                                                title={getSiteName(siret)}
                                                            >
                                                                {getSiteName(siret)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>                    

                    {/* Résumé et statistiques en grid-2 */}
                    <div className="grid grid-cols-2 gap-4 mb-4 mt-4">
                        {/* Résumé des paramètres */}
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Paramètres actifs :</h3>
                            <div className="text-xs text-gray-600 space-y-1">
                                <div>• Alerte: {filters.alerteStop === null ? 'Tous' : filters.alerteStop ? 'Avec' : 'Sans'}</div>
                                <div>• Providers: {filters.providers.length > 0 ? filters.providers.join(', ') : 'Tous'}</div>
                                <div>• Sites: {filters.siteSirets.length > 0 ? filters.siteSirets.map(siret => getSiteName(siret)).join(', ') : 'Tous'}</div>
                                <div>• Types: {filters.documentTypes.length > 0 ? filters.documentTypes.map(type => filterOptions.documentTypes.find(t => t.value === type)?.label || type).join(', ') : 'Tous'}</div>
                                <div>• Statuts: {filters.statuses.length > 0 ? filters.statuses.map(status => filterOptions.statuses.find(s => s.value === status)?.label || status).join(', ') : 'Tous'}</div>
                            </div>
                        </div>

                        {/* Statistiques et boutons d'action */}
                        <div className="p-3 bg-blue-50 rounded-lg">
                            <div className="flex items-center justify-between h-full">
                                <div className="flex items-center space-x-4">
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-blue-600">{filteredPdfs.length}</div>
                                        <div className="text-xs text-blue-600">PDFs filtrés</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-green-600">{selectedPdfIds.length}</div>
                                        <div className="text-xs text-green-600">Sélectionnés</div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={handleCheckAlertes}
                                        disabled={processingAlertes || selectedPdfIds.length === 0}
                                        className="px-3 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
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
                                    <button
                                        onClick={handleProcessPdfs}
                                        disabled={processing || processingAlertes || selectedPdfIds.length === 0}
                                        className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
                                    >
                                        {processing ? (
                                            <>
                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                                <span>Traitement...</span>
                                            </>
                                        ) : (
                                            <>
                                                <BoxIcon name="bx-play" size="16" />
                                                <span>Extraire ({selectedPdfIds.length})</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>



                    {/* Section Review des résultats */}
                    {showReview && processingResults.length > 0 && (
                        <div className="mt-8 p-6 bg-white rounded-lg shadow-lg border border-gray-200">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-gray-800">
                                    📊 Résultats du traitement
                                </h3>
                                <button
                                    onClick={() => setShowReview(false)}
                                    className="text-gray-500 hover:text-gray-700 p-2"
                                >
                                    <BoxIcon name="bx-x" size="20" />
                                </button>
                            </div>

                            {/* Résumé statistiques */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-blue-50 p-4 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-blue-600">{processingResults.length}</div>
                                    <div className="text-sm text-blue-600">Total traité</div>
                                </div>
                                <div className="bg-green-50 p-4 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-green-600">{processingResults.filter(r => r.success).length}</div>
                                    <div className="text-sm text-green-600">Succès</div>
                                </div>
                                <div className="bg-red-50 p-4 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-red-600">{processingResults.filter(r => !r.success).length}</div>
                                    <div className="text-sm text-red-600">Échecs</div>
                                </div>
                                <div className="bg-purple-50 p-4 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-purple-600">{processingResults.filter(r => r.wasSplit).length}</div>
                                    <div className="text-sm text-purple-600">Divisés</div>
                                </div>
                            </div>

                            {/* Détails des traitements */}
                            <div className="space-y-3">
                                <h4 className="font-medium text-gray-700">Détails par document :</h4>
                                <div className="max-h-96 overflow-y-auto space-y-2">
                                    {processingResults.map((result, index) => (
                                        <div
                                            key={index}
                                            className={`p-4 rounded-lg border ${
                                                result.success
                                                    ? 'bg-green-50 border-green-200'
                                                    : 'bg-red-50 border-red-200'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="font-medium text-sm mb-1">{result.originalPdfName}</div>
                                                    {result.error && (
                                                        <div className="text-xs text-red-600 mb-2">{result.error}</div>
                                                    )}
                                                    <div className="text-sm text-gray-600">{result.message}</div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {result.success && (
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                            result.wasSplit
                                                                ? 'bg-purple-100 text-purple-800'
                                                                : 'bg-green-100 text-green-800'
                                                        }`}>
                                                            {result.wasSplit ? 'Divisé' : 'Succès'}
                                                        </span>
                                                    )}
                                                    {!result.success && (
                                                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
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
