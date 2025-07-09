'use client'
import React, { createContext, useContext, useState } from 'react';

interface ImportContextType {
    importReload: boolean;
    triggerReload: () => void;
    documentTypeFilter: string | null;
    setDocumentTypeFilter: (filter: string | null) => void;
    statusFilter: string | null;
    setStatusFilter: (filter: string | null) => void;
}

const ImportContext = createContext<ImportContextType | undefined>(undefined);

export const ImportProvider = ({ children }: { children: React.ReactNode }) => {
    const [importReload, setImportReload] = useState(false);
    const [documentTypeFilter, setDocumentTypeFilter] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);

    const triggerReload = () => {
        setImportReload(prev => !prev);
    };

    return (
        <ImportContext.Provider value={{ 
            importReload, 
            triggerReload,
            documentTypeFilter,
            setDocumentTypeFilter,
            statusFilter,
            setStatusFilter
        }}>
            {children}
        </ImportContext.Provider>
    );
};

export const useImport = () => {
    const context = useContext(ImportContext);
    if (context === undefined) {
        throw new Error('useImport must be used within an ImportProvider');
    }
    return context;
}; 