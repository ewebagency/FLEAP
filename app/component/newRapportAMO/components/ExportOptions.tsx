"use client";

import { useMemo, useState } from "react";
import { ExportOptionsState, TableColumnKey } from "../types";

interface Props {
  value: ExportOptionsState;
  onChange: (value: ExportOptionsState) => void;
}

export function ExportOptions({ value, onChange }: Props) {
  const toggle = (key: keyof ExportOptionsState) => {
    onChange({ ...value, [key]: !value[key] });
  };

  const allColumns = useMemo<Array<{ key: TableColumnKey; label: string }>>(() => [
    { key: 'nBSD', label: 'N° BSD' },
    { key: 'nBon', label: 'N° Bon' },
    { key: 'nFacture', label: 'N° Facture' },
    { key: 'date', label: 'Date' },
    { key: 'site', label: 'Site' },
    { key: 'site_siret', label: 'SIRET site' },
    { key: 'waste', label: 'Déchet' },
    { key: 'ced', label: 'CED' },
    { key: 'qty', label: 'Tonnage' },
    { key: 'treatment', label: 'Traitement' },
    { key: 'exutoire', label: 'Exutoire' },
    { key: 'exutoire_siret', label: 'SIRET destinataire' },
    { key: 'exutoire_address', label: 'Adresse destinataire' },
    { key: 'receipt', label: 'N° récépissé (transporteur)' },
    { key: 'transport_name', label: 'Transporteur' },
    { key: 'transport_siret', label: 'SIRET transporteur' },
    { key: 'numberPlate', label: 'Immatriculation' },
    { key: 'containerDescription', label: 'Contenant' },
    { key: 'attachments', label: 'Pièces' },
  ], []);

  const defaultOrder = useMemo(() => (
    ['nBSD','nBon','nFacture','date','site','site_siret','waste','ced','qty','treatment','exutoire','exutoire_siret','exutoire_address','transport_name','transport_siret','receipt','numberPlate','containerDescription'] as TableColumnKey[]
  ), []);

  const selected = useMemo(() => (
    (value.tableColumns && value.tableColumns.length > 0)
      ? value.tableColumns
      : defaultOrder
  ), [value.tableColumns, defaultOrder]);

  const addColumn = (key: TableColumnKey) => {
    if (selected.includes(key)) return;
    onChange({ ...value, tableColumns: [...selected, key] });
  };

  const removeColumn = (key: TableColumnKey) => {
    if (!selected.includes(key)) return;
    onChange({ ...value, tableColumns: selected.filter(k => k !== key) });
  };

  const [showColumns, setShowColumns] = useState(false);
  const [search, setSearch] = useState('');

  const selectedSummary = useMemo(() => {
    const labels = selected
      .filter(k => !(k === 'site' && !value.includeTable))
      .map(k => (allColumns.find(c => c.key === k)?.label || k));
    const text = labels.join(', ');
    return text.length > 90 ? text.slice(0, 90) + '…' : text;
  }, [selected, allColumns, value.includeTable]);

  const remaining = useMemo(() => {
    return allColumns.filter(c => !selected.includes(c.key) && c.key !== 'attachments');
  }, [allColumns, selected]);

  const filteredRemaining = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return remaining;
    return remaining.filter(c => c.label.toLowerCase().includes(s));
  }, [search, remaining]);

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="font-semibold mb-2 text-gray-800">Contenu de l&apos;export</div>
      <div className="space-y-1">
        <label className="flex items-center gap-3 text-sm hover:bg-gray-100 p-2 rounded cursor-pointer">
          <input type="checkbox" checked={value.includeTitle} onChange={() => toggle('includeTitle')} className="w-4 h-4" />
          <span className="font-medium">Titre</span>
        </label>
        <label className="flex items-center gap-3 text-sm hover:bg-gray-100 p-2 rounded cursor-pointer">
          <input type="checkbox" checked={value.includeKPIs} onChange={() => toggle('includeKPIs')} className="w-4 h-4" />
          <span className="font-medium">KPIs</span>
        </label>
        <label className="flex items-center gap-3 text-sm hover:bg-gray-100 p-2 rounded cursor-pointer">
          <input type="checkbox" checked={value.includeTable} onChange={() => toggle('includeTable')} className="w-4 h-4" />
          <span className="font-medium">Tableau des lignes déchets</span>
        </label>
        <label className="flex items-center gap-3 text-sm hover:bg-gray-100 p-2 rounded cursor-pointer">
          <input type="checkbox" checked={value.includeCharts} onChange={() => toggle('includeCharts')} className="w-4 h-4" />
          <span className="font-medium">Graphiques</span>
        </label>
        <label className="flex items-center gap-3 text-sm hover:bg-gray-100 p-2 rounded cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value.includeLinePdfs)}
            onChange={() => toggle('includeLinePdfs')}
            className="w-4 h-4"
          />
          <span className="font-medium">Ajouter les PDF liés aux lignes</span>
        </label>
      </div>

      {value.includeTable && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowColumns(!showColumns)}
            className="w-full flex items-center justify-between px-3 py-2 border rounded bg-white hover:bg-gray-50"
          >
            <span className="font-semibold text-gray-800">Colonnes du tableau</span>
            <span className="text-xs text-gray-500">{showColumns ? 'Masquer' : 'Afficher'}</span>
          </button>

          {!showColumns && (
            <div className="text-xs text-gray-500 mt-2 truncate" title={selectedSummary}>{selectedSummary || '—'}</div>
          )}

          {showColumns && (
            <div className="mt-2 space-y-2">
              {/* Selected as chips (click to remove) */}
              <div className="flex flex-wrap gap-2">
                {selected.map(k => {
                  const label = allColumns.find(c => c.key === k)?.label || k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => removeColumn(k)}
                      className="px-2 py-1 text-xs rounded border bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                      title="Retirer cette colonne"
                    >{label} ✕</button>
                  );
                })}
                {selected.length === 0 && (
                  <span className="text-xs text-gray-500">Aucune colonne sélectionnée.</span>
                )}
              </div>

              {/* Search + list to add */}
              <div className="border rounded p-2 bg-white">
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher une colonne…"
                  className="w-full border rounded px-2 py-1 text-sm mb-2"
                />
                <div className="max-h-40 overflow-auto divide-y">
                  {filteredRemaining.map(col => (
                    <button
                      key={col.key}
                      type="button"
                      onClick={() => { addColumn(col.key); setSearch(''); }}
                      className="w-full text-left px-2 py-1 text-sm hover:bg-gray-50"
                    >{col.label}</button>
                  ))}
                  {filteredRemaining.length === 0 && (
                    <div className="text-xs text-gray-400 px-2 py-1">Aucune colonne disponible</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="text-xs text-gray-500 mt-2">Astuce: activez &quot;Pièces&quot; seulement si vous incluez aussi les PDFs ligne par ligne.</div>
        </div>
      )}
    </div>
  );
}


