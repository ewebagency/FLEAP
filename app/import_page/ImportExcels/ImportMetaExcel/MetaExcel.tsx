'use client';

import React, { useState } from 'react';
import { MetaExcelData, ExcelRow, ColumnPattern } from './ButtonImportMetaExcel';
import { formatPattern, getPatternSummary, excelNumberToDate } from './extract_meta_excel';

interface MetaExcelProps {
  data: MetaExcelData;
  isOpen: boolean;
  onClose: () => void;
}

const MetaExcel: React.FC<MetaExcelProps> = ({ data, isOpen, onClose }) => {
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
  const [columnMappings, setColumnMappings] = useState<{[key: string]: string}>({});
  const [clickedColumn, setClickedColumn] = useState<string | null>(null);
  const [displayingMergedPattern, setDisplayingMergedPattern] = useState<{
    pattern: ColumnPattern;
    rows: ExcelRow[];
    count: number;
    indices: number[];
  } | null>(null);

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

  if (!isOpen) return null;

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

  // Fonction pour mapper automatiquement les colonnes
  const autoMapColumns = () => {
    const patternToUse = displayingMergedPattern?.pattern || currentPattern.pattern;
    const columns = Object.keys(patternToUse);
    const mappings: {[key: string]: string} = {};
    
    columns.forEach(columnName => {
      let bestMatch = '';
      let bestScore = 0;
      
      Object.entries(columnMappingDictionary).forEach(([fieldName, patterns]) => {
        const score = fuzzyMatch(columnName, patterns);
        if (score > bestScore && score > 0.3) { // Seuil minimum de 30%
          bestScore = score;
          bestMatch = fieldName;
        }
      });
      
      if (bestMatch) {
        mappings[columnName] = bestMatch;
      }
    });
    
    setColumnMappings(mappings);
  };

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

  // Dictionnaire de mapping des colonnes
  const columnMappingDictionary = { 
    numBon: ['numéro bon', 'n° bon', 'bon', 'référence bon', 'bon de collecte', 'bon de pesée'],
    numFacture: ['numéro facture', 'n° facture', 'facture', 'réf facture'],
    NumBSD: ['numéro BSD', 'n° bsd', 'bordereau', 'référence bsd', 'BSDD', 'BSDA', 'Bordereau Suivi Déchet'],
    date: ['date', 'date opération', 'date collecte', 'date facturation', 'date bon', 'date bsd'],
    nomSite: ['chantier', 'lieu de collecte', 'site', 'nom du site', 'adresse chantier', 'site de production', 'chantier collecte'],
    adresseSite: ['adresse', 'adresse site', 'adresse chantier', 'lieu', 'localisation', 'emplacement'],
    nomPointCollecte: ['point de collecte', 'lieu de dépôt', 'zone collecte', 'point d’apport', 'lieu de regroupement'],
    nomDechet: ['description', 'type de déchet', 'désignation déchet', 'nature déchet', 'code déchet', 'intitulé déchet'],
    codeCED: ['code CED', 'code déchet', 'code européen déchet', 'code DND', 'code déchets dangereux'],
    nomTransporteur: ['transporteur', 'nom transporteur', 'entreprise transport', 'prestataire transport', 'collecteur'],
    nomDestinataire: ['destinataire', 'installation de traitement', 'centre de valorisation', 'site de traitement', 'usine', 'exutoire'],
    codeDR: ['code DR', 'département réception', 'code département', 'DR', 'région réception'],
    tonnage: ['poids', 'masse', 'tonnage', 'quantité en tonnes', 'poids total', 'kg', 't'],
    volume: ['volume', 'm³', 'quantité en volume', 'contenance', 'capacité'],
    nomContenant: ['contenant', 'type contenant', 'conditionnement', 'emballage', 'type de récipient'],
    typePrestation: ['prestation', 'service', 'type service', 'nature prestation', 'mode de traitement', 'type opération'],
    prixUnitaire: ['prix unitaire', 'tarif unitaire', 'PU', 'coût par unité'],
    MontantHT: ['montant HT', 'total HT', 'montant hors taxe', 'sous-total', 'valeur HT'],
    unite: ['unité', 'unité de mesure', 'u', 'kg', 'tonne', 'litre', 'm³'],
    quantiteFacture: ['quantité facturée', 'qté facturée', 'nombre', 'volume facturé', 'poids facturé']
  };

  // Fonction de matching flou simple
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


  // Fonction pour obtenir les suggestions de mapping pour une colonne
  const getMappingSuggestions = (columnName: string) => {
    const suggestions: {fieldName: string, score: number}[] = [];
    
    Object.entries(columnMappingDictionary).forEach(([fieldName, patterns]) => {
      const score = fuzzyMatch(columnName, patterns);
      if (score >= 0.9) { // Seuil élevé de 90% pour les suggestions
        suggestions.push({fieldName, score});
      }
    });
    
    return suggestions.sort((a, b) => b.score - a.score);
  };

  // Fonction pour assigner un mapping à une colonne
  const assignMapping = (columnName: string, fieldName: string) => {
    setColumnMappings({
      ...columnMappings,
      [columnName]: fieldName
    });
  };

  // Fonction pour obtenir le nom d'affichage d'une colonne
  const getColumnDisplayName = (columnName: string) => {
    return columnMappings[columnName] || columnName;
  };

  // Fonction pour vérifier si un champ est déjà utilisé
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
    const columns = Object.keys(pattern);
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
                  const suggestions = showStep2 ? getMappingSuggestions(displayName) : [];
                  
                  return (
                    <th
                      key={columnName}
                      className="px-2 py-1 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b min-w-[120px] relative"
                    >
                      <div 
                        className="flex items-center gap-1 cursor-pointer"
                        onClick={() => showStep2 && toggleMappingDropdown(displayName)}
                        title={showStep2 ? "Clic pour voir les suggestions de mapping" : `Colonne: ${columnName}`}
                      >
                        <span className="text-sm">{getTypeIcon(pattern[columnName])}</span>
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
                            {suggestions.length > 0 ? '🎯' : '⚪'}
                          </span>
                        )}
                      </div>
                      
                      {/* Suggestions de mapping - affichées seulement pour la colonne cliquée */}
                      {showStep2 && clickedColumn === displayName && suggestions.length > 0 && (
                        <div className="absolute top-full left-0 z-20 mt-1 bg-white border border-gray-300 rounded shadow-lg min-w-[200px]">
                          <div className="p-2 text-xs text-gray-600 border-b">
                            Suggestions pour &quot;{displayName}&quot; (≥90%):
                          </div>
                          {suggestions.map((suggestion) => (
                            <button
                              key={suggestion.fieldName}
                              onClick={() => {
                                assignMapping(displayName, suggestion.fieldName);
                                setClickedColumn(null); // Fermer le dropdown après sélection
                              }}
                              disabled={isFieldUsed(suggestion.fieldName) && columnMappings[displayName] !== suggestion.fieldName}
                              className={`w-full text-left px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed ${
                                isFieldUsed(suggestion.fieldName) && columnMappings[displayName] !== suggestion.fieldName
                                  ? 'text-gray-400'
                                  : 'text-gray-700'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span>{suggestion.fieldName}</span>
                                <span className="text-xs text-gray-500">
                                  {Math.round(suggestion.score * 100)}%
                                </span>
                              </div>
                              {isFieldUsed(suggestion.fieldName) && columnMappings[displayName] !== suggestion.fieldName && (
                                <div className="text-xs text-red-500">Déjà utilisé</div>
                              )}
                            </button>
                          ))}
                          <div className="border-t p-1">
                            <button
                              onClick={() => {
                                const newMappings = {...columnMappings};
                                delete newMappings[displayName];
                                setColumnMappings(newMappings);
                                setClickedColumn(null); // Fermer le dropdown après suppression
                              }}
                              className="w-full text-left px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                            >
                              🗑️ Supprimer le mapping
                            </button>
                          </div>
                        </div>
                      )}
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
                    {columns.map((columnName) => (
                      <td key={columnName} className="px-2 py-1 text-xs max-w-[150px]">
                        <div className="truncate">
                          {renderCell(row[columnName], pattern[columnName])}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
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
            <div className="flex items-center gap-2">
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
                onClick={() => {
                  setShowStep2(!showStep2);
                  if (!showStep2) {
                    autoMapColumns();
                  }
                }}
                className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
              >
                {showStep2 ? 'Retour étape 1' : 'Étape 2 - Mapping'}
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
    </div>
  );
};

export default MetaExcel;
