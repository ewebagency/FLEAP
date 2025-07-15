'use client'
import React from 'react';
import { useImport } from './ImportContext';

const ImportsFiltre: React.FC = () => {
    const { documentTypeFilter, setDocumentTypeFilter } = useImport();

    const handleFilterChange = (type: string | null) => {
        setDocumentTypeFilter(type);
    };

    return (
        <div className="flex items-center space-x-2">
            <div className="flex space-x-2">
                <button
                    onClick={() => handleFilterChange(null)}
                    className={`px-3 py-1 text-xs rounded-md mr-4 ${
                        documentTypeFilter === null
                            ? 'bg-green-100 text-green-800 font-medium'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    Tous
                </button>
                <button
                    onClick={() => handleFilterChange('bsd')}
                    className={`px-3 py-1 text-xs rounded-md ${
                        documentTypeFilter === 'bsd'
                            ? 'bg-green-100 text-green-800 font-medium'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    BSD
                </button>
                <button
                    onClick={() => handleFilterChange('bon')}
                    className={`px-3 py-1 text-xs rounded-md ${
                        documentTypeFilter === 'bon'
                            ? 'bg-green-100 text-green-800 font-medium'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    Bon
                </button>
                <button
                    onClick={() => handleFilterChange('facture')}
                    className={`px-3 py-1 text-xs rounded-md ${
                        documentTypeFilter === 'facture'
                            ? 'bg-green-100 text-green-800 font-medium'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    Facture
                </button>
                <button
                    onClick={() => handleFilterChange('conformite')}
                    className={`px-3 py-1 text-xs rounded-md mr-4 ${
                        documentTypeFilter === 'conformite'
                            ? 'bg-green-100 text-green-800 font-medium'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    Conformité
                </button>
                <div className='w-2 h-2 bg-white rounded-full'></div>
                <button
                    onClick={() => handleFilterChange('excel')}
                    className={`px-3 py-1 text-xs rounded-md mr-4 ${
                        documentTypeFilter === 'excel'
                            ? 'bg-green-100 text-green-800 font-medium'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    Excel
                </button>     
                <div className='w-2 h-2 bg-white rounded-full'></div>           
                <button
                    onClick={() => handleFilterChange('autre')}
                    className={`px-3 py-1 text-xs rounded-md ${
                        documentTypeFilter === 'autre'
                            ? 'bg-green-100 text-green-800 font-medium'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    Autre
                </button>
            </div>
        </div>
    );
};

export default ImportsFiltre; 