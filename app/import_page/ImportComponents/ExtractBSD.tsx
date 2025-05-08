/*import { useEffect, useState } from "react";
import { PdfInfo } from "./TableImportedFiles";
import { useSession } from "@/app/component/SessionProvider";
import { supabase } from "@/app/database/supabaseClient";
import PdfDisplayer from '@/app/interface_admin_2/InterfaceAdmin2/PdfDisplayer';
import { toast } from 'react-hot-toast';

const ExtractBSD = ({ pdf_id, pdf_path }: { pdf_id: number, pdf_path: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const {entreprise_id} = useSession();

    const OpenExtractModalButton = () => {
        return (
            <button 
            className="bg-green-800 text-white px-4 py-2 rounded-lg w-[150px]"
            onClick={() => setIsOpen(true)}>
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
        interface BSDCerfa {
            numeroBordereau: string;
          
            emetteur: {
              statut: 'producteur' | 'collecteur' | 'transformateur' | 'autre';
              nom: string;
              siret: string;
              adresse: string;
              tel?: string;
              fax?: string;
              email?: string;
            };
          
            installationDestination: {
              entreposageProvisoire: boolean;
              siren: string;
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
              denominationUsuelle: string;
              categorie: 'solide' | 'liquide' | 'gazeux';
              etiquetageADR: string;
              propriete: string;
              conditionnement: string;
              nombreColis: number;
              poids: number;
            };
          
            destinatairePrevu?: {
              siren: string;
              nom: string;
              adresse: string;
              contact?: string;
              tel?: string;
              fax?: string;
            };
          
            collecteurTransporteur: {
              siren: string;
              nom: string;
              adresse: string;
              tel?: string;
              fax?: string;
              email?: string;
              contact?: string;
              numeroRecepisse: string;
              dateValiditeRecepisse: string;
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

        return (
            <div className="overflow-y-auto h-full">
                <form className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        {renderObjectFields({
                            numeroBordereau: '',
                            emetteur: {
                                statut: 'producteur',
                                nom: '',
                                siret: '',
                                adresse: '',
                                tel: '',
                                fax: '',
                                email: ''
                            },
                            installationDestination: {
                                entreposageProvisoire: false,
                                siren: '',
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
                                denominationUsuelle: '',
                                categorie: 'solide',
                                etiquetageADR: '',
                                propriete: '',
                                conditionnement: '',
                                nombreColis: 0,
                                poids: 0
                            },
                            destinatairePrevu: {
                                siren: '',
                                nom: '',
                                adresse: '',
                                contact: '',
                                tel: '',
                                fax: ''
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
                </form>
            </div>
        );
    };

    const ModalExtractBsdInfos = () => {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg w-full h-[95vh] max-w-[95vw] relative">
                    {/* Header avec bouton de fermeture 
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

                    {/* Contenu principal 
                    <div className="flex h-full p-4 gap-4">
                        <div className="w-1/2 h-full">
                            <DisplayBsdPDF pdf_id={pdf_id} pdf_path={pdf_path}/>
                        </div>
                        <div className="w-1/2 h-full">
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

*/