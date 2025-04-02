import React, { useState, useEffect } from 'react';
import BoxIcon from '@/app/component/BoxIconWrapper';
import { supabase } from '@/app/database/supabaseClient';
import { useSession } from '@/app/component/SessionProvider';
import ExtractData from './ExtractData';
import { toast } from 'react-hot-toast';
import { RowBSD } from '@/app/register/interface/BSD_Interface';

export interface PdfInfo {
    status: string;
    id: number;
    name_pdf: string;
    name_pdf_in_bucket: string;
    pdf_path: string;
    created_at: string;
    url?: string;
    file_size: number;
    document_type?: string;
    site_siret?: string;
    provider?: ProviderJSON;
}

interface TableImportedFilesProps {
    pdfInfos: PdfInfo[];
    onDelete: (pdfPath: string, id: number) => void;
}

interface Site {
    siret: string;
    name: string;
}

interface DocumentType {
    id: string;
    name: string;
}

interface Provider {
    siret: string;
    name: string;
    is_transporter: boolean;
    is_destination: boolean;
}

interface ProviderJSON {
    siret: string;
    name: string;
    is_transporter: boolean;
    is_destination: boolean;
}

const ExcelIcon = () => (
    <svg 
        width="25" 
        height="25" 
        viewBox="0 0 512 512" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
    >
        <g>
            <polygon points="339.7,6 339.7,112.8 448.3,112.8" fill="#217346"/>
            <path d="M367.6,338.6L367.6,338.6c0-49.1-39.8-88.9-88.9-88.9h-215v177.8h215C327.8,427.5,367.6,387.7,367.6,338.6z M157,384.4l-19-32.9l-19,32.9h-17.3l27.5-44.1l-26.9-43.4h17.2l18.3,32.3l18.4-32.3h17.3l-26.9,43.4l27.9,44.1H157z M241.6,384.4H186v-87.5h14.6v75.8h41V384.4z M250.8,358.6l0.1-0.4H265c0,5.2,1.8,9.2,5.4,11.9c3.6,2.7,8,4,13.2,4c5.2,0,9.2-1.1,12-3.3c2.9-2.2,4.3-5.1,4.3-8.9c0-3.6-1.3-6.6-3.9-9c-2.6-2.3-7.2-4.4-13.7-6.2c-9.4-2.6-16.7-6-21.8-10.2c-5.1-4.2-7.7-9.7-7.7-16.6c0-7,2.8-12.9,8.4-17.4c5.6-4.6,12.8-6.8,21.6-6.8c9.5,0,17,2.5,22.7,7.6c5.7,5.1,8.4,11.3,8.2,18.8l-0.1,0.4h-14.1c0-4.6-1.5-8.3-4.6-11c-3.1-2.7-7.1-4.1-12.2-4.1c-4.9,0-8.7,1.2-11.4,3.5c-2.7,2.3-4,5.3-4,9c0,3.4,1.5,6.1,4.4,8.3c2.9,2.2,7.8,4.3,14.5,6.2c9.2,2.6,16.2,6.1,21,10.5c4.8,4.4,7.2,10.1,7.2,17c0,7.3-2.8,13-8.5,17.4c-5.7,4.3-13.2,6.5-22.4,6.5c-8.9,0-16.6-2.4-23.3-7.1C253.8,373.8,250.6,367.2,250.8,358.6z" fill="#217346"/>
            <path d="M327.7,6.3H81v231.3h197.7c55.6,0,100.9,45.3,100.9,100.9c0,55.6-45.3,100.9-100.9,100.9H81V506h366.6l0.6-381.2H327.7V6.3z" fill="#217346"/>
        </g>
    </svg>
);

const TableImportedFiles: React.FC<TableImportedFilesProps> = ({ pdfInfos, onDelete }) => {
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const session = useSession();
    //const [entrepriseId, setEntrepriseId] = useState<string | null>(null);
    const [providerType, setProviderType] = useState<'transporter' | 'destination' | ''>('');
    const [loadingUrls, setLoadingUrls] = useState<Record<number, boolean>>({});
    const [pdfUrls, setPdfUrls] = useState<Record<number, string>>({});
    const [numberPage, setNumberPage] = useState(1);

    // Gestionnaire de clic en dehors du menu
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (openMenuId !== null) {
                setOpenMenuId(null);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [openMenuId]);

    /*useEffect(() => {
        if (session && session?.entreprise_id) {
            setEntrepriseId(session.entreprise_id);
        }
    }, [session]);*/

    const handleOpenPdf = async (pdf: PdfInfo) => {
        if (pdfUrls[pdf.id]) {
            // Si on a déjà l'URL, ouvrir directement
            window.open(pdfUrls[pdf.id], '_blank');
            return;
        }

        try {
            setLoadingUrls(prev => ({ ...prev, [pdf.id]: true }));
            
            const { data: urlData } = await supabase
                .storage
                .from('pdfs_bucket')  // Correction du nom du bucket
                .createSignedUrl(pdf.name_pdf_in_bucket, 3600);

            if (!urlData?.signedUrl) {
                throw new Error('URL non générée');
            }

            setPdfUrls(prev => ({ ...prev, [pdf.id]: urlData.signedUrl }));
            window.open(urlData.signedUrl, '_blank');
        } catch (error) {
            console.error("Erreur lors de la récupération de l'URL:", error);
            toast.error("Impossible d'ouvrir le fichier");
        } finally {
            setLoadingUrls(prev => ({ ...prev, [pdf.id]: false }));
        }
    };

    return (
        <div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }} className="table-fixed">
                <thead>
                    <tr style={{ backgroundColor: 'white' }}>
                        <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '5%', textAlign: 'left', paddingLeft: '0' }}
                            className="text-xs font-normal text-gray-500 mb-0">Type</th>
                        <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '13%', textAlign: 'left', paddingLeft: '23px' }}
                            className="text-xs font-normal text-gray-500 mb-0">Statut</th>
                        <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '20%', textAlign: 'left', paddingLeft: '25px' }}
                            className="text-xs font-normal text-gray-500 mb-0">Nom</th>
                        <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '12%', textAlign: 'left' }}
                            className="text-xs font-normal text-gray-500 mb-0">Date</th>                            
                        <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '14%', textAlign: 'left' }}
                            className="text-xs font-normal text-gray-500 mb-0">Document</th>
                        {/*<th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '14%', textAlign: 'left' }}
                            className="text-xs font-normal text-gray-500 mb-0">Site</th>*/}
                        {/*<th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '25%', textAlign: 'left' }}
                            className="text-xs font-normal text-gray-500 mb-0">Prestataire</th>*/}
                        {/*<th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '8%', textAlign: 'left' }}
                            className="text-xs font-normal text-gray-500 mb-0">Taille</th>*/}
                        <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '12%', textAlign: 'right', paddingRight: '3.5rem' }}
                            className="text-xs font-normal text-gray-500 mb-0">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {[...pdfInfos]
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .slice(0, 10*numberPage)
                        .map((pdf) => (
                        <tr key={pdf.id} style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ padding: '6px', height: '40px' }} className="align-middle mt-1">
                                {pdf.document_type === 'excel' ? (
                                    <ExcelIcon />
                                ) : (
                                    <BoxIcon name='file-pdf' color='red' type='solid' />
                                )}
                            </td>
                            <td style={{ padding: '6px', height: '40px' }} className="align-middle">
                                {pdf.status === 'unread' ? <span className="px-2 py-1 rounded-full font-semibold text-orange-600 text-xs">
                                    En cours..
                                </span> : <span className="px-2 py-1 rounded-full font-semibold text-green-600 text-xs">
                                    Extraction terminée
                                </span>}
                            </td>
                            <td style={{ padding: '6px', height: '40px' }} className="align-middle">
                                <div className="text-xs font-medium truncate pr-4" title={pdf.name_pdf}>
                                    {pdf.name_pdf}
                                </div>
                            </td>
                            <td style={{ padding: '6px', height: '40px' }} className="align-middle">
                                <div className="flex justify-start items-center space-x-1">
                                    <div className="text-xs font-medium">
                                        {new Date(pdf.created_at).toLocaleDateString('fr-FR')}
                                    </div>
                                    {/*<div className="text-xs text-gray-500">
                                        {new Date(pdf.created_at).toLocaleTimeString('fr-FR')}
                                    </div>*/}
                                </div>
                            </td>
                            <td style={{ padding: '6px', height: '40px' }} className="align-middle">
                                {pdf.document_type !== 'excel' && (
                                    <SelectDocumentType 
                                        pdf_id={pdf.id} 
                                        initialType={pdf.document_type} 
                                    />
                                )}
                            </td>
                            {/*<td style={{ padding: '6px', height: '40px' }} className="align-middle">
                                <SelectSite 
                                    entreprise_id={session?.entreprise_id} 
                                    pdf_id={pdf.id}
                                    initialSite={pdf.site_siret}
                                />
                            </td>*/}
                            {/*<td style={{ padding: '6px', height: '40px' }} className="align-middle">
                                <SelectProvider 
                                    entreprise_id={session?.entreprise_id} 
                                    pdf_id={pdf.id}
                                    initialProvider={pdf.provider}
                                />
                            </td>*/}
                            {/*<td style={{ padding: '6px', height: '40px' }} className="align-middle">
                                <div className="text-xs">{pdf.file_size ? `${pdf.file_size} MB` : 'Inconnu'}</div>
                            </td>*/}
                            <td style={{ padding: '6px', height: '40px' }} className="align-middle">
                                <div className="flex items-center justify-end gap-2">
                                    {pdf.document_type !== 'excel' && (
                                        <button 
                                            onClick={() => handleOpenPdf(pdf)}
                                            disabled={loadingUrls[pdf.id]}
                                            className="px-3 py-1.5 border border-[var(--green-medium)] text-[var(--green-medium)] rounded-md text-xs hover:bg-green-50 w-[100px] text-center disabled:opacity-50"
                                        >
                                            {loadingUrls[pdf.id] ? 'Chargement...' : 'Ouvrir'}
                                        </button>
                                    )}
                                    <div className="relative">
                                        <button 
                                            className="px-1 py-1 text-gray-600 rounded-md hover:bg-gray-100 mt-0.5 h-8"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuId(openMenuId === pdf.id ? null : pdf.id);
                                            }}
                                        >
                                            <BoxIcon name='dots-vertical-rounded' size="20px" />
                                        </button>

                                        {openMenuId === pdf.id && (
                                            <div className="absolute right-0 mt-2 w-36 bg-white rounded-md shadow-lg z-50">
                                                <div className="py-1">
                                                    <button 
                                                        className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-red-50 hover:text-red-600 text-left"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDelete(pdf.name_pdf_in_bucket, pdf.id);
                                                            setOpenMenuId(null);
                                                        }}
                                                    >
                                                        Supprimer
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {cofounders_permission(session?.user_id) && pdf.document_type !== 'excel' && 
                                        <ExtractData 
                                            pdf_id={pdf.id} 
                                            pdf_path={pdf.name_pdf_in_bucket} 
                                        />
                                    }
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="flex justify-center mt-4"> 
                {pdfInfos.length > 10*numberPage ? (
                    <button 
                        className="px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded-md"
                        onClick={() => setNumberPage(numberPage + 1)}
                    >
                        Charger plus
                    </button>
                ) : (
                    <div className="text-xs">Les {pdfInfos.length} fichiers ont été chargés</div>
                )}
            </div>
        </div>
    );
};

const cofounders_permission = (user_id:string|null) => {
    if (user_id){
        if (user_id == "a0542794-bbae-4132-9dde-485595bfa2aa" || user_id == "8f05a291-f8b3-429d-839e-6f0b12f1bede" || user_id == "dd9acb15-4678-442f-af72-79331bc43d91"){
            return true;
        }
    }
    return false;
}

/*const SelectSite: React.FC<{ entreprise_id: string | null; pdf_id: number; initialSite?: string }> = ({ 
    entreprise_id, 
    pdf_id, 
    initialSite 
}) => {
    const [sites, setSites] = useState<Site[]>([]);
    const [selectedSite, setSelectedSite] = useState<string>(initialSite || '');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSites = async () => {
            setIsLoading(true);
            if (entreprise_id) {
                try {
                const sites = await getSites(entreprise_id);
                setSites(sites);
                } catch (error) {
                    console.error('Erreur lors du chargement des sites:', error);
                }
            }
            setIsLoading(false);
        };
        fetchSites();
    }, [entreprise_id]);

    if (isLoading) {
        return <div className="text-xs">Chargement...</div>;
    }

    const handleSelectSite = async (siret: string) => {
        setSelectedSite(siret);
        const { error } = await supabase
            .from('pdf_infos')
            .update({ site_siret: siret })
            .eq('id', pdf_id);

        if (error) {
            console.error('Erreur lors de la mise à jour du site:', error);
        }
    };

    return (
        <select 
            className="border rounded p-1 text-xs w-full max-w-[100px]"
            value={selectedSite}
            onChange={(e) => handleSelectSite(e.target.value)}
            disabled={isLoading}
        >
            <option value="">Sélectionner</option>
            {sites.map((site) => (
                <option key={site.siret} value={site.siret}>
                    {site.name} - {site.siret}
                </option>
            ))}
        </select>
    );
};*/

/*const getSites = async (entreprise_id: string): Promise<Site[]> => {
    const { data, error } = await supabase
        .from('bsd')
        .select(`
            infos_json,
            entreprise_id
        `)
        .eq('entreprise_id', entreprise_id);

    
    //const response = await fetch(`/api/get_data_bsd?entreprise_id=${entreprise_id}`);
    //const data:RowBSD[] = await response.json();

    if (error) {
        console.error('Erreur lors de la récupération des sites:', error);
        return [];
    }

    // Extraire et transformer les données
    const sitesData = data.map(row => {
        const emitterCompany = row.infos_json?.formAPI?.createFormInput?.emitter?.company;
        return {
            siret: emitterCompany?.siret || '',
            name: emitterCompany?.name || ''
        };
    }).filter(site => site.siret && site.name); // Filtrer les entrées invalides

    // Regrouper par siret et compter les occurrences des noms
    const siteMap = sitesData.reduce((acc, curr) => {
        if (!curr.siret) return acc;
        
        if (!acc[curr.siret]) {
            acc[curr.siret] = { names: {}, siret: curr.siret };
        }
        
        const name = curr.name || 'Inconnu';
        acc[curr.siret].names[name] = (acc[curr.siret].names[name] || 0) + 1;
        
        return acc;
    }, {} as Record<string, { names: Record<string, number>; siret: string }>);

    // Convertir en tableau et prendre le nom le plus fréquent pour chaque siret
    return Object.values(siteMap).map(({ names, siret }) => {
        const mostFrequentName = Object.entries(names)
            .reduce((a, b) => (a[1] > b[1] ? a : b))[0];
        
        return {
            siret,
            name: mostFrequentName
        };
    });
};*/

const SelectDocumentType: React.FC<{ pdf_id: number; initialType?: string }> = ({ pdf_id, initialType }) => {
    const [selectedType, setSelectedType] = useState<string>(initialType || '');

    const documentTypes: DocumentType[] = [
        { id: 'bsd', name: 'BSD' },
        { id: 'facture', name: 'Facture' },
        { id: 'contrat', name: 'Contrat' },
        { id: 'autre', name: 'Autre' }
    ];

    const handleSelectType = async (type: string) => {
        setSelectedType(type);
        const { error } = await supabase
            .from('pdf_infos')
            .update({ document_type: type })
            .eq('id', pdf_id);

        if (error) {
            console.error('Erreur lors de la mise à jour du type:', error);
        }
    };

    return (
        <select 
            className="border rounded p-1 text-xs w-full max-w-[100px]"
            value={selectedType}
            onChange={(e) => handleSelectType(e.target.value)}
        >
            <option value="">Type</option>
            {documentTypes.map((type) => (
                <option key={type.id} value={type.id}>
                    {type.name}
                </option>
            ))}
        </select>
    );
};

/*const SelectProvider: React.FC<{ 
    entreprise_id: string | null; 
    pdf_id: number;
    initialProvider?: ProviderJSON;
}> = ({ entreprise_id, pdf_id, initialProvider }) => {
    const [providers, setProviders] = useState<Provider[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<string>(initialProvider?.siret || '');
    const [providerType, setProviderType] = useState<'transporter' | 'destination' | ''>(() => {
        if (initialProvider?.is_transporter) return 'transporter';
        if (initialProvider?.is_destination) return 'destination';
        return '';
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchProviders = async () => {
            setIsLoading(true);
            if (entreprise_id) {
                try {
                const providers = await getProviders(entreprise_id);
                setProviders(providers);
                } catch (error) {
                    console.error('Erreur lors du chargement des prestataires:', error);
                }
            }
            setIsLoading(false);
        };
        fetchProviders();
    }, [entreprise_id]);

    if (isLoading) {
        return <div className="text-xs">Chargement...</div>;
    }

    const handleSelectProvider = async (siret: string) => {
        const selectedProviderData = providers.find(p => p.siret === siret);
        if (!selectedProviderData) return;

        setSelectedProvider(siret);
        
        const providerJSON: ProviderJSON = {
            siret: selectedProviderData.siret,
            name: selectedProviderData.name,
            is_transporter: providerType === 'transporter',
            is_destination: providerType === 'destination'
        };

        const { error } = await supabase
            .from('pdf_infos')
            .update({ 
                provider: providerJSON
            })
            .eq('id', pdf_id);

        if (error) {
            console.error('Erreur lors de la mise à jour du prestataire:', error);
        }
    };

    // Filtrer les providers selon le type sélectionné
    const filteredProviders = providers.filter(provider => {
        if (providerType === 'transporter') return provider.is_transporter;
        if (providerType === 'destination') return provider.is_destination;
        return true;
    });

    return (
        <div className="space-y-2 flex justify-start gap-2">
            <div className="flex flex-col gap-2">
                <label className="flex items-center space-x-1">
                    <input
                        type="radio"
                        checked={providerType === 'transporter'}
                        onChange={() => {
                            setProviderType('transporter');
                            setSelectedProvider(''); // Réinitialiser la sélection
                        }}
                        className="form-radio h-3 w-3"
                        name={`provider-type-${pdf_id}`}
                    />
                    <span className="text-xs">Transporteur</span>
                </label>
                <label className="flex items-center space-x-1">
                    <input
                        type="radio"
                        checked={providerType === 'destination'}
                        onChange={() => {
                            setProviderType('destination');
                            setSelectedProvider(''); // Réinitialiser la sélection
                        }}
                        className="form-radio h-3 w-3"
                        name={`provider-type-${pdf_id}`}
                    />
                    <span className="text-xs">Destinataire</span>
                </label>
            </div>
            {providerType && (
                <select 
                    className="border rounded p-1 text-xs w-full max-w-[150px]"
                    value={selectedProvider}
                    onChange={(e) => handleSelectProvider(e.target.value)}
                >
                    <option value="">Prestataire</option>
                    {filteredProviders.map((provider) => (
                        <option key={provider.siret} value={provider.siret}>
                            {provider.name} - {provider.siret}
                        </option>
                    ))}
                </select>
            )}
        </div>
    );
};*/

/*const getProviders = async (entreprise_id: string): Promise<Provider[]> => {
    const { data, error } = await supabase
        .from('bsd')
        .select(`
            infos_json,
            entreprise_id
        `)
        .eq('entreprise_id', entreprise_id);

    if (error) {
        console.error('Erreur lors de la récupération des prestataires:', error);
        return [];
    }

    // Extraire et transformer les données
    const providersData = data.map(row => {
        const transporterCompany = row.infos_json?.formAPI?.createFormInput?.transporter?.company;
        const destinationCompany = row.infos_json?.formAPI?.createFormInput?.recipient?.company;
        
        const providers: Provider[] = [];
        
        if (transporterCompany?.siret && transporterCompany?.name) {
            providers.push({
                siret: transporterCompany.siret,
                name: transporterCompany.name,
                is_transporter: true,
                is_destination: false
            });
        }
        
        if (destinationCompany?.siret && destinationCompany?.name) {
            providers.push({
                siret: destinationCompany.siret,
                name: destinationCompany.name,
                is_transporter: false,
                is_destination: true
            });
        }
        
        return providers;
    }).flat();

    // Regrouper par siret
    const providerMap = providersData.reduce((acc, curr) => {
        if (!curr.siret) return acc;
        
        if (!acc[curr.siret]) {
            acc[curr.siret] = { 
                names: {},
                siret: curr.siret,
                is_transporter: curr.is_transporter || false,
                is_destination: curr.is_destination || false
            };
        }
        
        const name = curr.name || 'Inconnu';
        acc[curr.siret].names[name] = (acc[curr.siret].names[name] || 0) + 1;
        acc[curr.siret].is_transporter = acc[curr.siret].is_transporter || curr.is_transporter;
        acc[curr.siret].is_destination = acc[curr.siret].is_destination || curr.is_destination;
        
        return acc;
    }, {} as Record<string, { 
        names: Record<string, number>; 
        siret: string;
        is_transporter: boolean;
        is_destination: boolean;
    }>);

    // Convertir en tableau et prendre le nom le plus fréquent
    return Object.values(providerMap).map(({ names, siret, is_transporter, is_destination }) => {
        const mostFrequentName = Object.entries(names)
            .reduce((a, b) => (a[1] > b[1] ? a : b))[0];
        
        return {
            siret,
            name: mostFrequentName,
            is_transporter,
            is_destination
        };
    });
};*/

export default TableImportedFiles;
