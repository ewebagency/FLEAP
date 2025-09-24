import { useMemo } from 'react';
import { calculateTauxTri } from '@/app/component/Analyse/Operationelle/TauxTri';
import { calculateTauxValorisation } from '@/app/component/Analyse/Environnementale/TauxValorisation';
import type { BsdItem } from './PDFPreviewTypes';
import { normalizeBsdForKpi, calculateTotalTonnage } from './PDFPreviewUtils';

interface KpiResult {
  triSite: number;
  triGlobal: number;
  valoMatiere: number;
  valoEnergie: number;
  valoGlobale: number;
  credibilite: number;
  tonnage: number;
}

export function useKpis(
  filteredBsdsForKpi: BsdItem[],
  mappingNomResp: { data?: Array<{ nom?: string; filiere: string; trie?: boolean }> } | null,
  segmentDates?: { debut?: string; fin?: string }
): KpiResult | null {
  return useMemo(() => {
    try {
      // Use only mapping by name to align with analyses (filière_nom only)
      const mappingTable = (mappingNomResp?.data || []) as unknown as Array<{ nom?: string; filiere: string; trie?: boolean }>;
      const filieres_ou_prestataires = { nom: 'filiere_nom' as const };
      
      // Debug: imported filter signals
      try {
        const importedLike = filteredBsdsForKpi.filter(b => {
          const createdOnFleap = (b as unknown as { created_on_fleap?: boolean }).created_on_fleap;
          const status = (b as unknown as { status_track_dechets?: string }).status_track_dechets;
          const source = (b as unknown as { source?: string }).source;
          return createdOnFleap === false || status === 'IMPORTED' || (source && source.toLowerCase() !== 'demande');
        }).length;
        console.log('[RapportAMO] KPI inputs', {
          rowsForKpi: filteredBsdsForKpi.length,
          mappingMode: filieres_ou_prestataires.nom,
          mappingNomSize: mappingNomResp?.data?.length || 0,
          suspectedImportedCount: importedLike,
        });
      } catch {}

      // Normalize numeric fields for KPI calculators
      const normalized = normalizeBsdForKpi(filteredBsdsForKpi);

      const tri = calculateTauxTri(normalized, mappingTable, filieres_ou_prestataires);
      const dateFilter = segmentDates
        ? {
            debut: segmentDates.debut ? new Date(segmentDates.debut) : null,
            fin: segmentDates.fin ? new Date(segmentDates.fin) : null,
          }
        : undefined;
      const valo = calculateTauxValorisation(normalized, dateFilter);
      
      // Force all values to numbers before calling toFixed
      const safeNumber = (val: unknown): number => {
        const n = typeof val === 'number' ? val : Number(val);
        return Number.isFinite(n) ? n : 0;
      };
      
      // Align displayed total tonnage with AnalOpBordereau: sum(quantityReceived || wasteDetails.quantity)
      const totalTonnageAnalOp = calculateTotalTonnage(normalized);

      const result = {
        triSite: Number(safeNumber(tri.tauxTriSurSite).toFixed(1)),
        triGlobal: Number(safeNumber(tri.tauxTri).toFixed(1)),
        valoMatiere: Number(safeNumber(valo.materialValorizationRate).toFixed(1)),
        valoEnergie: Number(safeNumber(valo.energeticValorizationRate).toFixed(1)),
        valoGlobale: Number(safeNumber(valo.globalValorizationRate).toFixed(1)),
        credibilite: Number(safeNumber(valo.credibilityScore).toFixed(1)),
        tonnage: Number(safeNumber(totalTonnageAnalOp).toFixed(1)),
      };

      console.log('[RapportAMO] KPI computed raw', { tri, valo });
      console.log('[RapportAMO] KPI computed final', result);
      return result;
    } catch (e) {
      console.error('[RapportAMO] KPI compute error', e);
      console.log('[RapportAMO] KPI compute context', {
        rowsForKpi: filteredBsdsForKpi.length,
        sample: filteredBsdsForKpi.slice(0, 2).map(b => ({
          qtyReceived: (b as unknown as { infos_json?: { formAPI?: { createFormInput?: { quantityReceived?: unknown; wasteDetails?: { quantity?: unknown } } } } }).infos_json?.formAPI?.createFormInput?.quantityReceived,
          wasteQty: (b as unknown as { infos_json?: { formAPI?: { createFormInput?: { wasteDetails?: { quantity?: unknown } } } } }).infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity,
          code: (b as unknown as { infos_json?: { formAPI?: { createFormInput?: { wasteDetails?: { code?: unknown } } } } }).infos_json?.formAPI?.createFormInput?.wasteDetails?.code,
          processing: (b as unknown as { infos_json?: { formAPI?: { createFormInput?: { recipient?: { processingOperation?: unknown } } } } }).infos_json?.formAPI?.createFormInput?.recipient?.processingOperation,
        }))
      });
      return null;
    }
  }, [filteredBsdsForKpi, mappingNomResp, segmentDates]);
}
