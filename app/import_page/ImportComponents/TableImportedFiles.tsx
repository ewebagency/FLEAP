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
                    {[...pdfInfos].reverse().slice(0, 10*numberPage).map((pdf) => (
                        <tr key={pdf.id} style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ padding: '6px', height: '40px' }} className="align-middle mt-1">
                                <BoxIcon name='file-pdf' color='red' type='solid' />
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
                                <SelectDocumentType 
                                    pdf_id={pdf.id} 
                                    initialType={pdf.document_type} 
                                />
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
                                    <button 
                                        onClick={() => handleOpenPdf(pdf)}
                                        disabled={loadingUrls[pdf.id]}
                                        className="px-3 py-1.5 border border-[var(--green-medium)] text-[var(--green-medium)] rounded-md text-xs hover:bg-green-50 w-[100px] text-center disabled:opacity-50"
                                    >
                                        {loadingUrls[pdf.id] ? 'Chargement...' : 'Ouvrir'}
                                    </button>
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
                                    {cofounders_permission(session?.user_id) && 
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
