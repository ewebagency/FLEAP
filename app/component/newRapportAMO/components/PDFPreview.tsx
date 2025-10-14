"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnalysisResponse, ReportBuilderState, TableColumnKey } from "../types";
import { ChartRenderer } from "./ChartRenderer";
import { useSession } from "@/app/component/SessionProvider";
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import { useFilterContext } from "@/app/FilterContext";
import { performPdfExport } from "./pdfExportUtils";
import { usePdfAttachments } from "./usePdfAttachments";
import { useKpis } from "./useKpis";
import { filterBsdRows, hasMultipleSites } from "./PDFPreviewUtils";
import { applyFilterType } from "@/app/analysis/filterType";
import type { BsdItem } from "./PDFPreviewTypes";
import { LoadingProgressBar } from "./LoadingProgressBar";

interface Props {
  title: string;
  data: AnalysisResponse | undefined;
  state: ReportBuilderState;
  onExportComplete?: () => void;
  // Orchestration flags for sequential loading
  startLoadingBsd?: boolean;
  autoStartAttachments?: boolean;
  onBsdFullyLoaded?: () => void;
}

export function PDFPreview({ title, data, state, onExportComplete, startLoadingBsd = false, autoStartAttachments = false, onBsdFullyLoaded }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chartImages, setChartImages] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [pendingExport, setPendingExport] = useState(false);
  const { segmentDates, filieres } = useFilterContext();
  const { entreprise_name, entreprise_id, user_id } = useSession();

  // worker configured at module scope


  const selectedSirets: string[] = useMemo(() => {
    const sites = state.selectedSites;
    const denom = data?.denominateur?.unique_site || [];
    const map = new Map<string, string>();
    denom.forEach(d => map.set((d.name && d.name.length > 0) ? d.name : d.siret, d.siret));
    return sites.map(s => map.get(s) || ( /^\d{9,}$/.test(s) ? s : '' )).filter(Boolean);
  }, [state.selectedSites, data]);

  // Paginated fetch of BSDs (server returns max 200 per call). Auto-fetch pages until no more.
  const getBsdKey = useCallback((pageIndex: number, previousPageData: { data: BsdItem[]; hasMore?: boolean } | null) => {
    if (!entreprise_id || !user_id) return null;
    if (!startLoadingBsd) return null; // gated by parent orchestrator
    if (previousPageData && previousPageData.hasMore === false) return null;
    const params = new URLSearchParams();
    params.set('entreprise_id', entreprise_id);
    params.set('user_id', user_id);
    // Pass date range to bypass cache path and align server filtering with UI period
    if (segmentDates?.debut) params.set('startDate', new Date(segmentDates.debut).toISOString());
    if (segmentDates?.fin) params.set('endDate', new Date(segmentDates.fin).toISOString());
    if (pageIndex > 0 && previousPageData && previousPageData.data && previousPageData.data.length > 0) {
      const last = previousPageData.data[previousPageData.data.length - 1];
      params.set('lastDate', last.created_at);
      params.set('lastId', last.id);
    }
    return ['/api/get_data_bsd', params.toString()] as const;
  }, [entreprise_id, user_id, segmentDates, startLoadingBsd]);

  const { data: bsdPages, setSize } = useSWRInfinite(
    getBsdKey,
    ([base, qs]: readonly [string, string]) => {
      const url = `${base}?${qs}`;
      try { console.log('[RapportAMO] Fetch BSD page', { url }); } catch {}
      return fetch(url, { cache: 'no-store' }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ data: BsdItem[]; hasMore?: boolean; totalCount?: number }>; 
      });
    },
    { revalidateOnFocus: false, revalidateIfStale: false, keepPreviousData: true }
  );

  // Auto-load all pages up to a sane cap
  useEffect(() => {
    if (!startLoadingBsd) return;
    if (!bsdPages || bsdPages.length === 0) return;
    const last = bsdPages[bsdPages.length - 1];
    if (last && last.hasMore) {
      if (bsdPages.length < 50) setSize((n: number) => n + 1);
    }
  }, [bsdPages, setSize, startLoadingBsd]);

  // Debug pagination status
  useEffect(() => {
    try {
      const pages = bsdPages?.length || 0;
      const totals = (bsdPages || []).map((p: { data?: unknown[]; hasMore?: boolean }, i: number) => ({ idx: i, count: p?.data?.length || 0, hasMore: !!p?.hasMore }));
      const totalRows = totals.reduce((a, b) => a + b.count, 0);
      const lastHasMore = pages > 0 ? !!(bsdPages![pages - 1] as { hasMore?: boolean }).hasMore : false;
      console.log('[RapportAMO] BSD pagination status', { pages, totalRows, lastHasMore, pageDetails: totals });
    } catch {}
  }, [bsdPages]);

  // Mapping tables needed by calculateTauxTri
  const mappingNomKey = useMemo(() => entreprise_id ? ['/api/get_mapping_nom_filiere', entreprise_id] as const : null, [entreprise_id]);
  const { data: mappingNomResp } = useSWR(mappingNomKey, ([base, id]) => fetch(`${base}?entreprise_id=${encodeURIComponent(id)}`).then(r => r.json() as Promise<{ data: Array<{ nom?: string; filiere: string; trie?: boolean }> }>), { revalidateOnFocus: false });

  const tableRows: BsdItem[] = useMemo(() => {
    const rows = (bsdPages || []).flatMap((p: { data: BsdItem[] } | undefined) => p?.data || []);
    const dateRange = segmentDates ? {
      debut: segmentDates.debut?.toISOString(),
      fin: segmentDates.fin?.toISOString()
    } : undefined;
    const base = filterBsdRows(rows, state, selectedSirets, dateRange, state.filterType || 'imported');

    // Apply filière filter from FilterContext (FiltreFilieresNom / Filtre CED)
    const activeFiliereNames = (filieres || []).filter(f => f.checked).map(f => (f.name || '').trim()).filter(Boolean);
    const totalFiliereCount = (filieres || []).length;
    const shouldFilterByFiliere = totalFiliereCount > 0 && activeFiliereNames.length < totalFiliereCount;


    if (!shouldFilterByFiliere) {
      return base;
    }

    const mapping = (mappingNomResp?.data || []).map(m => ({ nom: (m.nom || '').trim(), filiere: m.filiere }));
    const getFiliereForRow = (b: BsdItem): string => {
      const name = (b.infos_json?.formAPI?.createFormInput?.wasteDetails?.name || '').trim();
      if (!name) return 'Autres';
      const found = mapping.find(m => m.nom === name);
      return found?.filiere || 'Autres';
    };

    return base.filter(b => activeFiliereNames.includes(getFiliereForRow(b)));
  }, [bsdPages, state, selectedSirets, segmentDates, filieres, mappingNomResp]);

  const hasMultipleSitesValue = useMemo(() => hasMultipleSites(tableRows), [tableRows]);

  const [attachmentsRequested, setAttachmentsRequested] = useState(false);
  
  // Use custom hook for PDF attachments
  const {
    attachedPdfs,
    renderedAttachments,
    attachmentsLoading,
    downloadComplete,
    totalExpected,
    readyCount,
    allAttachmentsReady,
    resetAttachments,
  } = usePdfAttachments(tableRows, state, attachmentsRequested);

  // Derive loading phase from hook state (download first, then render)
  const loadingPhase: 'idle' | 'downloading' | 'rendering' | 'done' = useMemo(() => {
    if (!attachmentsRequested || !state.exportOptions.includeLinePdfs) return 'idle';
    if (!downloadComplete) return 'downloading';
    if (downloadComplete && !allAttachmentsReady) return 'rendering';
    if (allAttachmentsReady) return 'done';
    return 'idle';
  }, [attachmentsRequested, state.exportOptions.includeLinePdfs, downloadComplete, allAttachmentsReady]);

  // Downloaded count is the number of PDFs that have been fetched
  const downloadedCount = useMemo(() => attachedPdfs.length, [attachedPdfs.length]);


  // BSDs for KPI calculation: follow selected filterType (all/imported/registres)
  const filteredBsdsForKpi = useMemo(() => {
    return applyFilterType(tableRows, state.filterType || 'imported', {
      getStatus: (it: BsdItem) => it.status_track_dechets,
      getCreatedOnFleap: (it: BsdItem) => it.created_on_fleap,
    }) as BsdItem[];
  }, [tableRows, state.filterType]);

  // Use custom hook for KPIs
  const segmentDateStrings = useMemo(() => {
    if (!segmentDates) return undefined;
    return {
      debut: segmentDates.debut ? segmentDates.debut.toISOString() : undefined,
      fin: segmentDates.fin ? segmentDates.fin.toISOString() : undefined,
    } as { debut?: string; fin?: string } | undefined;
  }, [segmentDates]);

  const kpis = useKpis(filteredBsdsForKpi, mappingNomResp || null, segmentDateStrings);

  // Invalidate captured images when chart definitions change
  const chartsString = JSON.stringify(state.charts);
  useEffect(() => {
    setChartImages({});
  }, [chartsString]);

  // Charts readiness tracking
  const expectedChartIds = useMemo(() => state.charts.filter(c => c.type !== 'table').map(c => c.id), [state.charts]);
  const readyChartsCount = useMemo(() => expectedChartIds.filter(id => Boolean(chartImages[id])).length, [expectedChartIds, chartImages]);
  const allChartsReady = useMemo(() => !state.exportOptions.includeCharts || expectedChartIds.length === 0 || readyChartsCount === expectedChartIds.length, [state.exportOptions.includeCharts, expectedChartIds, readyChartsCount]);

  const lastPageHasMore = useMemo(() => {
    if (!bsdPages || bsdPages.length === 0) return true;
    const last = bsdPages[bsdPages.length - 1] as { hasMore?: boolean };
    return !!(last && last.hasMore);
  }, [bsdPages]);

  // Notify parent when BSDs fully loaded; optionally auto-start attachments
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (!startLoadingBsd) return;
    if (!bsdPages || bsdPages.length === 0) return;
    if (lastPageHasMore) return;
    if (!notifiedRef.current) {
      notifiedRef.current = true;
      try { onBsdFullyLoaded?.(); } catch {}
      if (autoStartAttachments && state.exportOptions.includeLinePdfs && state.selectedSites && state.selectedSites.length > 0) {
        setAttachmentsRequested(true);
        resetAttachments();
      }
    }
  }, [startLoadingBsd, bsdPages, lastPageHasMore, onBsdFullyLoaded, autoStartAttachments, state.exportOptions.includeLinePdfs, state.selectedSites, resetAttachments]);

  const onExport = useCallback(() => {
    // Trigger loading and defer the actual export until ready via effect
    if (!containerRef.current || isExporting) return;
    if (!startLoadingBsd) return; // must start loading first
    if (lastPageHasMore) return; // block until all BSD pages loaded
    if (!allChartsReady || !allAttachmentsReady) return;
    setPendingExport(true);
  }, [containerRef, isExporting, startLoadingBsd, lastPageHasMore, allChartsReady, allAttachmentsReady]);

  const onPrepare = useCallback(() => {
    // Start loading attachments and allow chart capture to proceed
    if (!state.exportOptions.includeLinePdfs) return;
    if (!state.selectedSites || state.selectedSites.length === 0) return;
    setAttachmentsRequested(true);
    // reset previous state for a fresh run
    resetAttachments();
  }, [state.exportOptions.includeLinePdfs, state.selectedSites, resetAttachments]);

  const performExport = useCallback(async () => {
    if (!containerRef.current) return;
    setIsExporting(true);
    try {
      try {
        console.log('[RapportAMO] Print run — attachments rendered:', renderedAttachments.length);
      } catch {}
      await performPdfExport(containerRef, title, onExportComplete);
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
    } finally {
      setIsExporting(false);
      setPendingExport(false);
    }
  }, [containerRef, title, onExportComplete, renderedAttachments.length]);

  // When export is pending, wait until both charts and attachments are ready, then perform export
  useEffect(() => {
    if (!pendingExport) return;
    if (allChartsReady && allAttachmentsReady) {
      performExport();
    }
  }, [pendingExport, allChartsReady, allAttachmentsReady, performExport]);

  // Auto-export si onExportComplete est fourni
  useEffect(() => {
    if (onExportComplete && data) {
      setAttachmentsRequested(true);
      setPendingExport(true);
    }
  }, [onExportComplete, data]);

  return (
    <div>
      <div className="flex flex-col items-center gap-3 mb-2">
        <div className="flex items-center gap-2">
          {state.exportOptions.includeLinePdfs && !attachmentsRequested && startLoadingBsd && !lastPageHasMore ? (
            <button 
              className={`px-4 py-2 rounded text-white text-base flex items-center gap-2 ${
                isExporting
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`} 
              onClick={onPrepare}
              title="Prépare les pièces pour l'export"
            >
              {(attachmentsLoading && !allAttachmentsReady) && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              Préparer les PDFs
            </button>
          ) : null}
          {(!state.exportOptions.includeLinePdfs || attachmentsRequested) && (
            <button 
              className={`px-4 py-2 rounded text-white text-base flex items-center gap-2 ${
                isExporting 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`} 
              onClick={onExport}
              disabled={
                isExporting
                || !startLoadingBsd
                || lastPageHasMore
                || (state.exportOptions.includeLinePdfs && !allAttachmentsReady)
                || (state.exportOptions.includeCharts && !allChartsReady)
              }
            >
              {isExporting && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              {isExporting
                ? 'Export en cours…'
                : (!startLoadingBsd
                  ? 'Démarrer le chargement'
                  : lastPageHasMore
                    ? 'Chargement des données…'
                    : (state.exportOptions.includeLinePdfs && attachmentsRequested && !allAttachmentsReady)
                      ? 'Données en préparation…'
                      : 'Exporter le PDF')}
            </button>
          )}
        </div>
        
        {/* Barre de progression pour le chargement des PDFs */}
        {state.exportOptions.includeLinePdfs && attachmentsRequested && loadingPhase !== 'idle' && (
          <div className="w-full">
            <LoadingProgressBar
              phase={loadingPhase}
              downloadProgress={totalExpected > 0 ? (downloadedCount / totalExpected) * 100 : 0}
              renderProgress={totalExpected > 0 ? (readyCount / totalExpected) * 100 : 0}
              totalExpected={totalExpected}
              downloadedCount={downloadedCount}
              renderedCount={readyCount}
            />
          </div>
        )}
        
        {(state.exportOptions.includeLinePdfs || (state.exportOptions.includeCharts && expectedChartIds.length > 0)) && (
          <div className="text-sm text-gray-600 ml-3">
            {state.exportOptions.includeCharts && expectedChartIds.length > 0 ? (
              <span>Graphiques: {readyChartsCount}/{expectedChartIds.length}{!allChartsReady ? ' (chargement)' : ' (prêts)'}{state.exportOptions.includeLinePdfs ? ' · ' : ''}</span>
            ) : null}
            {state.exportOptions.includeLinePdfs ? (
              <span>Pièces: {readyCount}/{totalExpected}{attachmentsLoading ? ' (chargement)' : (allAttachmentsReady ? ' (prêt)' : '')}</span>
            ) : null}
          </div>
        )}
      </div>
      <div ref={containerRef} className="space-y-3" style={{ display: 'none' }}>
        {state.exportOptions.includeLinePdfs && attachmentsLoading && (
          <div style={{fontSize:12, color:'#6b7280'}}>Chargement des pièces jointes…</div>
        )}
        {state.exportOptions.includeTitle && (
          <div className="header-grid">
            <div>
              <div className="title mb-4">{title}</div>
              <div className="subtitle">{entreprise_name || 'Entreprise'}</div>
            </div>
            <div>
              <div className="meta">
                {segmentDates?.debut ? new Date(segmentDates.debut).toLocaleDateString() : '—'}
                {' '}→{' '}
                {segmentDates?.fin ? new Date(segmentDates.fin).toLocaleDateString() : new Date().toLocaleDateString()}
              </div>
              <div className="sites">
                {state.selectedSites.length > 0 ? (
                  <ul>
                    {state.selectedSites.map(s => {
                      // Find SIRET for this site name
                      const denom = data?.denominateur?.unique_site || [];
                      const found = denom.find(d => (d.name && d.name.length > 0 ? d.name : d.siret) === s);
                      const siret = found?.siret || '';
                      return (
                        <li key={s}>{s}{siret ? ` (${siret})` : ''}</li>
                      );
                    })}
                  </ul>
                ) : (
                  <ul>
                    <li>Tous les sites</li>
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {state.exportOptions.includeKPIs && (
          <div className="kpi-grid">
            <div className="kpi">
              <div className="label">Tonnage total</div>
              <div className="value">{kpis ? `${kpis.tonnage.toFixed(1)}T` : '-'}</div>
            </div>
            <div className="kpi">
              <div className="label">Valorisation globale</div>
              <div className="value">{kpis ? `${kpis.valoGlobale}%` : '-'}</div>
            </div>
            <div className="kpi">
              <div className="label">Tri global</div>
              <div className="value">{kpis ? `${kpis.triGlobal}%` : '-'}</div>
            </div>
            <div className="kpi">
              <div className="label">Valorisation énergétique</div>
              <div className="value">{kpis ? `${kpis.valoEnergie}%` : '-'}</div>
            </div>
            <div className="kpi">
              <div className="label">Valorisation matière</div>
              <div className="value">{kpis ? `${kpis.valoMatiere}%` : '-'}</div>
            </div>
            <div className="kpi">
              <div className="label">Tri sur site</div>
              <div className="value">{kpis ? `${kpis.triSite}%` : '-'}</div>
            </div>
          </div>
        )}

        {state.exportOptions.includeCharts && state.charts.length > 0 && (
          <div className="charts">
            {state.charts.map(c => (
              <div key={c.id} className="chart">
                {c.title && c.title.trim().toLowerCase() !== 'graphique' && (
                  <div className="chart-title">{c.title}</div>
                )}
                {c.type === 'table' ? (
                  <div className="overflow-auto">
                    <ChartRenderer config={c} data={data} />
                  </div>
                ) : chartImages[c.id] ? (
                  <img className="chart-img" src={chartImages[c.id]} alt={c.title} />
                ) : (
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                    <div style={{fontSize:12,color:'#6b7280'}}>Préparation du graphique…</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {state.exportOptions.includeTable && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {(() => {
                    const cols: TableColumnKey[] = (state.exportOptions.tableColumns && state.exportOptions.tableColumns.length > 0)
                      ? state.exportOptions.tableColumns
                      : ['doc','date','site','waste','ced','qty','treatment','exutoire'];
                    return cols.map((col, idx) => {
                      if (col === 'site' && !hasMultipleSitesValue) return null;
                      if (col === 'attachments' && !state.exportOptions.includeLinePdfs) return null;
                      const label = (
                        col === 'doc' ? 'BSD/Bon' :
                        col === 'nBon' ? 'N° Bon' :
                        col === 'nFacture' ? 'N° Facture' :
                        col === 'date' ? 'Date' :
                        col === 'site' ? 'Site' :
                        col === 'site_siret' ? 'SIRET site' :
                        col === 'waste' ? 'Déchet' :
                        col === 'ced' ? 'CED' :
                        col === 'qty' ? 'Tonnage' :
                        col === 'treatment' ? 'Traitement' :
                        col === 'exutoire' ? 'Exutoire' :
                        col === 'exutoire_siret' ? 'SIRET destinataire' :
                        col === 'exutoire_address' ? 'Adresse destinataire' :
                        col === 'transport_name' ? 'Transporteur' :
                        col === 'transport_siret' ? 'SIRET transporteur' :
                        col === 'receipt' ? 'N° récépissé' :
                        col === 'numberPlate' ? 'Immatriculation' :
                        col === 'containerDescription' ? 'Contenant' :
                        col === 'attachments' ? 'Pièces' : ''
                      );
                      const className = col === 'ced' ? 'col-ced' : (col === 'qty' ? 'num' : undefined);
                      return <th key={`${col}_${idx}`} className={className}>{label}</th>;
                    });
                  })()}
                </tr>
              </thead>
              <tbody>
                {tableRows.slice(0, 800).map((b, i) => {
                  const ci = b.infos_json.formAPI.createFormInput;
                  const dateStr = ci.takenOverAt ? new Date(ci.takenOverAt).toLocaleDateString() : new Date(b.created_at).toLocaleDateString();
                  const qty = Number(ci.quantityReceived || ci.wasteDetails.quantity || 0) || 0;
                  const digitsInReadable = (b.readable_id_track_dechets || '').replace(/\D/g, '').length;
                  const hasReadableId = digitsInReadable > 4;
                  const numeroBon = b.other_infos?.numeroBon || b.facture_infos?.numeroFacture;
                  
                  let docId = '-';
                  let docType = '';
                  
                  if (hasReadableId) {
                    docId = b.readable_id_track_dechets;
                    docType = 'N°BSD';
                  } else if (numeroBon) {
                    docId = numeroBon;
                    docType = 'N°Bon';
                  }
                  const cols: TableColumnKey[] = (state.exportOptions.tableColumns && state.exportOptions.tableColumns.length > 0)
                    ? state.exportOptions.tableColumns
                    : ['doc','date','site','waste','ced','qty','treatment','exutoire'];
                  return (
                    <tr key={i}>
                      {cols.map((col, idx2) => {
                        if (col === 'site' && !hasMultipleSitesValue) return null;
                        if (col === 'attachments' && !state.exportOptions.includeLinePdfs) return null;
                        if (col === 'doc') return <td key={`c_${idx2}`}>{docId}{docType ? ` (${docType})` : ''}</td>;
                        if (col === 'nBon') return <td key={`c_${idx2}`}>{b.other_infos?.numeroBon || ''}</td>;
                        if (col === 'nFacture') return <td key={`c_${idx2}`}>{b.facture_infos?.numeroFacture || ''}</td>;
                        if (col === 'date') return <td key={`c_${idx2}`}>{dateStr}</td>;
                        if (col === 'site') return <td key={`c_${idx2}`}>{ci.emitter.company.name}</td>;
                        if (col === 'site_siret') return <td key={`c_${idx2}`}>{ci.emitter.company.siret}</td>;
                        if (col === 'waste') return <td key={`c_${idx2}`}>{ci.wasteDetails.name}</td>;
                        if (col === 'ced') return <td key={`c_${idx2}`}>{ci.wasteDetails.code}</td>;
                        if (col === 'qty') return <td key={`c_${idx2}`} className="num">{qty.toFixed(2)}</td>;
                        if (col === 'treatment') return <td key={`c_${idx2}`}>{ci.recipient.processingOperation}</td>;
                        if (col === 'exutoire') return <td key={`c_${idx2}`}>{ci.recipient.company.name}</td>;
                        if (col === 'exutoire_siret') return <td key={`c_${idx2}`}>{ci.recipient.company.siret}</td>;
                        if (col === 'exutoire_address') return <td key={`c_${idx2}`}>{ci.recipient.company.address || ''}</td>;
                        if (col === 'transport_name') return <td key={`c_${idx2}`}>{ci.transporter?.company?.name || ''}</td>;
                        if (col === 'transport_siret') return <td key={`c_${idx2}`}>{ci.transporter?.company?.siret || ''}</td>;
                        if (col === 'receipt') return <td key={`c_${idx2}`}>{ci.transporter?.receipt || ''}</td>;
                        if (col === 'numberPlate') return <td key={`c_${idx2}`}>{ci.transporter?.numberPlate || ''}</td>;
                        if (col === 'containerDescription') return <td key={`c_${idx2}`}>{b.other_infos?.containerDescription || ''}</td>;
                        if (col === 'attachments') {
                          return (
                            <td key={`c_${idx2}`}>
                          {(b.pdf_ids && b.pdf_ids.length > 0) ? (
                            <a 
                              href={`#pdf-${b.id}`} 
                              style={{color: '#2563eb', textDecoration: 'underline', cursor: 'pointer'}}
                              onClick={(e) => {
                                e.preventDefault();
                                const element = document.getElementById(`pdf-${b.id}`);
                                if (element) {
                                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }
                              }}
                            >
                              Oui
                            </a>
                          ) : (
                            <span style={{color:'#6b7280'}}>—</span>
                          )}
                        </td>
                          );
                        }
                        return null;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {state.exportOptions.includeLinePdfs && renderedAttachments.length > 0 && (
          <div className="attachments">
            {renderedAttachments.map((p, idx) => {
              // Find the corresponding BSD row to get the document info
              const correspondingRow = tableRows.find(row => row.pdf_ids?.includes(p.id));
              let attachmentTitle = 'Pièce jointe';
              let attachmentId = `pdf-${p.id}`;
              
              if (correspondingRow) {
                const digitsInReadable = (correspondingRow.readable_id_track_dechets || '').replace(/\D/g, '').length;
                const hasReadableId = digitsInReadable > 4;
                const numeroBon = correspondingRow.other_infos?.numeroBon || correspondingRow.facture_infos?.numeroFacture;
                
                let docId = '-';
                let docType = '';
                
                if (hasReadableId) {
                  docId = correspondingRow.readable_id_track_dechets;
                  docType = 'N°BSD';
                } else if (numeroBon) {
                  docId = numeroBon;
                  docType = 'N°Bon';
                }
                
                attachmentTitle = `${docId}${docType ? ` (${docType})` : ''}`;
                attachmentId = `pdf-${correspondingRow.id}`;
              }
              
              return (
                <div key={`${p.id}_${idx}`} id={attachmentId} className="attachment-item">
                  <div className="attachment-title">{attachmentTitle}</div>
                  <div>
                    {p.images.map((img, i) => (
                      <div key={`${p.id}_page_${i}`} style={{ pageBreakInside: 'avoid', marginBottom: 8 }}>
                        <img src={img} alt={`${attachmentTitle} page ${i + 1}`} style={{ width: '100%', height: 'auto' }} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hidden render for chart capture */}
      {state.exportOptions.includeCharts && state.charts.length > 0 && (
        <div style={{ position: 'absolute', left: -99999, top: -99999 }} aria-hidden>
          {state.charts.filter(chart => chart.type !== 'table').map(chart => (
            <div key={`capture_${chart.id}`}>
              <ChartRenderer
                config={chart}
                data={data}
                exportImage
                onExportImage={(id, url) => setChartImages(prev => ({ ...prev, [id]: url }))}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

