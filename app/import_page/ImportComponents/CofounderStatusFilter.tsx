'use client'
import React from 'react';
import { useImport } from './ImportContext';
import { cofounders_user_id } from '@/app/component/SideBar';
import { useSession } from '@/app/component/SessionProvider';

interface CofounderStatusFilterProps {
    totalDocuments?: number;
    filteredDocuments?: number;
}

const CofounderStatusFilter: React.FC<CofounderStatusFilterProps> = ({ totalDocuments = 0, filteredDocuments = 0 }) => {
    const { statusFilter, setStatusFilter } = useImport();
    const { user_id, display_features } = useSession();

    const handleStatusFilterChange = (status: string | null) => {
        setStatusFilter(status);
    };

    // Si l'utilisateur n'a pas le droit d'accéder aux fonctions d'extraction OCR, ne pas afficher le filtre
    if (!display_features?.extract_ocr) {
        return null;
    }

    // Déterminer le nombre de documents à afficher
    const documentsToShow = statusFilter ? filteredDocuments : totalDocuments;

    return (
        <div className="flex flex-row justify-start items-end gap-4 my-3">
            <div className="text-sm text-gray-500 font-medium">
                Statut des documents ({documentsToShow})
            </div>
            <div className="flex space-x-2">
                <button
                    onClick={() => handleStatusFilterChange(null)}
                    className={`px-3 py-1 text-xs rounded-md mr-4 ${
                        statusFilter === null
                            ? 'bg-blue-100 text-blue-800 font-medium'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    Tous
                </button>
                <button
                    onClick={() => handleStatusFilterChange('unread')}
                    className={`px-3 py-1 text-xs rounded-md ${
                        statusFilter === 'unread'
                            ? 'bg-orange-100 text-orange-800 font-medium'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    En cours
                </button>
                <button
                    onClick={() => handleStatusFilterChange('read')}
                    className={`px-3 py-1 text-xs rounded-md ${
                        statusFilter === 'read'
                            ? 'bg-green-100 text-green-800 font-medium'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    Extraction terminée
                </button>
                <button
                    onClick={() => handleStatusFilterChange('linked')}
                    className={`px-3 py-1 text-xs rounded-md ${
                        statusFilter === 'linked'
                            ? 'bg-purple-100 text-purple-800 font-medium'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    Document affilié
                </button>
            </div>
        </div>
    );
};

export default CofounderStatusFilter; 