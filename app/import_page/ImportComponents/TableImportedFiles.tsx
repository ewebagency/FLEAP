import React, { useState, useEffect } from 'react';
import BoxIcon from '@/app/component/BoxIconWrapper';
import { supabase } from '@/app/database/supabaseClient';
import { useSession } from '@/app/component/SessionProvider';
import ExtractData from './ExtractData';
import { toast } from 'react-hot-toast';
import { RowBSD } from '@/app/register/interface/BSD_Interface';
import { useFilterContext, Site as FilterSite } from '@/app/FilterContext';
import ExtractBSD from './ExtractBSD';
import LinkBSD from './LinkBSD';
import ButtonExtractFacture from './NewExtractFacture/ButtonExtractFacture';

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
    site_siret_plus?: string[];
    provider?: ProviderJSON;
}

interface TableImportedFilesProps {
    pdfInfos: PdfInfo[];
    onDelete: (pdfPath: string, id: number) => void;
}

interface SiteInfo {
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

export const ExcelIcon = () => (
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
    const [loadingUrls, setLoadingUrls] = useState<Record<number, boolean>>({});
    const [pdfUrls, setPdfUrls] = useState<Record<number, string>>({});
    const [numberPage, setNumberPage] = useState(1);
    const { sites: filteredSites } = useFilterContext();

    // Filtrer les pdfInfos en fonction des sites cochés
    const filteredPdfInfos = pdfInfos.filter(pdf => {
        // Si aucun site n'est défini, on garde le fichier
        if (!pdf.site_siret_plus || pdf.site_siret_plus.length === 0) return true;
        
        // On vérifie si au moins un des sites est coché dans le filtre
        return pdf.site_siret_plus.some(siret => {
            const site = filteredSites.find(s => s.orgId === siret);
            return site?.checked ?? true;
        });
    });

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

    const handleDelete = async (pdf: PdfInfo) => {
        try {
            // Si c'est un BSD, supprimer d'abord les enregistrements dans bsd_pdf
            if (pdf.document_type === 'bsd') {
                // 1. Récupérer les BSDs associés à ce PDF
                const { data: bsdPdfData, error: fetchError } = await supabase
                    .from('bsd_pdf')
                    .select('linked_bsd_id')
                    .eq('pdf_id', pdf.id);

                if (fetchError) {
                    console.error('Erreur lors de la récupération des BSDs:', fetchError);
                    toast.error('Erreur lors de la récupération des BSDs');
                    return;
                }

                // 2. Mettre à jour chaque BSD pour retirer le pdf_id de pdf_ids
                if (bsdPdfData && bsdPdfData.length > 0) {
                    for (const bsdPdf of bsdPdfData) {
                        const { data: bsdData, error: bsdFetchError } = await supabase
                            .from('bsd')
                            .select('pdf_ids')
                            .eq('id', bsdPdf.linked_bsd_id)
                            .single();

                        if (bsdFetchError) {
                            console.error('Erreur lors de la récupération du BSD:', bsdFetchError);
                            continue;
                        }

                        if (bsdData && bsdData.pdf_ids) {
                            const updatedPdfIds = bsdData.pdf_ids.filter((id: string) => id !== String(pdf.id));
                            
                            const { error: updateError } = await supabase
                                .from('bsd')
                                .update({ pdf_ids: updatedPdfIds })
                                .eq('id', bsdPdf.linked_bsd_id);

                            if (updateError) {
                                console.error('Erreur lors de la mise à jour du BSD:', updateError);
                            }
                        }
                    }
                }

                // 3. Supprimer les enregistrements dans bsd_pdf
                const { error: bsdError } = await supabase
                    .from('bsd_pdf')
                    .delete()
                    .eq('pdf_id', pdf.id);

                if (bsdError) {
                    console.error('Erreur lors de la suppression des données BSD:', bsdError);
                    toast.error('Erreur lors de la suppression des données BSD');
                    return;
                }
            }

            // Ensuite supprimer le fichier PDF
            onDelete(pdf.name_pdf_in_bucket, pdf.id);
            setOpenMenuId(null);
        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
            toast.error('Erreur lors de la suppression du fichier');
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
                        <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '16%', textAlign: 'left' }}
                            className="text-xs font-normal text-gray-500 mb-0">Site</th>
                        <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '12%', textAlign: 'right', paddingRight: '3.5rem' }}
                            className="text-xs font-normal text-gray-500 mb-0">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {[...filteredPdfInfos]
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
                                {pdf.status === 'unread' ? (
                                    <span className="px-2 py-1 rounded-full font-semibold text-orange-600 text-xs">
                                        En cours
                                    </span>
                                ) : pdf.status === 'linked' ? (
                                    <span className="px-2 py-1 rounded-full font-semibold text-green-600 text-xs">
                                        Document affilié
                                    </span>
                                ) : (
                                    <span className="px-2 py-1 rounded-full font-semibold text-green-600 text-xs">
                                        Extraction terminée
                                    </span>
                                )}
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
                            <td style={{ padding: '6px', height: '40px' }} className="align-middle">
                                <SelectSite 
                                    entreprise_id={session?.entreprise_id} 
                                    pdf_id={pdf.id}
                                    initialSite={pdf.site_siret_plus}
                                />
                            </td>
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
                                <div className="flex items-center justify-end gap-2" style={{ position: 'relative' }}>
                                    {pdf.document_type !== 'excel' && (
                                        <button 
                                            type="button"
                                            onClick={() => handleOpenPdf(pdf)}
                                            disabled={loadingUrls[pdf.id]}
                                            style={{ position: 'relative', zIndex: 1 }}
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
                                                            handleDelete(pdf);
                                                        }}
                                                    >
                                                        Supprimer
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {/*cofounders_permission(session?.user_id) && pdf.document_type === 'facture' && 
                                        <ExtractData 
                                            pdf_id={pdf.id} 
                                            pdf_path={pdf.name_pdf_in_bucket} 
                                        /> ---> ancien extract facture
                                    */} 
                                    {cofounders_permission(session?.user_id) && pdf.document_type === 'facture' && 
                                        <ButtonExtractFacture
                                            pdf_id={pdf.id} 
                                            pdf_path={pdf.name_pdf_in_bucket} 
                                        />
                                    }                                    
                                    {cofounders_permission(session?.user_id) && pdf.document_type === 'bsd' && 
                                        <ExtractBSD 
                                            pdf_id={pdf.id} 
                                            pdf_path={pdf.name_pdf_in_bucket} 
                                        />
                                    }
                                    {cofounders_permission(session?.user_id) && pdf.document_type === 'bsd' && pdf.status === 'read' &&
                                        <LinkBSD
                                            pdf_id={pdf.id}
                                        />
                                    }
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="flex justify-center mt-4"> 
                {filteredPdfInfos.length > 10*numberPage ? (
                    <button 
                        className="px-3 py-2 text-sm text-gray-700 bg-[var(--green-medium)] hover:bg-[var(--green-dark)] rounded-md border border-gray-300 text-white"
                        onClick={() => setNumberPage(numberPage + 1)}
                    >
                        Charger plus
                    </button>
                ) : (
                    <div className="text-xs">Les {filteredPdfInfos.length} fichiers ont été chargés</div>
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

const getSites = async (entreprise_id: string, sitesFromContext: FilterSite[]): Promise<SiteInfo[]> => {
    // Convertir les sites du FilterContext en format attendu
    return sitesFromContext.map((site: FilterSite) => ({
        siret: site.orgId,
        name: site.name
    }));
};

const SelectSite: React.FC<{ entreprise_id: string | null; pdf_id: number; initialSite?: string[] }> = ({ 
    entreprise_id, 
    pdf_id, 
    initialSite 
}) => {
    const [sites, setSites] = useState<SiteInfo[]>([]);
    const [selectedSites, setSelectedSites] = useState<string[]>(initialSite || []);
    const [isLoading, setIsLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const { sites: sitesFromContext } = useFilterContext();
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchSites = async () => {
            setIsLoading(true);
            if (entreprise_id) {
                try {
                    const sites = await getSites(entreprise_id, sitesFromContext);
                    setSites(sites);
                } catch (error) {
                    console.error('Erreur lors du chargement des sites:', error);
                }
            }
            setIsLoading(false);
        };
        fetchSites();
    }, [entreprise_id, sitesFromContext]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSelectSite = async (siret: string) => {
        const newSelectedSites = selectedSites.includes(siret)
            ? selectedSites.filter(site => site !== siret)
            : [...selectedSites, siret];
        
        setSelectedSites(newSelectedSites);
        
        const { error } = await supabase
            .from('pdf_infos')
            .update({ site_siret_plus: newSelectedSites })
            .eq('id', pdf_id);

        if (error) {
            console.error('Erreur lors de la mise à jour des sites:', error);
        }
    };

    if (isLoading) {
        return <div className="text-xs">Chargement...</div>;
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full max-w-[140px] px-2 py-1 text-xs border rounded-md hover:bg-gray-50"
            >
                <span className="truncate">
                    {selectedSites.length === 0 
                        ? "Sélectionner" 
                        : selectedSites.length === 1
                            ? sites.find(s => s.siret === selectedSites[0])?.name
                            : `${selectedSites.length} sites sélectionnés`}
                </span>
                <BoxIcon name={isOpen ? 'chevron-up' : 'chevron-down'} size="16px" />
            </button>

            {isOpen && (
                <div className="absolute z-10 w-full max-w-[200px] mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    <div className="py-1">
                        {sites.map((site) => (
                            <label
                                key={site.siret}
                                className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer whitespace-nowrap"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedSites.includes(site.siret)}
                                    onChange={() => handleSelectSite(site.siret)}
                                    className="mr-2 rounded border-gray-300 text-[var(--green-medium)] focus:ring-[var(--green-medium)]"
                                />
                                <span className="text-xs">
                                    {site.name}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const SelectDocumentType: React.FC<{ pdf_id: number; initialType?: string }> = ({ pdf_id, initialType }) => {
    const [selectedType, setSelectedType] = useState<string>(initialType || '');

    const documentTypes: DocumentType[] = [
        { id: 'bsd', name: 'BSD' },
        { id: 'bon', name: 'Bon' },
        { id: 'facture', name: 'Facture' },
        { id: 'prestataire', name: 'Contrat Presta' },
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

export default TableImportedFiles;
