"use client";

import { useMemo, useState, useCallback } from 'react';
import useSWR from 'swr';
import { useSession } from '@/app/component/SessionProvider';
import { useFilterContext } from '@/app/FilterContext';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';

type TypeParam = 'bsd' | 'facture' | 'pdf';

interface Denominators {
  unique_site: Array<{ siret: string; name: string }>;
  unique_exutoire: Array<{ siret: string; name: string }>;
  unique_transport: Array<{ siret: string; name: string }>;
  unique_filiere: string[];
  unique_mois_annee: string[];
  unique_contenant: string[];
  unique_code_dr: string[];
  unique_valorisation: string[];
  unique_tri: string[];
  unique_rep: string[];
  unique_source: string[];
}

interface GroupedDataItem {
  site: string;
  exutoire: string;
  transport: string;
  filiere: string;
  tonnage: number;
  nbr_ligne: number;
  mois_annee: string;
  contenant: string;
  code_dr: string;
  valorisation: string;
  tri: string;
  rep: string;
  remplissage: number;
  source: string;
}

interface AnalysisResponse {
  denominateur: Denominators;
  data: GroupedDataItem[];
}

export default function ButtonNewRapportAMO() {
  const { entreprise_id } = useSession();
  const { filieres } = useFilterContext();
  const [clicked, setClicked] = useState(false);

  type Family = 'site' | 'exutoire' | 'transport' | 'filiere' | 'mois_annee' | 'contenant' | 'code_dr' | 'valorisation' | 'tri' | 'rep' | 'source';
  type YAxis = 'tonnage' | 'nbr_ligne' | 'remplissage';

  const [filterFamily, setFilterFamily] = useState<Family>('site');
  const [filterValues, setFilterValues] = useState<string[]>([]);
  const [segmentFamily, setSegmentFamily] = useState<Family>('filiere');
  const [xFamily, setXFamily] = useState<Family>('mois_annee');
  const [yAxis, setYAxis] = useState<YAxis>('tonnage');

  // 1-hour bucket caching
  const hourBucket = useMemo(() => Math.floor(Date.now() / (60 * 60 * 1000)), []);

  const key = useMemo(() => {
    if (!entreprise_id || !clicked) return null;
    const type: TypeParam = 'bsd';
    const url = `/api/get_data_for_analysis?entreprise_id=${encodeURIComponent(entreprise_id)}&type=${type}`;
    return [`analysis-bsd`, entreprise_id, hourBucket, url] as const;
  }, [entreprise_id, clicked, hourBucket]);

  const { data, error, isLoading, mutate } = useSWR(
    key,
    ([, , , url]) => fetch(url, { cache: 'no-store' }).then<AnalysisResponse>(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }),
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      shouldRetryOnError: false,
      keepPreviousData: true,
    }
  );

  const onClick = useCallback(async () => {
    if (!entreprise_id) return;
    setClicked(true);
    if (!data && !isLoading && !error && key) {
      await mutate();
    }
  }, [entreprise_id, data, isLoading, error, mutate, key]);

  if (data) {
    // eslint-disable-next-line no-console
    console.log('Analyse BSD response:', data);
  }

  const allValuesByFamily = useMemo(() => {
    const d = data?.denominateur;
    const map: Record<Family, string[]> = {
      site: d ? d.unique_site.map(v => v.name && v.name.length > 0 ? v.name : v.siret) : [],
      exutoire: d ? d.unique_exutoire.map(v => v.name && v.name.length > 0 ? v.name : v.siret) : [],
      transport: d ? d.unique_transport.map(v => v.name && v.name.length > 0 ? v.name : v.siret) : [],
      filiere: d ? d.unique_filiere : [],
      mois_annee: d ? d.unique_mois_annee : [],
      contenant: d ? d.unique_contenant : [],
      code_dr: d ? d.unique_code_dr : [],
      valorisation: d?.unique_valorisation || [],
      tri: d?.unique_tri || [],
      rep: d?.unique_rep || [],
      source: d?.unique_source || [],
    };
    // Sort labels for deterministic UI
    (Object.keys(map) as Family[]).forEach(k => { map[k] = [...map[k]].sort(); });
    return map;
  }, [data]);

  const chartData = useMemo(() => {
    const rows = data?.data || [];
    
    // Apply filière filter from FilterContext
    const activeFiliereNames = (filieres || []).filter(f => f.checked).map(f => (f.name || '').trim()).filter(Boolean);
    const totalFiliereCount = (filieres || []).length;
    const shouldFilterByFiliere = totalFiliereCount > 0 && activeFiliereNames.length < totalFiliereCount;

    let filteredRows = rows;
    if (shouldFilterByFiliere) {
      filteredRows = rows.filter(r => activeFiliereNames.includes(r.filiere));
    }
    
    // Apply filters
    const filtered = filteredRows.filter(r => {
      if (filterValues.length === 0) return true;
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
      return filterValues.includes(valueByFamily[filterFamily]);
    });

    // X labels
    const xLabelsSet = new Set<string>();
    filtered.forEach(r => {
      const val = (
        xFamily === 'site' ? r.site :
        xFamily === 'exutoire' ? r.exutoire :
        xFamily === 'transport' ? r.transport :
        xFamily === 'filiere' ? r.filiere :
        xFamily === 'mois_annee' ? r.mois_annee :
        xFamily === 'contenant' ? r.contenant :
        xFamily === 'code_dr' ? r.code_dr :
        xFamily === 'valorisation' ? r.valorisation :
        xFamily === 'tri' ? r.tri :
        xFamily === 'rep' ? r.rep :
        r.source
      );
      if (val && val.length > 0) xLabelsSet.add(val);
    });
    const labels = Array.from(xLabelsSet).sort();

    // Segment keys
    const segmentSet = new Set<string>();
    filtered.forEach(r => {
      const val = (
        segmentFamily === 'site' ? r.site :
        segmentFamily === 'exutoire' ? r.exutoire :
        segmentFamily === 'transport' ? r.transport :
        segmentFamily === 'filiere' ? r.filiere :
        segmentFamily === 'mois_annee' ? r.mois_annee :
        segmentFamily === 'contenant' ? r.contenant :
        segmentFamily === 'code_dr' ? r.code_dr :
        segmentFamily === 'valorisation' ? r.valorisation :
        segmentFamily === 'tri' ? r.tri :
        segmentFamily === 'rep' ? r.rep :
        r.source
      );
      if (val && val.length > 0) segmentSet.add(val);
    });
    const segmentKeys = Array.from(segmentSet).sort();

    const colorFor = (idx: number): string => {
      const palette = [
        '#2563eb','#16a34a','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f97316','#ec4899','#10b981'
      ];
      return palette[idx % palette.length];
    };

    const datasets = segmentKeys.map((seg, i) => {
      const dataPoints = labels.map(lbl => {
        const subset = filtered.filter(r => {
          const segVal = (
            segmentFamily === 'site' ? r.site :
            segmentFamily === 'exutoire' ? r.exutoire :
            segmentFamily === 'transport' ? r.transport :
            segmentFamily === 'filiere' ? r.filiere :
            segmentFamily === 'mois_annee' ? r.mois_annee :
            segmentFamily === 'contenant' ? r.contenant :
            segmentFamily === 'code_dr' ? r.code_dr :
            segmentFamily === 'valorisation' ? r.valorisation :
            segmentFamily === 'tri' ? r.tri :
            segmentFamily === 'rep' ? r.rep :
            r.source
          );
          const xVal = (
            xFamily === 'site' ? r.site :
            xFamily === 'exutoire' ? r.exutoire :
            xFamily === 'transport' ? r.transport :
            xFamily === 'filiere' ? r.filiere :
            xFamily === 'mois_annee' ? r.mois_annee :
            xFamily === 'contenant' ? r.contenant :
            xFamily === 'code_dr' ? r.code_dr :
            xFamily === 'valorisation' ? r.valorisation :
            xFamily === 'tri' ? r.tri :
            xFamily === 'rep' ? r.rep :
            r.source
          );
          return segVal === seg && xVal === lbl;
        });
        if (yAxis === 'tonnage') {
          return subset.reduce((acc, r) => acc + r.tonnage, 0);
        } else if (yAxis === 'nbr_ligne') {
          return subset.reduce((acc, r) => acc + r.nbr_ligne, 0);
        }
        // remplissage: moyenne simple des pourcentages disponibles
        const fills = subset.map(s => s.remplissage).filter(v => typeof v === 'number' && !Number.isNaN(v)) as number[];
        if (fills.length === 0) return 0;
        return Number((fills.reduce((a, b) => a + b, 0) / fills.length).toFixed(1));
      });
      return {
        label: seg,
        data: dataPoints,
        backgroundColor: colorFor(i),
        borderColor: colorFor(i),
        borderWidth: 1,
      };
    });

    return { labels, datasets };
  }, [data, filterFamily, filterValues, segmentFamily, xFamily, yAxis, filieres]);

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={onClick}
        disabled={!entreprise_id || isLoading}
        className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
        title={!entreprise_id ? 'Aucune entreprise' : 'Lancer l\'analyse BSD'}
      >
        {isLoading ? 'Chargement...' : 'Analyse modulaire'}
      </button>

      {data && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm">Filtre:</label>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={filterFamily}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterFamily(e.target.value as Family)}
              >
                <option value="site">Site</option>
                <option value="exutoire">Exutoire</option>
                <option value="transport">Transport</option>
                <option value="filiere">Filière</option>
                <option value="mois_annee">Mois</option>
                <option value="contenant">Contenant</option>
                <option value="code_dr">Code DR</option>
                <option value="valorisation">Valorisation</option>
                <option value="tri">Tri</option>
                <option value="rep">REP</option>
                <option value="source">Source</option>
              </select>
              <select
                multiple
                className="border rounded px-2 py-1 text-sm min-w-[160px]"
                value={filterValues}
                onChange={e => setFilterValues(Array.from(e.target.selectedOptions).map(o => o.value))}
              >
                {(allValuesByFamily[filterFamily] || []).map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm">Segmentation:</label>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={segmentFamily}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSegmentFamily(e.target.value as Family)}
              >
                <option value="site">Site</option>
                <option value="exutoire">Exutoire</option>
                <option value="transport">Transport</option>
                <option value="filiere">Filière</option>
                <option value="mois_annee">Mois</option>
                <option value="contenant">Contenant</option>
                <option value="code_dr">Code DR</option>
                <option value="valorisation">Valorisation</option>
                <option value="tri">Tri</option>
                <option value="rep">REP</option>
                <option value="source">Source</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm">Axe X:</label>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={xFamily}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setXFamily(e.target.value as Family)}
              >
                <option value="site">Site</option>
                <option value="exutoire">Exutoire</option>
                <option value="transport">Transport</option>
                <option value="filiere">Filière</option>
                <option value="mois_annee">Mois</option>
                <option value="contenant">Contenant</option>
                <option value="code_dr">Code DR</option>
                <option value="valorisation">Valorisation</option>
                <option value="tri">Tri</option>
                <option value="rep">REP</option>
                <option value="source">Source</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm">Axe Y:</label>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={yAxis}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setYAxis(e.target.value as YAxis)}
              >
                <option value="tonnage">Tonnage</option>
                <option value="nbr_ligne">Nombre de lignes</option>
                <option value="remplissage">Remplissage (%)</option>
              </select>
            </div>
          </div>

          <div className="w-full">
            <Bar
              data={{ labels: chartData.labels, datasets: chartData.datasets }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top' as const },
                  title: { display: true, text: 'Analyse BSD' },
                },
                scales: {
                  x: { stacked: true },
                  y: { stacked: true }
                }
              }}
              height={360}
            />
          </div>
        </div>
      )}
    </div>
  );
}


