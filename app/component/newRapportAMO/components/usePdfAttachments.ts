import { useState, useEffect, useMemo } from 'react';
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

export function usePdfAttachments(
  tableRows: BsdItem[],
  state: ReportBuilderState,
  attachmentsRequested: boolean
) {
  const [attachedPdfs, setAttachedPdfs] = useState<AttachedPdf[]>([]);
  const [renderedAttachments, setRenderedAttachments] = useState<RenderedAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);

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

  // Load PDF URLs from Supabase
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
        
        const embeds: AttachedPdf[] = [];
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

        const results: RenderedAttachment[] = [];
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

  return {
    attachedPdfs,
    renderedAttachments,
    attachmentsLoading,
    totalExpected,
    readyCount,
    allAttachmentsReady,
    setAttachedPdfs,
    setRenderedAttachments
  };
}
