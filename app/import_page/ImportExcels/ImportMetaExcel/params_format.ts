'use client';

import { supabase } from '@/app/database/supabaseClient';
import { DerivedColumnDef } from './DeriveColumns';
import { ExcelRow, ColumnPattern } from './ButtonImportMetaExcel';

// Types stockés en BDD (dans entreprise.params_format_this)
export interface StoredParamsFormat {
  name: string;
  createdAt: string;
  // Métadonnées optionnelles pour aider à remapper (facultatif, pas utilisé pour matcher automatique)
  meta?: {
    // Snapshot des noms d'en-têtes (si header sélectionné) par clé canonique
    headerNamesByCanonical?: Record<string, string>;
    // Liste des colonnes originales rencontrées au moment de l'enregistrement
    originalColumnList?: string[];
  };
  actions: {
    excludedColumns: string[]; // canonical keys
    hiddenColumns: string[]; // canonical keys (UX)
    columnMappings: Record<string, string>; // canonicalKey -> standardFieldKey
    derivedDefs: DerivedColumnDefCanonical[]; // colonnes référencées en canonicalKey
    selectedExport?: { mode: 'single' | 'merged'; patternKeys: string[] };
  };
}

// Version "canonique" des DerivedColumnDef (colonnes référencées par canonicalKey)
export type DerivedColumnDefCanonical =
  | {
      kind: 'formula';
      name: string;
      tokens: (
        | { type: 'column'; columnName: string } // canonicalKey
        | { type: 'number'; value: number }
        | { type: 'op'; value: string }
        | { type: 'paren'; value: '(' | ')' }
        | { type: 'func'; name: 'NUM' | 'INT' | 'TEXT' | 'POS' | 'ABS' | 'ROUND' | 'FLOOR' | 'CEIL' }
      )[];
    }
  | {
      kind: 'mapping';
      name: string;
      sourceColumn: string; // canonicalKey
      map: Record<string, string>;
    }
  | {
      kind: 'condition';
      name: string;
      conditions: (
        | { type: 'column'; columnName: string } // canonicalKey
        | { type: 'operator'; value: 'contains' | 'not_contains' | 'equals' | 'not_equals' | 'gt' | 'gte' | 'lt' | 'lte' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' }
        | { type: 'value'; value: string }
        | { type: 'logical'; value: 'AND' | 'OR' }
        | { type: 'paren'; value: '(' | ')' }
      )[];
      trueValue: string;
      falseValue: string;
      trueIsIdentity?: boolean;
      identityColumn?: string; // canonicalKey
    };

// Utilitaires de résolution
function buildCanonicalResolver(
  pattern: ColumnPattern,
  headerRow: ExcelRow | null
) {
  // canonicalKey = nom original tel que dans pattern
  // displayName actuel = headerRow[original] ou original
  const originalColumns = Object.keys(pattern);

  const getDisplayName = (original: string) => {
    const headerVal = headerRow && (headerRow as Record<string, unknown>)[original];
    return headerVal ? String(headerVal) : original;
  };

  return {
    toDisplayName: (canonicalKey: string) => getDisplayName(canonicalKey),
    existsCanonical: (canonicalKey: string) => originalColumns.includes(canonicalKey),
  };
}

// Conversion UI -> stock (canonical)
export function buildStoredParams(
  name: string,
  pattern: ColumnPattern,
  headerRow: ExcelRow | null,
  state: {
    excludedColumns: string[]; // original names currently visible in table header context
    hiddenColumns: string[];
    columnMappings: Record<string, string>; // UI mapping: key = displayName, value = standardFieldKey
    derivedDefs: DerivedColumnDef[]; // UI-level (token columns are display names)
    selectedExport?: { mode: 'single' | 'merged'; patternKeys: string[] };
  }
): StoredParamsFormat {
  const resolver = buildCanonicalResolver(pattern, headerRow);

  // UI columnMappings (clé = displayName) -> canonicalKey
  const columnMappingsCanonical: Record<string, string> = {};
  Object.entries(state.columnMappings).forEach(([displayName, stdKey]) => {
    // retrouver la colonne originale via le displayName courant
    // Ici, displayName correspond soit au headerRow[original], soit au nom original
    const original = Object.keys(pattern).find((orig) => {
      const disp = headerRow && (headerRow as Record<string, unknown>)[orig] ? String((headerRow as Record<string, unknown>)[orig]) : orig;
      return disp === displayName;
    });
    if (original) {
      columnMappingsCanonical[original] = stdKey;
    }
  });

  // Excluded/Hidden sont déjà des noms originaux dans cette UI (on les garde tel quels)
  const excludedCanonical = state.excludedColumns.filter((c) => resolver.existsCanonical(c));
  const hiddenCanonical = state.hiddenColumns.filter((c) => resolver.existsCanonical(c));

  // Derived: convertir les références de colonnes (display) -> canonical
  const derivedCanonical: DerivedColumnDefCanonical[] = state.derivedDefs.map((d) => {
    if (d.kind === 'formula') {
      return {
        kind: 'formula',
        name: d.name,
        tokens: d.tokens.map((t) =>
          t.type === 'column'
            ? { type: 'column', columnName: toCanonicalFromDisplay(t.columnName, pattern, headerRow) }
            : t
        ),
      };
    } else if (d.kind === 'mapping') {
      return {
        kind: 'mapping',
        name: d.name,
        sourceColumn: toCanonicalFromDisplay(d.sourceColumn, pattern, headerRow),
        map: d.map,
      };
    } else {
      return {
        kind: 'condition',
        name: d.name,
        conditions: d.conditions.map((t) =>
          t.type === 'column'
            ? { type: 'column', columnName: toCanonicalFromDisplay(t.columnName, pattern, headerRow) }
            : t
        ),
        trueValue: d.trueValue,
        falseValue: d.falseValue,
        trueIsIdentity: d.trueIsIdentity,
        identityColumn: d.trueIsIdentity && d.identityColumn
          ? toCanonicalFromDisplay(d.identityColumn, pattern, headerRow)
          : d.identityColumn,
      };
    }
  });

  const headerNamesByCanonical: Record<string, string> = {};
  Object.keys(pattern).forEach((orig) => {
    const disp = headerRow && (headerRow as Record<string, unknown>)[orig] ? String((headerRow as Record<string, unknown>)[orig]) : '';
    if (disp) headerNamesByCanonical[orig] = disp;
  });

  return {
    name,
    createdAt: new Date().toISOString(),
    meta: {
      headerNamesByCanonical,
      originalColumnList: Object.keys(pattern),
    },
    actions: {
      excludedColumns: excludedCanonical,
      hiddenColumns: hiddenCanonical,
      columnMappings: columnMappingsCanonical,
      derivedDefs: derivedCanonical,
      selectedExport: state.selectedExport,
    },
  };
}

function toCanonicalFromDisplay(displayName: string, pattern: ColumnPattern, headerRow: ExcelRow | null): string {
  const match = Object.keys(pattern).find((orig) => {
    const disp = headerRow && (headerRow as Record<string, unknown>)[orig] ? String((headerRow as Record<string, unknown>)[orig]) : orig;
    return disp === displayName || orig === displayName;
  });
  return match || displayName;
}

// Conversion stock (canonical) -> UI courant (display)
export function adaptStoredToCurrent(
  stored: StoredParamsFormat,
  pattern: ColumnPattern,
  headerRow: ExcelRow | null
): {
  excludedColumns: string[]; // UI expects original names for toggles -> use canonical (original)
  hiddenColumns: string[];
  columnMappings: Record<string, string>; // key = displayName courant, value = standardFieldKey
  derivedDefs: DerivedColumnDef[]; // array
} {
  const resolver = buildCanonicalResolver(pattern, headerRow);

  const excluded = stored.actions.excludedColumns.filter((c) => resolver.existsCanonical(c));
  const hidden = stored.actions.hiddenColumns.filter((c) => resolver.existsCanonical(c));

  const columnMappingsUI: Record<string, string> = {};
  Object.entries(stored.actions.columnMappings).forEach(([canonicalKey, stdKey]) => {
    if (!resolver.existsCanonical(canonicalKey)) return;
    const display = resolver.toDisplayName(canonicalKey);
    columnMappingsUI[display] = stdKey;
  });

  const derivedUIArray: DerivedColumnDef[] = stored.actions.derivedDefs.map((d) => {
    if (d.kind === 'formula') {
      return {
        kind: 'formula',
        name: d.name,
        tokens: d.tokens.map((t) =>
          t.type === 'column'
            ? { type: 'column', columnName: resolver.existsCanonical(t.columnName) ? resolver.toDisplayName(t.columnName) : t.columnName }
            : t
        ),
      } as DerivedColumnDef;
    } else if (d.kind === 'mapping') {
      return {
        kind: 'mapping',
        name: d.name,
        sourceColumn: resolver.existsCanonical(d.sourceColumn) ? resolver.toDisplayName(d.sourceColumn) : d.sourceColumn,
        map: d.map,
      } as DerivedColumnDef;
    } else {
      return {
        kind: 'condition',
        name: d.name,
        conditions: d.conditions.map((t) =>
          t.type === 'column'
            ? { type: 'column', columnName: resolver.existsCanonical(t.columnName) ? resolver.toDisplayName(t.columnName) : t.columnName }
            : t
        ),
        trueValue: d.trueValue,
        falseValue: d.falseValue,
        trueIsIdentity: d.trueIsIdentity,
        identityColumn: d.identityColumn && resolver.existsCanonical(d.identityColumn)
          ? resolver.toDisplayName(d.identityColumn)
          : d.identityColumn,
      } as DerivedColumnDef;
    }
  });

  // Retourne un seul tableau pour setDerivedDefs
  // Le type attendu est DerivedColumnDef[]
  return {
    excludedColumns: excluded,
    hiddenColumns: hidden,
    columnMappings: columnMappingsUI,
    derivedDefs: derivedUIArray,
  };
}

// Supabase helpers
export async function fetchParamsFormats(entrepriseId: string): Promise<StoredParamsFormat[]> {
  const { data, error } = await supabase
    .from('entreprise')
    .select('params_format_this')
    .eq('id', entrepriseId)
    .single();
  if (error) throw error;
  const arr = (data as { params_format_this?: unknown })?.params_format_this || [];
  if (Array.isArray(arr)) return arr as StoredParamsFormat[];
  return [];
}

export async function saveParamsFormat(
  entrepriseId: string,
  params: StoredParamsFormat
): Promise<void> {
  const existing = await fetchParamsFormats(entrepriseId);
  // Écraser si un paramètre du même nom existe déjà
  const idx = existing.findIndex((p) => p.name === params.name);
  let newArray: StoredParamsFormat[];
  if (idx >= 0) {
    newArray = [...existing];
    newArray[idx] = params;
  } else {
    newArray = [...existing, params];
  }
  const { error } = await supabase
    .from('entreprise')
    .update({ params_format_this: newArray })
    .eq('id', entrepriseId);
  if (error) throw error;
}


