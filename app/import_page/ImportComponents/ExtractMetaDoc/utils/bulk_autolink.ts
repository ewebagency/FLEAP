import { getBSDCandidates, getPdfInfoById, getParamsMappingByEntreprise } from './bdd';
import { DEFAULT_AUTO_LINK_PARAMS } from './default_auto_link_params';
import { AutoLinkOrCreateThisDoc, BSDCandidate, ProposeActionResult } from './link';
import { PdfInfo, ParamsMapping } from '../interface/pdf_interface';

export interface BulkAutoLinkItemResult {
    pdfId: string;
    success: boolean;
    message: string;
    results?: Array<{ index_dechet: number; result: ProposeActionResult; performed: 'linked' | 'created' | 'to_check_by_user' | 'skipped'; bsd_id?: string }>; 
}

export interface BulkAutoLinkOutcome {
    success: boolean;
    processedCount: number;
    results: BulkAutoLinkItemResult[];
    errors: Array<{ pdfId: string; error: string }>;
    message?: string;
}

// Compute an expanded date window around all déchets dates of a pdf
const computeDateWindow = (pdfInfo: PdfInfo): { startISO: string; endISO: string } => {
    const raw = (pdfInfo?.infos_raw || {}) as Record<string, unknown>;
    const maybeDechets = (raw as { dechet?: unknown }).dechet;
    const dechets = Array.isArray(maybeDechets) ? (maybeDechets as Array<{ date?: string }>) : [];
    const dates = dechets
        .map(d => (d?.date ? new Date(d.date) : null))
        .filter((d): d is Date => !!d && !isNaN(d.getTime()));
    const today = new Date();
    const minDate = dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))) : today;
    const maxDate = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : today;
    const start = new Date(minDate);
    start.setDate(start.getDate() - 100);
    const end = new Date(maxDate);
    end.setDate(end.getDate() + 100);
    return { startISO: start.toISOString(), endISO: end.toISOString() };
};

export const autoLinkDocs = async (
    pdfIds: string[],
    entrepriseId: number,
    userId?: string
): Promise<BulkAutoLinkOutcome> => {
    if (!userId) {
        console.error('[autoLinkDocs] userId manquant');
    }
    const results: BulkAutoLinkItemResult[] = [];
    const errors: Array<{ pdfId: string; error: string }> = [];

    // Load mappings once
    const { data: mappings, error: mappingError } = await getParamsMappingByEntreprise(entrepriseId);
    if (mappingError || !mappings) {
        return {
            success: false,
            processedCount: 0,
            results: [],
            errors: pdfIds.map(id => ({ pdfId: id, error: mappingError?.message || 'Mappings introuvables' })),
            message: 'Impossible de récupérer les mappings'
        };
    }

    for (const pdfId of pdfIds) {
        try {
            // Load pdf info
            const { data: pdfInfo, error: pdfErr } = await getPdfInfoById(pdfId, entrepriseId);
            if (pdfErr || !pdfInfo) {
                const errMsg = pdfErr?.message || 'pdf_infos introuvable';
                errors.push({ pdfId, error: errMsg });
                results.push({ pdfId, success: false, message: errMsg });
                continue;
            }

            // Compute date window per pdf and fetch candidates
            const { startISO, endISO } = computeDateWindow(pdfInfo as PdfInfo);
            const { data: candidatesData, error: candErr } = await getBSDCandidates(
                entrepriseId,
                startISO,
                endISO,
                1000
            );
            if (candErr || !candidatesData) {
                const errMsg = candErr?.message || 'Aucun candidat';
                errors.push({ pdfId, error: errMsg });
                results.push({ pdfId, success: false, message: errMsg });
                continue;
            }

            const candidates = candidatesData as BSDCandidate[];

            // Run auto-link per document
            const outcome = await AutoLinkOrCreateThisDoc(
                (pdfInfo as PdfInfo).infos_raw || {},
                candidates,
                mappings as ParamsMapping,
                DEFAULT_AUTO_LINK_PARAMS,
                { entrepriseId, pdfId, userId }
            );

            results.push({
                pdfId,
                success: true,
                message: 'Auto-link terminé',
                results: outcome.results
            });
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Erreur inconnue';
            errors.push({ pdfId, error: msg });
            results.push({ pdfId, success: false, message: msg });
        }
    }

    const processedCount = results.filter(r => r.success).length;
    return {
        success: errors.length === 0,
        processedCount,
        results,
        errors,
        message: errors.length ? 'Terminé avec des erreurs' : 'Succès'
    };
};


