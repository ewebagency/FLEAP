'use client';

import React, { useState, useRef } from 'react';
import { useSession } from '@/app/component/SessionProvider';
import { supabase } from '@/app/database/supabaseClient';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import BoxIcon from '@/app/component/BoxIconWrapper';
import { extractMetaExcel } from './extract_meta_excel';
import MetaExcel from './MetaExcel';
import { useImport } from '@/app/import_page/ImportComponents/ImportContext';
import { PdfInfo } from '@/app/import_page/ImportComponents/TableImportedFiles';

export interface ExcelRow {
  [key: string]: string | number | boolean | null;
}

export interface ColumnPattern {
  [columnName: string]: 'text' | 'number' | 'boolean' | 'date' | 'null' | 'id';
}

export interface PatternAnalysis {
  pattern: ColumnPattern;
  rows: ExcelRow[];
  count: number;
}

export interface MetaExcelData {
  fileName: string;
  sheetName: string;
  totalRows: number;
  patterns: PatternAnalysis[];
  mostCommonPattern: PatternAnalysis;
  mergedPatterns?: number[][]; // Groupes de patterns fusionnés
}

const ButtonImportMetaExcel = () => {
  const { entreprise_id, user_id } = useSession();
  const { updatePdfInfos } = useImport();
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [metaData, setMetaData] = useState<MetaExcelData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowModal(true);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast.error('Veuillez sélectionner un fichier Excel');
      return;
    }

    setIsLoading(true);
    try {
      // Lire le fichier Excel
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      
      // Traiter la première sheet (ou toutes les sheets selon vos besoins)
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExcelRow[];

      // Analyser les patterns avec la fonction extract_meta_excel
      const analysis = extractMetaExcel(jsonData, fileName, firstSheetName);
      
      setMetaData(analysis);
      setShowPreview(true);
      setShowModal(false);
      
      // Créer une ligne dans la table pdf_infos
      if (entreprise_id && user_id) {
        try {
          const { data: pdfData, error: pdfError } = await supabase
            .from('pdf_infos')
            .insert({
              user_id: user_id,
              pdf_path: '',
              name_pdf: fileName,
              name_pdf_in_bucket: '',
              status: 'read',
              site_siret: null,
              document_type: 'excel',
              entreprise_id: entreprise_id,
              site_siret_plus: null,
            })
            .select()
            .single();

          if (pdfError) {
            console.error('Erreur lors de la création de la ligne pdf_infos:', pdfError);
            toast.error('Erreur lors de l\'enregistrement des informations du fichier');
          } else if (pdfData && updatePdfInfos) {
            // Mettre à jour les données locales avec le nouveau PDF
            updatePdfInfos(pdfData as PdfInfo);
          }
        } catch (error) {
          console.error('Erreur lors de la création de la ligne pdf_infos:', error);
          toast.error('Erreur lors de l\'enregistrement des informations du fichier');
        }
      }
      
      toast.success(`Analyse terminée : ${analysis.patterns.length} patterns détectés`);
    } catch (error) {
      console.error('Erreur lors de l\'analyse:', error);
      toast.error('Erreur lors de l\'analyse du fichier Excel');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setFileName('');
    setMetaData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    resetForm();
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    resetForm();
  };

  return (
    <div className="relative">
      <button 
        onClick={handleButtonClick}
        className="h-[30px] flex justify-between items-center gap-2 bg-gray-100 rounded-md px-2 cursor-pointer active:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isLoading}
      >
        <div className="text-[var(--green-light)] rounded-full py-1 mt-1 font-thin">
          {isLoading ? (
            <span className="inline-block animate-spin">↻</span>
          ) : (
            <BoxIcon name='import' type='solid' color='green' size="18px" />
          )}
        </div>
        <div className="text-black font-thin text-md">
          {isLoading ? 'Analyse en cours...' : 'Analyser Excel (Meta)'}
        </div>
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Analyser un fichier Excel (Meta)</h3>
            
            {/* Sélection du fichier */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fichier Excel <span className="text-red-500">*</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {fileName && (
                <p className="text-sm text-gray-600 mt-1">Fichier sélectionné: {fileName}</p>
              )}
            </div>

            <div className="mb-4 p-3 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Fonctionnalité Meta Excel :</strong> Cette fonctionnalité analyse automatiquement 
                les patterns de types de colonnes dans votre fichier Excel et vous permet de visualiser 
                les données par pattern de structure.
              </p>
            </div>

            {/* Boutons */}
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                disabled={isLoading}
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                disabled={isLoading || !selectedFile}
              >
                {isLoading ? 'Analyse en cours...' : 'Analyser'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de prévisualisation */}
      {showPreview && metaData && (
        <MetaExcel
          data={metaData}
          isOpen={showPreview}
          onClose={handleClosePreview}
        />
      )}
    </div>
  );
};

export default ButtonImportMetaExcel;
