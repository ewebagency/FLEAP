// Utilitaires pour l'export PDF
export function generatePrintStyles(): string {
  return `
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
}

export async function waitForImages(newWin: Window): Promise<void> {
  const imgs = Array.from(newWin.document.images);
  const pending = imgs.filter(img => !img.complete);
  await Promise.all(pending.map(img => new Promise<void>(res => { 
    img.onload = () => res(); 
    img.onerror = () => res(); 
  })));
}

export async function performPdfExport(
  containerRef: React.RefObject<HTMLDivElement>,
  title: string,
  onExportComplete?: () => void
): Promise<void> {
  if (!containerRef.current) return;
  
  // Ensure DOM is flushed
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  await new Promise(r => setTimeout(r, 50));
  
  const html = containerRef.current.innerHTML;
  const newWin = window.open('', '_blank');
  if (!newWin) return;
  
  const styles = generatePrintStyles();
  newWin.document.write(`<!doctype html><html><head><title>${title}</title><style>${styles}</style></head><body>${html}</body></html>`);
  newWin.document.close();
  
  // Ensure images are loaded in print window
  await waitForImages(newWin);
  
  newWin.focus();
  try {
    newWin.print();
  } catch (e) {
    console.warn('[RapportAMO] window.print failed, retrying once', e);
    await new Promise(r => setTimeout(r, 100));
    if (!newWin.closed) newWin.print();
  }
  
  if (onExportComplete) onExportComplete();
}
