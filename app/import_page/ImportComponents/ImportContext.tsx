'use client'
import React, { createContext, useContext, useState, ReactNode, useRef } from 'react';
import { PdfInfo } from './TableImportedFiles';

interface ImportContextType {
  importReload: number;
  triggerReload: () => void;
  documentTypeFilter: string | null;
  setDocumentTypeFilter: (filter: string | null) => void;
  statusFilter: string | null;
  setStatusFilter: (filter: string | null) => void;
  setUpdatePdfInfosFunction: (fn: (newPdfInfo: PdfInfo) => void) => void;
  updatePdfInfos: (newPdfInfo: PdfInfo) => void;
}

const ImportContext = createContext<ImportContextType | undefined>(undefined);

export const useImport = () => {
  const context = useContext(ImportContext);
  if (context === undefined) {
    throw new Error('useImport must be used within an ImportProvider');
  }
  return context;
};

interface ImportProviderProps {
  children: ReactNode;
}

export const ImportProvider: React.FC<ImportProviderProps> = ({ children }) => {
  const [importReload, setImportReload] = useState(0);
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const updatePdfInfosRef = useRef<((newPdfInfo: PdfInfo) => void) | null>(null);

  const triggerReload = () => {
    setImportReload(prev => prev + 1);
  };

  const setUpdatePdfInfosFunction = (fn: (newPdfInfo: PdfInfo) => void) => {
    updatePdfInfosRef.current = fn;
  };

  const updatePdfInfos = (newPdfInfo: PdfInfo) => {
    if (updatePdfInfosRef.current) {
      updatePdfInfosRef.current(newPdfInfo);
    }
  };

  const value: ImportContextType = {
    importReload,
    triggerReload,
    documentTypeFilter,
    setDocumentTypeFilter,
    statusFilter,
    setStatusFilter,
    setUpdatePdfInfosFunction,
    updatePdfInfos
  };

  return (
    <ImportContext.Provider value={value}>
      {children}
    </ImportContext.Provider>
  );
}; 