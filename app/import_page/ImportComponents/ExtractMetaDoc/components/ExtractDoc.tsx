import { useEffect, useState } from "react";
import { useSession } from "@/app/component/SessionProvider";
import { supabase } from "@/app/database/supabaseClient";
import PdfDisplayer from '@/app/interface_admin_2/InterfaceAdmin2/PdfDisplayer';
import { toast } from 'react-hot-toast';
import BoutonExtractDoc from './BoutonExtractDoc';
import BoutonSplitDoc from './BoutonSplitDoc';
import { MetaOcrResponse } from '../interface/pdf_interface';

// Import des interfaces depuis MetaDataInterface.ts
interface PrestaInfosAdd {
    type: "transporteur" | "destinataire" | "courtier" | "negotiant";
    adresse: string;
    tel: string;
    mail: string;
    fax: string;
    infos_transporteur?: {
        recepisse: string;
        departement: string;
        limite_validite: string;
        routier: string;
    };
}

interface DechetMetaInterface {
    date: string;
    nom: string;
    tonnage: string;
    ced: string;
    d_r?: string;
    tour?: string;
}

interface FactureInterface {
    ligne: {
        operation: string;
        quantite: number;
        unite: string;
        montant_ht: number;
        tva_absolute: number;
    }[];
    declassement?: string;
}

interface DocMetaInterface {
    type_doc: "bon" | "bsd" | "facture";
    site_raw: string;
    presta_raw: string;
    add_presta_raw?: PrestaInfosAdd;
    l_prestas?: [
        presta_raw2?: string,
        add_presta2_raw?: PrestaInfosAdd
    ];
    dechet: DechetMetaInterface[];
}

interface DechetBonInterface extends DechetMetaInterface {
    num_bon: string;
}

interface DechetBsdInterface extends DechetMetaInterface {
    num_bon: string;
    contenant?: string;
    volume_m3?: string;
}

interface DechetFactureInterface extends DechetBsdInterface {
    facture: FactureInterface;
}

interface DocBonInterface extends DocMetaInterface {
    type_doc: "bon";
    dechet: DechetBonInterface[];
}

interface DocBsdInterface extends DocMetaInterface {
    type_doc: "bsd";
    num_bsd?: string;
    conformite: {
        CAP: string;
        ADR: string;
    };
    dechet: DechetBsdInterface[];
}

interface DocFactureInterface extends DocMetaInterface {
    type_doc: "facture";
    num_facture: string;
    num_bsd?: string;
    dechet: DechetFactureInterface[];
}

interface DocInterface {
    type_doc: "bon" | "bsd" | "facture";
    site_raw: string;
    presta_raw: string;
    add_presta_raw?: PrestaInfosAdd;
    l_prestas?: [presta_raw2?: string, add_presta2_raw?: PrestaInfosAdd];
    dechet: DechetMetaInterface[];
    conformite?: { CAP: string; ADR: string };
    num_facture?: string;
}

interface ExtractDocProps {
    pdf_id: number;
    pdf_path: string;
    pdf_status?: string;
}

const ExtractDoc = ({ pdf_id, pdf_path, pdf_status }: ExtractDocProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const { entreprise_id, user_id } = useSession();
    const [existingData, setExistingData] = useState<DocInterface | null>(null);
    const [documentType, setDocumentType] = useState<"bon" | "bsd" | "facture" | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const loadExistingData = async () => {
        try {
            const { data, error } = await supabase
                .from('pdf_infos')
                .select('*')
                .eq('id', pdf_id)
                .single();

            if (error) {
                if (error.code !== 'PGRST116') {
                    console.error('Error loading existing data:', error);
                }
                return;
            }

            if (data) {
                setDocumentType(data.document_type as "bon" | "bsd" | "facture" | null);
                if (data.infos_raw) {
                    setExistingData(data.infos_raw as DocInterface);
                }
            }
        } catch (error) {
            console.error('Error loading existing data:', error);
        }
    };

    const handleSave = async (formData: DocInterface) => {
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('pdf_infos')
                .update({
                    infos_raw: formData
                })
                .eq('id', pdf_id)
                .eq('entreprise_id', entreprise_id);

            if (error) {
                console.error('Error saving data:', error);
                toast.error('Erreur lors de la sauvegarde');
                return;
            }

            toast.success('Données sauvegardées avec succès');
            setIsOpen(false);
        } catch (error) {
            console.error('Error saving data:', error);
            toast.error('Erreur lors de la sauvegarde');
        } finally {
            setIsLoading(false);
        }
    };

    const OpenExtractModalButton = () => {
        return (
            <button 
                className="bg-purple-800 text-xs text-white px-4 py-2 rounded-lg hover:bg-purple-900 transition-colors"
                onClick={() => {
                    setIsOpen(true);
                    loadExistingData();
                }}>
                Extraire la donnée
            </button>
        );
    };

    const DisplayDocPDF = ({ pdf_id, pdf_path }: { pdf_id: number, pdf_path: string }) => {
        const [pdfUrl, setPdfUrl] = useState<string | null>(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState<string | null>(null);
        const [urlCache, setUrlCache] = useState<Record<string, string>>({});

        const getPdfUrl = async () => {
            // Vérifier le cache d'abord
            if (urlCache[pdf_path]) {
                setPdfUrl(urlCache[pdf_path]);
                setLoading(false);
                return urlCache[pdf_path];
            }
            
            // Éviter les appels multiples si on a déjà une URL
            if (pdfUrl) return pdfUrl;
            
            try {
                setLoading(true);
                setError(null);
                
                const { data } = await supabase.storage
                    .from('pdfs_bucket')
                    .createSignedUrl(pdf_path, 3600);

                if (data?.signedUrl) {
                    const signedUrl = data.signedUrl;
                    setPdfUrl(signedUrl);
                    // Mettre en cache l'URL
                    setUrlCache(prev => ({ ...prev, [pdf_path]: signedUrl }));
                    return signedUrl;
                }
                throw new Error('URL du PDF non trouvée');
            } catch (error) {
                console.error('Erreur lors de la récupération de l\'URL du PDF:', error);
                setError('Erreur lors du chargement du PDF');
                toast.error('Erreur lors du chargement du PDF');
            } finally {
                setLoading(false);
            }
        };
        
        useEffect(() => {
            // Reset les états quand le pdf_path change
            setPdfUrl(null);
            setError(null);
            setLoading(true);
            
            if (pdf_path) {
                getPdfUrl();
            }
        }, [pdf_path]);

        // Précharger l'URL quand le modal s'ouvre
        useEffect(() => {
            if (isOpen && pdf_path && !pdfUrl && !urlCache[pdf_path]) {
                getPdfUrl();
            } else if (isOpen && pdf_path && urlCache[pdf_path]) {
                setPdfUrl(urlCache[pdf_path]);
                setLoading(false);
            }
        }, [isOpen, pdf_path]);

        return (
            <div className="w-full h-full">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                            <p className="text-sm text-gray-600">Chargement du PDF...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <p className="text-red-600 mb-2">{error}</p>
                            <button 
                                onClick={getPdfUrl}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                                Réessayer
                            </button>
                        </div>
                    </div>
                ) : pdfUrl ? (
                    <PdfDisplayer pdfUrl={pdfUrl} />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p>Impossible de charger le PDF</p>
                    </div>
                )}
            </div>
        );
    };

    const FormulaireExtractDoc = ({ onSave }: { onSave: (formData: DocInterface) => Promise<void> }) => {
        const [formData, setFormData] = useState<DocInterface>(() => {
            if (existingData) {
                return existingData;
            }
            
            // Créer un formulaire vide selon le type de document
            const baseData = {
                type_doc: documentType || "bon",
                site_raw: '',
                presta_raw: '',
                dechet: []
            };

            switch (documentType) {
                case "bsd":
                    return {
                        ...baseData,
                        type_doc: "bsd",
                        conformite: { CAP: '', ADR: '' }
                    } as DocInterface;
                case "facture":
                    return {
                        ...baseData,
                        type_doc: "facture",
                        num_facture: ''
                    } as DocInterface;
                default:
                    return baseData as DocInterface;
            }
        });

        useEffect(() => {
            if (existingData) {
                setFormData(existingData);
            }
        }, [existingData]);

        const handleInputChange = (field: string, value: unknown) => {
            setFormData(prev => ({
                ...prev,
                [field]: value
            }));
        };

        const handleDechetChange = (index: number, field: string, value: string) => {
            setFormData(prev => ({
                ...prev,
                dechet: prev.dechet.map((dechet, i) => 
                    i === index ? { ...dechet, [field]: value } : dechet
                )
            }));
        };

        const addDechet = () => {
            const newDechet: Record<string, unknown> = {
                date: '',
                nom: '',
                tonnage: '',
                ced: '',
                d_r: '',
                tour: ''
            };

            // Ajouter les champs spécifiques selon le type
            if (documentType === "bon") {
                newDechet.num_bon = '';
            } else if (documentType === "bsd") {
                newDechet.num_bon = '';
                newDechet.contenant = '';
                newDechet.volume_m3 = '';
            } else if (documentType === "facture") {
                newDechet.num_bon = '';
                newDechet.contenant = '';
                newDechet.volume_m3 = '';
                newDechet.facture = {
                    ligne: [],
                    declassement: ''
                };
            }

            setFormData(prev => ({
                ...prev,
                dechet: [...prev.dechet, newDechet as unknown as DechetMetaInterface]
            } as unknown as DocInterface));
        };

        const removeDechet = (index: number) => {
            setFormData(prev => ({
                ...prev,
                dechet: prev.dechet.filter((_, i) => i !== index)
            }));
        };

        const renderDechetFields = (dechet: DechetMetaInterface, index: number) => {
            return (
                <div key={index} className="bg-gray-50 p-2 rounded mb-2">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold text-gray-700 text-sm">Déchet {index + 1}</h4>
                        <button
                            type="button"
                            onClick={() => removeDechet(index)}
                            className="text-red-600 hover:text-red-800 text-xs"
                        >
                            Supprimer
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                            <input
                                type="date"
                                value={dechet.date || ''}
                                onChange={(e) => handleDechetChange(index, 'date', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Nom</label>
                            <input
                                type="text"
                                value={dechet.nom || ''}
                                onChange={(e) => handleDechetChange(index, 'nom', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Tonnage</label>
                            <input
                                type="text"
                                value={dechet.tonnage || ''}
                                onChange={(e) => handleDechetChange(index, 'tonnage', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Code CED</label>
                            <input
                                type="text"
                                value={dechet.ced || ''}
                                onChange={(e) => handleDechetChange(index, 'ced', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">D/R</label>
                            <input
                                type="text"
                                value={dechet.d_r || ''}
                                onChange={(e) => handleDechetChange(index, 'd_r', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Tour</label>
                            <input
                                type="text"
                                value={dechet.tour || ''}
                                onChange={(e) => handleDechetChange(index, 'tour', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        
                                                 {/* Champs spécifiques selon le type */}
                         {documentType === "bon" && (
                             <div>
                                 <label className="block text-xs font-medium text-gray-700 mb-1">Numéro bon</label>
                                 <input
                                     type="text"
                                     value={(dechet as DechetBonInterface).num_bon || ''}
                                     onChange={(e) => handleDechetChange(index, 'num_bon', e.target.value)}
                                     className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                 />
                             </div>
                         )}
                         
                         {(documentType === "bsd" || documentType === "facture") && (
                             <>
                                 <div>
                                     <label className="block text-xs font-medium text-gray-700 mb-1">Numéro bon</label>
                                     <input
                                         type="text"
                                         value={(dechet as DechetBsdInterface).num_bon || ''}
                                         onChange={(e) => handleDechetChange(index, 'num_bon', e.target.value)}
                                         className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                     />
                                 </div>
                                 <div>
                                     <label className="block text-xs font-medium text-gray-700 mb-1">Contenant</label>
                                     <input
                                         type="text"
                                         value={(dechet as DechetBsdInterface).contenant || ''}
                                         onChange={(e) => handleDechetChange(index, 'contenant', e.target.value)}
                                         className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                     />
                                 </div>
                                 <div>
                                     <label className="block text-xs font-medium text-gray-700 mb-1">Volume (m³)</label>
                                     <input
                                         type="text"
                                         value={(dechet as DechetBsdInterface).volume_m3 || ''}
                                         onChange={(e) => handleDechetChange(index, 'volume_m3', e.target.value)}
                                         className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                     />
                                 </div>
                             </>
                         )}
                         
                         {/* Section lignes de facturation pour les factures */}
                         {documentType === "facture" && (
                             <div className="col-span-2 mt-2">
                                 <h5 className="font-semibold text-gray-700 mb-2 text-sm">Lignes de facturation</h5>
                                 <div className="space-y-2">
                                     {(dechet as DechetFactureInterface).facture?.ligne?.map((ligne, ligneIndex) => (
                                         <div key={ligneIndex} className="bg-white p-2 rounded border">
                                             <div className="grid grid-cols-5 gap-2">
                                                 <div>
                                                     <label className="block text-xs font-medium text-gray-600 mb-1">Opération</label>
                                                     <input
                                                         type="text"
                                                         value={ligne.operation || ''}
                                                         onChange={(e) => {
                                                             const factureData = formData as unknown as DocFactureInterface;
                                                             const updatedDechet = [...factureData.dechet];
                                                             if (updatedDechet[index] && updatedDechet[index].facture) {
                                                                 const updatedLignes = [...updatedDechet[index].facture.ligne];
                                                                 updatedLignes[ligneIndex] = { ...updatedLignes[ligneIndex], operation: e.target.value };
                                                                 updatedDechet[index].facture.ligne = updatedLignes;
                                                                 handleInputChange('dechet', updatedDechet);
                                                             }
                                                         }}
                                                         className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                                     />
                                                 </div>
                                                 <div>
                                                     <label className="block text-xs font-medium text-gray-600 mb-1">Quantité</label>
                                                     <input
                                                         type="number"
                                                         value={ligne.quantite || ''}
                                                         onChange={(e) => {
                                                             const factureData = formData as unknown as DocFactureInterface;
                                                             const updatedDechet = [...factureData.dechet];
                                                             if (updatedDechet[index] && updatedDechet[index].facture) {
                                                                 const updatedLignes = [...updatedDechet[index].facture.ligne];
                                                                 updatedLignes[ligneIndex] = { ...updatedLignes[ligneIndex], quantite: Number(e.target.value) };
                                                                 updatedDechet[index].facture.ligne = updatedLignes;
                                                                 handleInputChange('dechet', updatedDechet);
                                                             }
                                                         }}
                                                         className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                                     />
                                                 </div>
                                                 <div>
                                                     <label className="block text-xs font-medium text-gray-600 mb-1">Unité</label>
                                                     <input
                                                         type="text"
                                                         value={ligne.unite || ''}
                                                         onChange={(e) => {
                                                             const factureData = formData as DocFactureInterface;
                                                             const updatedDechet = [...factureData.dechet];
                                                             if (updatedDechet[index] && updatedDechet[index].facture) {
                                                                 const updatedLignes = [...updatedDechet[index].facture.ligne];
                                                                 updatedLignes[ligneIndex] = { ...updatedLignes[ligneIndex], unite: e.target.value };
                                                                 updatedDechet[index].facture.ligne = updatedLignes;
                                                                 handleInputChange('dechet', updatedDechet);
                                                             }
                                                         }}
                                                         className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                                     />
                                                 </div>
                                                 <div>
                                                     <label className="block text-xs font-medium text-gray-600 mb-1">Montant HT</label>
                                                     <input
                                                         type="number"
                                                         step="0.01"
                                                         value={ligne.montant_ht || ''}
                                                         onChange={(e) => {
                                                             const factureData = formData as DocFactureInterface;
                                                             const updatedDechet = [...factureData.dechet];
                                                             if (updatedDechet[index] && updatedDechet[index].facture) {
                                                                 const updatedLignes = [...updatedDechet[index].facture.ligne];
                                                                 updatedLignes[ligneIndex] = { ...updatedLignes[ligneIndex], montant_ht: Number(e.target.value) };
                                                                 updatedDechet[index].facture.ligne = updatedLignes;
                                                                 handleInputChange('dechet', updatedDechet);
                                                             }
                                                         }}
                                                         className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                                     />
                                                 </div>
                                                 <div>
                                                     <label className="block text-xs font-medium text-gray-600 mb-1">TVA</label>
                                                     <input
                                                         type="number"
                                                         step="0.01"
                                                         value={ligne.tva_absolute || ''}
                                                         onChange={(e) => {
                                                             const factureData = formData as DocFactureInterface;
                                                             const updatedDechet = [...factureData.dechet];
                                                             if (updatedDechet[index] && updatedDechet[index].facture) {
                                                                 const updatedLignes = [...updatedDechet[index].facture.ligne];
                                                                 updatedLignes[ligneIndex] = { ...updatedLignes[ligneIndex], tva_absolute: Number(e.target.value) };
                                                                 updatedDechet[index].facture.ligne = updatedLignes;
                                                                 handleInputChange('dechet', updatedDechet);
                                                             }
                                                         }}
                                                         className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                                     />
                                                 </div>
                                             </div>
                                         </div>
                                     ))}
                                     <button
                                         type="button"
                                         onClick={() => {
                                             const factureData = formData as DocFactureInterface;
                                             const updatedDechet = [...factureData.dechet];
                                             if (updatedDechet[index] && updatedDechet[index].facture) {
                                                 updatedDechet[index].facture.ligne.push({
                                                     operation: '',
                                                     quantite: 0,
                                                     unite: '',
                                                     montant_ht: 0,
                                                     tva_absolute: 0
                                                 });
                                                 handleInputChange('dechet', updatedDechet);
                                             } else if (updatedDechet[index]) {
                                                 // Initialiser la facture si elle n'existe pas
                                                 updatedDechet[index].facture = {
                                                     ligne: [{
                                                         operation: '',
                                                         quantite: 0,
                                                         unite: '',
                                                         montant_ht: 0,
                                                         tva_absolute: 0
                                                     }],
                                                     declassement: ''
                                                 };
                                                 handleInputChange('dechet', updatedDechet);
                                             }
                                         }}
                                         className="w-full px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                     >
                                         + Ajouter une ligne
                                     </button>
                                 </div>
                             </div>
                         )}
                    </div>
                </div>
            );
        };

        return (
            <div className="h-full overflow-y-auto p-1 bg-gray-50">
                <div className="mb-3">
                    <h2 className="text-lg font-bold text-gray-800 mb-2">
                        Extraction Document - {documentType?.toUpperCase() || 'Type inconnu'}
                    </h2>
                    
                    {/* Sélecteur de type de document */}
                    <div className="bg-white rounded-lg p-2 mb-1 shadow-sm flex items-center justify-between">
                        <h3 className="text-base font-semibold text-purple-600">Type de document</h3>
                        <div className="flex gap-4">
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    name="documentType"
                                    value="bon"
                                    checked={documentType === "bon"}
                                    onChange={(e) => {
                                        setDocumentType(e.target.value as "bon" | "bsd" | "facture");
                                        // Réinitialiser le formulaire avec le nouveau type
                                        const newFormData = {
                                            type_doc: e.target.value as "bon" | "bsd" | "facture",
                                            site_raw: formData.site_raw,
                                            presta_raw: formData.presta_raw,
                                            dechet: []
                                        };
                                        setFormData(newFormData as DocInterface);
                                    }}
                                    className="mr-2"
                                />
                                Bon de livraison
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    name="documentType"
                                    value="bsd"
                                    checked={documentType === "bsd"}
                                    onChange={(e) => {
                                        setDocumentType(e.target.value as "bon" | "bsd" | "facture");
                                        const newFormData = {
                                            type_doc: e.target.value as "bon" | "bsd" | "facture",
                                            site_raw: formData.site_raw,
                                            presta_raw: formData.presta_raw,
                                            conformite: { CAP: '', ADR: '' },
                                            dechet: []
                                        };
                                        setFormData(newFormData as DocInterface);
                                    }}
                                    className="mr-2"
                                />
                                BSD
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    name="documentType"
                                    value="facture"
                                    checked={documentType === "facture"}
                                    onChange={(e) => {
                                        setDocumentType(e.target.value as "bon" | "bsd" | "facture");
                                        const newFormData = {
                                            type_doc: e.target.value as "bon" | "bsd" | "facture",
                                            site_raw: formData.site_raw,
                                            presta_raw: formData.presta_raw,
                                            num_facture: '',
                                            dechet: []
                                        };
                                        setFormData(newFormData as DocInterface);
                                    }}
                                    className="mr-2"
                                />
                                Facture
                            </label>
                        </div>
                    </div>
                    
                    {/* Informations générales */}
                    <div className="bg-white rounded-lg p-2 mb-1 shadow-sm">
                        <h3 className="text-base font-semibold text-blue-600 mb-1">Informations générales</h3>
                        <div className="grid grid-cols-2 gap-2 mb-1">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Site (texte brut)</label>
                                <input
                                    type="text"
                                    value={formData.site_raw || ''}
                                    onChange={(e) => handleInputChange('site_raw', e.target.value)}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="Coller ici le texte brut OCR du site"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Prestataire (texte brut)</label>
                                <input
                                    type="text"
                                    value={formData.presta_raw || ''}
                                    onChange={(e) => handleInputChange('presta_raw', e.target.value)}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="Coller ici le texte brut OCR du prestataire"
                                />
                            </div>
                        </div>
                        
                        {/* Champs spécifiques selon le type - organisés sur 3 colonnes */}
                        {documentType === "bsd" && (
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Numéro BSD</label>
                                    <input
                                        type="text"
                                        value={(formData as unknown as DocBsdInterface).num_bsd || ''}
                                        onChange={(e) => handleInputChange('num_bsd', e.target.value)}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">CAP</label>
                                    <input
                                        type="text"
                                        value={(formData as unknown as DocBsdInterface).conformite?.CAP || ''}
                                        onChange={(e) => {
                                            const bsdData = formData as unknown as DocBsdInterface;
                                            handleInputChange('conformite', {
                                                ...bsdData.conformite,
                                                CAP: e.target.value
                                            });
                                        }}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">ADR</label>
                                    <input
                                        type="text"
                                        value={(formData as unknown as DocBsdInterface).conformite?.ADR || ''}
                                        onChange={(e) => {
                                            const bsdData = formData as unknown as DocBsdInterface;
                                            handleInputChange('conformite', {
                                                ...bsdData.conformite,
                                                ADR: e.target.value
                                            });
                                        }}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        )}
                        
                        {documentType === "facture" && (
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Numéro de facture</label>
                                    <input
                                        type="text"
                                        value={(formData as unknown as DocFactureInterface).num_facture || ''}
                                        onChange={(e) => handleInputChange('num_facture', e.target.value)}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Numéro BSD</label>
                                    <input
                                        type="text"
                                        value={(formData as unknown as DocFactureInterface).num_bsd || ''}
                                        onChange={(e) => handleInputChange('num_bsd', e.target.value)}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Déclassement</label>
                                    <input
                                        type="text"
                                        value={(formData as unknown as DocFactureInterface).dechet?.[0]?.facture?.declassement || ''}
                                        onChange={(e) => {
                                            const factureData = formData as unknown as DocFactureInterface;
                                            if (factureData.dechet && factureData.dechet.length > 0) {
                                                const updatedDechet = [...factureData.dechet];
                                                if (!updatedDechet[0].facture) {
                                                    updatedDechet[0].facture = { ligne: [], declassement: '' };
                                                }
                                                updatedDechet[0].facture.declassement = e.target.value;
                                                handleInputChange('dechet', updatedDechet);
                                            }
                                        }}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Section Déchets */}
                    <div className="bg-white rounded-lg p-2 mb-1 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-base font-semibold text-green-600">Déchets</h3>
                            <button
                                type="button"
                                onClick={addDechet}
                                className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
                            >
                                Ajouter un déchet
                            </button>
                        </div>
                        
                        {formData.dechet.length === 0 ? (
                            <p className="text-gray-500 text-center py-2 text-sm">Aucun déchet ajouté</p>
                        ) : (
                            formData.dechet.map((dechet, index) => renderDechetFields(dechet, index))
                        )}
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
                            className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? 'Sauvegarde...' : 'Sauvegarder'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const ModalExtractDoc = () => {
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

                    {/* Boutons d'action en haut */}
                    <div className="absolute top-4 left-4 z-10 flex gap-2">
                        <BoutonExtractDoc 
                            pdfId={pdf_id}
                            onExtractSuccess={(pdfId, data) => {
                                console.log('Extraction réussie:', data);
                                // Ici on pourrait mettre à jour le formulaire avec les données extraites
                            }}
                            onExtractError={(pdfId, error) => {
                                console.error('Erreur extraction:', error);
                            }}
                        />
                                                 <BoutonSplitDoc 
                             pdfId={pdf_id}
                             entrepriseId={Number(entreprise_id) || 0}
                             onSplitComplete={(newPdfIds) => {
                                 console.log('Split terminé:', newPdfIds);
                                 setIsOpen(false);
                             }}
                         />
                    </div>

                    {/* Contenu principal */}
                    <div className="flex h-full p-4 gap-4 pt-16">
                        <div className="w-1/2 h-full">
                            <DisplayDocPDF pdf_id={pdf_id} pdf_path={pdf_path}/>
                        </div>
                        <div className="w-1/2 h-full">
                            <FormulaireExtractDoc onSave={handleSave}/>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div>
            <OpenExtractModalButton />
            {isOpen && (
                <ModalExtractDoc />
            )}
        </div>
    );
};

export default ExtractDoc;
