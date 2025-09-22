"use client";

import { AnalysisResponse, ChartConfig, Denominators, Family, YAxis } from "../types";

interface Props {
  denominators: Denominators | undefined;
  charts: ChartConfig[];
  onAddChart: () => void;
  onUpdateChart: (id: string, updater: (c: ChartConfig) => ChartConfig) => void;
  onRemoveChart: (id: string) => void;
}

export function GraphConfigurator({ denominators, charts, onAddChart, onUpdateChart, onRemoveChart }: Props) {
  const allValuesByFamily: Record<Family, string[]> = {
    site: denominators ? denominators.unique_site.map(v => (v.name && v.name.length > 0 ? v.name : v.siret)) : [],
    exutoire: denominators ? denominators.unique_exutoire.map(v => (v.name && v.name.length > 0 ? v.name : v.siret)) : [],
    transport: denominators ? denominators.unique_transport.map(v => (v.name && v.name.length > 0 ? v.name : v.siret)) : [],
    filiere: denominators?.unique_filiere || [],
    mois_annee: denominators?.unique_mois_annee || [],
    contenant: denominators?.unique_contenant || [],
    code_dr: denominators?.unique_code_dr || [],
    valorisation: denominators?.unique_valorisation || [],
    tri: denominators?.unique_tri || [],
    rep: denominators?.unique_rep || [],
    source: denominators?.unique_source || [],
  };

  (Object.keys(allValuesByFamily) as Family[]).forEach(k => { allValuesByFamily[k] = [...allValuesByFamily[k]].sort(); });

  return (
    <div className="border rounded p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">Graphiques</div>
        <button className="px-2 py-1 border rounded text-sm" onClick={onAddChart}>Ajouter un graphique</button>
      </div>

      {charts.length === 0 && (
        <div className="text-sm text-gray-500">Aucun graphique configuré.</div>
      )}

      {charts.map(chart => (
        <div key={chart.id} className="border rounded p-3 space-y-3 bg-gray-50">
          <div className="flex items-center gap-3">
            <input
              className="border rounded px-3 py-2 text-sm flex-1"
              placeholder="Titre du graphique"
              value={chart.title}
              onChange={e => onUpdateChart(chart.id, c => ({ ...c, title: e.target.value }))}
            />
            <select
              className="border rounded px-3 py-2 text-sm"
              value={chart.type}
              onChange={e => onUpdateChart(chart.id, c => ({ ...c, type: e.target.value as 'bar' | 'pie' | 'table' }))}
            >
              <option value="bar">Barres</option>
              <option value="pie">Camembert</option>
              <option value="table">Tableau croisé</option>
            </select>
            <button className="px-3 py-2 border rounded text-sm bg-red-50 text-red-600 hover:bg-red-100" onClick={() => onRemoveChart(chart.id)}>Supprimer</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {chart.type === 'table' ? (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Axe X (colonnes)</label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={chart.xFamily}
                    onChange={e => onUpdateChart(chart.id, c => ({ ...c, xFamily: e.target.value as Family }))}
                  >
                    {(['site','exutoire','transport','filiere','mois_annee','contenant','code_dr','valorisation','tri','rep','source'] as Family[]).map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Axe Y (lignes)</label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={chart.yFamily || 'filiere'}
                    onChange={e => onUpdateChart(chart.id, c => ({ ...c, yFamily: e.target.value as Family }))}
                  >
                    {(['site','exutoire','transport','filiere','mois_annee','contenant','code_dr','valorisation','tri','rep','source'] as Family[]).map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Segmentation</label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={chart.segmentFamily}
                    onChange={e => onUpdateChart(chart.id, c => ({ ...c, segmentFamily: e.target.value as Family }))}
                  >
                    {(['site','exutoire','transport','filiere','mois_annee','contenant','code_dr','valorisation','tri','rep','source'] as Family[]).map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                {chart.type === 'bar' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Axe X</label>
                    <select
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={chart.xFamily}
                      onChange={e => onUpdateChart(chart.id, c => ({ ...c, xFamily: e.target.value as Family }))}
                    >
                      {(['site','exutoire','transport','filiere','mois_annee','contenant','code_dr','valorisation','tri','rep','source'] as Family[]).map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Axe Y</label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={chart.yAxis}
                    onChange={e => onUpdateChart(chart.id, c => ({ ...c, yAxis: e.target.value as YAxis }))}
                  >
                    <option value="tonnage">Tonnage</option>
                    <option value="nbr_ligne">Nombre de lignes</option>
                    <option value="remplissage">Remplissage (%)</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}


