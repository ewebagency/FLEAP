import { ExcelRow, ColumnPattern, PatternAnalysis, MetaExcelData } from './ButtonImportMetaExcel';

/**
 * Convertit un nombre Excel en date (Excel stocke les dates comme nombre de jours depuis 1900)
 * Utilisée dans MetaExcel.tsx pour l'affichage
 */
export function excelNumberToDate(excelNumber: number): Date | null {
  // Excel compte les jours depuis le 1er janvier 1900
  // Mais il y a un bug Excel : il considère 1900 comme une année bissextile
  const excelEpoch = new Date(1900, 0, 1); // 1er janvier 1900
  const daysSinceEpoch = excelNumber - 2; // -2 pour corriger le bug Excel
  
  if (daysSinceEpoch < 0) {
    return null; // Date invalide
  }
  
  const resultDate = new Date(excelEpoch);
  resultDate.setDate(resultDate.getDate() + daysSinceEpoch);
  
  return resultDate;
}

/**
 * Vérifie si un nombre pourrait être une date Excel dans une plage réaliste
 */
function isExcelDateNumber(value: number): boolean {
  if (!Number.isInteger(value) || value < 1) {
    return false;
  }

  // Convertir en date pour vérifier la plage
  const date = excelNumberToDate(value);
  if (!date) {
    return false;
  }

  // Plage réaliste : aujourd'hui - 8 ans à aujourd'hui + 4 mois
  const today = new Date();
  const minDate = new Date(today);
  minDate.setFullYear(today.getFullYear() - 8);
  
  const maxDate = new Date(today);
  maxDate.setMonth(today.getMonth() + 4);

  return date >= minDate && date <= maxDate;
}

/**
 * Vérifie si une string contient une séquence de 6+ chiffres consécutifs (type ID)
 */
function isIdString(value: string): boolean {
  // Chercher une séquence de 4 chiffres ou plus sans point ni virgule ni espace
  const idPattern = /\d{6,}/;
  return idPattern.test(value) && !/[.,]/.test(value);
}

/**
 * Détermine le type d'une valeur
 */
function detectValueType(value: unknown): 'text' | 'number' | 'boolean' | 'date' | 'null' | 'id' {
  if (value === null || value === undefined || value === '') {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
  }

  if (typeof value === 'number') {
    // Vérifier si c'est une date Excel
    if (isExcelDateNumber(value)) {
      return 'date';
    }
    return 'number';
  }

  if (typeof value === 'string') {
    // Vérifier si c'est une date
    if (isDateString(value)) {
      return 'date';
    }
    
    // Vérifier si c'est un ID (séquence de 4+ chiffres)
    if (isIdString(value)) {
      return 'id';
    }
    
    // Vérifier si c'est un nombre sous forme de string
    if (isNumericString(value)) {
      const numValue = parseFloat(value.replace(',', '.'));
      // Vérifier si ce nombre pourrait être une date Excel
      if (isExcelDateNumber(numValue)) {
        return 'date';
      }
      return 'number';
    }
    
    // Vérifier si c'est un booléen sous forme de string
    if (isBooleanString(value)) {
      return 'boolean';
    }
    
    return 'text';
  }

  return 'text';
}

/**
 * Vérifie si une string représente une date dans une plage réaliste
 */
function isDateString(value: string): boolean {
  // Exclure les valeurs qui contiennent des lettres (sauf formats de date stricts)
  if (/[a-zA-Z]/.test(value) && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  // Formats de date courants stricts
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
    /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY
    /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
    /^\d{1,2}\/\d{1,2}\/\d{4}$/, // D/M/YYYY
    /^\d{1,2}-\d{1,2}-\d{4}$/, // D-M-YYYY
  ];

  // Vérifier les patterns stricts
  for (const pattern of datePatterns) {
    if (pattern.test(value)) {
      // Vérifier que c'est une date valide
      const date = new Date(value);
      if (!isNaN(date.getTime()) && date.toString() !== 'Invalid Date') {
        // Vérifier que la date est dans une plage réaliste
        return isDateInRealisticRange(date);
      }
    }
  }

  return false;
}

/**
 * Vérifie si une date est dans une plage réaliste (aujourd'hui - 8 ans à aujourd'hui + 4 mois)
 */
function isDateInRealisticRange(date: Date): boolean {
  const today = new Date();
  const minDate = new Date(today);
  minDate.setFullYear(today.getFullYear() - 8);
  
  const maxDate = new Date(today);
  maxDate.setMonth(today.getMonth() + 4);

  return date >= minDate && date <= maxDate;
}

/**
 * Vérifie si une string représente un nombre
 */
function isNumericString(value: string): boolean {
  // Enlever les espaces
  const trimmed = value.trim();
  
  // Vérifier si c'est un nombre (avec ou sans décimales, avec ou sans signe)
  const numericPattern = /^-?\d+(\.\d+)?$/;
  
  if (numericPattern.test(trimmed)) {
    return true;
  }

  // Vérifier les formats avec virgule comme séparateur décimal
  const commaPattern = /^-?\d+(,\d+)?$/;
  if (commaPattern.test(trimmed)) {
    return true;
  }

  // Vérifier les formats avec espaces comme séparateurs de milliers
  const spacePattern = /^-?\d{1,3}(\s\d{3})*(,\d+)?$/;
  if (spacePattern.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Vérifie si une string représente un booléen
 */
function isBooleanString(value: string): boolean {
  const lowerValue = value.toLowerCase().trim();
  const booleanValues = [
    'true', 'false', 'vrai', 'faux', 'oui', 'non', 'yes', 'no',
    '1', '0', 'o', 'n', 'y', 't', 'f'
  ];
  
  return booleanValues.includes(lowerValue);
}

/**
 * Crée un pattern de colonnes pour une ligne
 */
function createColumnPattern(row: ExcelRow): ColumnPattern {
  const pattern: ColumnPattern = {};
  
  for (const [columnName, value] of Object.entries(row)) {
    pattern[columnName] = detectValueType(value);
  }
  
  return pattern;
}


/**
 * Convertit un pattern en string pour l'utiliser comme clé
 */
function patternToString(pattern: ColumnPattern): string {
  const sortedEntries = Object.entries(pattern)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, type]) => `${key}:${type}`);
  
  return sortedEntries.join('|');
}

/**
 * Calcule le pourcentage de cellules vides dans une ligne
 */
function getEmptyCellsPercentage(row: ExcelRow): number {
  const values = Object.values(row);
  if (values.length === 0) return 100;
  
  const emptyCount = values.filter(value => 
    value === null || 
    value === undefined || 
    value === '' || 
    (typeof value === 'string' && value.trim() === '')
  ).length;
  
  return (emptyCount / values.length) * 100;
}

/**
 * Extrait et analyse les patterns d'un fichier Excel
 */
export function extractMetaExcel(
  excelData: ExcelRow[],
  fileName: string,
  sheetName: string
): MetaExcelData {
  if (!excelData || excelData.length === 0) {
    throw new Error('Aucune donnée trouvée dans le fichier Excel');
  }

  // Filtrer les lignes avec trop de cellules vides (probablement des en-têtes ou lignes vides)
  const filteredData = excelData.filter(row => {
    const emptyPercentage = getEmptyCellsPercentage(row);
    // Garder seulement les lignes avec moins de 80% de cellules vides
    return emptyPercentage < 80;
  });

  if (filteredData.length === 0) {
    throw new Error('Aucune ligne valide trouvée (toutes les lignes sont majoritairement vides)');
  }

  console.log(`Filtrage: ${excelData.length} lignes → ${filteredData.length} lignes valides`);

  // Créer un pattern pour chaque ligne filtrée
  const rowPatterns: { pattern: ColumnPattern; row: ExcelRow; patternKey: string }[] = [];
  
  for (const row of filteredData) {
    const pattern = createColumnPattern(row);
    const patternKey = patternToString(pattern);
    rowPatterns.push({ pattern, row, patternKey });
  }

  // Grouper les lignes par pattern
  const patternGroups = new Map<string, { pattern: ColumnPattern; rows: ExcelRow[] }>();
  
  for (const { pattern, row, patternKey } of rowPatterns) {
    if (!patternGroups.has(patternKey)) {
      patternGroups.set(patternKey, { pattern, rows: [] });
    }
    patternGroups.get(patternKey)!.rows.push(row);
  }

  // Créer les analyses de patterns
  const patterns: PatternAnalysis[] = [];
  
  patternGroups.forEach(({ pattern, rows }) => {
    patterns.push({
      pattern,
      rows,
      count: rows.length
    });
  });

  // Trier par nombre d'occurrences (décroissant)
  patterns.sort((a, b) => b.count - a.count);

  // Le pattern le plus récurrent est le premier
  const mostCommonPattern = patterns[0];

  return {
    fileName,
    sheetName,
    totalRows: filteredData.length, // Utiliser le nombre de lignes filtrées
    patterns,
    mostCommonPattern
  };
}

/**
 * Fonction utilitaire pour afficher un pattern de manière lisible
 */
export function formatPattern(pattern: ColumnPattern): string {
  const entries = Object.entries(pattern)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([column, type]) => {
      let typeIcon = '❓';
      switch (type) {
        case 'text': typeIcon = '📝'; break;
        case 'number': typeIcon = '🔢'; break;
        case 'boolean': typeIcon = '✅'; break;
        case 'date': typeIcon = '📅'; break;
        case 'null': typeIcon = '⚪'; break;
        case 'id': typeIcon = '🆔'; break;
      }
      
      return `${column}: ${typeIcon} ${type}`;
    });
  
  return entries.join(', ');
}

/**
 * Fonction utilitaire pour obtenir un résumé des patterns
 */
export function getPatternSummary(patterns: PatternAnalysis[]): string {
  const totalRows = patterns.reduce((sum, p) => sum + p.count, 0);
  const patternCount = patterns.length;
  const mostCommonCount = patterns[0]?.count || 0;
  const mostCommonPercentage = totalRows > 0 ? Math.round((mostCommonCount / totalRows) * 100) : 0;
  
  return `${patternCount} patterns détectés sur ${totalRows} lignes. Pattern principal: ${mostCommonCount} lignes (${mostCommonPercentage}%)`;
}
