import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import type { BsdItem, AttachedPdf, RenderedAttachment } from './PDFPreviewTypes';
import type { ReportBuilderState } from '../types';

// Minimal PDF.js type definitions to avoid using `any`
type PdfPageViewport = { width: number; height: number };
type PdfPage = {
  getViewport: (params: { scale: number }) => PdfPageViewport;
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: PdfPageViewport }) => { promise: Promise<void> };
};
type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
};

// Tweakable rendering constants
export const PDF_RENDER_SCALE = 0.9;        // Lower = faster/lighter
export const PDF_JPEG_QUALITY = 0.8;       // 0..1 (only for JPEG)
export const PDF_MAX_PAGES = 50;           // Safety cap per attachment

export function usePdfAttachments(
  tableRows: BsdItem[],
  state: ReportBuilderState,
  attachmentsRequested: boolean
) {
  const [attachedPdfs, setAttachedPdfs] = useState<AttachedPdf[]>([]);
  const [renderedAttachments, setRenderedAttachments] = useState<RenderedAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [expectedPdfIdList, setExpectedPdfIdList] = useState<string[]>([]);
  const renderingRef = useRef<Set<string>>(new Set());

  // Expected vs rendered attachments tracking
  const expectedPdfIds = useMemo(() => {
    if (!state.exportOptions.includeLinePdfs) return new Set<string>();
    return new Set(expectedPdfIdList);
  }, [state.exportOptions.includeLinePdfs, expectedPdfIdList]);

  const { totalExpected, readyCount, allAttachmentsReady } = useMemo(() => {
    const expected = expectedPdfIds;
    const rendered = new Set(renderedAttachments.map(a => a.id));
    let count = 0;
    expected.forEach(id => { if (rendered.has(id)) count += 1; });
    const total = expected.size;
    const ready = !state.exportOptions.includeLinePdfs || total === 0 || (count === total && !attachmentsLoading);
    return { totalExpected: total, readyCount: count, allAttachmentsReady: ready };
  }, [expectedPdfIds, renderedAttachments, attachmentsLoading, state.exportOptions.includeLinePdfs]);

  // Load PDF URLs from Supabase
  useEffect(() => {
    const loadPdfUrls = async () => {
      console.log('🔍 PDFs: start load', { on: !!state.exportOptions.includeLinePdfs, rows: tableRows.length });
      
      if (!state.exportOptions.includeLinePdfs) { 
        console.log('❌ PDF option disabled');
        setAttachedPdfs([]); 
        setRenderedAttachments([]);
        setDownloadComplete(false);
        setExpectedPdfIdList([]);
        return; 
      }
      
      const allIds = Array.from(new Set((tableRows.flatMap(r => r.pdf_ids || [])).filter(Boolean)));
      console.log('🧮 PDFs expected:', allIds.length);
      
      if (allIds.length === 0) { 
        console.log('❌ No PDF IDs found in table rows');
        setAttachedPdfs([]); 
        setRenderedAttachments([]);
        setDownloadComplete(false);
        setExpectedPdfIdList([]);
        return; 
      }
      
      try {
        setAttachmentsLoading(true);
        console.log('☁️ Supabase: fetch pdf_infos');
        const { data: infos, error } = await supabase
          .from('pdf_infos')
          .select('id, name_pdf_in_bucket, document_type')
          .in('id', allIds);
          
        if (error) {
          console.error('❌ Erreur récupération pdf_infos:', error);
          setAttachedPdfs([]); 
          setRenderedAttachments([]);
          setDownloadComplete(false);
          setExpectedPdfIdList([]);
          return;
        }
        
        console.log('📄 pdf_infos:', infos?.length || 0);
        const infoMap = new Map(
          (infos || []).map((info) => {
            const cast = info as { id: string; name_pdf_in_bucket?: string; document_type?: string | null };
            return [cast.id, cast];
          })
        );
        const selectedIds: string[] = [];
        const selectedIdSet = new Set<string>();
        for (const row of tableRows) {
          const rowIds = row.pdf_ids || [];
          const firstAllowed = rowIds.find((id) => {
            const info = infoMap.get(id);
            const type = (info?.document_type || '').toLowerCase().trim();
            return type === 'bon' || type === 'bsd';
          });
          if (firstAllowed && !selectedIdSet.has(firstAllowed)) {
            selectedIds.push(firstAllowed);
            selectedIdSet.add(firstAllowed);
          }
        }
        console.log('🎯 Selected PDFs after document_type filter:', selectedIds.length);
        
        // Reset before downloading
        setAttachedPdfs([]);
        setRenderedAttachments([]);
        setDownloadComplete(false);
        setExpectedPdfIdList([]);
        renderingRef.current.clear();
        
        const downloadedPdfs: AttachedPdf[] = [];
        const downloadedIds: string[] = [];
        
        for (const selectedId of selectedIds) {
          const info = infoMap.get(selectedId);
          const cast = info as { id: string; name_pdf_in_bucket?: string };
          if (!cast || !cast.name_pdf_in_bucket) {
            console.log('⚠️ Skipping PDF info without bucket name:', cast);
            continue;
          }
          
          console.log('⬇️ DL', cast.id);
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
          console.error('❌ DL fail', cast.id, dlErr);
            continue;
          }
          
          const buf = await fileData.arrayBuffer();
          const newPdf = { id: cast.id, data: buf };
          downloadedPdfs.push(newPdf);
          downloadedIds.push(cast.id);
          // Update state incrementally for progress tracking (download phase)
          setAttachedPdfs([...downloadedPdfs]);
        console.log('✅ DL', cast.id, 'size=', buf.byteLength);
        }
        
        console.log('🎉 DL complete, total downloaded:', downloadedPdfs.length, '/', selectedIds.length);
        // Only expect successfully downloaded PDFs to avoid blocking the export on missing files
        setExpectedPdfIdList(downloadedIds);
        // Mark download as complete - this will trigger rendering
        setDownloadComplete(true);
      } catch (e) {
        console.error('❌ Erreur génération URLs PDF:', e);
        setAttachedPdfs([]);
        setRenderedAttachments([]);
        setDownloadComplete(false);
        setExpectedPdfIdList([]);
      }
    };

    if (attachmentsRequested) {
      loadPdfUrls();
    }
  }, [state.exportOptions.includeLinePdfs, tableRows, attachmentsRequested]);

  // Render attached PDFs into images for robust printing (only after download is complete)
  useEffect(() => {
    const run = async () => {
      if (!state.exportOptions.includeLinePdfs || attachedPdfs.length === 0) {
        return;
      }
      
      // Wait until download is complete before starting rendering
      if (!downloadComplete) {
        return;
      }
      
      // Filter PDFs that need rendering (not already rendered and not currently rendering)
      const toRender = attachedPdfs.filter(p => !renderingRef.current.has(p.id));
      
      if (toRender.length === 0) {
        return;
      }
      
      console.log('🖼️ Rendering', toRender.length, 'PDFs (download phase complete)');
      
      // Mark these PDFs as being rendered
      toRender.forEach(p => renderingRef.current.add(p.id));
      
      try {
        // Dynamically import pdf.js in the client
        console.log('📦 Importing pdf.js...');
        // @ts-expect-error - pdfjs-dist types are not available but the module works
        const pdfjsModule = await import('pdfjs-dist/build/pdf');
        const pdfjsGlobal = pdfjsModule as unknown as {
          GlobalWorkerOptions: { workerSrc: string };
          getDocument: (params: { data: ArrayBuffer }) => { promise: Promise<PdfDocument> };
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

        for (const p of toRender) {
          try {
            console.log('⚙️ Rendering PDF', p.id);
            // Clone the ArrayBuffer to prevent detachment issues with workers
            const clonedData = p.data.slice(0);
            const loadingTask = pdfjsGlobal.getDocument({ data: clonedData });
            const pdf = await loadingTask.promise;
            console.log('📖 pages', pdf.numPages);
            
            const maxPages = Math.min(pdf.numPages, PDF_MAX_PAGES);
            const images: string[] = [];
            for (let i = 1; i <= maxPages; i++) {
              const page = await pdf.getPage(i);
              const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              await page.render({ canvasContext: ctx!, viewport }).promise;
              try {
                images.push(canvas.toDataURL('image/jpeg', PDF_JPEG_QUALITY));
              } catch {
                images.push(canvas.toDataURL('image/png'));
              }
            }
            const item = { id: p.id, images };
            // Update state incrementally for progress tracking
            setRenderedAttachments(prev => [...prev, item]);
            console.log('✅ Rendered', p.id, 'pages=', images.length);
          } catch (e) {
            console.error('❌ Render fail', p.id, e);
            // Keep a placeholder so one bad PDF does not block the whole export flow
            setRenderedAttachments(prev => {
              if (prev.some(item => item.id === p.id)) return prev;
              return [...prev, { id: p.id, images: [] }];
            });
          }
        }
        
        console.log('🎉 Render batch complete');
      } catch (e) {
        console.error('❌ PDF.js import or setup failed:', e);
        // Clear rendering set on fatal error
        toRender.forEach(p => renderingRef.current.delete(p.id));
      }
    };
    if (attachmentsRequested) {
      run();
    }
  }, [state.exportOptions.includeLinePdfs, attachedPdfs, attachmentsRequested, downloadComplete]);

  // Update loading state based on progress
  useEffect(() => {
    if (!state.exportOptions.includeLinePdfs || !attachmentsRequested) {
      setAttachmentsLoading(false);
      return;
    }
    
    const expected = expectedPdfIds.size;
    const downloaded = attachedPdfs.length;
    const rendered = renderedAttachments.length;
    
    // Loading is done when all expected PDFs are both downloaded and rendered
    if (expected > 0 && downloaded === expected && rendered === expected) {
      setAttachmentsLoading(false);
      console.log('✅ All attachments ready:', rendered, '/', expected);
    } else if (expected > 0) {
      setAttachmentsLoading(true);
    }
  }, [state.exportOptions.includeLinePdfs, attachmentsRequested, expectedPdfIds.size, attachedPdfs.length, renderedAttachments.length]);

  // Reset function to clear all states
  const resetAttachments = () => {
    setAttachedPdfs([]);
    setRenderedAttachments([]);
    setDownloadComplete(false);
    setExpectedPdfIdList([]);
    renderingRef.current.clear();
  };

  return {
    attachedPdfs,
    renderedAttachments,
    attachmentsLoading,
    downloadComplete,
    totalExpected,
    readyCount,
    allAttachmentsReady,
    setAttachedPdfs,
    setRenderedAttachments,
    resetAttachments
  };
}