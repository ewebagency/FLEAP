import { useEffect, useState } from "react";
import { PdfInfo } from "./TableImportedFiles";
import { useSession } from "@/app/component/SessionProvider";
import { supabase } from "@/app/database/supabaseClient";
import PdfDisplayer from '@/app/interface_admin_2/InterfaceAdmin2/PdfDisplayer';
import { toast } from 'react-hot-toast';
import OCRThisBSD from "./OCRThisBSD";
import SplitBsdPDF from "./SplitBsdPDF";

export interface BSDCerfa {
    numeroBordereau: string;
    emetteur: {
        statut: 'producteur' | 'collecteur' | 'transformateur' | 'autre';
        siret: string;
        nom: string;
        adresse: string;
        tel?: string;
        fax?: string;
        email?: string;
        contact?: string;
    };
    installationDestination: {
        entreposageProvisoire: boolean;
        siret: string;
        nom: string;
        adresse: string;
        tel?: string;
        email?: string;
        contact?: string;
        numeroCAP?: string;
        codeOperation: string;
    };
    dechet: {
        code: string;
        consistence: 'solide' | 'liquide' | 'gazeux';
        denominationUsuelle: string;
        categorie: 'solide' | 'liquide' | 'gazeux';
        etiquetageADR: string;
        conditionnement: string;
        nombreColis: number;
        poids: number;
        volume: number;
        volumeUnite: string;
        reel: boolean;
    };
    negociant?: {
        siren: string;
        nom: string;
        adresse: string;
        contact?: string;
        tel?: string;
        email?: string;
        fax?: string;
        numeroRecepisse?: string;
        departement?: string;
        dateValiditeRecepisse?: string;
    };
    collecteurTransporteur: {
        siren: string;
        nom: string;
        adresse: string;
        tel?: string;
        fax?: string;
        email?: string;
        contact?: string;
        numeroRecepisse?: string;
        departement?: string;
        dateValiditeRecepisse?: string;
        modeTransport: 'route' | 'multimodal';
        datePriseEnCharge?: string;
        signature?: string;
    };
    expedition: {
        dateEnvoi: string;
        heure: string;
        signature: string;
    };
    realisationOperation: {
        code: string;
        description: string;
        nom: string;
        date: string;
        signature: string;
    };
    declarationEmetteur: {
        nom: string;
        date: string;
        signature: string;
    };
}

const ExtractBSD = ({ pdf_id, pdf_path }: { pdf_id: number, pdf_path: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const {entreprise_id, user_id} = useSession();
    const [existingData, setExistingData] = useState<Partial<BSDCerfa> | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const loadExistingData = async () => {
        try {
            const { data, error } = await supabase
                .from('bsd_pdf')
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
                setExistingData(data.infos as Partial<BSDCerfa>);
            }
        } catch (error) {
            console.error('Error loading existing data:', error);
        }
    };

    const handleSave = async (formData: Partial<BSDCerfa>) => {
        setIsLoading(true);
        try {
            // D'abord, vérifier si un enregistrement existe déjà
            const { data: existingRecord } = await supabase
                .from('bsd_pdf')
                .select('id')
                .eq('pdf_id', pdf_id)
                .single();

            const { error } = await supabase
                .from('bsd_pdf')
                .upsert({
                    id: existingRecord?.id,
                    entreprise_id,
                    user_id,
                    pdf_id,
                    infos: formData
                });

            if (error) {
                console.error('Error saving BSD data:', error);
                toast.error('Erreur lors de la sauvegarde des données');
                return;
            }

            // Mise à jour du status dans pdf_infos
            const { error: error2 } = await supabase
                .from('pdf_infos')
                .update({ status: 'read' })
                .eq('id', pdf_id)
                .eq('entreprise_id', entreprise_id);

            if (error2) {
                console.error('Error updating pdf_infos status:', error2);
                toast.error('Erreur lors de la mise à jour du statut');
                return;
            }

            toast.success('Données sauvegardées avec succès');
            setIsLoading(false);
            setIsOpen(false);
        } catch (error) {
            console.error('Error saving BSD data:', error);
            toast.error('Erreur lors de la sauvegarde des données');
            setIsLoading(false);
        }
    };

    const OpenExtractModalButton = () => {
        return (
            <button 
            className="bg-green-800 text-white px-4 py-2 rounded-lg w-[150px]"
            onClick={() => {
                setIsOpen(true);
                loadExistingData();
            }}>
                Extraire BSD
            </button>
        )
    }

    const DisplayBsdPDF = ({ pdf_id, pdf_path }: { pdf_id: number, pdf_path: string }) => {
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

    const FormulaireExtractBsdInfosMano = ({ entreprise_id }: { entreprise_id: string | null }) => {
        const [formData, setFormData] = useState<Partial<BSDCerfa>>({});

        type FieldType = 'string' | 'number' | 'boolean';
        type FieldValue = string | number | boolean;

        const renderField = (
            fieldName: string, 
            fieldType: FieldType, 
            value: FieldValue | undefined, 
            onChange: (value: FieldValue) => void
        ) => {
            const label = fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1');

            // Vérifier si le champ est une date
            const isDateField = fieldName.toLowerCase().includes('date');

            if (isDateField) {
                return (
                    <div key={fieldName} className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {label}
                        </label>
                        <input
                            type="date"
                            value={value as string || ''}
                            onChange={(e) => onChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                );
            }

            switch (fieldType) {
                case 'string':
                    return (
                        <div key={fieldName} className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {label}
                            </label>
                            <input
                                type="text"
                                value={value as string || ''}
                                onChange={(e) => onChange(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    );
                case 'number':
                    return (
                        <div key={fieldName} className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {label}
                            </label>
                            <input
                                type="number"
                                value={value as number || ''}
                                onChange={(e) => onChange(Number(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    );
                case 'boolean':
                    return (
                        <div key={fieldName} className="mb-4">
                            <label className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={value as boolean || false}
                                    onChange={(e) => onChange(e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-gray-700">{label}</span>
                            </label>
                        </div>
                    );
                default:
                    return null;
            }
        };

        const renderObjectFields = (obj: Record<string, unknown>, prefix: string = '') => {
            const fields = Object.entries(obj).map(([key, value]) => {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                const currentValue = prefix
                    ? (formData[prefix as keyof BSDCerfa] as Record<string, unknown>)?.[key]
                    : formData[key as keyof BSDCerfa];

                if (typeof value === 'object' && value !== null) {
                    return (
                        <div key={fullKey} className="col-span-3 mb-6">
                            <h3 className="text-lg font-semibold mb-3">
                                {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                            </h3>
                            <div className="pl-4 border-l-2 border-gray-200">
                                <div className="grid grid-cols-3 gap-4">
                                    {renderObjectFields(value as Record<string, unknown>, key)}
                                </div>
                            </div>
                        </div>
                    );
                }

                const type = typeof value as FieldType;
                return (
                    <div key={fullKey} className="col-span-1">
                        {renderField(
                            key,
                            type,
                            currentValue as FieldValue,
                            (newValue) => {
                                setFormData(prev => {
                                    if (prefix) {
                                        const prefixData = prev[prefix as keyof BSDCerfa] as Record<string, unknown> || {};
                                        return {
                                            ...prev,
                                            [prefix]: {
                                                ...prefixData,
                                                [key]: newValue
                                            }
                                        };
                                    }
                                    return {
                                        ...prev,
                                        [key]: newValue
                                    };
                                });
                            }
                        )}
                    </div>
                );
            });

            return fields;
        };

        useEffect(() => {
            if (existingData) {
                setFormData(existingData);
            }
        }, [existingData]);

        return (
            <div className="overflow-y-auto h-full">
                <form className="space-y-6" onSubmit={(e) => {
                    e.preventDefault();
                    handleSave(formData);
                }}>
                    <div className="grid grid-cols-3 gap-4">
                        {renderObjectFields({
                            numeroBordereau: '',
                            emetteur: {
                                statut: 'producteur',
                                siret: '',
                                nom: '',
                                adresse: '',
                                tel: '',
                                fax: '',
                                email: '',
                                contact: ''
                            },
                            installationDestination: {
                                entreposageProvisoire: false,
                                siret: '',
                                nom: '',
                                adresse: '',
                                tel: '',
                                email: '',
                                contact: '',
                                numeroCAP: '',
                                codeOperation: ''
                            },
                            dechet: {
                                code: '',
                                consistence: 'solide',
                                denominationUsuelle: '',
                                categorie: 'solide',
                                etiquetageADR: '',
                                conditionnement: '',
                                nombreColis: 0,
                                poids: 0,
                                volume: 0,
                                volumeUnite: '',
                                reel: false
                            },
                            negociant: {
                                siren: '',
                                nom: '',
                                adresse: '',
                                contact: '',
                                tel: '',
                                email: '',
                                fax: '',
                                numeroRecepisse: '',
                                departement: '',
                                dateValiditeRecepisse: ''
                            },
                            collecteurTransporteur: {
                                siren: '',
                                nom: '',
                                adresse: '',
                                tel: '',
                                fax: '',
                                email: '',
                                contact: '',
                                numeroRecepisse: '',
                                departement: '',
                                dateValiditeRecepisse: '',
                                modeTransport: 'route',
                                datePriseEnCharge: '',
                                signature: ''
                            },
                            expedition: {
                                dateEnvoi: '',
                                heure: '',
                                signature: ''
                            },
                            realisationOperation: {
                                code: '',
                                description: '',
                                nom: '',
                                date: '',
                                signature: ''
                            },
                            declarationEmetteur: {
                                nom: '',
                                date: '',
                                signature: ''
                            }
                        })}
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    En cours...
                                </span>
                            ) : 'Sauvegarder'}
                        </button>
                    </div>
                </form>
            </div>
        );
    };

    const ModalExtractBsdInfos = () => {
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
                            <DisplayBsdPDF pdf_id={pdf_id} pdf_path={pdf_path}/>
                        </div>
                        <div className="w-1/2 h-full">
                            <div className="flex absolute top-4 right-10 gap-2">
                                <OCRThisBSD 
                                    pdf_id={pdf_id}
                                    pdf_path={pdf_path}
                                    onDataExtracted={(data: Partial<BSDCerfa>)=>setExistingData(data)}
                                />       
                                <SplitBsdPDF pdf_id={pdf_id} pdf_path={pdf_path} onClose={()=>setIsOpen(false)}/>                 
                            </div>
                            
                            <FormulaireExtractBsdInfosMano entreprise_id={entreprise_id}/>
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
                <ModalExtractBsdInfos />
            )}
        </div>
    )
}

export default ExtractBSD;

