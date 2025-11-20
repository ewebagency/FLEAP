import { getBSDCandidates, getPdfInfoById, getParamsMappingByEntreprise } from './bdd';
import { DEFAULT_AUTO_LINK_PARAMS } from './default_auto_link_params';
import { AutoLinkParams } from './link';
import { AutoLinkOrCreateThisDoc, BSDCandidate, ProposeActionResult } from './link';
import { PdfInfo, ParamsMapping } from '../interface/pdf_interface';
import { link_in_bdd, create_in_bdd } from './link_or_create_bdd';
import { supabase } from '@/app/database/supabaseClient';

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
    start.setDate(start.getDate() - 31);
    const end = new Date(maxDate);
    end.setDate(end.getDate() + 31);
    return { startISO: start.toISOString(), endISO: end.toISOString() };
};

export const autoLinkDocs = async (
    pdfIds: string[],
    entrepriseId: number,
    userId?: string,
    simulationMode: boolean = false,
    linkParams?: AutoLinkParams
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
                linkParams || DEFAULT_AUTO_LINK_PARAMS,
                { entrepriseId, pdfId, userId, simulationMode }
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

// Fonction pour appliquer directement les décisions pré-calculées de la simulation
// sans recalculer les candidats BSD ni refaire le matching
export const applyPreComputedAutoLink = async (
    simulationOutcome: BulkAutoLinkOutcome,
    selectedPdfIds: string[],
    entrepriseId: number,
    userId: string
): Promise<BulkAutoLinkOutcome> => {
    if (!userId) {
        console.error('[applyPreComputedAutoLink] userId manquant');
    }
    
    const results: BulkAutoLinkItemResult[] = [];
    const errors: Array<{ pdfId: string; error: string }> = [];

    // Filtrer les résultats de simulation pour ne garder que les PDFs sélectionnés
    const selectedSimulationResults = simulationOutcome.results.filter(
        result => selectedPdfIds.includes(result.pdfId)
    );

    // Fonction helper pour mettre à jour le statut dans bsd_linked
    const upsertStatusFlag = async (
        pdfId: string,
        indexDechet: number,
        status: 'linked' | 'created' | 'check_by_user',
        bsdId?: string
    ): Promise<void> => {
        const { data: currentPdf, error: fetchErr } = await supabase
            .from('pdf_infos')
            .select('bsd_linked')
            .eq('entreprise_id', entrepriseId)
            .eq('id', pdfId)
            .maybeSingle();

        if (fetchErr) {
            throw fetchErr;
        }

        const prevArray: Array<Record<string, unknown>> = Array.isArray(currentPdf?.bsd_linked)
            ? (currentPdf!.bsd_linked as Array<Record<string, unknown>>)
            : [];

        // Trouver et mettre à jour l'item existant ou en créer un nouveau
        const matchIdx = prevArray.findIndex(item => {
            const idx = item.index_dechet as number | undefined;
            const id = item.bsd_id as string | undefined;
            if (bsdId) {
                return idx === indexDechet && id === bsdId;
            }
            return idx === indexDechet;
        });

        let nextArray: Array<Record<string, unknown>>;
        if (matchIdx >= 0) {
            nextArray = [...prevArray];
            const updated = { ...nextArray[matchIdx] } as Record<string, unknown>;
            updated.status = status;
            if (bsdId) updated.bsd_id = bsdId;
            nextArray[matchIdx] = updated;
        } else {
            const base: Record<string, unknown> = { index_dechet: indexDechet, status };
            if (bsdId) base.bsd_id = bsdId;
            nextArray = [...prevArray, base];
        }

        const { error: updateErr } = await supabase
            .from('pdf_infos')
            .update({ bsd_linked: nextArray })
            .eq('entreprise_id', entrepriseId)
            .eq('id', pdfId);

        if (updateErr) {
            throw updateErr;
        }
    };

    // Appliquer les actions pré-calculées pour chaque PDF sélectionné
    for (const simulationResult of selectedSimulationResults) {
        const pdfId = simulationResult.pdfId;
        
        try {
            if (!simulationResult.success || !simulationResult.results) {
                // Si la simulation a échoué, copier l'erreur
                errors.push({ pdfId, error: simulationResult.message });
                results.push({ ...simulationResult });
                continue;
            }

            const appliedResults: Array<{ 
                index_dechet: number; 
                result: ProposeActionResult; 
                performed: 'linked' | 'created' | 'to_check_by_user' | 'skipped'; 
                bsd_id?: string 
            }> = [];

            // Appliquer chaque action pré-calculée
            for (const dechetAction of simulationResult.results) {
                const { index_dechet, result, performed } = dechetAction;

                try {
                    // Appliquer l'action selon ce qui a été décidé en simulation
                    if (performed === 'linked' && result.id_candidat) {
                        // Appliquer le linkage
                        await link_in_bdd(entrepriseId, result.id_candidat, pdfId, index_dechet);
                        await upsertStatusFlag(pdfId, index_dechet, 'linked', result.id_candidat);
                        
                        appliedResults.push({
                            index_dechet,
                            result,
                            performed: 'linked',
                            bsd_id: result.id_candidat
                        });
                        
                    } else if (performed === 'created') {
                        // Créer le BSD
                        const createRes = await create_in_bdd(entrepriseId, pdfId, index_dechet, { user_id: userId });
                        const createdId = (createRes as { bsd_id?: string }).bsd_id;
                        await upsertStatusFlag(pdfId, index_dechet, 'created', createdId);
                        
                        appliedResults.push({
                            index_dechet,
                            result,
                            performed: 'created',
                            bsd_id: createdId
                        });
                        
                    } else if (performed === 'to_check_by_user') {
                        // Marquer comme à vérifier par l'utilisateur
                        await upsertStatusFlag(pdfId, index_dechet, 'check_by_user');
                        
                        appliedResults.push({
                            index_dechet,
                            result,
                            performed: 'to_check_by_user'
                        });
                        
                    } else if (performed === 'skipped') {
                        // Déjà traité, on le saute
                        appliedResults.push({
                            index_dechet,
                            result,
                            performed: 'skipped',
                            bsd_id: dechetAction.bsd_id
                        });
                    }
                } catch (dechetError) {
                    // Erreur sur un déchet spécifique, on continue avec les autres
                    const msg = dechetError instanceof Error ? dechetError.message : 'Erreur inconnue';
                    console.error(`[applyPreComputedAutoLink] Erreur déchet ${index_dechet} du PDF ${pdfId}:`, msg);
                    
                    appliedResults.push({
                        index_dechet,
                        result,
                        performed: 'skipped',
                        bsd_id: undefined
                    });
                }
            }

            results.push({
                pdfId,
                success: true,
                message: 'Auto-link appliqué',
                results: appliedResults
            });

        } catch (pdfError) {
            const msg = pdfError instanceof Error ? pdfError.message : 'Erreur inconnue';
            console.error(`[applyPreComputedAutoLink] Erreur PDF ${pdfId}:`, msg);
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


