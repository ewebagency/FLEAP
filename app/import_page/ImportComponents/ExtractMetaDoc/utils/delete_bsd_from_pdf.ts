import { supabase } from "@/app/database/supabaseClient";
import { invalidateCache } from "@/app/utils/invalidateCache";

type BsdLinkedItem = { 
    bsd_id?: string; 
    index_dechet: number; 
    status?: 'linked' | 'created' | 'check_by_user' 
};

// Interface pour les PDFs de TableImportedFiles (basée sur l'interface dans TableImportedFiles.tsx)
export interface TablePdfInfo {
    id: number;
    name_pdf: string;
    document_type?: string;
    infos_raw?: Record<string, unknown>;
    bsd_linked?: Array<{ index_dechet: number; bsd_id?: string; status?: 'linked' | 'created' | 'check_by_user' }>;
}

export const handleDeleteMetaDocFromPdf = async (pdf: {
    id: number;
    name_pdf: string;
    document_type?: string;
    infos_raw?: Record<string, unknown>;
    bsd_linked?: Array<{ index_dechet: number; bsd_id?: string; status?: 'linked' | 'created' | 'check_by_user' }>;
}, entrepriseId: string) => {
    if (!entrepriseId || !pdf.bsd_linked || !Array.isArray(pdf.bsd_linked)) {
        console.warn('[handleDeleteMetaDocFromPdf] PDF invalide ou pas de bsd_linked');
        return;
    }

    const entrepriseIdNum = parseInt(entrepriseId);
    const pdfId = pdf.id.toString();
    const documentType = pdf.document_type;
    const bsdLinked = (pdf.bsd_linked as unknown) as BsdLinkedItem[];

    // Compter les éléments à supprimer pour l'affichage
    const createdItems = bsdLinked.filter(item => item.status === 'created');
    const linkedItems = bsdLinked.filter(item => item.status === 'linked');
    const isFacture = documentType?.toLowerCase() === 'facture';

    // PAS DE CONFIRMATION ICI - elle est gérée par TableImportedFiles.tsx
    // On fait directement la suppression
    try {

        // Traitement des éléments avec status 'created' - suppression complète des lignes BSD
        for (const item of createdItems) {
            const { bsd_id, index_dechet } = item;
            
            if (!bsd_id) {
                continue;
            }
            
            // Vérifier que la ligne BSD correspond bien à ce PDF
            const { data: bsdData, error: bsdError } = await supabase
                .from('bsd')
                .select('id, pdf_infos_id, index_dechet_pdf, id_track_dechets')
                .eq('id', bsd_id)
                .eq('entreprise_id', entrepriseIdNum)
                .single();

            if (bsdError || !bsdData) {
                continue;
            }

            // Vérifier que c'est bien lié à ce PDF
            if (bsdData.pdf_infos_id === pdfId && bsdData.index_dechet_pdf === index_dechet) {
                // Supprimer la ligne BSD
                await supabase
                    .from('bsd')
                    .delete()
                    .eq('id', bsd_id)
                    .eq('entreprise_id', entrepriseIdNum);
            }
        }

        // Traitement des éléments avec status 'linked' - nettoyage des colonnes PDF
        for (const item of linkedItems) {
            const { bsd_id, index_dechet } = item;
            
            if (!bsd_id) {
                continue;
            }
            
            // Vérifier que la ligne BSD correspond bien à ce PDF
            const { data: bsdData, error: bsdError } = await supabase
                .from('bsd')
                .select('id, pdf_infos_id, pdf_ids, index_dechet_pdf')
                .eq('id', bsd_id)
                .eq('entreprise_id', entrepriseIdNum)
                .single();

            if (bsdError || !bsdData) {
                continue;
            }

            // Vérifier que c'est bien lié à ce PDF
            if (bsdData.pdf_infos_id === pdfId && bsdData.index_dechet_pdf === index_dechet) {
                // Nettoyer les colonnes PDF
                const currentPdfIds = Array.isArray(bsdData.pdf_ids) ? bsdData.pdf_ids : [];
                const updatedPdfIds = currentPdfIds.filter(id => id !== pdfId);

                const updateData: Record<string, unknown> = {
                    pdf_infos_id: null,
                    index_dechet_pdf: null
                };

                // Si il reste d'autres PDFs liés, garder le tableau, sinon le vider
                if (updatedPdfIds.length > 0) {
                    updateData.pdf_ids = updatedPdfIds;
                } else {
                    updateData.pdf_ids = [];
                }

                await supabase
                    .from('bsd')
                    .update(updateData)
                    .eq('id', bsd_id)
                    .eq('entreprise_id', entrepriseIdNum);
            }
        }

        // Suppression des lignes facture si document_type == facture
        if (isFacture) {
            await supabase
                .from('facture')
                .delete()
                .eq('pdf_infos_id', pdfId)
                .eq('entreprise_id', entrepriseIdNum);
        }

        // Ne pas supprimer la ligne pdf_infos ici: cela sera géré par onDelete au niveau supérieur

        // Invalider le cache
        await invalidateCache(entrepriseId, null);

    } catch (error) {
        throw error; // Re-throw pour que TableImportedFiles.tsx puisse gérer l'erreur
    }
};