"use client";

import { useEffect, useMemo, useRef } from "react";
import { Bar, Pie } from 'react-chartjs-2';
import 'chart.js/auto';
import { AnalysisResponse, ChartConfig, Family } from "../types";

interface Props {
  config: ChartConfig;
  data: AnalysisResponse | undefined;
  exportImage?: boolean;
  onExportImage?: (id: string, dataUrl: string) => void;
}

export function ChartRenderer({ config, data, exportImage, onExportImage }: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const displayTitle = useMemo(() => {
    const custom = (config.title || '').trim();
    if (custom.toLowerCase() === 'graphique' || custom.length === 0) return '';
    
    // Don't show auto-generated titles for tables
    if (config.type === 'table') return custom;
    
    const y = config.yAxis === 'tonnage' ? 'Tonnage' : config.yAxis === 'nbr_ligne' ? 'Lignes' : 'Remplissage %';
    if (config.type === 'pie') return `${custom} — ${y} par ${config.segmentFamily}`;
    if (config.type === 'bar') return `${custom} — ${y} par ${config.xFamily} (seg: ${config.segmentFamily})`;
    return custom;
  }, [config]);
  type BuiltChartData =
    | { kind: 'pie' | 'bar'; data: { labels: string[]; datasets: Array<{ label: string; data: number[]; backgroundColor?: string | string[]; borderColor?: string | string[]; borderWidth?: number }> } }
    | { kind: 'table'; xLabels: string[]; yLabels: string[]; matrix: number[][] };

  const chartData = useMemo<BuiltChartData>(() => {
    const rows = data?.data || [];

    const filtered = rows.filter(r => {
      if (!config.filterFamily || !config.filterValues || config.filterValues.length === 0) return true;
      const valueByFamily: Record<Family, string> = {
        site: r.site,
        exutoire: r.exutoire,
        transport: r.transport,
        filiere: r.filiere,
        mois_annee: r.mois_annee,
        contenant: r.contenant,
        code_dr: r.code_dr,
        valorisation: r.valorisation,
        tri: r.tri,
        rep: r.rep,
        source: r.source,
      };
      return config.filterValues.includes(valueByFamily[config.filterFamily]);
    });

    const colorFor = (idx: number): string => {
      const palette = [
        // Couleurs primaires et secondaires
        '#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#10b981',
        // Couleurs supplémentaires
        '#6366f1', '#14b8a6', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#65a30d', '#ea580c', '#be185d', '#059669',
        // Couleurs tertiaires
        '#3b82f6', '#22c55e', '#eab308', '#f87171', '#a855f7', '#22d3ee', '#a3e635', '#fb923c', '#f472b6', '#34d399',
        // Couleurs complémentaires
        '#1d4ed8', '#15803d', '#ca8a04', '#b91c1c', '#6d28d9', '#0e7490', '#4d7c0f', '#c2410c', '#9d174d', '#047857',
        // Couleurs pastel
        '#93c5fd', '#86efac', '#fde047', '#fca5a5', '#c4b5fd', '#67e8f9', '#bef264', '#fdba74', '#f9a8d4', '#6ee7b7',
        // Couleurs sombres
        '#1e40af', '#166534', '#92400e', '#7f1d1d', '#581c87', '#164e63', '#365314', '#9a3412', '#831843', '#064e3b',
        // Couleurs vives
        '#60a5fa', '#4ade80', '#facc15', '#f87171', '#a78bfa', '#38bdf8', '#84cc16', '#fb923c', '#f472b6', '#2dd4bf'
      ];
      return palette[idx % palette.length];
    };

    if (config.type === 'pie') {
      const groups = new Map<string, number>();
      filtered.forEach(r => {
        const key = (
          config.segmentFamily === 'site' ? r.site :
          config.segmentFamily === 'exutoire' ? r.exutoire :
          config.segmentFamily === 'transport' ? r.transport :
          config.segmentFamily === 'filiere' ? r.filiere :
          config.segmentFamily === 'mois_annee' ? r.mois_annee :
          config.segmentFamily === 'contenant' ? r.contenant :
          config.segmentFamily === 'code_dr' ? r.code_dr :
          config.segmentFamily === 'valorisation' ? r.valorisation :
          config.segmentFamily === 'tri' ? r.tri :
          config.segmentFamily === 'rep' ? r.rep :
          r.source
        );
        const value = config.yAxis === 'tonnage' ? r.tonnage : config.yAxis === 'nbr_ligne' ? r.nbr_ligne : r.remplissage || 0;
        groups.set(key, (groups.get(key) || 0) + value);
      });
      const labels = Array.from(groups.keys()).sort();
      const values = labels.map(l => groups.get(l) || 0);
      return {
        kind: 'pie',
        data: {
          labels,
          datasets: [{
            label: config.title,
            data: values,
            backgroundColor: labels.map((_, i) => colorFor(i))
          }]
        }
      };
    }

    if (config.type === 'table') {
      const xSet = new Set<string>();
      const ySet = new Set<string>();
      filtered.forEach(r => {
        const xVal = (
          config.xFamily === 'site' ? r.site :
          config.xFamily === 'exutoire' ? r.exutoire :
          config.xFamily === 'transport' ? r.transport :
          config.xFamily === 'filiere' ? r.filiere :
          config.xFamily === 'mois_annee' ? r.mois_annee :
          config.xFamily === 'contenant' ? r.contenant :
          config.xFamily === 'code_dr' ? r.code_dr :
          config.xFamily === 'valorisation' ? r.valorisation :
          config.xFamily === 'tri' ? r.tri :
          config.xFamily === 'rep' ? r.rep :
          r.source
        );
        const yVal = (
          (config.yFamily || 'filiere') === 'site' ? r.site :
          (config.yFamily || 'filiere') === 'exutoire' ? r.exutoire :
          (config.yFamily || 'filiere') === 'transport' ? r.transport :
          (config.yFamily || 'filiere') === 'filiere' ? r.filiere :
          (config.yFamily || 'filiere') === 'mois_annee' ? r.mois_annee :
          (config.yFamily || 'filiere') === 'contenant' ? r.contenant :
          (config.yFamily || 'filiere') === 'code_dr' ? r.code_dr :
          (config.yFamily || 'filiere') === 'valorisation' ? r.valorisation :
          (config.yFamily || 'filiere') === 'tri' ? r.tri :
          (config.yFamily || 'filiere') === 'rep' ? r.rep :
          r.source
        );
        if (xVal) xSet.add(xVal);
        if (yVal) ySet.add(yVal);
      });
      const xLabels: string[] = Array.from(xSet).sort();
      const yLabels: string[] = Array.from(ySet).sort();
      // Build matrix
      const matrix: number[][] = yLabels.map(y => xLabels.map(x => {
        const subset = filtered.filter(r => {
          const xVal = (
            config.xFamily === 'site' ? r.site :
            config.xFamily === 'exutoire' ? r.exutoire :
            config.xFamily === 'transport' ? r.transport :
            config.xFamily === 'filiere' ? r.filiere :
            config.xFamily === 'mois_annee' ? r.mois_annee :
            config.xFamily === 'contenant' ? r.contenant :
            config.xFamily === 'code_dr' ? r.code_dr :
            config.xFamily === 'valorisation' ? r.valorisation :
            config.xFamily === 'tri' ? r.tri :
            config.xFamily === 'rep' ? r.rep :
            r.source
          );
          const yVal = (
            (config.yFamily || 'filiere') === 'site' ? r.site :
            (config.yFamily || 'filiere') === 'exutoire' ? r.exutoire :
            (config.yFamily || 'filiere') === 'transport' ? r.transport :
            (config.yFamily || 'filiere') === 'filiere' ? r.filiere :
            (config.yFamily || 'filiere') === 'mois_annee' ? r.mois_annee :
            (config.yFamily || 'filiere') === 'contenant' ? r.contenant :
            (config.yFamily || 'filiere') === 'code_dr' ? r.code_dr :
            (config.yFamily || 'filiere') === 'valorisation' ? r.valorisation :
            (config.yFamily || 'filiere') === 'tri' ? r.tri :
            (config.yFamily || 'filiere') === 'rep' ? r.rep :
            r.source
          );
          return xVal === x && yVal === y;
        });
        if (config.yAxis === 'tonnage') return subset.reduce((a, b) => a + b.tonnage, 0);
        if (config.yAxis === 'nbr_ligne') return subset.reduce((a, b) => a + b.nbr_ligne, 0);
        const fills = subset.map(s => s.remplissage).filter(v => typeof v === 'number' && !Number.isNaN(v)) as number[];
        if (fills.length === 0) return 0;
        return Number((fills.reduce((a, b) => a + b, 0) / fills.length).toFixed(1));
      }));
      return { kind: 'table', xLabels, yLabels, matrix };
    }

    // bar
    const xSet = new Set<string>();
    filtered.forEach(r => {
      const val = (
        config.xFamily === 'site' ? r.site :
        config.xFamily === 'exutoire' ? r.exutoire :
        config.xFamily === 'transport' ? r.transport :
        config.xFamily === 'filiere' ? r.filiere :
        config.xFamily === 'mois_annee' ? r.mois_annee :
        config.xFamily === 'contenant' ? r.contenant :
        config.xFamily === 'code_dr' ? r.code_dr :
        config.xFamily === 'valorisation' ? r.valorisation :
        config.xFamily === 'tri' ? r.tri :
        config.xFamily === 'rep' ? r.rep :
        r.source
      );
      if (val) xSet.add(val);
    });
    const labels = Array.from(xSet).sort();

    const segSet = new Set<string>();
    filtered.forEach(r => {
      const val = (
        config.segmentFamily === 'site' ? r.site :
        config.segmentFamily === 'exutoire' ? r.exutoire :
        config.segmentFamily === 'transport' ? r.transport :
        config.segmentFamily === 'filiere' ? r.filiere :
        config.segmentFamily === 'mois_annee' ? r.mois_annee :
        config.segmentFamily === 'contenant' ? r.contenant :
        config.segmentFamily === 'code_dr' ? r.code_dr :
        config.segmentFamily === 'valorisation' ? r.valorisation :
        config.segmentFamily === 'tri' ? r.tri :
        config.segmentFamily === 'rep' ? r.rep :
        r.source
      );
      if (val) segSet.add(val);
    });
    const segments = Array.from(segSet).sort();

    const datasets = segments.map((seg, i) => {
      const points = labels.map(lbl => {
        const subset = filtered.filter(r => {
          const segVal = (
            config.segmentFamily === 'site' ? r.site :
            config.segmentFamily === 'exutoire' ? r.exutoire :
            config.segmentFamily === 'transport' ? r.transport :
            config.segmentFamily === 'filiere' ? r.filiere :
            config.segmentFamily === 'mois_annee' ? r.mois_annee :
            config.segmentFamily === 'contenant' ? r.contenant :
            config.segmentFamily === 'code_dr' ? r.code_dr :
            config.segmentFamily === 'valorisation' ? r.valorisation :
            config.segmentFamily === 'tri' ? r.tri :
            config.segmentFamily === 'rep' ? r.rep :
            r.source
          );
          const xVal = (
            config.xFamily === 'site' ? r.site :
            config.xFamily === 'exutoire' ? r.exutoire :
            config.xFamily === 'transport' ? r.transport :
            config.xFamily === 'filiere' ? r.filiere :
            config.xFamily === 'mois_annee' ? r.mois_annee :
            config.xFamily === 'contenant' ? r.contenant :
            config.xFamily === 'code_dr' ? r.code_dr :
            config.xFamily === 'valorisation' ? r.valorisation :
            config.xFamily === 'tri' ? r.tri :
            config.xFamily === 'rep' ? r.rep :
            r.source
          );
          return segVal === seg && xVal === lbl;
        });

        if (config.yAxis === 'tonnage') return subset.reduce((a, b) => a + b.tonnage, 0);
        if (config.yAxis === "nbr_ligne") return subset.reduce((a, b) => a + b.nbr_ligne, 0);
        const fills = subset.map(s => s.remplissage).filter(v => typeof v === 'number' && !Number.isNaN(v)) as number[];
        if (fills.length === 0) return 0;
        return Number((fills.reduce((a, b) => a + b, 0) / fills.length).toFixed(1));
      });
      return { label: seg, data: points, backgroundColor: colorFor(i), borderColor: colorFor(i), borderWidth: 1 };
    });

    return { kind: 'bar', data: { labels, datasets } };
  }, [config, data]);

  useEffect(() => {
    if (!exportImage) return;
    const el = wrapperRef.current;
    if (!el) return;
    const maybeCanvas = el.querySelector('canvas');
    if (!maybeCanvas) return;
    const canvas = maybeCanvas as HTMLCanvasElement;
    // Wait for chart render
    requestAnimationFrame(() => {
      // Give Chart.js a bit more time to finish layout without animations
      setTimeout(() => {
        try {
          const url = canvas.toDataURL('image/png');
          if (url && onExportImage) onExportImage(config.id, url);
        } catch {
          // ignore
        }
      }, 200);
    });
  }, [exportImage, config.id, chartData, onExportImage]);

  return (
    <div className="w-full" ref={wrapperRef}>
      {displayTitle && chartData.kind !== 'table' && <div className="text-sm font-medium mb-1 text-gray-800">{displayTitle}</div>}
      {chartData.kind === 'table' ? (
        <div className="overflow-auto border rounded">
          {/* Render a simple cross-tab table for preview/export capture context does not affect */}
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left">{config.yFamily || 'filiere'} / {config.xFamily}</th>
                {chartData.xLabels.map((x) => (
                  <th key={x} className="px-2 py-1 text-left">{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* datasets[0].data contains a matrix rows x cols */}
              {chartData.matrix.map((row, rIdx) => (
                <tr key={`r_${rIdx}`}>
                  <td className="px-2 py-1 font-medium">{chartData.yLabels[rIdx] || ''}</td>
                  {row.map((val, cIdx) => (
                    <td key={`c_${cIdx}`} className="px-2 py-1 text-right">{typeof val === 'number' ? val.toFixed(2) : ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : chartData.kind === 'pie' ? (
        exportImage ? (
          <Pie data={chartData.data} width={1200} height={360} options={{
            responsive: false,
            maintainAspectRatio: false,
            devicePixelRatio: 2,
            animation: { duration: 0 },
            animations: { colors: false, radius: false },
            plugins: {
              legend: {
                position: 'bottom',
                labels: { font: { size: 20 }, boxWidth: 20, boxHeight: 14 }
              },
              title: { display: false }
            },
            layout: { padding: { top: 8, right: 8, bottom: 24, left: 8 } }
          }} />
        ) : (
          <div style={{ height: 320 }}>
            <Pie data={chartData.data} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        )
      ) : (
        exportImage ? (
          <Bar data={chartData.data} width={1200} height={520} options={{
            responsive: false,
            maintainAspectRatio: false,
            devicePixelRatio: 2,
            animation: { duration: 0 },
            animations: { colors: false },
            plugins: {
              legend: { position: 'bottom', labels: { font: { size: 18 } } },
              title: { display: false }
            },
            layout: { padding: { top: 8, right: 8, bottom: 16, left: 8 } },
            scales: { x: { stacked: true }, y: { stacked: true } }
          }} />
        ) : (
          <div style={{ height: 360 }}>
            <Bar data={chartData.data} options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'top' as const } },
              scales: { x: { stacked: true }, y: { stacked: true } }
            }} />
          </div>
        )
      )}
    </div>
  );
}


