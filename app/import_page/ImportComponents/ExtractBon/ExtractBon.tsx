import { useEffect, useState } from "react";
import { PdfInfo } from "../TableImportedFiles";
import { useSession } from "@/app/component/SessionProvider";
import { supabase } from "@/app/database/supabaseClient";
import PdfDisplayer from '@/app/interface_admin_2/InterfaceAdmin2/PdfDisplayer';
import { toast } from 'react-hot-toast';
import OCRThisBon from './OCRThisBon';
import { 
    BonCerfa, 
    enrichExtractedData, 
    fetchAutocompletionData, 
    saveBonData, 
    updatePdfStatus 
} from './utils';
import SplitBon from './SplitBon';

// Interface BonCerfa maintenant importée depuis utils.ts

const ExtractBon = ({ pdf_id, pdf_path, pdf_status, onExtract }: { pdf_id: number, pdf_path: string, pdf_status?: string, onExtract?: (pdfId: number, newStatus: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const {entreprise_id, user_id} = useSession();
    const [existingData, setExistingData] = useState<Partial<BonCerfa> | null>(null);
    const [perfectExtract, setPerfectExtract] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const loadExistingData = async () => {
        try {
            const { data, error } = await supabase
                .from('bon_pdf')
                .select('*')
                .eq('pdf_id', pdf_id)
                .single();

            if (error) {
                if (error.code !== 'PGRST116') { // PGRST116 is the error code for no rows returned
                    console.error('Error loading existing data:', error);
                }
                return;
            }

            if (data) {
                setExistingData(data.infos as Partial<BonCerfa>);
                setPerfectExtract(data.infos?.perfect_extract || false);
            }
        } catch (error) {
            console.error('Error loading existing data:', error);
        }
    };

    const handleSave = async (formData: Partial<BonCerfa>) => {
        setIsLoading(true);
        try {
            const saveResult = await saveBonData(pdf_id, entreprise_id || '', user_id || '', formData, undefined, pdf_status);
            
            if (!saveResult.success) {
                throw new Error(saveResult.error || 'Erreur lors de la sauvegarde');
            }

            toast.success('Bon de livraison sauvegardé avec succès');
            
            // Mettre à jour le statut du PDF dans la base de données
            let newStatus = 'extracted';
            
            // Si le statut initial est 'splitted', vérifier les conditions pour passer à 'splitted_extracted'
            if (pdf_status === 'splitted') {
                // Vérifier qu'il y a une date ET un tonnage
                const hasDate = formData.date && formData.date.trim() !== '';
                const hasTonnage = formData.dechet?.tonnage && formData.dechet.tonnage > 0;
                
                if (hasDate && hasTonnage) {
                    newStatus = 'splitted_extracted';
                } else {
                    newStatus = 'splitted'; // Garder le statut splitted si conditions non remplies
                }
            }
            
            // Mettre à jour le statut dans la base de données
            const updateResult = await updatePdfStatus(pdf_id, newStatus, formData, entreprise_id || undefined);
            if (!updateResult.success) {
                console.warn(`Erreur lors de la mise à jour du statut: ${updateResult.error}`);
            }
            
            // Mettre à jour l'état local si la fonction onExtract est fournie
            if (onExtract) {
                onExtract(pdf_id, newStatus);
            }
            
            setIsOpen(false);
        } catch (error) {
            console.error('Error saving bon data:', error);
            toast.error('Erreur lors de la sauvegarde');
        } finally {
            setIsLoading(false);
        }
    };

    const OpenExtractModalButton = () => {
        return (
            <button 
            className="bg-blue-800 text-xs text-white px-4 py-2 rounded-lg hover:bg-blue-900 transition-colors"
            onClick={() => {
                setIsOpen(true);
                loadExistingData();
            }}>
                Extraire Bon
            </button>
        )
    }

    const DisplayBonPDF = ({ pdf_id, pdf_path }: { pdf_id: number, pdf_path: string }) => {
        const [pdfUrl, setPdfUrl] = useState<string | null>(null);
        const [loading, setLoading] = useState(false);

        const getPdfUrl = async () => {
            try {
                setLoading(true);
                const { data } = await supabase.storage
                    .from('pdfs_bucket')
                    .createSignedUrl(pdf_path, 3600);

                if (data?.signedUrl) {
                    setPdfUrl(data.signedUrl);
                    return data.signedUrl;
                }
                throw new Error('URL du PDF non trouvée');
            } catch (error) {
                console.error('Erreur lors de la récupération de l\'URL du PDF:', error);
                toast.error('Erreur lors du chargement du PDF');
            } finally {
                setLoading(false);
            }
        };
        
        useEffect(() => {
            getPdfUrl();
        }, [pdf_path]);

        return (
            <div className="w-full h-full">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <p>Chargement du PDF...</p>
                    </div>
                ) : pdfUrl ? (
                    <PdfDisplayer pdfUrl={pdfUrl} />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p>Impossible de charger le PDF</p>
                    </div>
                )}
            </div>
        )
    }

    const FormulaireExtractBonInfos = ({ entreprise_id, onSave }: { entreprise_id: string | null, onSave: (formData: Partial<BonCerfa>) => Promise<void> }) => {
        // Fonction pour obtenir la clé de stockage unique pour ce PDF
        const getStorageKey = () => `bon_form_data_${pdf_id}`;
        
        // Fonction pour sauvegarder les données dans localStorage
        const saveToLocalStorage = (data: Partial<BonCerfa>) => {
            try {
                localStorage.setItem(getStorageKey(), JSON.stringify(data));
            } catch (error) {
                console.error('Erreur lors de la sauvegarde dans localStorage:', error);
            }
        };
        
        // Fonction pour charger les données depuis localStorage
        const loadFromLocalStorage = (): Partial<BonCerfa> | null => {
            try {
                const saved = localStorage.getItem(getStorageKey());
                return saved ? JSON.parse(saved) : null;
            } catch (error) {
                console.error('Erreur lors du chargement depuis localStorage:', error);
                return null;
            }
        };
        
        // Fonction pour réinitialiser le formulaire
        const resetForm = () => {
            const initialData: Partial<BonCerfa> = {
                numeroBon: '',
                date: '',
                            dechet: {
                nom: '',
                codeCED: '',
                tonnage: 0,
                code_traitement: ''
            },
                site: {
                    nom: '',
                    siret: '',
                    adresse: '',
                    contact: '',
                    tel: '',
                    email: ''
                },
                prestataire: {
                    nom: '',
                    siret: '',
                    adresse: '',
                    contact: '',
                    tel: '',
                    email: ''
                },
                site_raw: '',
                presta_raw: ''
            };
            setFormData(initialData);
            localStorage.removeItem(getStorageKey());
        };

        const [formData, setFormData] = useState<Partial<BonCerfa>>(() => {
            // Charger d'abord les données existantes, puis localStorage, puis valeurs par défaut
            if (existingData) {
                return existingData;
            }
            
            const savedData = loadFromLocalStorage();
            if (savedData) {
                return savedData;
            }
            
            return {
            numeroBon: '',
            date: '',
            dechet: {
                nom: '',
                codeCED: '',
                tonnage: 0,
                code_traitement: ''
            },
            site: {
                nom: '',
                siret: '',
                adresse: '',
                contact: '',
                tel: '',
                email: ''
            },
            prestataire: {
                nom: '',
                siret: '',
                adresse: '',
                contact: '',
                tel: '',
                email: ''
            },
            site_raw: '',
            presta_raw: ''
            };
        });
        const [isLoading, setIsLoading] = useState(false);

        const [sites, setSites] = useState<Array<{id: number, nom: string, siret: string, adresse: string, contact?: string, tel?: string, email?: string}>>([]);
        const [prestataires, setPrestataires] = useState<Array<{id: number, nom: string, siret: string, adresse: string, contact?: string, tel?: string, email?: string}>>([]);

        // Fonction enrichExtractedData maintenant importée depuis utils.ts

        // Types maintenant définis dans utils.ts

        // Charger les données existantes
        useEffect(() => {
            if (existingData) {
                setFormData(existingData);
            }
        }, [existingData]);

        // Sauvegarder automatiquement les données quand elles changent
        useEffect(() => {
            saveToLocalStorage(formData);
        }, [formData]);

        // Charger les données d'autocomplétion
        useEffect(() => {
            const loadAutocompletionData = async () => {
                if (!entreprise_id) return;
                
                try {
                    const { sites: sitesData, prestataires: prestatairesData } = await fetchAutocompletionData(entreprise_id);
                    setSites(sitesData);
                    setPrestataires(prestatairesData);
                } catch (error) {
                    console.error('Erreur lors du chargement des données d\'autocomplétion:', error);
                }
            };

            loadAutocompletionData();
        }, [entreprise_id]);

        const handleInputChange = <K extends keyof BonCerfa>(field: K, value: Partial<BonCerfa>[K]) => {
            setFormData(prev => ({
                ...prev,
                [field]: value
            }));
        };

        const handleDechetChange = <K extends keyof BonCerfa['dechet']>(field: K, value: BonCerfa['dechet'][K]) => {
            setFormData(prev => ({
                ...prev,
                dechet: {
                    ...prev.dechet!,
                    [field]: value
                }
            }));
        };

        const handleSiteChange = <K extends keyof BonCerfa['site']>(field: K, value: BonCerfa['site'][K]) => {
            setFormData(prev => ({
                ...prev,
                site: {
                    ...prev.site!,
                    [field]: value
                }
            }));
        };

        const handlePrestataireChange = <K extends keyof BonCerfa['prestataire']>(field: K, value: BonCerfa['prestataire'][K]) => {
            setFormData(prev => ({
                ...prev,
                prestataire: {
                    ...prev.prestataire!,
                    [field]: value
                }
            }));
        };

        const handleSiteSelect = (siteId: number) => {
            const selectedSite = sites.find(site => site.id === siteId);
            if (selectedSite) {
                setFormData(prev => ({
                    ...prev,
                    site: {
                        nom: selectedSite.nom,
                        siret: selectedSite.siret,
                        adresse: selectedSite.adresse,
                        contact: selectedSite.contact || '',
                        tel: selectedSite.tel || '',
                        email: selectedSite.email || ''
                    }
                }));
            }
        };

        const handlePrestataireSelect = (prestataireId: number) => {
            const selectedPrestataire = prestataires.find(prestataire => prestataire.id === prestataireId);
            if (selectedPrestataire) {
                setFormData(prev => ({
                    ...prev,
                    prestataire: {
                        nom: selectedPrestataire.nom,
                        siret: selectedPrestataire.siret,
                        adresse: selectedPrestataire.adresse,
                        contact: selectedPrestataire.contact || '',
                        tel: selectedPrestataire.tel || '',
                        email: selectedPrestataire.email || ''
                    }
                }));
            }
        };

        return (
            <div className="h-full overflow-y-auto p-4 bg-gray-50">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-gray-800">Extraction Bon de Livraison</h2>
                        {perfectExtract !== null && (
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                                perfectExtract 
                                    ? 'bg-green-100 text-green-800 border border-green-200' 
                                    : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                            }`}>
                                {perfectExtract ? '🎯 Extraction parfaite' : '⚠️ Extraction partielle'}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                    <OCRThisBon 
                        pdf_id={pdf_id}
                        pdf_path={pdf_path}
                        pdf_status={pdf_status}
                        onDataExtracted={async (data: Partial<BonCerfa>, perfect_extract?: boolean) => {
                            // Enrichir les données avec les informations de known_data
                            const enrichedData = enrichExtractedData(data, sites, prestataires);
                            setFormData(prev => ({
                                ...prev,
                                ...enrichedData
                            }));
                            
                            // Sauvegarder les données avec le perfect_extract
                            if (entreprise_id && user_id) {
                                const saveResult = await saveBonData(pdf_id, entreprise_id, user_id, enrichedData, perfect_extract, pdf_status);
                                if (saveResult.success) {
                                    setPerfectExtract(perfect_extract || false);
                                    toast.success('Données extraites et sauvegardées avec succès');
                                } else {
                                    toast.error('Erreur lors de la sauvegarde');
                                }
                            }
                        }}
                    />
                        <SplitBon 
                            pdf_id={pdf_id}
                            pdf_path={pdf_path}
                            onClose={() => setIsOpen(false)}
                            currentFormData={formData}
                            entreprise_id={entreprise_id ?? undefined}
                            user_id={user_id ?? undefined}
                        />
                        <button
                            onClick={resetForm}
                            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                            title="Réinitialiser le formulaire"
                        >
                            Reset
                        </button>
                    </div>
                </div>
                
                {/* Numéro du bon et Date */}
                <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-blue-600 mb-4">Informations générales</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Numéro du bon
                            </label>
                            <input
                                type="text"
                                value={formData.numeroBon || ''}
                                onChange={(e) => handleInputChange('numeroBon', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="N° bon"
                            />

                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Date
                            </label>
                            <input
                                type="date"
                                value={formData.date || ''}
                                onChange={(e) => handleInputChange('date', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />

                        </div>
                    </div>
                </div>

                {/* Déchet */}
                <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-green-600 mb-4">Déchet</h3>
                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Nom du déchet
                            </label>
                            <input
                                type="text"
                                value={formData.dechet?.nom || ''}
                                onChange={(e) => handleDechetChange('nom', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="Nom du déchet"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Code CED
                            </label>
                            <input
                                type="text"
                                value={formData.dechet?.codeCED || ''}
                                onChange={(e) => handleDechetChange('codeCED', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="00 00 00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Tonnage (tonnes)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.dechet?.tonnage || ''}
                                onChange={(e) => handleDechetChange('tonnage', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Code traitement
                            </label>
                            <input
                                type="text"
                                value={formData.dechet?.code_traitement || ''}
                                onChange={(e) => handleDechetChange('code_traitement', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="D/R"
                            />
                        </div>
                    </div>
                </div>

                {/* Site */}
                <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-purple-600">Site</h3>
                        <textarea
                            value={formData.site_raw || ''}
                            onChange={(e) => handleInputChange('site_raw', e.target.value)}
                            rows={1}
                            className="w-2/3 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Coller ici le texte brut OCR du site"
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Nom du site
                        </label>
                        <select
                            value={sites.find(site => site.nom === formData.site?.nom)?.id || ''}
                            onChange={(e) => handleSiteSelect(parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="">Sélectionner un site</option>
                            {sites.map((site) => (
                                <option key={site.id} value={site.id}>
                                    {site.nom} - {site.siret}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    {/* Attributs du site en petit */}
                    <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
                        <div>
                            <span className="font-medium">SIRET:</span> {formData.site?.siret || '-'}
                        </div>
                        <div>
                            <span className="font-medium">Contact:</span> {formData.site?.contact || '-'}
                        </div>
                        <div>
                            <span className="font-medium">Tél:</span> {formData.site?.tel || '-'}
                        </div>
                        <div>
                            <span className="font-medium">Email:</span> {formData.site?.email || '-'}
                        </div>
                        <div className="col-span-2">
                            <span className="font-medium">Adresse:</span> {formData.site?.adresse || '-'}
                        </div>
                    </div>                    
                </div>

                {/* Prestataire */}
                <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-orange-600">Prestataire</h3>
                        <textarea
                            value={formData.presta_raw || ''}
                            onChange={(e) => handleInputChange('presta_raw', e.target.value)}
                            rows={1}
                            className="w-2/3 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                            placeholder="Coller ici le texte brut OCR du prestataire"
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Nom du prestataire
                        </label>
                        <select
                            value={prestataires.find(prestataire => prestataire.nom === formData.prestataire?.nom)?.id || ''}
                            onChange={(e) => handlePrestataireSelect(parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                            <option value="">Sélectionner un prestataire</option>
                            {prestataires.map((prestataire) => (
                                <option key={prestataire.id} value={prestataire.id}>
                                    {prestataire.nom} - {prestataire.siret}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    {/* Attributs du prestataire en petit */}
                    <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
                        <div>
                            <span className="font-medium">SIRET:</span> {formData.prestataire?.siret || '-'}
                        </div>
                        <div>
                            <span className="font-medium">Contact:</span> {formData.prestataire?.contact || '-'}
                        </div>
                        <div>
                            <span className="font-medium">Tél:</span> {formData.prestataire?.tel || '-'}
                        </div>
                        <div>
                            <span className="font-medium">Email:</span> {formData.prestataire?.email || '-'}
                        </div>
                        <div className="col-span-2">
                            <span className="font-medium">Adresse:</span> {formData.prestataire?.adresse || '-'}
                        </div>
                    </div>
                </div>

                {/* Bouton de sauvegarde */}
                <div className="flex justify-end">
                    <button
                        onClick={async () => {
                            setIsLoading(true);
                            try {
                                await onSave(formData);
                            } finally {
                                setIsLoading(false);
                            }
                        }}
                        disabled={isLoading}
                        className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? 'Sauvegarde...' : 'Sauvegarder'}
                    </button>
                </div>
            </div>
        );
    };

    const ModalExtractBonInfos = () => {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg w-full h-[95vh] max-w-[95vw] relative">
                    {/* Header avec bouton de fermeture */}
                    <div className="absolute top-0 right-0 p-4 z-10">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Contenu principal */}
                    <div className="flex h-full p-4 gap-4">
                        <div className="w-1/2 h-full">
                            <DisplayBonPDF pdf_id={pdf_id} pdf_path={pdf_path}/>
                        </div>
                        <div className="w-1/2 h-full">
                            <FormulaireExtractBonInfos entreprise_id={entreprise_id} onSave={handleSave}/>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div>
            <OpenExtractModalButton />
            {isOpen && (
                <ModalExtractBonInfos />
            )}
        </div>
    )
}

export default ExtractBon;
