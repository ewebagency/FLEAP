import type { BsdItem } from './PDFPreviewTypes';
import type { BSD } from '@/app/analysis/AnalysisProvider';
import type { ReportBuilderState } from '../types';
import { applyFilterType, type FilterType } from '@/app/analysis/filterType';

// Utilitaires pour le filtrage des données BSD
export function filterBsdRows(
  rows: BsdItem[],
  state: ReportBuilderState,
  selectedSirets: string[],
  segmentDates?: { debut?: string; fin?: string },
  filterType: FilterType = state.filterType || 'imported'
): BsdItem[] {
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
    return rows.filter((b: BsdItem) => selectedSet.size === 0
      || siretSet.has(b.infos_json.formAPI.createFormInput.emitter.company.siret)
    );
  })();

  // Apply new shared filter (default 'imported') before date and other computations
  const importedOnly = applyFilterType(siteFiltered, filterType, {
    getStatus: (it: BsdItem) => (it as unknown as { status_track_dechets?: string }).status_track_dechets,
    getCreatedOnFleap: (it: BsdItem) => (it as unknown as { created_on_fleap?: boolean }).created_on_fleap,
  }) as BsdItem[];

  return importedOnly.filter((b: BsdItem) => inRange(b));
}

export function filterBsdsForKpi(tableRows: BsdItem[]): BsdItem[] {
  return applyFilterType(tableRows, 'imported', {
    getStatus: (it: BsdItem) => (it as unknown as { status_track_dechets?: string }).status_track_dechets,
    getCreatedOnFleap: (it: BsdItem) => (it as unknown as { created_on_fleap?: boolean }).created_on_fleap,
  }) as BsdItem[];
}

export function normalizeBsdForKpi(filteredBsdsForKpi: BsdItem[]): BSD[] {
  return (filteredBsdsForKpi as unknown as BSD[]).map((row) => {
    try {
      const clone = JSON.parse(JSON.stringify(row)) as BSD;
      const ci = clone?.infos_json?.formAPI?.createFormInput as unknown as {
        quantityReceived?: unknown;
        wasteDetails?: { quantity?: unknown };
        recipient?: { valoParts?: Array<{ tonnage?: unknown; code_valo?: unknown } & Record<string, unknown>>; processingOperation?: unknown };
      };
      if (ci) {
        if (ci.quantityReceived !== undefined) {
          const n = Number(String(ci.quantityReceived).replace(',', '.'));
          ci.quantityReceived = Number.isFinite(n) ? n : ci.quantityReceived;
        }
        if (ci?.wasteDetails?.quantity !== undefined) {
          const nw = Number(String(ci.wasteDetails.quantity).replace(',', '.'));
          ci.wasteDetails.quantity = Number.isFinite(nw) ? nw : ci.wasteDetails.quantity;
        }
        if (ci?.recipient?.valoParts && Array.isArray(ci.recipient.valoParts)) {
          ci.recipient.valoParts = ci.recipient.valoParts.map((p: { tonnage?: unknown; code_valo?: unknown } & Record<string, unknown>) => ({
            ...p,
            tonnage: Number.isFinite(Number(p.tonnage)) ? Number(p.tonnage) : Number(String(p.tonnage || 0).replace(',', '.'))
          }));
        }
      }
      return clone;
    } catch {
      return row as unknown as BSD;
    }
  });
}

export function calculateTotalTonnage(normalized: BSD[]): number {
  return normalized.reduce((sum, b) => {
    try {
      const ci = (b as BSD).infos_json?.formAPI?.createFormInput as unknown as { quantityReceived?: unknown; wasteDetails?: { quantity?: unknown } };
      const q = (ci?.quantityReceived !== undefined && ci?.quantityReceived !== null)
        ? Number(String(ci.quantityReceived).replace(',', '.'))
        : Number(String(ci?.wasteDetails?.quantity ?? 0).replace(',', '.'));
      return sum + (Number.isFinite(q) ? q : 0);
    } catch { return sum; }
  }, 0);
}

export function hasMultipleSites(tableRows: BsdItem[]): boolean {
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
}
