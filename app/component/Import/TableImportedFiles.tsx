import React from 'react';

interface PdfInfo {
    id: number;
    name_pdf: string;
    name_pdf_in_bucket:string;
    pdf_path: string;
    created_at: string;
    url: string;
}

interface TableImportedFilesProps {
    pdfInfos: PdfInfo[];
    onDelete: (pdfPath: string, id: number) => void; // Fonction pour gérer la suppression
}

const TableImportedFiles: React.FC<TableImportedFilesProps> = ({ pdfInfos, onDelete }) => {
    return (
        <div className="mt-4">
            <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                    <tr>
                        <th className="border border-gray-300 p-2">Nom du PDF</th>
                        {/*<th className="border border-gray-300 p-2">Chemin du PDF</th>*/}
                        <th className="border border-gray-300 p-2">URL</th>
                        <th className="border border-gray-300 p-2">Date de création</th>
                        <th className="border border-gray-300 p-2">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {[...pdfInfos].reverse().map((pdf) => (
                        <tr key={pdf.id}>
                            <td className="border border-gray-300 p-2">{pdf.name_pdf}</td>
                            {/*<td className="border border-gray-300 p-2">{pdf.pdf_path}</td>*/}
                            <td className="border border-gray-300 p-2">
                                <a 
                                    href={pdf.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:text-blue-700 underline"
                                >
                                    Voir le PDF
                                </a>
                            </td>
                            <td className="border border-gray-300 p-2">{new Date(pdf.created_at).toLocaleString()}</td>
                            <td className="border border-gray-300 p-2">
                                <button 
                                    onClick={() => onDelete(pdf.name_pdf_in_bucket, pdf.id)} 
                                    className="bg-red-500 text-white p-1 rounded"
                                >
                                    Supprimer
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TableImportedFiles;
