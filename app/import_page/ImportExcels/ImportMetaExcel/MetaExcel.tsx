'use client';

import React, { useEffect, useState } from 'react';
import { MetaExcelData, ExcelRow, ColumnPattern } from './ButtonImportMetaExcel';
import { formatPattern, getPatternSummary, excelNumberToDate } from './extract_meta_excel';
import DeriveColumns, { DerivedColumnDef, evaluateFormulaTokens, evaluateConditionTokens } from './DeriveColumns';
import * as XLSX from 'xlsx';
import { buildStoredParams, fetchParamsFormats, saveParamsFormat, StoredParamsFormat, adaptStoredToCurrent } from './params_format';
import { useSession } from '@/app/component/SessionProvider';
import PreviewImport from '../../ImportComponents/PreviewImport';
import { RowBSDPreview } from '../ButtonImportExcels';
import standard_with_classic from '../FormatsExcels/classic';
import { ExcelData } from '../FormatsExcels/ecobtp';
import { sendDataToBdd } from '../send_data_to_bdd';
import { supabase } from '@/app/database/supabaseClient';

interface MetaExcelProps {
  data: MetaExcelData;
  isOpen: boolean;
  onClose: () => void;
}

const MetaExcel: React.FC<MetaExcelProps> = ({ data, isOpen, onClose }) => {
  const session = useSession();
  const [selectedPatternIndex, setSelectedPatternIndex] = useState(0);
  const [showAllPatterns, setShowAllPatterns] = useState(false);
  const [mergedPatterns, setMergedPatterns] = useState<number[][]>(data.mergedPatterns || []);
  const [selectedPatterns, setSelectedPatterns] = useState<number[]>([]);
  const [headerPatternIndex, setHeaderPatternIndex] = useState<number | null>(null);
  const [deletedPatterns, setDeletedPatterns] = useState<number[]>([]);
  const [excludedColumns, setExcludedColumns] = useState<string[]>([]);
  const [showDeletedPatterns, setShowDeletedPatterns] = useState(false);
  const [showDiscriminantColumns, setShowDiscriminantColumns] = useState(false);
  const [showColumnStructure, setShowColumnStructure] = useState(true);
  const [showStep2, setShowStep2] = useState(false);
  const [derivedDefs, setDerivedDefs] = useState<DerivedColumnDef[]>([]);
  const [columnMappings, setColumnMappings] = useState<{[key: string]: string}>({});
  const [clickedColumn, setClickedColumn] = useState<string | null>(null);
  const [displayingMergedPattern, setDisplayingMergedPattern] = useState<{
    pattern: ColumnPattern;
    rows: ExcelRow[];
    count: number;
    indices: number[];
  } | null>(null);
  const [mappingSearch, setMappingSearch] = useState<string>('');
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [showHiddenColumnsPanel, setShowHiddenColumnsPanel] = useState<boolean>(false);
  const [hideMode, setHideMode] = useState<boolean>(false);
  const [selectedMappingIndex, setSelectedMappingIndex] = useState<number>(-1);
  const [savedParams, setSavedParams] = useState<StoredParamsFormat[]>([]);
  const [showSaveParamsModal, setShowSaveParamsModal] = useState<boolean>(false);
  const [saveParamsName, setSaveParamsName] = useState<string>('');
  const [saveMode, setSaveMode] = useState<'new' | 'overwrite'>('new');
  const [overwriteIdx, setOverwriteIdx] = useState<number>(-1);
  const [showApplyParamsModal, setShowApplyParamsModal] = useState<boolean>(false);
  const [selectedParamsIdx, setSelectedParamsIdx] = useState<number>(-1);
  const [showFinalPreview, setShowFinalPreview] = useState<boolean>(false);
  const [finalPreviewData, setFinalPreviewData] = useState<RowBSDPreview[]>([]);
  const [isProcessingImport, setIsProcessingImport] = useState<boolean>(false);

  // Fonction pour sélectionner un pattern individuel
  const selectPattern = (index: number) => {
    setSelectedPatternIndex(index);
    setSelectedPatterns([]); // Désélectionner tous les patterns pour la fusion
  };

  // Fonction pour gérer le clic sur un pattern
  const handlePatternClick = (index: number, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      // Ctrl+clic : sélection multiple pour fusion
      if (selectedPatterns.includes(index)) {
        setSelectedPatterns(selectedPatterns.filter(i => i !== index));
      } else {
        setSelectedPatterns([...selectedPatterns, index]);
      }
    } else {
      // Clic simple : afficher le pattern
      selectPattern(index);
    }
  };

  // Fonction pour supprimer un pattern
  const deletePattern = (index: number) => {
    setDeletedPatterns([...deletedPatterns, index]);
    // Nettoyer les sélections et fusions qui incluent ce pattern
    setSelectedPatterns(selectedPatterns.filter(i => i !== index));
    setMergedPatterns(mergedPatterns.map(group => group.filter(i => i !== index)).filter(group => group.length > 0));
    if (headerPatternIndex === index) {
      setHeaderPatternIndex(null);
    }
    if (displayingMergedPattern && displayingMergedPattern.indices.includes(index)) {
      setDisplayingMergedPattern(null);
    }
  };

  // Fonction pour restaurer un pattern supprimé
  const restorePattern = (index: number) => {
    setDeletedPatterns(deletedPatterns.filter(i => i !== index));
  };

  // Fonction pour recalculer les patterns en excluant certaines colonnes
  const recalculatePatternsWithExcludedColumns = () => {
    if (excludedColumns.length === 0) return data.patterns;

    return data.patterns.map(pattern => {
      // Créer un nouveau pattern sans les colonnes exclues
      const newPattern: ColumnPattern = {};
      Object.entries(pattern.pattern).forEach(([column, type]) => {
        if (!excludedColumns.includes(column)) {
          newPattern[column] = type;
        }
      });

      // Filtrer les lignes pour ne garder que les colonnes non exclues
      const filteredRows = pattern.rows.map(row => {
        const newRow: ExcelRow = {};
        Object.entries(row).forEach(([column, value]) => {
          if (!excludedColumns.includes(column)) {
            newRow[column] = value;
          }
        });
        return newRow;
      });

      return {
        pattern: newPattern,
        rows: filteredRows,
        count: pattern.count
      };
    });
  };

  // Fonction pour grouper les patterns identiques après exclusion de colonnes
  const groupIdenticalPatterns = (patterns: typeof data.patterns) => {
    const groups = new Map<string, number[]>();
    
    patterns.forEach((pattern, index) => {
      if (deletedPatterns.includes(index)) return; // Ignorer les patterns supprimés
      
      const patternKey = JSON.stringify(pattern.pattern);
      if (!groups.has(patternKey)) {
        groups.set(patternKey, []);
      }
      groups.get(patternKey)!.push(index);
    });

    return Array.from(groups.values()).filter(group => group.length > 1);
  };

  // Fonction pour calculer la similarité entre deux patterns
  const calculatePatternSimilarity = (pattern1: ColumnPattern, pattern2: ColumnPattern): number => {
    const keys1 = Object.keys(pattern1);
    const keys2 = Object.keys(pattern2);
    const allKeys = new Set([...keys1, ...keys2]);
    
    let matchingTypes = 0;
    const totalKeys = allKeys.size;
    
    allKeys.forEach(key => {
      const type1 = pattern1[key];
      const type2 = pattern2[key];
      if (type1 === type2) {
        matchingTypes++;
      }
    });
    
    return totalKeys > 0 ? matchingTypes / totalKeys : 0;
  };

  // Fonction pour supprimer automatiquement les patterns non pertinents
  const autoCleanupPatterns = () => {
    if (recalculatedPatterns.length <= 1) return;
    
    const mainPattern = recalculatedPatterns[0]; // Pattern principal (le plus récurrent)
    const patternsToDelete: number[] = [];
    
    recalculatedPatterns.forEach((pattern, index) => {
      if (index === 0 || deletedPatterns.includes(index)) return; // Ne pas supprimer le pattern principal
      if (headerPatternIndex === index) return; // Ne pas supprimer le pattern header
      
      const similarity = calculatePatternSimilarity(mainPattern.pattern, pattern.pattern);
      const isLowCount = pattern.count < 5;
      const isVeryDifferent = similarity < 0.3; // Moins de 30% de similarité
      
      // Supprimer si : peu de lignes ET très différent du pattern principal
      if (isLowCount && isVeryDifferent) {
        patternsToDelete.push(index);
      }
    });
    
    if (patternsToDelete.length > 0) {
      setDeletedPatterns([...deletedPatterns, ...patternsToDelete]);
      // Nettoyer les sélections et fusions qui incluent ces patterns
      setSelectedPatterns(selectedPatterns.filter(i => !patternsToDelete.includes(i)));
      setMergedPatterns(mergedPatterns.map(group => group.filter(i => !patternsToDelete.includes(i))).filter(group => group.length > 0));
      if (displayingMergedPattern && displayingMergedPattern.indices.some(i => patternsToDelete.includes(i))) {
        setDisplayingMergedPattern(null);
      }
    }
  };

  // Recalculer les patterns avec les colonnes exclues
  const recalculatedPatterns = recalculatePatternsWithExcludedColumns();
  
  // Filtrer les patterns visibles (exclure les supprimés)
  const visiblePatterns = recalculatedPatterns.filter((_, index) => !deletedPatterns.includes(index));
  const visiblePatternIndices = recalculatedPatterns
    .map((_, index) => index)
    .filter(index => !deletedPatterns.includes(index));

  // Ajuster l'index sélectionné si le pattern actuel a été supprimé
  const adjustedSelectedIndex = visiblePatternIndices.includes(selectedPatternIndex) 
    ? selectedPatternIndex 
    : visiblePatternIndices[0] || 0;

  const currentPattern = recalculatedPatterns[adjustedSelectedIndex];
  const summary = getPatternSummary(visiblePatterns);


  // Trouver les patterns qui peuvent être fusionnés automatiquement
  const autoMergeableGroups = groupIdenticalPatterns(recalculatedPatterns);

  // Calculer le nombre de patterns qui seraient supprimés par le nettoyage automatique
  const getCleanupCandidateCount = () => {
    if (recalculatedPatterns.length <= 1) return 0;
    
    const mainPattern = recalculatedPatterns[0];
    let count = 0;
    
    recalculatedPatterns.forEach((pattern, index) => {
      if (index === 0 || deletedPatterns.includes(index)) return;
      if (headerPatternIndex === index) return; // Ne pas compter le pattern header
      
      const similarity = calculatePatternSimilarity(mainPattern.pattern, pattern.pattern);
      const isLowCount = pattern.count < 5;
      const isVeryDifferent = similarity < 0.3;
      
      if (isLowCount && isVeryDifferent) {
        count++;
      }
    });
    
    return count;
  };

  const cleanupCandidateCount = getCleanupCandidateCount();

  useEffect(() => {
    const load = async () => {
      if (!session?.entreprise_id) return;
      try {
        const arr = await fetchParamsFormats(session.entreprise_id);
        setSavedParams(arr);
      } catch (e) {
        console.error('load params_format_this error', e);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.entreprise_id, isOpen]);

  if (!isOpen) return null;

  const handleSaveCurrentParams = async () => {
    if (!session?.entreprise_id) return;
    let finalName = saveParamsName && saveParamsName.trim() ? saveParamsName.trim() : (data.fileName || 'format');
    if (saveMode === 'overwrite' && overwriteIdx >= 0 && overwriteIdx < savedParams.length) {
      finalName = savedParams[overwriteIdx].name;
    }
    const headerRow = headerPatternIndex !== null ? getHeaderRow(headerPatternIndex) : null;
    // Capturer le choix d'export courant: pattern sélectionné ou groupe fusionné affiché
    let selectedExport: { mode: 'single' | 'merged'; patternKeys: string[] } | undefined = undefined;
    if (displayingMergedPattern) {
      // merged: utiliser les indices de group, convertir en patternKey via JSON.stringify du pattern original
      const keys = displayingMergedPattern.indices.map((i) => JSON.stringify(data.patterns[i].pattern));
      selectedExport = { mode: 'merged', patternKeys: keys };
    } else {
      // single: pattern actuellement affiché (après filtrage), basé sur adjustedSelectedIndex -> retrouver l'index original
      const patternKey = JSON.stringify(currentPattern.pattern);
      selectedExport = { mode: 'single', patternKeys: [patternKey] };
    }
    const stored = buildStoredParams(
      finalName
      ,
      displayingMergedPattern?.pattern || currentPattern.pattern,
      headerRow,
      {
        excludedColumns,
        hiddenColumns,
        columnMappings,
        derivedDefs,
        selectedExport,
      }
    );
    try {
      await saveParamsFormat(session.entreprise_id, stored);
      const arr = await fetchParamsFormats(session.entreprise_id);
      setSavedParams(arr);
      setShowSaveParamsModal(false);
      setSaveParamsName('');
      setSaveMode('new');
      setOverwriteIdx(-1);
    } catch (e) {
      console.error('save params_format_this error', e);
    }
  };

  const handleApplySelectedParams = () => {
    if (selectedParamsIdx < 0 || selectedParamsIdx >= savedParams.length) return;
    const chosen = savedParams[selectedParamsIdx];
    const headerRow = headerPatternIndex !== null ? getHeaderRow(headerPatternIndex) : null;
    const pattern = displayingMergedPattern?.pattern || currentPattern.pattern;
    try {
      const adapted = adaptStoredToCurrent(chosen, pattern, headerRow);
      setExcludedColumns(adapted.excludedColumns || []);
      setHiddenColumns(adapted.hiddenColumns || []);
      setColumnMappings(adapted.columnMappings || ({} as { [key: string]: string }));
      // Adapted.derivedDefs is typed via helper; ensure array cast
      const d = adapted.derivedDefs as DerivedColumnDef[];
      setDerivedDefs(Array.isArray(d) ? d : []);
      setShowApplyParamsModal(false);
      setSelectedParamsIdx(-1);

      // Appliquer le choix d'export (pattern/groupe) après mise à jour d'état
      const selectedExport = chosen.actions?.selectedExport;
      if (selectedExport) {
        setTimeout(() => {
          if (selectedExport.mode === 'merged') {
            // Retrouver indices par patternKey contre data.patterns
            const indices = selectedExport.patternKeys
              .map((k) => data.patterns.findIndex((p) => JSON.stringify(p.pattern) === k))
              .filter((i) => i >= 0) as number[];
            if (indices.length > 0) {
              // Construire mergedPatternData
              const allRows: ExcelRow[] = [];
              const allColumns = new Set<string>();
              indices.forEach((idx) => {
                const p = data.patterns[idx];
                allRows.push(...p.rows);
                Object.keys(p.pattern).forEach((c) => allColumns.add(c));
              });
              const mergedPattern: ColumnPattern = {};
              Array.from(allColumns).forEach((col) => {
                type ColumnType = ColumnPattern[string];
                const firstType = indices
                  .map((i) => data.patterns[i].pattern[col] as ColumnType | undefined)
                  .find((t) => t !== undefined);
                mergedPattern[col] = firstType ?? 'text';
              });
              setDisplayingMergedPattern({
                pattern: mergedPattern,
                rows: allRows,
                count: allRows.length,
                indices,
              });
            }
          } else {
            // single: matcher par clé sur les patterns recalculés (avec exclusions)
            const recalc = recalculatePatternsWithExcludedColumns();
            const key = selectedExport.patternKeys[0];
            const idx = recalc.findIndex((p) => JSON.stringify(p.pattern) === key);
            if (idx >= 0) {
              setDisplayingMergedPattern(null);
              setSelectedPatternIndex(idx);
            }
          }
        }, 0);
      }
    } catch (e) {
      console.error('apply params error', e);
    }
  };

  // Dictionnaire de mapping des colonnes
  const columnMappingDictionary: Record<string, string> = { 
    numBon: "numeroBon",
    numFacture: "numeroFacture",
    NumBSD: "numeroBsd",
    date: "dateCollecteTransporteur",
    nomSite: "nomSiteEmetteur",
    siretSite : "siretEmetteur",
    nomPointCollecte: "nomPointCollecte",
    adresseCollecte: "adresseCollecte",
    nomDechet: "descDechet",
    codeCED: "codeCed",
    nomTransporteur: "nomTransporteur",
    nomDestinataire: "nomInstallationDestination",
    codeDR: "codeTraitementPrevuInstallationDestination",
    tonnage: "quantiteEstimeeReelleTransporteur", //"quantiteCollecteTransporteur",
    volume: "volumeUnitaire",
    nomContenant: "descContenant",
    
    //---- Attention on prend pas dans l'import excel après je crois
    typePrestation: "typePrestation",
    prixUnitaire: "prixUnitaire",
    MontantHT: "MontantHT",
    unite: "unite",
    quantiteFacture: "quantiteFacture",
    //----

    estTrie : "tri",
    siretTransporteur: "siretTransporteur",
    recepisseTransporteur: "recepisseTransporteur",
    siretDestinataire: "siretInstallationDestination",
    adresseDestinataire: "adresseInstallationDestination",
    valo1_dest: "valo1_dest",
    tonnage1_dest: "tonnage1_dest",
    valo2_dest: "valo2_dest",
    tonnage2_dest: "tonnage2_dest",
    valo3_dest: "valo3_dest",
    tonnage3_dest: "tonnage3_dest",
  };

  // Fonction de matching flou simple
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fuzzyMatch = (text: string, patterns: string[]): number => {
    const normalizedText = text.toLowerCase().trim();
    let bestScore = 0;
    
    patterns.forEach(pattern => {
      const normalizedPattern = pattern.toLowerCase();
      
      // Score exact
      if (normalizedText === normalizedPattern) {
        bestScore = Math.max(bestScore, 1.0);
        return;
      }
      
      // Score de contenu (le pattern est contenu dans le texte)
      if (normalizedText.includes(normalizedPattern)) {
        bestScore = Math.max(bestScore, 0.8);
        return;
      }
      
      // Score de similarité simple (caractères communs)
      const commonChars = normalizedPattern.split('').filter(char => normalizedText.includes(char)).length;
      const similarity = commonChars / Math.max(normalizedPattern.length, normalizedText.length);
      if (similarity > 0.5) {
        bestScore = Math.max(bestScore, similarity * 0.6);
      }
    });
    
    return bestScore;
  };



  // Fonction pour assigner un mapping à une colonne
  const getCurrentColumnForField = (fieldName: string): string | null => {
    for (const [col, field] of Object.entries(columnMappings)) {
      if (field === fieldName) return col;
    }
    return null;
  };

  const assignMapping = (columnName: string, fieldName: string) => {
    const previousColumn = getCurrentColumnForField(fieldName);
    const newMappings = { ...columnMappings } as { [key: string]: string };
    
    // Supprimer le mapping précédent si ce champ était déjà mappé ailleurs
    if (previousColumn && previousColumn !== columnName) {
      delete newMappings[previousColumn];
    }
    
    // Supprimer le mapping actuel de cette colonne si elle était mappée
    if (newMappings[columnName]) {
      delete newMappings[columnName];
    }
    
    // Assigner le nouveau mapping
    newMappings[columnName] = fieldName;
    setColumnMappings(newMappings);
  };

  // Fonction pour obtenir le nom d'affichage d'une colonne
  const getColumnDisplayName = (columnName: string) => {
    return columnMappings[columnName] || columnName;
  };

  // Fonction pour vérifier si un champ est déjà utilisé
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isFieldUsed = (fieldName: string) => {
    return Object.values(columnMappings).includes(fieldName);
  };

  // Fonction pour fermer le dropdown de mapping
  const closeMappingDropdown = () => {
    setClickedColumn(null);
  };

  // Fonction pour toggle le dropdown de mapping
  const toggleMappingDropdown = (columnName: string) => {
    if (clickedColumn === columnName) {
      setClickedColumn(null);
    } else {
      setClickedColumn(columnName);
      setMappingSearch('');
      setSelectedMappingIndex(-1);
      // Focaliser automatiquement la barre de recherche après un court délai
      setTimeout(() => {
        const searchInput = document.querySelector('.mapping-search-input') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }, 100);
    }
  };

  // Fonction pour gérer les touches du clavier dans le dropdown de mapping
  const handleMappingKeyDown = (e: React.KeyboardEvent, filteredFields: string[]) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedMappingIndex(prev => 
        prev < filteredFields.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedMappingIndex(prev => 
        prev > 0 ? prev - 1 : filteredFields.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedMappingIndex >= 0 && selectedMappingIndex < filteredFields.length) {
        const fieldName = filteredFields[selectedMappingIndex];
        assignMapping(clickedColumn!, fieldName);
        setClickedColumn(null);
        setSelectedMappingIndex(-1);
      }
    } else if (e.key === 'Escape') {
      setClickedColumn(null);
      setSelectedMappingIndex(-1);
    }
  };

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'text': return '📝';
      case 'number': return '🔢';
      case 'boolean': return '✅';
      case 'date': return '📅';
      case 'null': return '⚪';
      case 'id': return '🆔';
      default: return '❓';
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'text': return 'text-blue-600';
      case 'number': return 'text-green-600';
      case 'boolean': return 'text-purple-600';
      case 'date': return 'text-orange-600';
      case 'null': return 'text-gray-400';
      case 'id': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const renderCell = (value: unknown, type: string) => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-gray-400 italic">vide</span>;
    }

    let displayValue: string;
    
    if (type === 'date') {
      // Si c'est un nombre qui représente une date Excel
      if (typeof value === 'number') {
        const excelDate = excelNumberToDate(value);
        if (excelDate) {
          displayValue = excelDate.toLocaleDateString('fr-FR');
        } else {
          displayValue = String(value);
        }
      } else {
        // Si c'est une string de date
        const date = new Date(String(value));
        if (!isNaN(date.getTime())) {
          displayValue = date.toLocaleDateString('fr-FR');
        } else {
          displayValue = String(value);
        }
      }
    } else {
      displayValue = String(value);
    }

    const truncatedValue = displayValue.length > 50 
      ? displayValue.substring(0, 50) + '...' 
      : displayValue;

    return (
      <span className={`${getTypeColor(type)} font-mono text-sm`}>
        {truncatedValue}
      </span>
    );
  };

  const renderPatternHeader = (pattern: ColumnPattern) => {
    const columns = Object.entries(pattern);
    
    return (
      <div className="bg-gray-50 p-2 rounded mb-3">
        <h4 className="font-semibold text-gray-800 mb-1 text-sm">Structure des colonnes :</h4>
        <div className="flex flex-wrap gap-1">
          {columns.map(([columnName, type]) => (
            <div
              key={columnName}
              className="flex items-center gap-1 bg-white px-1 py-0.5 rounded border text-xs"
            >
              <span className="text-sm">{getTypeIcon(type)}</span>
              <span className="font-medium">{columnName}</span>
              <span className={`${getTypeColor(type)} font-mono`}>({type})</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Fonction pour obtenir les données fusionnées d'un groupe de patterns
  const getMergedPatternData = (patternIndices: number[]) => {
    const allRows: ExcelRow[] = [];
    const allColumns = new Set<string>();
    
    patternIndices.forEach(index => {
      const pattern = data.patterns[index];
      allRows.push(...pattern.rows);
      Object.keys(pattern.pattern).forEach(col => allColumns.add(col));
    });
    
    return {
      rows: allRows,
      columns: Array.from(allColumns)
    };
  };

  // Fonction pour obtenir le pattern header (première ligne d'un pattern)
  const getHeaderRow = (patternIndex: number): ExcelRow | null => {
    if (patternIndex === null || !data.patterns[patternIndex]) return null;
    return data.patterns[patternIndex].rows[0] || null;
  };

  const renderDataTable = (rows: ExcelRow[], pattern: ColumnPattern, isMerged: boolean = false, mergedPatternIndices?: number[]) => {
    const baseColumns = Object.keys(pattern).filter((c) => !hiddenColumns.includes(c));
    const derivedColumnNames = derivedDefs.map((d) => d.name).filter((n) => !hiddenColumns.includes(n));
    const columns = [...baseColumns, ...derivedColumnNames];
    const headerRow = headerPatternIndex !== null ? getHeaderRow(headerPatternIndex) : null;
    
    return (
      <div className="h-full border border-gray-200 rounded-lg bg-white shadow-sm">
        <div className="h-full overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-2 py-1 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b min-w-[40px]">
                  #
                </th>
                {columns.map((columnName) => {
                  // Utiliser le nom de la colonne du header si disponible, sinon le nom original
                  const displayName = headerRow && headerRow[columnName] 
                    ? String(headerRow[columnName]) 
                    : columnName;
                  
                  // Nom d'affichage final (mappé ou original)
                  const finalDisplayName = getColumnDisplayName(displayName);
                  const isMapped = columnMappings[displayName];
                  
                  return (
                    <th
                      key={columnName}
                      className={`px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider border-b min-w-[120px] relative ${
                        isMapped ? 'bg-green-800 text-white' : 'text-gray-700'
                      }`}
                    >
                      <div 
                        className="flex items-center gap-1 cursor-pointer"
                        onClick={(e) => { if (showStep2) { e.stopPropagation(); toggleMappingDropdown(displayName); } }}
                        title={showStep2 ? "Clic pour voir les suggestions de mapping" : `Colonne: ${columnName}`}
                      >
                        <span className="text-sm">{pattern[columnName] ? getTypeIcon(pattern[columnName]) : '🧮'}</span>
                        <span className="truncate font-medium">
                          {finalDisplayName}
                        </span>
                        {headerRow && headerRow[columnName] && (
                          <span className="text-xs text-purple-600" title="Nom du header">H</span>
                        )}
                        {isMapped && (
                          <span className="text-xs text-green-600" title="Colonne mappée">✓</span>
                        )}
                        {showStep2 && (
                          <span className="text-xs text-indigo-600" title="Mode mapping actif - Clic pour suggestions">
                            ⚪
                          </span>
                        )}
                      </div>

                      {/* Masquer cette colonne - visible seulement en mode masquer */}
                      {hideMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!hiddenColumns.includes(columnName)) {
                              setHiddenColumns([...hiddenColumns, columnName]);
                            }
                          }}
                          className="absolute top-1 right-1 text-[10px] px-1 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200"
                          title="Masquer cette colonne"
                        >
                          Masquer
                        </button>
                      )}
                      
                      {/* Menu de mapping - affiché seulement pour la colonne cliquée */}
                      {showStep2 && clickedColumn === displayName && (() => {
                        const filteredFields = Object.keys(columnMappingDictionary)
                          .filter((fieldName) => fieldName.toLowerCase().includes(mappingSearch.toLowerCase()));
                        
                        return (
                          <div 
                            className="absolute top-full left-0 z-20 mt-1 bg-white border border-gray-300 rounded shadow-lg min-w-[260px]" 
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="p-2 border-b">
                              <input
                                type="text"
                                value={mappingSearch}
                                onChange={(e) => {
                                  setMappingSearch(e.target.value);
                                  setSelectedMappingIndex(-1);
                                }}
                                onKeyDown={(e) => handleMappingKeyDown(e, filteredFields)}
                                placeholder="Rechercher un champ... (↑↓ pour naviguer, Entrée pour sélectionner)"
                                className="mapping-search-input w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="px-2 text-xs text-gray-600">Toutes les colonnes</div>
                            <div className="max-h-48 overflow-auto">
                              {filteredFields.map((fieldName, index) => {
                                const prevCol = Object.entries(columnMappings).find(([, f]) => f === fieldName)?.[0];
                                const isSame = columnMappings[displayName] === fieldName;
                                const isSelected = index === selectedMappingIndex;
                                
                                return (
                                  <button
                                    key={fieldName}
                                    onClick={() => {
                                      assignMapping(displayName, fieldName);
                                      setClickedColumn(null);
                                    }}
                                    disabled={isSame}
                                    className={`w-full text-left px-2 py-1 text-xs transition-colors ${
                                      isSelected 
                                        ? 'bg-indigo-100 text-indigo-800' 
                                        : isSame 
                                          ? 'text-gray-400 cursor-not-allowed' 
                                          : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span>{fieldName}</span>
                                      {prevCol && prevCol !== displayName && (
                                        <span className="ml-2 text-[10px] text-orange-600">réaffectera depuis «{prevCol}»</span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                              {filteredFields.length === 0 && (
                                <div className="px-2 py-1 text-xs text-gray-500 italic">
                                  Aucun champ trouvé
                                </div>
                              )}
                            </div>
                            <div className="border-t p-1">
                              <button
                                onClick={() => {
                                  const newMappings = {...columnMappings};
                                  delete newMappings[displayName];
                                  setColumnMappings(newMappings);
                                  setClickedColumn(null);
                                }}
                                className="w-full text-left px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                              >
                                🗑️ Supprimer le mapping
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((row, index) => {
                // Déterminer la couleur de fond selon le pattern d'origine
                let rowClass = "hover:bg-blue-50 transition-colors";
                if (isMerged && mergedPatternIndices) {
                  // Trouver de quel pattern vient cette ligne
                  let patternIndex = 0;
                  let rowCount = 0;
                  for (let i = 0; i < mergedPatternIndices.length; i++) {
                    const pattern = data.patterns[mergedPatternIndices[i]];
                    if (index < rowCount + pattern.rows.length) {
                      patternIndex = mergedPatternIndices[i];
                      break;
                    }
                    rowCount += pattern.rows.length;
                  }
                  
                  // Couleurs alternées selon le pattern
                  const colors = ['bg-white', 'bg-gray-50', 'bg-blue-50', 'bg-green-50', 'bg-yellow-50'];
                  rowClass = `hover:bg-blue-100 transition-colors ${colors[patternIndex % colors.length]}`;
                }
                
                return (
                  <tr key={index} className={rowClass}>
                    <td className="px-2 py-1 text-xs text-gray-600 border-r sticky left-0 bg-white font-medium">
                      {index + 1}
                    </td>
                    {columns.map((columnName) => {
                      const derived = derivedDefs.find((d) => d.name === columnName);
                      let value: unknown = row[columnName];
                      let type: string = pattern[columnName] || 'number';
                      if (derived) {
                        if (derived.kind === 'formula') {
                          // Utiliser le même mapping que dans l'étape 3
                          const headerRow = headerPatternIndex !== null ? getHeaderRow(headerPatternIndex) : null;
                          const reverseMapping: {[mappedName: string]: string} = {};
                          Object.keys(pattern).forEach((originalName) => {
                            // Utiliser le nom de la colonne du header si disponible, sinon le nom original
                            const displayName = headerRow && headerRow[originalName] 
                              ? String(headerRow[originalName]) 
                              : originalName;
                            
                            // Nom d'affichage final (mappé ou original)
                            const mappedName = getColumnDisplayName(displayName);
                            reverseMapping[mappedName] = originalName;
                          });
                          value = evaluateFormulaTokens(derived.tokens, row, reverseMapping);
                          type = 'number';
                        } else if (derived.kind === 'condition') {
                          // Utiliser le même mapping que dans l'étape 3
                          const headerRow = headerPatternIndex !== null ? getHeaderRow(headerPatternIndex) : null;
                          const reverseMapping: {[mappedName: string]: string} = {};
                          Object.keys(pattern).forEach((originalName) => {
                            const displayName = headerRow && headerRow[originalName] 
                              ? String(headerRow[originalName]) 
                              : originalName;
                            const mappedName = getColumnDisplayName(displayName);
                            reverseMapping[mappedName] = originalName;
                          });
                          const conditionResult = evaluateConditionTokens(derived.conditions, row, reverseMapping);
                          if (conditionResult) {
                            if (derived.trueIsIdentity) {
                              const identityKeyMapped = derived.identityColumn || columnName;
                              const identityOriginal = reverseMapping[identityKeyMapped] || identityKeyMapped;
                              value = row[identityOriginal];
                            } else {
                              value = derived.trueValue;
                            }
                          } else {
                            value = derived.falseValue;
                          }
                          type = 'text';
                        } else {
                          // Pour les mappings, résoudre la colonne source via le même reverseMapping que formules/conditions
                          const headerRow = headerPatternIndex !== null ? getHeaderRow(headerPatternIndex) : null;
                          const reverseMapping: {[mappedName: string]: string} = {};
                          Object.keys(pattern).forEach((originalName) => {
                            const displayName = headerRow && headerRow[originalName]
                              ? String(headerRow[originalName])
                              : originalName;
                            const mappedName = getColumnDisplayName(displayName);
                            reverseMapping[mappedName] = originalName;
                            reverseMapping[displayName] = originalName;
                            reverseMapping[originalName] = originalName;
                          });
                          const originalSourceColumn = reverseMapping[derived.sourceColumn] || derived.sourceColumn;
                          const key = row[originalSourceColumn];
                          value = key != null ? (derived.map[String(key)] ?? '') : '';
                          type = 'text';
                        }
                      }
                      return (
                      <td key={columnName} className="px-2 py-1 text-xs max-w-[150px]">
                        <div className="truncate">
                            {renderCell(value, type)}
                        </div>
                      </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const exportCurrentAsExcel = () => {
    // Determine data context
    const pattern = displayingMergedPattern?.pattern || currentPattern.pattern;
    const rows = displayingMergedPattern?.rows || currentPattern.rows;
    const baseColumns = Object.keys(pattern).filter((c) => !hiddenColumns.includes(c));
    const derivedColumnNames = derivedDefs.map(d => d.name).filter(n => !hiddenColumns.includes(n));
    const allColumns = [...baseColumns, ...derivedColumnNames];
    const headerRow = headerPatternIndex !== null ? getHeaderRow(headerPatternIndex) : null;

    // Build reverse mapping (mapped header name -> original)
    const reverseMapping: {[mappedName: string]: string} = {};
    Object.keys(pattern).forEach((originalName) => {
      const displayName = headerRow && headerRow[originalName] ? String(headerRow[originalName]) : originalName;
      const mappedName = getColumnDisplayName(displayName);
      reverseMapping[mappedName] = originalName;
      // also include displayName direct
      reverseMapping[displayName] = originalName;
    });

    // Build final dataset
    const dateKeys = new Set<string>(['dateCollecteTransporteur', 'takenOverAt', 'created_at']);
    const isRealistic = (d: Date) => {
      const today = new Date();
      const min = new Date(today);
      min.setFullYear(today.getFullYear() - 8);
      const max = new Date(today);
      max.setMonth(today.getMonth() + 4);
      return d >= min && d <= max;
    };
    const toIsoDateIfNeeded = (key: string, val: unknown): unknown => {
      if (!dateKeys.has(key) || val == null) return val;
      // Handle FR-like date strings (DD/MM/YYYY or DD-MM-YYYY)
      if (typeof val === 'string') {
        const m = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (m) {
          const day = Number(m[1]);
          const month = Number(m[2]);
          const year = Number(m[3]);
          const d = new Date(year, month - 1, day);
          console.log('[MetaExcel][date-normalize][FR]', { key, input: val, day, month, year, out: isNaN(d.getTime()) ? null : d.toISOString() });
          if (!isNaN(d.getTime()) && isRealistic(d)) return d; // return Date object
          return val;
        }
      }
      if (typeof val === 'number') {
        const d = excelNumberToDate(val);
        console.log('[MetaExcel][date-normalize][excel-number]', { key, input: val, out: d ? d.toISOString() : null });
        return d && isRealistic(d) ? d : val; // return Date object
      }
      if (typeof val === 'string' && /^\d{4,6}$/.test(val)) {
        const n = Number(val);
        const d = excelNumberToDate(n);
        console.log('[MetaExcel][date-normalize][excel-number-string]', { key, input: val, out: d ? d.toISOString() : null });
        return d && isRealistic(d) ? d : val;
      }
      if (val instanceof Date) {
        console.log('[MetaExcel][date-normalize][Date]', { key, input: val.toISOString() });
        if (isNaN(val.getTime()) || !isRealistic(val)) return val;
        return val; // keep Date
      }
      // try parse strings
      const dt = new Date(String(val));
      console.log('[MetaExcel][date-normalize][fallback-parse]', { key, input: val, out: isNaN(dt.getTime()) ? null : dt.toISOString() });
      return isNaN(dt.getTime()) || !isRealistic(dt) ? val : dt; // return Date
    };
    const exportRows = rows.map((row) => {
      const out: Record<string, unknown> = {};
      allColumns.forEach((colName) => {
        let value: unknown;
        let mappedFieldName: string | undefined; // user mapped field key (e.g., nomDechet)

        if (derivedDefs.find(d => d.name === colName)) {
          const def = derivedDefs.find(d => d.name === colName)!;
          if (def.kind === 'formula') {
            value = evaluateFormulaTokens(def.tokens, row, reverseMapping);
            mappedFieldName = undefined;
          } else if (def.kind === 'condition') {
            const cond = evaluateConditionTokens(def.conditions, row, reverseMapping);
            value = cond ? (def.trueIsIdentity ? row[reverseMapping[def.identityColumn || colName] || (def.identityColumn || colName)] : def.trueValue) : def.falseValue;
            mappedFieldName = undefined;
          } else {
            // mapping type derived: map source raw to selected meta values
            const originalSourceColumn = Object.entries(columnMappings).find(([, mapped]) => mapped === def.sourceColumn)?.[0] || def.sourceColumn;
            const key = row[originalSourceColumn];
            value = key != null ? (def.map[String(key)] ?? '') : '';
            mappedFieldName = def.name; // treat derived mapping name as field name
            // Si la source est une colonne de type date et que le nom dérivé n'a pas de mapping, forcer 'date'
            const isDateSource = pattern[originalSourceColumn] === 'date';
            if (!(mappedFieldName && mappedFieldName in columnMappingDictionary) && isDateSource) {
              mappedFieldName = 'date';
            }
          }
        } else {
          // base column
          const displayName = headerRow && headerRow[colName] ? String(headerRow[colName]) : colName;
          const finalDisplayName = getColumnDisplayName(displayName);
          const original = reverseMapping[finalDisplayName] || reverseMapping[displayName] || colName;
          value = row[original];
          mappedFieldName = columnMappings[displayName];
          // Heuristique: si non mappé et type date, mapper par défaut sur 'date'
          if (!mappedFieldName && pattern[colName] === 'date') {
            console.log('[MetaExcel][auto-map-base-date]', { column: colName, displayName, finalDisplayName });
            mappedFieldName = 'date';
          }
        }

        // Compute final column key using dictionary if a mapped field exists
        let finalKey: string;
        const displayName = headerRow && headerRow[colName] ? String(headerRow[colName]) : colName;
        const userMappedField = mappedFieldName || columnMappings[displayName];
        if (userMappedField && userMappedField in columnMappingDictionary) {
          finalKey = columnMappingDictionary[userMappedField as string];
        } else if (displayName in columnMappingDictionary) {
          // If the header/display name itself is a known meta key (e.g. 'codeDR'), map it
          finalKey = columnMappingDictionary[displayName];
        } else {
          // fallback to mapped display name
          finalKey = getColumnDisplayName(displayName);
        }

        const normalized = toIsoDateIfNeeded(finalKey, value);
        if (Object.prototype.hasOwnProperty.call(out, finalKey)) {
          console.warn('[MetaExcel][collision][exportCurrentAsExcel]', {
            finalKey,
            previous: out[finalKey],
            next: normalized,
            sourceColumn: colName,
            mappedFieldName: userMappedField || mappedFieldName,
          });
        }
        out[finalKey] = normalized;
      });
      return out;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileBase = data?.fileName?.split('.').slice(0, -1).join('.') || 'export';
    a.download = `${fileBase}_meta_export.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildExportRowsForClassic = () => {
    const pattern = displayingMergedPattern?.pattern || currentPattern.pattern;
    const rows = displayingMergedPattern?.rows || currentPattern.rows;
    const baseColumns = Object.keys(pattern).filter((c) => !hiddenColumns.includes(c));
    const derivedColumnNames = derivedDefs.map(d => d.name).filter(n => !hiddenColumns.includes(n));
    const allColumns = [...baseColumns, ...derivedColumnNames];
    const headerRow = headerPatternIndex !== null ? getHeaderRow(headerPatternIndex) : null;

    const reverseMapping: {[mappedName: string]: string} = {};
    Object.keys(pattern).forEach((originalName) => {
      const displayName = headerRow && headerRow[originalName] ? String(headerRow[originalName]) : originalName;
      const mappedName = getColumnDisplayName(displayName);
      reverseMapping[mappedName] = originalName;
      reverseMapping[displayName] = originalName;
    });

    const dateKeys = new Set<string>(['dateCollecteTransporteur', 'takenOverAt', 'created_at']);
    const isRealistic = (d: Date) => {
      const today = new Date();
      const min = new Date(today);
      min.setFullYear(today.getFullYear() - 8);
      const max = new Date(today);
      max.setMonth(today.getMonth() + 4);
      return d >= min && d <= max;
    };
    // IMPORTANT: emit Excel serial numbers for dates to avoid timezone shifts in classic.ts
    const dateToExcelSerial = (d: Date): number => {
      const msPerDay = 24 * 60 * 60 * 1000;
      const epoch = Date.UTC(1900, 0, 1);
      const dayUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
      const diffDays = Math.round((dayUtc - epoch) / msPerDay);
      // Excel 1900 leap bug (+1) and observed preview offset (+1) => +2 total already accounted by +2 above.
      // We add +1 extra to fix consistent -1 day display in preview.
      return diffDays + 3;
    };

    const toPreviewDateValue = (key: string, val: unknown): unknown => {
      if (!dateKeys.has(key) || val == null) return val;
      if (typeof val === 'string') {
        const m = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (m) {
          const day = Number(m[1]);
          const month = Number(m[2]);
          const year = Number(m[3]);
          const d = new Date(year, month - 1, day);
          if (!isNaN(d.getTime()) && isRealistic(d)) return dateToExcelSerial(d);
          return val;
        }
      }
      if (typeof val === 'number') {
        const d = excelNumberToDate(val);
        return d && isRealistic(d) ? (typeof val === 'number' ? (val + 1) : val) : val;
      }
      if (typeof val === 'string' && /^\d{4,6}$/.test(val)) {
        const n = Number(val);
        const d = excelNumberToDate(n);
        return d && isRealistic(d) ? (n + 1) : val;
      }
      if (val instanceof Date) {
        if (isNaN(val.getTime()) || !isRealistic(val)) return val;
        return dateToExcelSerial(val);
      }
      const dt = new Date(String(val));
      return isNaN(dt.getTime()) || !isRealistic(dt) ? val : dateToExcelSerial(dt);
    };

    const exportRows = rows.map((row) => {
      const out: Record<string, unknown> = {};
      allColumns.forEach((colName) => {
        let value: unknown;
        let mappedFieldName: string | undefined;
        if (derivedDefs.find(d => d.name === colName)) {
          const def = derivedDefs.find(d => d.name === colName)!;
          if (def.kind === 'formula') {
            value = evaluateFormulaTokens(def.tokens, row, reverseMapping);
            mappedFieldName = undefined;
          } else if (def.kind === 'condition') {
            const cond = evaluateConditionTokens(def.conditions, row, reverseMapping);
            value = cond ? (def.trueIsIdentity ? row[reverseMapping[def.identityColumn || colName] || (def.identityColumn || colName)] : def.trueValue) : def.falseValue;
            mappedFieldName = undefined;
          } else {
            const originalSourceColumn = Object.entries(columnMappings).find(([, mapped]) => mapped === def.sourceColumn)?.[0] || def.sourceColumn;
            const key = row[originalSourceColumn];
            value = key != null ? (def.map[String(key)] ?? '') : '';
            mappedFieldName = def.name;
          }
        } else {
          const displayName = headerRow && headerRow[colName] ? String(headerRow[colName]) : colName;
          const finalDisplayName = getColumnDisplayName(displayName);
          const original = reverseMapping[finalDisplayName] || reverseMapping[displayName] || colName;
          value = row[original];
          mappedFieldName = columnMappings[displayName];
          if (!mappedFieldName && pattern[colName] === 'date') {
            mappedFieldName = 'date';
          }
        }

        let finalKey: string;
        const displayName = headerRow && headerRow[colName] ? String(headerRow[colName]) : colName;
        const userMappedField = mappedFieldName || columnMappings[displayName];
        if (userMappedField && userMappedField in columnMappingDictionary) {
          finalKey = columnMappingDictionary[userMappedField as string];
        } else if (displayName in columnMappingDictionary) {
          // If the header/display name itself is a known meta key (e.g. 'codeDR'), map it
          finalKey = columnMappingDictionary[displayName];
        } else {
          finalKey = getColumnDisplayName(displayName);
        }

        const normalized = toPreviewDateValue(finalKey, value);
        
        
        out[finalKey] = normalized;
      });
      return out;
    });

    return exportRows;
  };

  const handleOpenFinalPreview = async () => {
    if (!session?.entreprise_id || !session?.user_id) return;
    const exportRows = buildExportRowsForClassic();
    const sheetName = data.sheetName || 'Sheet1';
    const excelData: ExcelData = {
      nom_fichier: data.fileName,
      presta: {
        id: 0,
        type: 'transporteur',
        nom: '',
      },
      site: {
        id: 0,
        nom: '',
        siret: '',
        adresseSiege: '',
        pointsCollecte: [{ nom: '', adresse: '' }],
      },
      excel_data: { [sheetName]: exportRows },
      sheets: [sheetName],
      nombre_sheets: 1,
      nombre_lignes_total: exportRows.length,
      nombre_lignes_par_sheet: { [sheetName]: exportRows.length },
      date_import: new Date().toISOString(),
    } as ExcelData;

    try {
      const preview = await standard_with_classic(excelData, session.user_id, session.entreprise_id);
      setFinalPreviewData(preview);
      setShowFinalPreview(true);
    } catch (e) {
      console.error('Erreur génération preview import:', e);
    }
  };

  const handleConfirmFinalImport = async () => {
    if (!session?.entreprise_id) return;
    setIsProcessingImport(true);
    try {
      await sendDataToBdd(finalPreviewData as RowBSDPreview[], session.entreprise_id);
      // Créer une ligne dans la table pdf_infos après import final (aligné avec le flux classic)
      try {
        const { data: pdfData, error: pdfError } = await supabase
          .from('pdf_infos')
          .insert({
            user_id: session.user_id,
            pdf_path: '',
            name_pdf: data.fileName,
            name_pdf_in_bucket: '',
            status: 'read',
            site_siret: null,
            document_type: 'excel',
            entreprise_id: session.entreprise_id,
            site_siret_plus: null,
          })
          .select()
          .single();
        if (pdfError) {
          console.error('Erreur lors de la création de la ligne pdf_infos (MetaExcel):', pdfError);
        } else {
          void pdfData; // not used here; UI update non-critique
        }
      } catch (err) {
        console.error('Erreur insertion pdf_infos (MetaExcel):', err);
      }
      setShowFinalPreview(false);
    } catch (e) {
      console.error('Erreur lors de l\u0027import final:', e);
    } finally {
      setIsProcessingImport(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-lg w-full max-w-7xl min-h-[90vh] flex flex-col overflow-hidden my-8">
        {/* Header */}
        <div className="flex justify-between items-center p-3 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Analyse Meta Excel - {data.fileName} ({data.sheetName})
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {summary} • Lignes filtrées (&gt;80% vides) • Dates: {new Date(new Date().setFullYear(new Date().getFullYear() - 8)).toLocaleDateString('fr-FR')} à {new Date(new Date().setMonth(new Date().getMonth() + 4)).toLocaleDateString('fr-FR')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ×
          </button>
        </div>

        {/* Navigation des patterns */}
        <div className="p-3 border-b bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-800">
              Patterns détectés ({data.patterns.length})
            </h3>
            <div className="flex items-center gap-2 relative">
              <button
                onClick={() => setHideMode(!hideMode)}
                className={`px-2 py-1 text-sm rounded border ${hideMode ? 'bg-red-100 text-red-800 border-red-200' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'}`}
                title="Activer le mode masquage des colonnes"
              >
                {hideMode ? 'Masquer colonnes: ON' : 'Masquer colonnes'}
              </button>
              {hiddenColumns.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowHiddenColumnsPanel(!showHiddenColumnsPanel)}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded border border-blue-200 hover:bg-blue-200"
                    title="Voir les colonnes masquées"
                  >
                    Colonnes masquées ({hiddenColumns.length})
                  </button>
                  {showHiddenColumnsPanel && (
                    <div className="absolute right-0 top-full mt-1 w-64 max-h-64 overflow-auto bg-white border border-gray-200 rounded shadow-lg z-20 p-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-700">Colonnes masquées</span>
                        <button
                          onClick={() => { setHiddenColumns([]); setShowHiddenColumnsPanel(false); }}
                          className="text-[11px] px-1 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100"
                        >
                          Tout restaurer
                        </button>
                      </div>
                      <div className="space-y-1">
                        {hiddenColumns.map((col) => (
                          <div key={col} className="flex items-center justify-between text-xs">
                            <span className="truncate pr-2" title={col}>{col}</span>
                            <button
                              onClick={() => {
                                setHiddenColumns(hiddenColumns.filter((c) => c !== col));
                                if (hiddenColumns.length === 1) setShowHiddenColumnsPanel(false);
                              }}
                              className="px-1 py-0.5 bg-white text-blue-700 border border-blue-300 rounded hover:bg-blue-50"
                            >
                              Restaurer
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => setShowAllPatterns(!showAllPatterns)}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                {showAllPatterns ? 'Masquer' : 'Voir'} tous les patterns
              </button>
              {deletedPatterns.length > 0 && (
                <button
                  onClick={() => setShowDeletedPatterns(!showDeletedPatterns)}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  {showDeletedPatterns ? 'Masquer' : 'Voir'} patterns supprimés ({deletedPatterns.length})
                </button>
              )}
              <button
                onClick={() => setShowDiscriminantColumns(!showDiscriminantColumns)}
                className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
              >
                {showDiscriminantColumns ? 'Masquer' : 'Voir'} colonnes discriminantes
              </button>
              <button
                onClick={() => setShowColumnStructure(!showColumnStructure)}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                {showColumnStructure ? 'Masquer' : 'Voir'} structure
              </button>
              <button
                onClick={() => setShowStep2(!showStep2)}
                className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
              >
                {showStep2 ? 'Retour étape 1' : 'Étape 2 - Mapping'}
              </button>
              <button
                onClick={() => {
                  // Toggle d'affichage de l'étape 3 via un léger scroll jusqu'au composant
                  const el = document.getElementById('derive-columns-panel');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                Étape 3 - Colonnes dérivées
              </button>
              {cleanupCandidateCount > 0 && (
                <button
                  onClick={autoCleanupPatterns}
                  className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                  title="Supprimer automatiquement les patterns avec <5 lignes et très différents du pattern principal (sauf le pattern header)"
                >
                  🧹 Nettoyer ({cleanupCandidateCount})
                </button>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="mb-1 text-xs text-gray-600">
            💡 Clic simple = afficher • Ctrl+Clic = sélectionner pour fusion • Clic droit = définir comme header • Shift+Clic = supprimer
          </div>

          {/* Gestion des colonnes discriminantes */}
          {currentPattern && showDiscriminantColumns && (
            <div className="mb-3 p-2 bg-blue-50 rounded border">
              <h4 className="text-sm font-medium text-blue-800 mb-2">Colonnes discriminantes :</h4>
              <div className="flex flex-wrap gap-1 mb-2">
                {Object.keys(currentPattern.pattern).map((columnName) => (
                  <button
                    key={columnName}
                    onClick={() => {
                      if (excludedColumns.includes(columnName)) {
                        setExcludedColumns(excludedColumns.filter(col => col !== columnName));
                      } else {
                        setExcludedColumns([...excludedColumns, columnName]);
                      }
                    }}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      excludedColumns.includes(columnName)
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-sm">{getTypeIcon(currentPattern.pattern[columnName])}</span>
                      <span className="truncate">{columnName}</span>
                      {excludedColumns.includes(columnName) && <span className="text-xs">❌</span>}
                    </div>
                  </button>
                ))}
              </div>
              <div className="text-xs text-blue-600">
                💡 Clic sur une colonne pour l&apos;exclure des patterns (fusion automatique si patterns identiques)
              </div>
            </div>
          )}

          {/* Patterns fusionnables automatiquement */}
          {autoMergeableGroups.length > 0 && (
            <div className="mb-3 p-2 bg-yellow-50 rounded border">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">Patterns fusionnables automatiquement :</h4>
              <div className="space-y-2">
                {autoMergeableGroups.map((group, groupIndex) => (
                  <div key={groupIndex} className="flex items-center gap-2">
                    <span className="text-xs text-yellow-700">
                      Patterns {group.map(i => `P${i + 1}`).join(', ')} sont identiques
                    </span>
                    <button
                      onClick={() => {
                        setMergedPatterns([...mergedPatterns, group]);
                      }}
                      className="px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700"
                    >
                      Fusionner automatiquement
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Liste des patterns visibles + groupes fusionnés */}
          <div className="flex flex-wrap gap-2 mb-2">
            {/* Patterns individuels */}
            {visiblePatterns.map((pattern, visibleIndex) => {
              const originalIndex = visiblePatternIndices[visibleIndex];
              return (
                <div key={originalIndex} className="relative group">
                  <button
                    onClick={(e) => handlePatternClick(originalIndex, e)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setHeaderPatternIndex(headerPatternIndex === originalIndex ? null : originalIndex);
                    }}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      selectedPatterns.includes(originalIndex)
                        ? 'bg-green-500 text-white border-green-500'
                        : selectedPatternIndex === originalIndex
                        ? 'bg-blue-500 text-white border-blue-500'
                        : headerPatternIndex === originalIndex
                        ? 'bg-purple-500 text-white border-purple-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="font-medium">P{originalIndex + 1}</span>
                      <span className="text-xs opacity-75">
                        ({pattern.count})
                      </span>
                      {originalIndex === 0 && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded">
                          P
                        </span>
                      )}
                      {headerPatternIndex === originalIndex && (
                        <span className="text-xs bg-purple-100 text-purple-800 px-1 rounded">
                          H
                        </span>
                      )}
                    </div>
                  </button>
                  {/* Bouton de suppression */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePattern(originalIndex);
                    }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    title="Supprimer ce pattern"
                  >
                    ×
                  </button>
                </div>
              );
            })}
            
            {/* Groupes fusionnés */}
            {mergedPatterns.map((group, groupIndex) => (
              <div key={`group-${groupIndex}`} className="relative group">
                <button
                  onClick={() => {
                    // Afficher les patterns fusionnés
                    const mergedData = getMergedPatternData(group);
                    const mergedPattern: ColumnPattern = {};
                    mergedData.columns.forEach(col => {
                      // Prendre le type le plus commun pour cette colonne
                      const types = group.map(i => data.patterns[i].pattern[col]).filter(Boolean);
                      mergedPattern[col] = types[0] || 'text';
                    });
                    
                    // Créer un pattern temporaire pour l'affichage
                    setDisplayingMergedPattern({
                      pattern: mergedPattern,
                      rows: mergedData.rows,
                      count: mergedData.rows.length,
                      indices: group
                    });
                  }}
                  className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded border hover:bg-green-200 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span className="font-medium">G{groupIndex + 1}</span>
                    <span className="text-xs opacity-75">
                      ({group.map(i => data.patterns[i].count).reduce((a, b) => a + b, 0)})
                    </span>
                    <span className="text-xs bg-green-200 text-green-900 px-1 rounded">
                      F
                    </span>
                  </div>
                </button>
                {/* Bouton de suppression du groupe */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMergedPatterns(mergedPatterns.filter((_, i) => i !== groupIndex));
                  }}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  title="Supprimer ce groupe"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Patterns supprimés (si il y en a) */}
          {deletedPatterns.length > 0 && showDeletedPatterns && (
            <div className="mb-2 p-2 bg-red-50 rounded border">
              <h4 className="text-sm font-medium text-red-700 mb-2">Patterns supprimés :</h4>
              <div className="flex flex-wrap gap-2">
                {deletedPatterns.map((index) => (
                  <button
                    key={index}
                    onClick={() => restorePattern(index)}
                    className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded border hover:bg-red-200 transition-colors"
                  >
                    <span className="font-medium">P{index + 1}</span>
                    <span className="ml-1 text-xs opacity-75">
                      ({data.patterns[index].count} lignes)
                    </span>
                    <span className="ml-1 text-xs">↻ Restaurer</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Boutons de fusion */}
          {selectedPatterns.length > 1 && (
            <div className="mb-2 p-2 bg-green-50 rounded border">
              <div className="flex items-center gap-2">
                <span className="text-sm text-green-700">
                  {selectedPatterns.length} patterns sélectionnés
                </span>
                <button
                  onClick={() => {
                    setMergedPatterns([...mergedPatterns, [...selectedPatterns]]);
                    setSelectedPatterns([]);
                  }}
                  className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Fusionner
                </button>
                <button
                  onClick={() => setSelectedPatterns([])}
                  className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}


          {/* Affichage détaillé des patterns si demandé */}
          {showAllPatterns && (
            <div className="max-h-32 overflow-y-auto space-y-2">
              {visiblePatterns.map((pattern, visibleIndex) => {
                const originalIndex = visiblePatternIndices[visibleIndex];
                return (
                  <div
                    key={originalIndex}
                    className="bg-white p-2 rounded border"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-gray-800">
                        Pattern {originalIndex + 1} - {pattern.count} lignes
                      </h4>
                      <div className="flex items-center gap-2">
                        {originalIndex === 0 && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            Pattern principal
                          </span>
                        )}
                        <button
                          onClick={() => deletePattern(originalIndex)}
                          className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {formatPattern(pattern.pattern)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Contenu principal */}
        <div className="flex-1 p-4 flex flex-col min-h-0">

          {/* En-tête du pattern sélectionné */}
          <div className="mb-2 flex-shrink-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-medium text-gray-800">
                {displayingMergedPattern ? 
                  `Patterns fusionnés (${displayingMergedPattern.indices.map(i => `P${i + 1}`).join(', ')}) - ${displayingMergedPattern.count} lignes` :
                  `Pattern ${selectedPatternIndex + 1} - ${currentPattern.count} lignes`
                }
                {showStep2 && (
                  <span className="ml-2 text-sm text-indigo-600">
                    • Mode Mapping actif ({Object.values(columnMappings).filter(Boolean).length} colonnes mappées)
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {selectedPatternIndex === 0 && !displayingMergedPattern && (
                  <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                    Pattern le plus récurrent
                  </span>
                )}
                <button
                  onClick={exportCurrentAsExcel}
                  className="text-sm bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                  title="Exporter en Excel avec noms finaux"
                >
                  Exporter Excel
                </button>
                <button
                  onClick={() => setShowApplyParamsModal(true)}
                  className="text-sm bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                  title="Appliquer un modèle de paramètres sauvegardé"
                >
                  Appliquer params
                </button>
                <button
                  onClick={() => setShowSaveParamsModal(true)}
                  className="text-sm bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
                  title="Enregistrer les paramètres actuels"
                >
                  Enregistrer params
                </button>
                {displayingMergedPattern && (
                  <button
                    onClick={() => {
                      setDisplayingMergedPattern(null);
                    }}
                    className="text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                  >
                    Retour aux patterns individuels
                  </button>
                )}
              </div>
            </div>
            {showColumnStructure && renderPatternHeader(displayingMergedPattern?.pattern || currentPattern.pattern)}
          </div>

        {/* Tableau des données */}
        <div className="flex-1 min-h-[300px]" onClick={closeMappingDropdown}>
          {displayingMergedPattern ? 
            renderDataTable(
              displayingMergedPattern.rows, 
              displayingMergedPattern.pattern, 
              true, 
              displayingMergedPattern.indices
            ) :
            renderDataTable(currentPattern.rows, currentPattern.pattern)
          }
        </div>

        {/* Étape 3: Colonnes dérivées */}
        <div id="derive-columns-panel" className="mt-3">
          {(() => {
            const baseColumns = Object.keys(displayingMergedPattern ? displayingMergedPattern.pattern : currentPattern.pattern)
              .filter((c) => !hiddenColumns.includes(c));
            
            // Créer les noms de colonnes mappés pour les formules
            const headerRow = headerPatternIndex !== null ? getHeaderRow(headerPatternIndex) : null;
            const mappedColumns = baseColumns.map(columnName => {
              // Utiliser le nom de la colonne du header si disponible, sinon le nom original
              const displayName = headerRow && headerRow[columnName] 
                ? String(headerRow[columnName]) 
                : columnName;
              
              // Nom d'affichage final (mappé ou original)
              return getColumnDisplayName(displayName);
            });
            
            // Créer le mapping inverse (nom mappé -> nom original)
            const reverseMapping: {[mappedName: string]: string} = {};
            baseColumns.forEach((originalName) => {
              // Inclure le nom d'en-tête si présent
              const headerRow = headerPatternIndex !== null ? getHeaderRow(headerPatternIndex) : null;
              const headerName = headerRow && headerRow[originalName]
                ? String(headerRow[originalName])
                : originalName;

              // 1) Nom d'en-tête → original
              reverseMapping[headerName] = originalName;
              // 2) Nom mappé (à partir du nom d'en-tête) → original
              const mappedFromHeader = getColumnDisplayName(headerName);
              reverseMapping[mappedFromHeader] = originalName;
              // 3) Nom original lui-même → original
              reverseMapping[originalName] = originalName;
              // 4) Nom mappé depuis le nom original (fallback) → original
              const mappedFromOriginal = getColumnDisplayName(originalName);
              reverseMapping[mappedFromOriginal] = originalName;
            });

            // Clés standards encore non utilisées (suggestion pour nommer la nouvelle colonne)
            const allFieldKeys = Object.keys(columnMappingDictionary);
            const usedFieldKeys = new Set<string>([
              ...Object.values(columnMappings),
              ...derivedDefs.map(d => d.name),
            ].filter(Boolean) as string[]);
            const unusedFieldKeys = allFieldKeys.filter(k => !usedFieldKeys.has(k));

            return (
              <DeriveColumns
                rows={displayingMergedPattern ? displayingMergedPattern.rows : currentPattern.rows}
                availableColumns={mappedColumns}
                value={derivedDefs.filter(d => !hiddenColumns.includes(d.name))}
                onChange={(newDefs) => {
                  // Filtrer les colonnes dérivées masquées
                  const filteredDefs = newDefs.filter(d => !hiddenColumns.includes(d.name));
                  setDerivedDefs(filteredDefs);
                }}
                columnMapping={reverseMapping}
                unusedFieldKeys={unusedFieldKeys}
              />
            );
          })()}
        </div>
        {/* Bouton final: Confirmer l’import */}
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleOpenFinalPreview}
            className="px-3 py-1 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700"
            title="Construire les lignes standardisées et prévisualiser l’import"
          >
            Confirmer l’import
          </button>
        </div>
        </div>

        {/* Footer avec informations */}
        <div className="p-2 border-t bg-gray-50 flex-shrink-0">
          <div className="flex justify-between items-center text-xs text-gray-600">
            <div>
              {displayingMergedPattern ? 
                `Patterns fusionnés (${displayingMergedPattern.indices.map(i => `P${i + 1}`).join(', ')})` :
                `Pattern ${adjustedSelectedIndex + 1}`
              } sur {visiblePatterns.length} patterns visibles ({data.patterns.length} total)
              {deletedPatterns.length > 0 && (
                <span className="ml-2 text-red-600">
                  • {deletedPatterns.length} supprimé{deletedPatterns.length > 1 ? 's' : ''}
                </span>
              )}
              {excludedColumns.length > 0 && (
                <span className="ml-2 text-blue-600">
                  • {excludedColumns.length} colonne{excludedColumns.length > 1 ? 's' : ''} exclue{excludedColumns.length > 1 ? 's' : ''}
                </span>
              )}
              {headerPatternIndex !== null && (
                <span className="ml-2 text-purple-600">
                  • Header: P{headerPatternIndex + 1}
                </span>
              )}
            </div>
            <div>
              {displayingMergedPattern ? 
                `${displayingMergedPattern.count} lignes fusionnées` :
                `${currentPattern.count} lignes`
              } sur {data.totalRows} total
            </div>
          </div>
        </div>
        </div>
      </div>
      {/* Modal: Save Params */}
      {showSaveParamsModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowSaveParamsModal(false)}></div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white w-full max-w-md rounded shadow-md border">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="text-sm font-medium">Enregistrer les paramètres</div>
              <button onClick={() => setShowSaveParamsModal(false)} className="text-gray-500 text-sm">✕</button>
            </div>
            <div className="p-3 text-sm space-y-3">
              <div>
                <div className="text-xs text-gray-600 mb-1">Choisir une action</div>
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" checked={saveMode==='new'} onChange={() => { setSaveMode('new'); setOverwriteIdx(-1); }} />
                    <span>Nouveau</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" checked={saveMode==='overwrite'} onChange={() => setSaveMode('overwrite')} />
                    <span>Remplacer</span>
                  </label>
                </div>
              </div>
              {saveMode === 'new' ? (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Nom du modèle</label>
                  <input
                    value={saveParamsName}
                    onChange={(e) => setSaveParamsName(e.target.value)}
                    placeholder="ex: Format Collecteur X"
                    className="w-full px-2 py-1 text-sm border rounded"
                  />
                </div>
              ) : (
                <div>
                  <div className="text-xs text-gray-600 mb-1">Sélectionner un modèle à remplacer</div>
                  <div className="max-h-44 overflow-auto border rounded">
                    {savedParams.length === 0 && (
                      <div className="p-2 text-xs text-gray-500">Aucun modèle existant</div>
                    )}
                    {savedParams.map((p, idx) => (
                      <label key={idx} className="flex items-center gap-2 px-2 py-1 border-b cursor-pointer">
                        <input
                          type="radio"
                          name="overwriteParams"
                          checked={overwriteIdx === idx}
                          onChange={() => { setOverwriteIdx(idx); setSaveParamsName(p.name); }}
                        />
                        <div className="min-w-0">
                          <div className="truncate">{p.name}</div>
                          <div className="text-[11px] text-gray-500">{new Date(p.createdAt).toLocaleString()}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-3 border-t flex justify-end gap-2">
              <button onClick={() => setShowSaveParamsModal(false)} className="px-3 py-1 text-sm border rounded bg-white hover:bg-gray-50">Annuler</button>
              <button onClick={handleSaveCurrentParams} disabled={saveMode==='new' && !saveParamsName.trim()} className="px-3 py-1 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed">{saveMode==='new' ? 'Enregistrer' : 'Remplacer'}</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Apply Params */}
      {showApplyParamsModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowApplyParamsModal(false)}></div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white w-full max-w-md rounded shadow-md border">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="text-sm font-medium">Appliquer des paramètres</div>
              <button onClick={() => setShowApplyParamsModal(false)} className="text-gray-500 text-sm">✕</button>
            </div>
            <div className="p-3 text-sm max-h-72 overflow-auto">
              {savedParams.length === 0 && (
                <div className="text-xs text-gray-500">Aucun modèle enregistré.</div>
              )}
              {savedParams.map((p, idx) => (
                <label key={idx} className="flex items-center gap-2 px-2 py-1 border-b cursor-pointer">
                  <input
                    type="radio"
                    name="applyParams"
                    checked={selectedParamsIdx === idx}
                    onChange={() => setSelectedParamsIdx(idx)}
                  />
                  <div className="min-w-0">
                    <div className="truncate">{p.name}</div>
                    <div className="text-[11px] text-gray-500">{new Date(p.createdAt).toLocaleString()}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="p-3 border-t flex justify-end gap-2">
              <button onClick={() => setShowApplyParamsModal(false)} className="px-3 py-1 text-sm border rounded bg-white hover:bg-gray-50">Annuler</button>
              <button onClick={handleApplySelectedParams} disabled={selectedParamsIdx < 0} className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed">Appliquer</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de prévisualisation finale */}
      <PreviewImport
        dataReadyToSend={finalPreviewData}
        entreprise_id={session?.entreprise_id || ''}
        isOpen={showFinalPreview}
        onClose={() => setShowFinalPreview(false)}
        onConfirm={handleConfirmFinalImport}
        isLoading={isProcessingImport}
      />
    </div>
  );
};

export default MetaExcel;
