import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";
import { supabase } from "@/app/database/supabaseClient";
import { getParamsMappingByEntreprise } from "../utils/bdd";
import { normalizePdfData, buildFactureFromNormalized, push_in_facture_bdd, ParamsMapping } from "../utils/link";

type DocInterface = Record<string, unknown>;

interface PushFactureButtonProps {
    entrepriseId: number;
    pdfId: string;
    userId?: string;
    doc: DocInterface | null;
    disabled?: boolean;
}

const PushFactureButton = ({ entrepriseId, pdfId, userId, doc, disabled }: PushFactureButtonProps) => {
    const [isLoading, setIsLoading] = useState(false);

    const handlePush = useCallback(async () => {
        if (!doc) {
            toast.error("Aucune donnée de document");
            return;
        }
        const typeDoc = (doc.type_doc as string) || "";
        if (typeDoc !== "facture") {
            toast.error("Le document n'est pas une facture");
            return;
        }

        try {
            setIsLoading(true);

            const { data: mappings, error: mappingError } = await getParamsMappingByEntreprise(entrepriseId);
            if (mappingError || !mappings) {
                throw new Error("Impossible de récupérer les mappings");
            }

            const paramsMapping = mappings as ParamsMapping;
            
            const dechets = Array.isArray((doc as { dechet?: unknown[] }).dechet)
                ? ((doc as { dechet: unknown[] }).dechet)
                : [];
            const indices: number[] = dechets.map((_, i) => i);

            // Récupérer les existants pour ce PDF
            const { data: existingRows, error: existingFetchErr } = await supabase
                .from('facture')
                .select('id,index_dechet_pdf')
                .eq('entreprise_id', entrepriseId)
                .eq('pdf_infos_id', pdfId);
            if (existingFetchErr) throw existingFetchErr;
            const existingIndexToId = new Map<number, string>();
            for (const row of existingRows || []) {
                const idx = (row as { index_dechet_pdf?: number }).index_dechet_pdf;
                const id = (row as { id?: string }).id;
                if (typeof idx === 'number' && id) existingIndexToId.set(idx, id);
            }

            // Demander une seule confirmation si certains existent
            const indicesExisting = indices.filter(i => existingIndexToId.has(i));
            let overwriteAllowed = false;
            if (indicesExisting.length > 0) {
                overwriteAllowed = window.confirm(`Certaines lignes de facture (${indicesExisting.length}) existent déjà. Voulez-vous les écraser ?`);
            }

            let created = 0;
            let updated = 0;
            let skipped = 0;

            for (const idx of indices) {
                try {
                // Normaliser et construire la facture pour cet index
                const normalized = normalizePdfData(
                    doc as Record<string, unknown>,
                    paramsMapping.params_mapping_site || {},
                    paramsMapping.params_mapping_presta || {},
                    idx,
                    true
                );
                const factureJson = buildFactureFromNormalized(
                    normalized,
                    doc as Record<string, unknown>,
                    idx,
                    paramsMapping
                );

                const existingId = existingIndexToId.get(idx);
                if (existingId) {
                    if (!overwriteAllowed) {
                        skipped += 1;
                        continue;
                    }
                    const { error: updateErr } = await supabase
                        .from('facture')
                        .update({ infos_json: factureJson, user_id: userId })
                        .eq('id', existingId);
                    if (updateErr) throw updateErr;
                    updated += 1;
                } else {
                    await push_in_facture_bdd(entrepriseId, pdfId, idx, factureJson, userId);
                    created += 1;
                }
                } catch (e) {
                    console.error('Erreur push facture index', idx, e);
                    skipped += 1;
                    continue;
                }
            }

            if (updated > 0) toast.success(`${updated} facture(s) mise(s) à jour`);
            if (created > 0) toast.success(`${created} facture(s) créée(s)`);
            if (skipped > 0) toast(`Ignoré ${skipped} facture(s) existante(s)`);

            // Si tout a été poussé (aucun skip, et tous traités)
            const total = indices.length;
            const processed = created + updated;
            if (processed === total) {
                // Marquer le pdf comme pushed et remplir bsd_linked par index
                const pushedArray = indices.map(idx => ({ index_dechet: idx, status: 'pushed' as const }));
                const { error: updatePdfErr } = await supabase
                    .from('pdf_infos')
                    .update({ status: 'pushed', bsd_linked: pushedArray })
                    .eq('entreprise_id', entrepriseId)
                    .eq('id', pdfId);
                if (updatePdfErr) {
                    console.error('Erreur update pdf_infos.status/bsd_linked', updatePdfErr);
                } else {
                    toast.success('Statut PDF mis à jour: pushed');
                }
            }
        } catch (err) {
            console.error(err);
            toast.error("Erreur lors de la génération de la facture");
        } finally {
            setIsLoading(false);
        }
    }, [doc, entrepriseId, pdfId, userId]);

    return (
        <button
            onClick={() => { void handlePush(); }}
            disabled={disabled || isLoading}
            className="px-3 py-1 rounded-md text-sm bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isLoading ? "Pousse…" : "Pousser Facture"}
        </button>
    );
};

export default PushFactureButton;


