import React, { useState } from 'react';

interface PdfInfo {
    id: number;
    name_pdf: string;
    name_pdf_in_bucket: string;
    pdf_path: string;
    created_at: string;
    url: string;
    file_size: number;
}

interface TableImportedFilesProps {
    pdfInfos: PdfInfo[];
    onDelete: (pdfPath: string, id: number) => void;
}

const TableImportedFiles: React.FC<TableImportedFilesProps> = ({ pdfInfos, onDelete }) => {
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);

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
                        <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '14%', textAlign: 'left' }}
                            className="text-xs font-normal text-gray-500 mb-0">Site</th>
                        <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '14%', textAlign: 'left' }}
                            className="text-xs font-normal text-gray-500 mb-0">Prestataire</th>
                        <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '8%', textAlign: 'left' }}
                            className="text-xs font-normal text-gray-500 mb-0">Taille</th>
                        <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '12%', textAlign: 'right', paddingRight: '3.5rem' }}
                            className="text-xs font-normal text-gray-500 mb-0">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {[...pdfInfos].reverse().map((pdf) => (
                        <tr key={pdf.id} style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ padding: '6px', height: '40px' }} className="align-middle mt-1">
                                <box-icon name='file-pdf' color='red' type='solid'></box-icon>
                            </td>
                            <td style={{ padding: '6px', height: '40px' }} className="align-middle">
                                <span className="px-2 py-1 rounded-full font-semibold text-orange-600 text-xs">
                                    En cours..
                                </span>
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
                                <select className="border rounded p-1 text-xs w-full max-w-[100px]">
                                    <option value="">Type</option>
                                    <option value="bsd">BSD</option>
                                    <option value="facture">Facture</option>
                                    <option value="autre">Autre</option>
                                </select>
                            </td>
                            <td style={{ padding: '6px', height: '40px' }} className="align-middle">
                                <select className="border rounded p-1 text-xs w-full max-w-[100px]">
                                    <option value="">Site</option>
                                    <option value="paprec">Paprec</option>
                                    <option value="veolia">Veolia</option>
                                    <option value="suez">Suez</option>
                                </select>
                            </td>
                            <td style={{ padding: '6px', height: '40px' }} className="align-middle">
                                <select className="border rounded p-1 text-xs w-full max-w-[100px]">
                                    <option value="">Prestataire</option>
                                    <option value="paprec">Paprec</option>
                                    <option value="veolia">Veolia</option>
                                    <option value="suez">Suez</option>
                                </select>
                            </td>
                            <td style={{ padding: '6px', height: '40px' }} className="align-middle">
                                <div className="text-xs">{pdf.file_size ? `${pdf.file_size} MB` : 'Inconnu'}</div>
                            </td>
                            <td style={{ padding: '6px', height: '40px' }} className="align-middle">
                                <div className="flex items-center justify-end gap-2">
                                    <a 
                                        href={pdf.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1.5 border border-[var(--green-medium)] text-[var(--green-medium)] rounded-md text-xs hover:bg-green-50 w-[100px] text-center"
                                    >
                                        Ouvrir
                                    </a>
                                    <div className="relative">
                                        <button 
                                            className="px-1 py-1 text-gray-600 rounded-md hover:bg-gray-100 mt-0.5 h-8"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuId(openMenuId === pdf.id ? null : pdf.id);
                                            }}
                                        >
                                            <box-icon name='dots-vertical-rounded' size="20px"></box-icon>
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
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TableImportedFiles;
