'use client';

import React, { useMemo, useState } from 'react';
import { ExcelRow } from './ButtonImportMetaExcel';
import { useSession } from '@/app/component/SessionProvider';
import { supabase } from '@/app/database/supabaseClient';

type CatalogSource = 'site' | 'transporteur' | 'destinataire' | 'contenant' | 'dechet' | 'operation' | 'unite';
type CatalogItem = { label: string; value: string } | { label: string; value: Record<string, unknown> };

export type DerivedColumnDef =
  | {
      kind: 'formula';
      name: string;
      tokens: FormulaToken[];
    }
  | {
      kind: 'mapping';
      name: string;
      sourceColumn: string;
      map: Record<string, string>;
  }
  | {
    kind: 'condition';
    name: string;
    conditions: ConditionToken[];
    trueValue: string;
    falseValue: string;
    trueIsIdentity?: boolean;
    identityColumn?: string;
    };

type FormulaToken =
  | { type: 'column'; columnName: string }
  | { type: 'number'; value: number }
  | { type: 'op'; value: string }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'func'; name: 'NUM' | 'INT' | 'TEXT' | 'POS' | 'ABS' | 'ROUND' | 'FLOOR' | 'CEIL' };

type ConditionToken =
  | { type: 'column'; columnName: string }
  | { type: 'operator'; value: 'contains' | 'not_contains' | 'equals' | 'not_equals' | 'gt' | 'gte' | 'lt' | 'lte' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' }
  | { type: 'value'; value: string }
  | { type: 'logical'; value: 'AND' | 'OR' }
  | { type: 'paren'; value: '(' | ')' };

interface DeriveColumnsProps {
  rows: ExcelRow[];
  availableColumns: string[];
  value: DerivedColumnDef[];
  onChange: (defs: DerivedColumnDef[]) => void;
  columnMapping?: { [mappedName: string]: string }; // Mapping des noms mappés vers les noms originaux
  unusedFieldKeys?: string[]; // Standard field keys still available for naming
}

const ops = ['+', '-', '*', '/'];

export default function DeriveColumns({ rows, availableColumns, value, onChange, columnMapping, unusedFieldKeys }: DeriveColumnsProps) {
  const [mode, setMode] = useState<'formula' | 'mapping' | 'condition'>('formula');
  const [newName, setNewName] = useState('');
  const [tokens, setTokens] = useState<FormulaToken[]>([]);
  const [showColumnList, setShowColumnList] = useState<boolean>(true);
  const [numberLiteral, setNumberLiteral] = useState<string>('');
  const [sourceColumn, setSourceColumn] = useState<string>('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [columnSearch, setColumnSearch] = useState<string>('');
  const [conditions, setConditions] = useState<ConditionToken[]>([]);
  const [trueValue, setTrueValue] = useState<string>('');
  const [falseValue, setFalseValue] = useState<string>('');
  const [conditionValue, setConditionValue] = useState<string>('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedOperator, setSelectedOperator] = useState<string>('');
  const [trueIsIdentity, setTrueIsIdentity] = useState<boolean>(false);
  const [identityColumn, setIdentityColumn] = useState<string>('');

  // Catalog picker state for mapping mode
  const session = useSession();
  const [isCatalogOpen, setIsCatalogOpen] = useState<{ open: boolean; key?: string }>({ open: false });
  const [catalogSource, setCatalogSource] = useState<CatalogSource>('site');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  // Tree exploration state
  const [treeRoot, setTreeRoot] = useState<unknown | null>(null);
  const [treePath, setTreePath] = useState<(string | number)[]>([]);

  const openCatalog = (rawKey: string) => {
    setIsCatalogOpen({ open: true, key: rawKey });
    setCatalogSearch('');
    setCatalogItems([]);
    setTreeRoot(null);
    setTreePath([]);
  };

  const closeCatalog = () => setIsCatalogOpen({ open: false });

  const loadCatalog = async () => {
    if (!session?.entreprise_id) return;
    setCatalogLoading(true);
    try {
      if (catalogSource === 'operation' || catalogSource === 'unite') {
        // Only keys from entreprise.params_mapping_operation / params_mapping_unite
        const field = catalogSource === 'operation' ? 'params_mapping_operation' : 'params_mapping_unite';
        const { data, error } = await supabase
          .from('entreprise')
          .select(field)
          .eq('id', session.entreprise_id)
          .single();
        if (error) throw error;
        const obj = (data && typeof data === 'object' && field in (data as Record<string, unknown>)
          ? (data as Record<string, unknown>)[field]
          : {}) as Record<string, unknown>;
        const keys = Object.keys(obj);
        setCatalogItems(keys.map(k => ({ label: k, value: k })));
      } else {
        // table_autocompletion arrays: site, transporteur, destinataire, contenant, dechet
        const col = catalogSource;
        // Fetch full objects to allow picking any field
        const { data, error } = await supabase
          .from('table_autocompletion')
          .select(`${col}`)
          .eq('entreprise_id', session.entreprise_id)
          .limit(500);
        if (error) throw error;
        const rows = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
        const flattened: Array<Record<string, unknown>> = [];
        rows.forEach((r) => {
          const arr = (r as Record<string, unknown>)[col as string];
          if (Array.isArray(arr)) {
            arr.forEach((obj) => {
              if (obj && typeof obj === 'object') {
                flattened.push(obj as Record<string, unknown>);
              }
            });
          } else if (arr && typeof arr === 'object') {
            flattened.push(arr as Record<string, unknown>);
          }
        });
        // Create display label from common fields if exist
        const items: CatalogItem[] = flattened.map((obj) => {
          const o = obj as Record<string, unknown>;
          const label =
            (typeof o['nomBoite'] === 'string' ? (o['nomBoite'] as string) : undefined) ||
            (typeof o['nom'] === 'string' ? (o['nom'] as string) : undefined) ||
            (typeof o['codeCED'] === 'string' ? (o['codeCED'] as string) : undefined) ||
            (typeof o['siret'] === 'string' ? (o['siret'] as string) : undefined) ||
            JSON.stringify(obj).slice(0, 80);
          return { label, value: obj };
        });
        setCatalogItems(items);
      }
    } catch (e) {
      console.error('Catalog load error', e);
      setCatalogItems([]);
    } finally {
      setCatalogLoading(false);
    }
  };

  const filteredCatalog = catalogItems.filter(it =>
    (it.label || '').toLowerCase().includes(catalogSearch.toLowerCase()) ||
    (typeof it.value === 'string' && it.value.toLowerCase().includes(catalogSearch.toLowerCase()))
  );

  const uniqueValues = useMemo(() => {
    if (!sourceColumn) return [] as string[];
    const set = new Set<string>();
    // Utiliser le mapping pour trouver le nom original de la colonne
    const originalColumnName = columnMapping?.[sourceColumn] || sourceColumn;

    // Résolution robuste de la clé dans la ligne (gère accents/casse/espaces)
    const normalizeKey = (s: string | undefined) => (s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9_]/g, '');

    const resolveKey = (rowObj: Record<string, unknown>, wanted: string) => {
      if (wanted in rowObj) return wanted;
      const wantedNorm = normalizeKey(wanted);
      const keys = Object.keys(rowObj);
      for (const k of keys) {
        if (normalizeKey(k) === wantedNorm) return k;
      }
      return wanted; // fallback
    };

    for (const row of rows) {
      const key = resolveKey(row as Record<string, unknown>, originalColumnName);
      const v = (row as Record<string, unknown>)[key];
      if (v !== undefined && v !== null && String(v).trim() !== '') set.add(String(v));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows, sourceColumn, columnMapping]);

  const addToken = (t: FormulaToken) => {
    setTokens((prev: FormulaToken[]) => [...prev, t]);
  };

  const removeLastToken = () => setTokens((prev: FormulaToken[]) => prev.slice(0, -1));

  const addCondition = (t: ConditionToken) => {
    setConditions((prev: ConditionToken[]) => [...prev, t]);
  };


  const addCurrentCondition = () => {
    if (!selectedColumn || !selectedOperator) return;

    // Ajouter la colonne
    addCondition({ type: 'column', columnName: selectedColumn });

    // Ajouter l'opérateur
    addCondition({ type: 'operator', value: selectedOperator as 'contains' | 'not_contains' | 'equals' | 'not_equals' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' });

    // Ajouter la valeur si nécessaire
    if (!['is_empty', 'is_not_empty'].includes(selectedOperator) && conditionValue.trim()) {
      addCondition({ type: 'value', value: conditionValue.trim() });
    }

    // Réinitialiser les sélections
    setSelectedColumn('');
    setSelectedOperator('');
    setConditionValue('');
  };

  // (preview helper removed; not used)

  const getConditionsDisplay = () => {
    const result: string[] = [];
    let currentCondition: string[] = [];

    conditions.forEach((token) => {
      if (token.type === 'column') {
        if (currentCondition.length > 0) {
          result.push(currentCondition.join(' '));
          currentCondition = [];
        }
        currentCondition.push(`«${token.columnName}»`);
      } else if (token.type === 'operator') {
        const opMap: Record<string, string> = {
          'contains': 'contient',
          'not_contains': 'ne contient pas',
          'equals': '=',
          'not_equals': '≠',
          'gt': '>',
          'gte': '≥',
          'lt': '<',
          'lte': '≤',
          'starts_with': 'commence par',
          'ends_with': 'finit par',
          'is_empty': 'est vide',
          'is_not_empty': 'n\'est pas vide'
        };
        currentCondition.push(opMap[token.value] || token.value);
      } else if (token.type === 'value') {
        currentCondition.push(`"${token.value}"`);
      } else if (token.type === 'logical') {
        if (currentCondition.length > 0) {
          result.push(currentCondition.join(' '));
          currentCondition = [];
        }
        result.push(token.value);
      } else if (token.type === 'paren') {
        currentCondition.push(token.value);
      }
    });

    if (currentCondition.length > 0) {
      result.push(currentCondition.join(' '));
    }

    return result;
  };

  const removeCondition = (index: number) => {
    // Logique simplifiée : supprimer par groupe de 3 tokens (colonne, opérateur, valeur)
    const newConditions = [...conditions];
    const startIndex = index * 3;
    newConditions.splice(startIndex, 3);
    setConditions(newConditions);
  };

  const previewExpression = useMemo(() => {
    return tokens
      .map((t: FormulaToken) => {
        if (t.type === 'column') return `«${t.columnName}»`;
        if (t.type === 'number') return String(t.value);
        if (t.type === 'func') return `${t.name}(`;
        return t.value;
      })
      .join(' ');
  }, [tokens]);

  const previewCondition = useMemo(() => {
    return conditions
      .map((t: ConditionToken) => {
        if (t.type === 'column') return `«${t.columnName}»`;
        if (t.type === 'operator') {
          const opMap: Record<string, string> = {
            'contains': 'contient',
            'not_contains': 'ne contient pas',
            'equals': '=',
            'not_equals': '≠',
            'starts_with': 'commence par',
            'ends_with': 'finit par',
            'is_empty': 'est vide',
            'is_not_empty': 'n\'est pas vide'
          };
          return opMap[t.value] || t.value;
        }
        if (t.type === 'value') return `"${t.value}"`;
        if (t.type === 'logical') return t.value;
        return t.value;
      })
      .join(' ');
  }, [conditions]);

  const handleAddDerived = () => {
    if (!newName.trim()) return;
    if (mode === 'formula') {
      if (tokens.length === 0) return;
      onChange([...value, { kind: 'formula', name: newName.trim(), tokens }]);
      setNewName('');
      setTokens([]);
    } else if (mode === 'mapping') {
      if (!sourceColumn) return;
      onChange([...value, { kind: 'mapping', name: newName.trim(), sourceColumn, map: mapping }]);
      setNewName('');
      setSourceColumn('');
      setMapping({});
    } else if (mode === 'condition') {
      if (conditions.length === 0) return;
      onChange([
        ...value,
        {
          kind: 'condition',
          name: newName.trim(),
          conditions,
          trueValue,
          falseValue,
          trueIsIdentity,
          identityColumn: trueIsIdentity ? (identityColumn || selectedColumn || '') : undefined,
        },
      ]);
      setNewName('');
      setConditions([]);
      setTrueValue('');
      setFalseValue('');
      setConditionValue('');
      setSelectedColumn('');
      setSelectedOperator('');
      setTrueIsIdentity(false);
      setIdentityColumn('');
    }
  };

  const handleDelete = (name: string) => {
    onChange(value.filter((d) => d.name !== name));
  };

  return (
    <div className="p-2 border rounded bg-white">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800">Étape 3 • Colonnes dérivées</h4>
        <div className="text-xs text-gray-500">{value.length} colonne(s)</div>
      </div>

      <div className="mt-2 flex gap-2 text-xs">
        <button
          onClick={() => setMode('formula')}
          className={`px-2 py-1 rounded border ${mode === 'formula' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'}`}
        >
          Formule
        </button>
        <button
          onClick={() => setMode('mapping')}
          className={`px-2 py-1 rounded border ${mode === 'mapping' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'}`}
        >
          Mapping
        </button>
        <button
          onClick={() => setMode('condition')}
          className={`px-2 py-1 rounded border ${mode === 'condition' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'}`}
        >
          Condition
        </button>
      </div>

      <div className="mt-3">
        <div className="flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="ex: tonnage_valorise_R1"
            className="w-full px-2 py-1 text-xs border rounded"
          />
          {unusedFieldKeys && unusedFieldKeys.length > 0 && (
            <select
              onChange={(e) => { if (e.target.value) setNewName(e.target.value); }}
              className="px-2 py-1 text-xs border rounded bg-white w-auto"
              value=""
              title="Choisir un standard"
            >
              <option value="">—</option>
              {unusedFieldKeys.map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {mode === 'formula' ? (
        <div className="mt-3">
          <div className="text-xs text-gray-700 mb-1">Construire la formule</div>
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[220px]">
              <div className="flex items-center justify-between gap-2 mb-1">
              <input
                value={columnSearch}
                onChange={(e) => setColumnSearch(e.target.value)}
                placeholder="Rechercher une colonne..."
                className="w-full px-2 py-1 text-xs border rounded"
              />
                <button
                  onClick={() => setShowColumnList(!showColumnList)}
                  className="px-2 py-1 text-[11px] border rounded bg-white hover:bg-gray-50 whitespace-nowrap"
                  title="Afficher/masquer la liste des colonnes"
                >
                  {showColumnList ? 'Masquer' : 'Afficher'}
                </button>
              </div>
              {showColumnList && (
              <div className="mt-1 max-h-28 overflow-auto border rounded p-1">
                {availableColumns
                  .filter((c) => c.toLowerCase().includes(columnSearch.toLowerCase()))
                  .map((c) => (
                    <button
                      key={c}
                      onClick={() => addToken({ type: 'column', columnName: c })}
                      className="block w-full text-left px-2 py-1 text-xs hover:bg-gray-50 rounded"
                    >
                      {c}
                    </button>
                  ))}
              </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1 items-center max-w-[50%]">
              {ops.map((o) => (
                <button key={o} onClick={() => addToken({ type: 'op', value: o })} className="px-2 py-1 text-xs bg-gray-100 border rounded">
                  {o}
                </button>
              ))}
              <button onClick={() => addToken({ type: 'paren', value: '(' })} className="px-2 py-1 text-xs bg-gray-100 border rounded">(</button>
              <button onClick={() => addToken({ type: 'paren', value: ')' })} className="px-2 py-1 text-xs bg-gray-100 border rounded">)</button>
              <button onClick={() => addToken({ type: 'func', name: 'NUM' })} className="px-2 py-1 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded">NUM(</button>
              <button onClick={() => addToken({ type: 'func', name: 'INT' })} className="px-2 py-1 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded">INT(</button>
              <button onClick={() => addToken({ type: 'func', name: 'TEXT' })} className="px-2 py-1 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded">TEXT(</button>
              <button onClick={() => addToken({ type: 'func', name: 'POS' })} className="px-2 py-1 text-[10px] bg-green-50 text-green-700 border border-green-200 rounded" title="Partie positive">POS(</button>
              <button onClick={() => addToken({ type: 'func', name: 'ABS' })} className="px-2 py-1 text-[10px] bg-green-50 text-green-700 border border-green-200 rounded">ABS(</button>
              <button onClick={() => addToken({ type: 'func', name: 'ROUND' })} className="px-2 py-1 text-[10px] bg-green-50 text-green-700 border border-green-200 rounded">ROUND(</button>
              <button onClick={() => addToken({ type: 'func', name: 'FLOOR' })} className="px-2 py-1 text-[10px] bg-green-50 text-green-700 border border-green-200 rounded">FLOOR(</button>
              <button onClick={() => addToken({ type: 'func', name: 'CEIL' })} className="px-2 py-1 text-[10px] bg-green-50 text-green-700 border border-green-200 rounded">CEIL(</button>
              <button onClick={removeLastToken} className="px-2 py-1 text-xs bg-red-100 text-red-700 border border-red-200 rounded">Suppr dernier</button>
            </div>
            <div className="mt-2 flex items-center gap-2 w-full">
              <input
                value={numberLiteral}
                onChange={(e) => setNumberLiteral(e.target.value)}
                placeholder="Nombre (ex: 100, 0.34)"
                className="px-2 py-1 text-xs border rounded w-36"
              />
              <button
                onClick={() => {
                  const n = Number(numberLiteral.replace(',', '.'));
                  if (isFinite(n)) {
                    addToken({ type: 'number', value: n });
                    setNumberLiteral('');
                  }
                }}
                className="px-2 py-1 text-xs bg-gray-100 border rounded"
              >
                Ajouter nombre
              </button>
              <button onClick={() => { addToken({ type:'op', value:'*' }); addToken({ type:'number', value: 0.01 }); }} className="px-2 py-1 text-[10px] bg-purple-50 text-purple-700 border border-purple-200 rounded" title="Diviser par 100">/100</button>
              <button onClick={() => { addToken({ type:'op', value:'*' }); addToken({ type:'number', value: 100 }); }} className="px-2 py-1 text-[10px] bg-purple-50 text-purple-700 border border-purple-200 rounded" title="Multiplier par 100">*100</button>
              <button onClick={() => { addToken({ type:'op', value:'*' }); addToken({ type:'number', value: 0.34 }); }} className="px-2 py-1 text-[10px] bg-purple-50 text-purple-700 border border-purple-200 rounded" title="Appliquer 34%">34%</button>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">Aperçu: <span className="font-mono">{previewExpression || '—'}</span></div>
        </div>
      ) : mode === 'condition' ? (
        <div className="mt-3">
          <div className="text-xs text-gray-700 mb-3 font-medium">🔍 Créer une condition logique</div>

          {/* Interface simple ligne par ligne */}
          <div className="space-y-3">
            {/* Ajouter une nouvelle condition */}
            <div className="bg-blue-50 p-3 rounded border">
              <div className="text-xs font-medium text-blue-800 mb-2">➕ Ajouter une condition</div>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedColumn || ''}
                  onChange={(e) => setSelectedColumn(e.target.value)}
                  className="px-2 py-1 text-xs border rounded bg-white min-w-[120px]"
                >
                  <option value="">Colonne...</option>
                  {availableColumns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={selectedOperator || ''}
                  onChange={(e) => setSelectedOperator(e.target.value)}
                  className="px-2 py-1 text-xs border rounded bg-white min-w-[100px]"
                  disabled={!selectedColumn}
                >
                  <option value="">Opérateur...</option>
                  <option value="contains">contient</option>
                  <option value="not_contains">ne contient pas</option>
                  <option value="equals">=</option>
                  <option value="not_equals">≠</option>
                  <option value="gt">&gt; (num)</option>
                  <option value="gte">≥ (num)</option>
                  <option value="lt">&lt; (num)</option>
                  <option value="lte">≤ (num)</option>
                  <option value="starts_with">commence par</option>
                  <option value="ends_with">finit par</option>
                  <option value="is_empty">est vide</option>
                  <option value="is_not_empty">n&apos;est pas vide</option>
                </select>

                {selectedOperator && !['is_empty', 'is_not_empty'].includes(selectedOperator) && (
                  <input
                    value={conditionValue}
                    onChange={(e) => setConditionValue(e.target.value)}
                    placeholder="Valeur..."
                    className="px-2 py-1 text-xs border rounded min-w-[100px]"
                  />
                )}

                <button
                  onClick={addCurrentCondition}
                  disabled={!selectedColumn || !selectedOperator || (!['is_empty', 'is_not_empty'].includes(selectedOperator) && !conditionValue.trim())}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Ajouter
                </button>
              </div>
            </div>

            {/* Conditions existantes */}
            {conditions.length > 0 && (
              <div className="bg-gray-50 p-3 rounded border">
                <div className="text-xs font-medium text-gray-800 mb-2">📋 Conditions ajoutées</div>
                <div className="space-y-2">
                  {getConditionsDisplay().map((condition: string, index: number) => (
                    <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                      <span className="text-xs text-gray-700">{condition}</span>
                      <button
                        onClick={() => removeCondition(index)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        ❌
                      </button>
                    </div>
                  ))}
                </div>

                {/* Boutons pour ajouter des opérateurs logiques */}
                {conditions.length > 0 && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => addCondition({ type: 'logical', value: 'AND' })}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      ET (AND)
                    </button>
                    <button
                      onClick={() => addCondition({ type: 'logical', value: 'OR' })}
                      className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                    >
                      OU (OR)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Aperçu de la condition */}
            {conditions.length > 0 && (
              <div className="bg-indigo-50 p-3 rounded border">
                <div className="text-xs font-medium text-indigo-800 mb-1">🎯 Aperçu</div>
                <div className="text-xs text-indigo-700 font-mono bg-white p-2 rounded border">
                  {previewCondition || '—'}
                </div>
              </div>
            )}

            {/* Valeurs de retour */}
            <div className="bg-gray-50 p-3 rounded border">
              <div className="text-xs font-medium text-gray-800 mb-2">🎭 Valeurs de retour</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600">Si VRAI</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      value={trueValue}
                      onChange={(e) => setTrueValue(e.target.value)}
                      placeholder="Ex: OUI, VALIDE..."
                      className="flex-1 px-2 py-1 text-xs border rounded"
                      disabled={trueIsIdentity}
                    />
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={trueIsIdentity}
                        onChange={(e) => setTrueIsIdentity(e.target.checked)}
                      />
                      Utiliser la valeur de la colonne (identité)
                    </label>
                    {trueIsIdentity && (
                      <select
                        value={identityColumn || selectedColumn}
                        onChange={(e) => setIdentityColumn(e.target.value)}
                        className="px-2 py-1 border rounded bg-white"
                      >
                        <option value="">— Sélectionner —</option>
                        {availableColumns.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Si FAUX</label>
                  <input
                    value={falseValue}
                    onChange={(e) => setFalseValue(e.target.value)}
                    placeholder="Ex: NON, INVALIDE..."
                    className="mt-1 w-full px-2 py-1 text-xs border rounded"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <div className="text-xs text-gray-700 mb-1">Colonne source</div>
          <select
            value={sourceColumn}
            onChange={(e) => setSourceColumn(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
          >
            <option value="">Sélectionner...</option>
            {availableColumns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {sourceColumn && (
            <div className="mt-2">
              <div className="text-xs text-gray-700 mb-1">Valeurs uniques → Meta</div>
              <div className="max-h-40 overflow-auto border rounded">
                {uniqueValues.map((v) => (
                  <div key={v} className="flex items-center justify-between gap-2 px-2 py-1 border-b text-xs">
                    <div className="truncate max-w-[45%]" title={v}>{v}</div>
                    <div className="flex items-center gap-2 flex-1">
                    <input
                      value={mapping[v] || ''}
                      onChange={(e) => setMapping((m) => ({ ...m, [v]: e.target.value }))}
                      placeholder="valeur meta (ex: params_site(...) )"
                      className="flex-1 px-2 py-1 border rounded"
                    />
                      <button
                        onClick={() => openCatalog(v)}
                        className="px-2 py-1 border rounded bg-white hover:bg-gray-50"
                        title="Chercher dans la BDD"
                      >
                        Chercher
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Catalog Picker Modal */}
          {isCatalogOpen.open && (
            <div className="fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/30" onClick={closeCatalog}></div>
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white w-full max-w-xl rounded shadow-md border">
                <div className="p-3 border-b flex items-center justify-between">
                  <div className="text-sm font-medium">Sélectionner une valeur (BDD)</div>
                  <button onClick={closeCatalog} className="text-gray-500 text-sm">✕</button>
                </div>
                <div className="p-3 flex items-center gap-2">
                  <select
            value={catalogSource}
            onChange={(e) => setCatalogSource(e.target.value as CatalogSource)}
                    className="px-2 py-1 text-xs border rounded bg-white"
                  >
                    <option value="site">Site</option>
                    <option value="transporteur">Transporteur</option>
                    <option value="destinataire">Destinataire</option>
                    <option value="contenant">Contenant</option>
                    <option value="dechet">Déchet</option>
                    <option value="operation">Opération (keys)</option>
                    <option value="unite">Unité (keys)</option>
                  </select>
                  <input
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Rechercher..."
                    className="flex-1 px-2 py-1 text-xs border rounded"
                  />
                  <button
                    onClick={loadCatalog}
                    className="px-2 py-1 text-xs border rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Charger
                  </button>
                </div>
                <div className="p-3 border-t max-h-72 overflow-auto text-sm">
                  {catalogLoading && <div className="text-xs text-gray-500">Chargement...</div>}

                  {/* Tree breadcrumb */}
                  {!catalogLoading && treeRoot !== null && (
                    <div className="mb-2 text-xs">
                      <div className="flex items-center flex-wrap gap-1">
                        <button
                          className="px-1 py-0.5 border rounded bg-white hover:bg-gray-50"
                          onClick={() => setTreePath([])}
                        >
                          racine
                        </button>
                        {treePath.map((seg, idx) => (
                          <button
                            key={idx}
                            className="px-1 py-0.5 border rounded bg-white hover:bg-gray-50"
                            onClick={() => setTreePath(treePath.slice(0, idx + 1))}
                          >
                            .{String(seg)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tree children or flat list */}
                  {!catalogLoading && (treeRoot !== null ? (
                    (() => {
                      const getNodeAtPath = (root: unknown, path: (string | number)[]) => {
                        let node: unknown = root;
                        for (const p of path) {
                          if (node == null) return undefined;
                          if (Array.isArray(node) && typeof p === 'number') {
                            node = node[p];
                          } else if (typeof node === 'object' && node !== null) {
                            node = (node as Record<string, unknown>)[String(p)];
                          } else {
                            return undefined;
                          }
                        }
                        return node;
                      };

                      const current = getNodeAtPath(treeRoot, treePath);
                      const entries: { key: string | number; value: unknown; type: string }[] = [];
                      if (Array.isArray(current)) {
                        current.forEach((v, i) => entries.push({ key: i, value: v, type: Array.isArray(v) ? 'array' : typeof v }));
                      } else if (current && typeof current === 'object') {
                        const rec = current as Record<string, unknown>;
                        Object.keys(rec).forEach(k => {
                          const v = rec[k];
                          entries.push({ key: k, value: v, type: Array.isArray(v) ? 'array' : typeof v });
                        });
                      }

                      const filtered = entries.filter(e => {
                        const keyStr = String(e.key).toLowerCase();
                        if (keyStr.includes(catalogSearch.toLowerCase())) return true;
                        if (e.value != null && ['string', 'number', 'boolean'].includes(typeof e.value)) {
                          return String(e.value).toLowerCase().includes(catalogSearch.toLowerCase());
                        }
                        return false;
                      });

                      return (
                        <div>
                          {filtered.length === 0 && (
                            <div className="text-xs text-gray-500">Aucun résultat</div>
                          )}
                          {filtered.map((e, idx) => {
                            const isPrimitive = e.value == null || ['string', 'number', 'boolean'].includes(typeof e.value);
                            return (
                              <div key={idx} className="flex items-center justify-between gap-2 px-2 py-1 border-b">
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs text-gray-700 truncate">{String(e.key)} <span className="text-[10px] text-gray-500">({isPrimitive ? typeof e.value : Array.isArray(e.value) ? 'array' : typeof e.value})</span></div>
                                  {isPrimitive && (
                                    <div className="text-[11px] text-gray-500 truncate">{String(e.value)}</div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {!isPrimitive && (
                                    <button
                                      className="px-2 py-0.5 text-[11px] border rounded bg-white hover:bg-gray-50"
                                      onClick={() => setTreePath([...treePath, e.key])}
                                    >
                                      Entrer
                                    </button>
                                  )}
                                  <button
                                    className="px-2 py-0.5 text-[11px] border rounded bg-blue-600 text-white hover:bg-blue-700"
                                    onClick={() => {
                                      if (!isCatalogOpen.key) return;
                                      const toStore = isPrimitive ? String(e.value) : JSON.stringify(e.value);
                                      setMapping((m) => ({ ...m, [isCatalogOpen.key as string]: toStore }));
                                      closeCatalog();
                                    }}
                                  >
                                    Sélectionner
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  ) : (
                    filteredCatalog.map((it, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          if (!isCatalogOpen.key) return;
                          if (typeof it.value === 'string') {
                            // Entreprise keys (operation/unite)
                            setMapping((m) => ({ ...m, [isCatalogOpen.key as string]: it.value as string }));
                            closeCatalog();
                            return;
                          }
                          // Open tree exploration for object values
                          setTreeRoot(it.value);
                          setTreePath([]);
                        }}
                        className="w-full text-left px-2 py-1 hover:bg-gray-50 border-b"
                        title={typeof it.value === 'string' ? it.value : JSON.stringify(it.value)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{it.label}</span>
                          <span className="text-[10px] text-gray-500">{typeof it.value === 'string' ? 'texte' : 'objet'}</span>
                        </div>
                      </button>
                    ))
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button onClick={handleAddDerived} className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">Ajouter</button>
      </div>

      {value.length > 0 && (
        <div className="mt-4 border-t pt-2">
          <div className="text-xs text-gray-700 mb-2">Colonnes dérivées</div>
          <div className="flex flex-wrap gap-2">
            {value.map((d) => (
              <div key={d.name} className="px-2 py-1 text-xs border rounded bg-gray-50 flex items-center gap-2">
                <span className="font-medium">{d.name}</span>
                <span className="text-gray-500">[{d.kind}]</span>
                {d.kind === 'condition' && (
                  <span className="text-xs text-blue-600" title={`Si ${d.conditions.map(t => t.type === 'column' ? t.columnName : t.type === 'operator' ? t.value : t.type === 'value' ? `"${t.value}"` : t.value).join(' ')} alors "${d.trueValue}" sinon "${d.falseValue}"`}>
                    {d.conditions.length} condition(s)
                  </span>
                )}
                <button onClick={() => handleDelete(d.name)} className="text-red-600 hover:underline">Supprimer</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Utilitaire pour évaluer une formule construite par tokens
export function evaluateFormulaTokens(tokens: FormulaToken[], row: ExcelRow, columnMapping?: { [mappedName: string]: string }): number | null {
  //console.log('🔍 [evaluateFormulaTokens] Début évaluation:');
  //console.log('  - Tokens:', tokens);
  //console.log('  - Row keys:', Object.keys(row));
  //console.log('  - Column mapping:', columnMapping);
  
  // Générer une expression JS sécurisée: nombres, opérateurs, parenthèses, fonctions de cast, accès row["col"]
  const jsExpr = tokens
    .map((t: FormulaToken) => {
      if (t.type === 'number') {
        //console.log(`  - Token number: ${t.value}`);
        return String(t.value);
      }
      if (t.type === 'op') {
        //console.log(`  - Token op: ${t.value}`);
        return t.value;
      }
      if (t.type === 'paren') {
        //console.log(`  - Token paren: ${t.value}`);
        return t.value;
      }
      if (t.type === 'func') {
        //console.log(`  - Token func: ${t.name}`);
        if (t.name === 'NUM') return '((v)=>{const n=Number(v);return isFinite(n)?n:0})(';
        if (t.name === 'INT') return '((v)=>{const n=parseInt(String(v).replace(/[^-\\d]/g,""),10);return isFinite(n)?n:0})(';
        if (t.name === 'TEXT') return '((v)=>String(v??""))(';
        if (t.name === 'POS') return '((v)=>{const n=Number(v);return isFinite(n)&&n>0?n:0})(';
        if (t.name === 'ABS') return '((v)=>{const n=Number(v);return isFinite(n)?Math.abs(n):0})(';
        if (t.name === 'ROUND') return '((v)=>{const n=Number(v);return isFinite(n)?Math.round(n):0})(';
        if (t.name === 'FLOOR') return '((v)=>{const n=Number(v);return isFinite(n)?Math.floor(n):0})(';
        if (t.name === 'CEIL') return '((v)=>{const n=Number(v);return isFinite(n)?Math.ceil(n):0})(';
      }
      // column with smart numeric parsing (remove spaces, convert comma to dot)
      // Toujours utiliser l'accès par clé pour plus de robustesse
      if (t.type === 'column') {
        const originalColumnName = columnMapping?.[t.columnName] || t.columnName;
        const key = originalColumnName
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        //console.log(`  - Token column: "${t.columnName}" -> original: "${originalColumnName}"`);
        
        return `((v)=>{ if(v==null) return 0; const s=String(v).replace(/\\s+/g,"").replace(/,/g,"."); const n=Number(s); return isFinite(n)?n:0 })(row["${key}"])`;
      }
    })
    .join(' ');

  //console.log('  - Expression JS générée:', jsExpr);

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('row', `return (${jsExpr});`);
    const result = fn(row);
    //console.log('  - Résultat brut:', result, `(type: ${typeof result})`);
    
    if (typeof result === 'number' && isFinite(result)) {
      //console.log('  - ✅ Résultat final:', result);
      return result;
    }
    //console.log('  - ❌ Résultat invalide (null ou non-fini)');
    return null;
  } catch (_err) {
    void _err;
    //console.log('  - ❌ Erreur lors de l\'évaluation:', _err);
    return null;
  }
}

// Utilitaire pour évaluer une condition construite par tokens
export function evaluateConditionTokens(tokens: ConditionToken[], row: ExcelRow, columnMapping?: { [mappedName: string]: string }): boolean {
  console.log('🔍 [evaluateConditionTokens] Début évaluation:');
  console.log('  - Tokens:', tokens);
  console.log('  - Row keys:', Object.keys(row));
  console.log('  - Column mapping:', columnMapping);

  // Construire l'expression condition par condition
  let jsExpr = '';
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.type === 'column') {
      const originalColumnName = columnMapping?.[token.columnName] || token.columnName;
      const key = originalColumnName
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
      console.log(`  - Token column: "${token.columnName}" -> original: "${originalColumnName}"`);

      // Chercher l'opérateur suivant
      if (i + 1 < tokens.length && tokens[i + 1].type === 'operator') {
        const operator = tokens[i + 1];
        console.log(`  - Token operator: ${operator.type === 'operator' ? operator.value : 'unknown'}`);

        // Chercher la valeur suivante
        if (i + 2 < tokens.length && tokens[i + 2].type === 'value') {
          const value = tokens[i + 2];
          const escapedValue = value.type === 'value' ? value.value
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t') : '';
          console.log(`  - Token value: "${value.type === 'value' ? value.value : 'unknown'}"`);

          // Construire l'expression selon l'opérateur
          switch (operator.type === 'operator' ? operator.value : '') {
            case 'contains':
              jsExpr += `contains(row["${key}"], "${escapedValue}")`;
              break;
            case 'not_contains':
              jsExpr += `notContains(row["${key}"], "${escapedValue}")`;
              break;
            case 'equals':
              jsExpr += `equals(row["${key}"], "${escapedValue}")`;
              break;
            case 'not_equals':
              jsExpr += `notEquals(row["${key}"], "${escapedValue}")`;
              break;
            case 'gt':
              jsExpr += `num(row["${key}"]) > num("${escapedValue}")`;
              break;
            case 'gte':
              jsExpr += `num(row["${key}"]) >= num("${escapedValue}")`;
              break;
            case 'lt':
              jsExpr += `num(row["${key}"]) < num("${escapedValue}")`;
              break;
            case 'lte':
              jsExpr += `num(row["${key}"]) <= num("${escapedValue}")`;
              break;
            case 'starts_with':
              jsExpr += `startsWith(row["${key}"], "${escapedValue}")`;
              break;
            case 'ends_with':
              jsExpr += `endsWith(row["${key}"], "${escapedValue}")`;
              break;
            default:
              jsExpr += `row["${key}"]`;
          }
          i += 3; // Passer colonne, opérateur, valeur
        } else if (operator.type === 'operator' && (operator.value === 'is_empty' || operator.value === 'is_not_empty')) {
          if (operator.value === 'is_empty') {
            jsExpr += `isEmpty(row["${key}"])`;
          } else {
            jsExpr += `isNotEmpty(row["${key}"])`;
          }
          i += 2; // Passer colonne, opérateur
        } else {
          jsExpr += `row["${key}"]`;
          i += 1;
        }
      } else {
        jsExpr += `row["${key}"]`;
        i += 1;
      }
    } else if (token.type === 'logical') {
      console.log(`  - Token logical: ${token.value}`);
      jsExpr += ` ${token.value.toLowerCase()} `;
      i += 1;
    } else if (token.type === 'paren') {
      console.log(`  - Token paren: ${token.value}`);
      jsExpr += token.value;
      i += 1;
    } else {
      i += 1;
    }
  }

  console.log('  - Expression JS générée:', jsExpr);

  try {
    // Créer une fonction d'évaluation sécurisée
    const conditionFn = new Function('row', `
      const contains = (str, substr) => String(str || '').toLowerCase().includes(String(substr || '').toLowerCase());
      const notContains = (str, substr) => !contains(str, substr);
      const equals = (a, b) => String(a || '') === String(b || '');
      const notEquals = (a, b) => !equals(a, b);
      const startsWith = (str, prefix) => String(str || '').toLowerCase().startsWith(String(prefix || '').toLowerCase());
      const endsWith = (str, suffix) => String(str || '').toLowerCase().endsWith(String(suffix || '').toLowerCase());
      const isEmpty = (str) => !str || String(str).trim() === '';
      const isNotEmpty = (str) => !isEmpty(str);
      const num = (v) => { const s = String(v ?? '').replace(/\s+/g,'').replace(/,/g,'.'); const n = Number(s); return isFinite(n) ? n : 0; };
      
      return (${jsExpr});
    `);

    const result = conditionFn(row);
    console.log('  - Résultat brut:', result, `(type: ${typeof result})`);

    if (typeof result === 'boolean') {
      console.log('  - ✅ Résultat final:', result);
      return result;
    }
    console.log('  - ❌ Résultat invalide (pas un booléen)');
    return false;
  } catch (_err) {
    console.log('  - ❌ Erreur lors de l\'évaluation:', _err);
    return false;
  }
}


