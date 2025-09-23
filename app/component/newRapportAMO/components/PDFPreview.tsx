"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnalysisResponse, ReportBuilderState } from "../types";
import { ChartRenderer } from "./ChartRenderer";
import { useAnalysis } from "@/app/analysis/AnalysisProvider";
import { calculateTauxTri } from "@/app/component/Analyse/Operationelle/TauxTri";
import { calculateTauxValorisation } from "@/app/component/Analyse/Environnementale/TauxValorisation";
import { useSession } from "@/app/component/SessionProvider";
import useSWR from 'swr';
import { useFilterContext } from "@/app/FilterContext";
import { supabase } from "@/app/database/supabaseClient";

interface Props {
  title: string;
  data: AnalysisResponse | undefined;
  state: ReportBuilderState;
  onExportComplete?: () => void;
}

export function PDFPreview({ title, data, state, onExportComplete }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chartImages, setChartImages] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [pendingExport, setPendingExport] = useState(false);
  const { bsds, mappingTable, filieres_ou_prestataires, filterType } = useAnalysis();
  const { segmentDates } = useFilterContext();
  const { entreprise_name } = useSession();

  // worker configured at module scope

  // BSD lines for the detailed table fetched from /api/get_data_bsd
  interface BsdCompany { orgId: string; siret: string; name: string }
  interface BsdItem {
    id: string;
    readable_id_track_dechets: string;
    created_at: string;
    other_infos?: { numeroBon?: string };
    facture_infos?: { numeroFacture?: string };
    pdf_ids?: string[];
    infos_json: {
      formAPI: {
        createFormInput: {
          takenOverAt: string;
          recipient: { processingOperation: string; company: BsdCompany };
          emitter: { company: BsdCompany };
          wasteDetails: { name: string; code: string; quantity: string };
          quantityReceived?: string;
        }
      }
    }
  }

  // Extra fields that may be present for import/origin detection
  type ImportableBsd = BsdItem & {
    created_on_fleap?: boolean;
    status_track_dechets?: string;
    source?: string;
  };

  const selectedSirets: string[] = useMemo(() => {
    const sites = state.selectedSites;
    const denom = data?.denominateur?.unique_site || [];
    const map = new Map<string, string>();
    denom.forEach(d => map.set((d.name && d.name.length > 0) ? d.name : d.siret, d.siret));
    return sites.map(s => map.get(s) || ( /^\d{9,}$/.test(s) ? s : '' )).filter(Boolean);
  }, [state.selectedSites, data]);

  const { user_id, entreprise_id } = useSession();
  const bsdKey = useMemo(() => {
    if (!entreprise_id || !user_id) return null;
    const params = new URLSearchParams();
    params.set('entreprise_id', entreprise_id);
    params.set('user_id', user_id);
    // No server-side filters; everything filtered client-side
    return ['/api/get_data_bsd', params.toString()] as const;
  }, [entreprise_id, user_id]);

  const { data: bsdResp } = useSWR(bsdKey, ([base, qs]) => fetch(`${base}?${qs}`, { cache: 'no-store' }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<{ data: BsdItem[] }>;
  }), { revalidateOnFocus: false, keepPreviousData: true });

  const tableRows: BsdItem[] = useMemo(() => {
    const rows = bsdResp?.data || [];

    // Dates boundaries from FilterContext
    const startMs = segmentDates?.debut ? new Date(segmentDates.debut).setHours(0,0,0,0) : null;
    const endMs = segmentDates?.fin ? new Date(segmentDates.fin).setHours(23,59,59,999) : null;

    const inRange = (b: BsdItem) => {
      const ci = b.infos_json.formAPI.createFormInput;
      const raw = ci.takenOverAt || b.created_at;
      if (!raw) return true;
      const t = new Date(raw).getTime();
      if (Number.isNaN(t)) return true;
      if (startMs && t < startMs) return false;
      if (endMs && t > endMs) return false;
      return true;
    };

    const siteFiltered = (() => {
      if (selectedSirets.length <= 1 && state.selectedSites.length === 0) return rows;
      const selectedSet = new Set(state.selectedSites);
      const siretSet = new Set(selectedSirets);
      return rows.filter(b => selectedSet.size === 0
        || selectedSet.has(b.infos_json.formAPI.createFormInput.emitter.company.name)
        || siretSet.has(b.infos_json.formAPI.createFormInput.emitter.company.siret)
      );
    })();

    // Imported filter: keep rows recognized as imported (best-effort)
    const isImported = (b: ImportableBsd) => {
      if (typeof b.created_on_fleap === 'boolean') return b.created_on_fleap === false;
      if (typeof b.status_track_dechets === 'string') return b.status_track_dechets === 'IMPORTED';
      if (typeof b.source === 'string') return b.source.toLowerCase() !== 'demande';
      return true; // if unknown, don't exclude
    };

    return siteFiltered.filter(b => inRange(b)).filter(b => filterType === 'imported' ? isImported(b) : true);
  }, [bsdResp, state.selectedSites, selectedSirets, segmentDates, filterType]);

  const hasMultipleSites = useMemo(() => {
    try {
      const names = new Set<string>();
      tableRows.forEach(b => {
        const n = b.infos_json.formAPI.createFormInput.emitter.company.name || '';
        if (n) names.add(n);
      });
      return names.size > 1;
    } catch {
      return false;
    }
  }, [tableRows]);

  // Fetch raw PDF buffers and render them as images for reliable printing
  const [attachedPdfs, setAttachedPdfs] = useState<Array<{ id: string; data: ArrayBuffer }>>([]);
  const [renderedAttachments, setRenderedAttachments] = useState<Array<{ id: string; images: string[] }>>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsRequested, setAttachmentsRequested] = useState(false);

  // Expected vs rendered attachments tracking
  const expectedPdfIds = useMemo(() => {
    if (!state.exportOptions.includeLinePdfs) return new Set<string>();
    const allIds = Array.from(new Set((tableRows.flatMap(r => r.pdf_ids || [])).filter(Boolean)));
    return new Set(allIds);
  }, [state.exportOptions.includeLinePdfs, tableRows]);

  const { totalExpected, readyCount, allAttachmentsReady } = useMemo(() => {
    const expected = expectedPdfIds;
    const rendered = new Set(renderedAttachments.map(a => a.id));
    let count = 0;
    expected.forEach(id => { if (rendered.has(id)) count += 1; });
    const total = expected.size;
    const ready = !state.exportOptions.includeLinePdfs || total === 0 || (count === total && !attachmentsLoading);
    return { totalExpected: total, readyCount: count, allAttachmentsReady: ready };
  }, [expectedPdfIds, renderedAttachments, attachmentsLoading, state.exportOptions.includeLinePdfs]);

  useEffect(() => {
    const loadPdfUrls = async () => {
      console.log('🔍 PDF load effect triggered:', { 
        includeLinePdfs: state.exportOptions.includeLinePdfs, 
        tableRowsCount: tableRows.length 
      });
      
      if (!state.exportOptions.includeLinePdfs) { 
        console.log('❌ PDF option disabled');
        setAttachedPdfs([]); 
        setRenderedAttachments([]); 
        return; 
      }
      
      const allIds = Array.from(new Set((tableRows.flatMap(r => r.pdf_ids || [])).filter(Boolean)));
      console.log('📋 Found PDF IDs in table rows:', allIds);
      
      if (allIds.length === 0) { 
        console.log('❌ No PDF IDs found in table rows');
        setAttachedPdfs([]); 
        setRenderedAttachments([]); 
        return; 
      }
      
      try {
        setAttachmentsLoading(true);
        console.log('🔍 Fetching PDF info from Supabase...');
        const { data: infos, error } = await supabase
          .from('pdf_infos')
          .select('id, name_pdf_in_bucket')
          .in('id', allIds);
          
        if (error) {
          console.error('❌ Erreur récupération pdf_infos:', error);
          setAttachedPdfs([]); 
          setRenderedAttachments([]); 
          return;
        }
        
        console.log('📄 PDF infos found:', infos?.length || 0);
        
        const embeds: Array<{ id: string; data: ArrayBuffer }> = [];
        for (const info of infos || []) {
          const cast = info as { id: string; name_pdf_in_bucket?: string };
          if (!cast || !cast.name_pdf_in_bucket) {
            console.log('⚠️ Skipping PDF info without bucket name:', cast);
            continue;
          }
          
          console.log('📥 Downloading PDF from bucket:', cast.name_pdf_in_bucket);
          // First try raw name
          let fileData: Blob | null = null;
          let dlErr: unknown = null;
          try {
            const res = await supabase.storage.from('pdfs_bucket').download(cast.name_pdf_in_bucket);
            fileData = (res as unknown as { data?: Blob }).data || null;
            dlErr = (res as unknown as { error?: unknown }).error;
          } catch (e) {
            dlErr = e;
          }
          // Fallback: try encoded path if raw fails
          if (!fileData) {
            try {
              const res2 = await supabase.storage.from('pdfs_bucket').download(encodeURIComponent(cast.name_pdf_in_bucket));
              fileData = (res2 as unknown as { data?: Blob }).data || null;
              dlErr = (res2 as unknown as { error?: unknown }).error;
            } catch (e2) {
              dlErr = e2;
            }
          }
          
          if (!fileData) {
            console.error('❌ Failed to download PDF (raw and encoded):', cast.name_pdf_in_bucket, dlErr);
            continue;
          }
          
          const buf = await fileData.arrayBuffer();
          embeds.push({ id: cast.id, data: buf });
          console.log('✅ PDF downloaded and buffered:', cast.id, 'size:', buf.byteLength);
        }
        
        console.log('🎉 Total PDFs loaded:', embeds.length);
        setAttachedPdfs(embeds);
      } catch (e) {
        console.error('❌ Erreur génération URLs PDF:', e);
        setAttachedPdfs([]);
        setRenderedAttachments([]);
      } finally {
        // keep true until render finishes; render effect will set false when done
      }
    };

    if (attachmentsRequested) {
      loadPdfUrls();
    }
  }, [state.exportOptions.includeLinePdfs, tableRows, attachmentsRequested]);

  // Render attached PDFs into images for robust printing
  useEffect(() => {
    const run = async () => {
      console.log('🔍 PDF render effect triggered:', { 
        includeLinePdfs: state.exportOptions.includeLinePdfs, 
        attachedPdfsCount: attachedPdfs.length 
      });
      
      if (!state.exportOptions.includeLinePdfs || attachedPdfs.length === 0) {
        console.log('❌ No PDFs to render or option disabled');
        setRenderedAttachments([]);
        setAttachmentsLoading(false);
        return;
      }
      
      setAttachmentsLoading(true);
      console.log('📄 Starting PDF rendering for', attachedPdfs.length, 'PDFs');
      
      try {
        // Dynamically import pdf.js in the client
        console.log('📦 Importing pdf.js...');
        // @ts-expect-error - pdfjs-dist types are not available but the module works
        const pdfjsModule = await import('pdfjs-dist/build/pdf');
        const pdfjsGlobal = pdfjsModule as unknown as {
          GlobalWorkerOptions: { workerSrc: string };
          getDocument: (params: { data: ArrayBuffer }) => { promise: Promise<PdfJsDocument> };
        };
        // Use the local worker that matches the installed version
        pdfjsGlobal.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.mjs';
        
        // Fallback: disable worker if it fails
        try {
          await fetch('/pdfjs/pdf.worker.mjs');
        } catch {
          console.log('⚠️ Worker not accessible, using fallback');
          pdfjsGlobal.GlobalWorkerOptions.workerSrc = '';
        }
        console.log('✅ PDF.js worker configured');

        interface PdfJsViewport { width: number; height: number }
        interface PdfJsRenderTask { promise: Promise<void> }
        interface PdfJsPage {
          getViewport: (params: { scale: number }) => PdfJsViewport;
          render: (args: { canvasContext: CanvasRenderingContext2D; viewport: PdfJsViewport }) => PdfJsRenderTask;
        }
        interface PdfJsDocument { numPages: number; getPage: (n: number) => Promise<PdfJsPage> }
        
        const results: Array<{ id: string; images: string[] }> = [];
        for (const p of attachedPdfs) {
          try {
            console.log('🔄 Processing PDF:', p.id);
            const loadingTask = pdfjsGlobal.getDocument({ data: p.data });
            const pdf = await loadingTask.promise;
            console.log('📖 PDF loaded, pages:', pdf.numPages);
            
            const maxPages = Math.min(pdf.numPages, 50);
            const images: string[] = [];
            for (let i = 1; i <= maxPages; i++) {
              console.log(`🖼️ Rendering page ${i}/${maxPages}`);
              const page = await pdf.getPage(i);
              const viewport = page.getViewport({ scale: 1.2 });
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              await page.render({ canvasContext: ctx!, viewport }).promise;
              images.push(canvas.toDataURL('image/png'));
            }
            const item = { id: p.id, images };
            results.push(item);
            setRenderedAttachments(prev => [...prev, item]);
            console.log('✅ PDF rendered:', p.id, 'pages:', images.length);
          } catch (e) {
            console.error('❌ Rendering PDF to images failed for', p.id, ':', e);
          }
        }
        if (results.length > 0) {
          setRenderedAttachments(results);
          console.log('🎉 All PDFs rendered successfully:', results.length);
        } else {
          console.log('⚠️ No PDFs were successfully rendered');
        }
      } catch (e) {
        console.error('❌ PDF.js import or setup failed:', e);
      }
      
      setAttachmentsLoading(false);
    };
    if (attachmentsRequested) {
      run();
    }
  }, [state.exportOptions.includeLinePdfs, attachedPdfs, attachmentsRequested]);

  // Filter bsds by selected sites and date range for KPI and consistency with charts/table
  const filteredBsdsForKpi = useMemo(() => {
    try {
      const rows = bsds || [];
      const startMs = segmentDates?.debut ? new Date(segmentDates.debut).setHours(0,0,0,0) : null;
      const endMs = segmentDates?.fin ? new Date(segmentDates.fin).setHours(23,59,59,999) : null;
      const siretSet = new Set(selectedSirets);

      return rows.filter(b => {
        // dates
        const raw = b.infos_json?.formAPI?.createFormInput?.takenOverAt || b.created_at;
        const t = raw ? new Date(raw).getTime() : NaN;
        if (startMs && !(t >= startMs)) return false;
        if (endMs && !(t <= endMs)) return false;
        // sites (if any selected)
        if (siretSet.size > 0) {
          const siret = b.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret || '';
          if (!siretSet.has(siret)) return false;
        }
        return true;
      });
    } catch {
      return bsds || [];
    }
  }, [bsds, segmentDates, selectedSirets]);

  const kpis = useMemo(() => {
    try {
      const tri = calculateTauxTri(filteredBsdsForKpi, mappingTable, filieres_ou_prestataires);
      const valo = calculateTauxValorisation(filteredBsdsForKpi, segmentDates);
      return {
        triSite: Number(tri.tauxTriSurSite.toFixed(1)),
        triGlobal: Number(tri.tauxTri.toFixed(1)),
        valoMatiere: Number(valo.materialValorizationRate.toFixed(1)),
        valoEnergie: Number(valo.energeticValorizationRate.toFixed(1)),
        valoGlobale: Number(valo.globalValorizationRate.toFixed(1)),
        credibilite: Number(valo.credibilityScore.toFixed(1)),
        tonnage: Number(valo.totalTonnage.toFixed(1)),
      };
    } catch {
      return null;
    }
  }, [filteredBsdsForKpi, mappingTable, filieres_ou_prestataires, segmentDates]);

  // Invalidate captured images when chart definitions change
  const chartsString = JSON.stringify(state.charts);
  useEffect(() => {
    setChartImages({});
  }, [chartsString]);

  // Charts readiness tracking
  const expectedChartIds = useMemo(() => state.charts.filter(c => c.type !== 'table').map(c => c.id), [state.charts]);
  const readyChartsCount = useMemo(() => expectedChartIds.filter(id => Boolean(chartImages[id])).length, [expectedChartIds, chartImages]);
  const allChartsReady = useMemo(() => !state.exportOptions.includeCharts || expectedChartIds.length === 0 || readyChartsCount === expectedChartIds.length, [state.exportOptions.includeCharts, expectedChartIds, readyChartsCount]);

  const onExport = useCallback(() => {
    // Trigger loading and defer the actual export until ready via effect
    if (!containerRef.current || isExporting) return;
    if (!allChartsReady || !allAttachmentsReady) return;
    setPendingExport(true);
  }, [containerRef, isExporting, allChartsReady, allAttachmentsReady]);

  const onPrepare = useCallback(() => {
    // Start loading attachments and allow chart capture to proceed
    if (!state.exportOptions.includeLinePdfs) return;
    setAttachmentsRequested(true);
    // reset previous state for a fresh run
    setAttachedPdfs([]);
    setRenderedAttachments([]);
  }, [state.exportOptions.includeLinePdfs]);

  const performExport = useCallback(async () => {
    if (!containerRef.current) return;
    setIsExporting(true);
    try {
      // Ensure DOM is flushed
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      await new Promise(r => setTimeout(r, 50));
      const html = containerRef.current.innerHTML;
      const newWin = window.open('', '_blank');
      if (!newWin) return;
      const styles = `
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 24px; color: #111827; }
      h1 { font-size: 24px; margin: 0 0 8px 0; }
      .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; margin-bottom: 10px; justify-content: space-between; }
      .title { font-size: 28px; font-weight: 900; letter-spacing: 0.2px; }
      .subtitle { font-size: 15px; color: #111827; font-weight: 800; }
      .meta { font-size: 14px; color: #111827; font-weight: 700; margin-top: 4px; }
      .sites ul { margin: 8px 0 0 0; padding-left: 18px; }
      .sites li { font-size: 12px; color: #374151; }
      .kpi-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 12px 0; }
      .kpi { border: 1px solid #edf2f7; background: linear-gradient(180deg, #ffffff, #f9fafb); border-radius: 12px; padding: 12px; font-size: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
      .kpi .label { color: #6b7280; font-size: 11px; margin-bottom: 2px; }
      .kpi .value { font-size: 20px; font-weight: 800; color: #111827; }
      .table-wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
      table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
      thead tr { background: #f8fafc; color: #374151; }
      th, td { padding: 10px 12px; border-bottom: 1px solid #eef2f7; }
      tbody tr:nth-child(2n) { background: #fcfcfd; }
      th { font-weight: 600; text-align: left; }
      td.num { width: 100px;  text-align: left; }
      tbody tr:nth-child(2n) { background: #fafafa; }
      .charts { display: grid; grid-template-columns: 1fr; gap: 12px; margin: 12px 0; }
      .chart { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; }
      .chart-title { font-size: 13px; margin-bottom: 6px; font-weight: 600; }
      .chart-img { width: 100%; height: auto; display: block; page-break-inside: avoid; }
      .crosstab { width: 100%; border-collapse: collapse; font-size: 12px; }
      .crosstab th, .crosstab td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
      .crosstab thead tr { background: #f9fafb; }
      .crosstab td.num { text-align: left; }
      .col-ced { width: 140px; }
      .attachments { margin-top: 16px; }
      .attachment-item { page-break-before: always; margin-top: 12px; }
      .attachment-title { font-size: 14px; font-weight: 700; margin-bottom: 8px; }
      .attachment-frame { width: 100%; height: 1000px; border: 1px solid #e5e7eb; }
    `;
      newWin.document.write(`<!doctype html><html><head><title>${title}</title><style>${styles}</style></head><body>${html}</body></html>`);
      newWin.document.close();
      // Ensure images are loaded in print window
      const waitForImages = async () => {
        const imgs = Array.from(newWin.document.images);
        const pending = imgs.filter(img => !img.complete);
        await Promise.all(pending.map(img => new Promise<void>(res => { img.onload = () => res(); img.onerror = () => res(); })));
      };
      await waitForImages();
      newWin.focus();
      newWin.print();
      if (onExportComplete) onExportComplete();
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
    } finally {
      setIsExporting(false);
      setPendingExport(false);
    }
  }, [containerRef, title, onExportComplete]);

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
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {state.exportOptions.includeLinePdfs && !attachmentsRequested ? (
            <button 
              className={`px-4 py-2 rounded text-white text-base flex items-center gap-2 ${
                isExporting
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`} 
              onClick={onPrepare}
              disabled={isExporting}
              title="Prépare les pièces pour l'export"
            >
              {(attachmentsLoading && !allAttachmentsReady) && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              Préparer la donnée
            </button>
          ) : (
            <button 
              className={`px-4 py-2 rounded text-white text-base flex items-center gap-2 ${
                isExporting 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`} 
              onClick={onExport}
              disabled={isExporting || (state.exportOptions.includeLinePdfs && !allAttachmentsReady) || (state.exportOptions.includeCharts && !allChartsReady)}
            >
              {isExporting && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              {isExporting ? 'Export en cours…' : 'Exporter en PDF'}
            </button>
          )}
        </div>
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
              <div className="title">{entreprise_name || 'Entreprise'}</div>
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
                    {state.selectedSites.map(s => (
                      <li key={s}>{s}</li>
                    ))}
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
                  <th>BSD</th>
                  <th>Date</th>
                  {hasMultipleSites ? (<th>Site</th>) : null}
                  <th>Déchet</th>
                  <th className="col-ced">CED</th>
                  <th className="num">Tonnage</th>
                  <th>Traitement</th>
                  <th>Exutoire</th>
                  {state.exportOptions.includeLinePdfs ? (<th>Pièces</th>) : null}
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
                  return (
                    <tr key={i}>
                      <td>{docId}{docType ? ` (${docType})` : ''}</td>
                      <td>{dateStr}</td>
                      {hasMultipleSites ? (<td>{ci.emitter.company.name}</td>) : null}
                      <td>{ci.wasteDetails.name}</td>
                      <td>{ci.wasteDetails.code}</td>
                      <td className="num">{qty.toFixed(2)}</td>
                      <td>{ci.recipient.processingOperation}</td>
                      <td>{ci.recipient.company.name}</td>
                      {state.exportOptions.includeLinePdfs ? (
                        <td>
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
                      ) : null}
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


