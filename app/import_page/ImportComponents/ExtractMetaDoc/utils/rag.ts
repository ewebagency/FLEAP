import { getPdfInfoById, createSignedUrl } from './bdd';
import { supabase } from '@/app/database/supabaseClient';

/**
 * Crée un placeholder RAG (ligne dans bdd_rag sans perfect_answer) pour un PDF
 * qui nécessite un exemple RAG mais n'en a pas encore.
 * 
 * @param pdfId - ID du PDF
 * @param entrepriseId - ID de l'entreprise
 * @param userId - ID de l'utilisateur
 * @param documentType - Type de document (bon, bsd, facture, etc.)
 * @returns Promise<void> - Ne retourne rien, gère les erreurs silencieusement
 */
export const createRagPlaceholder = async (
    pdfId: string,
    entrepriseId: number,
    userId: string | number,
    documentType: string = 'inconnu'
): Promise<void> => {
    try {
        // 1. Récupérer les infos du PDF pour obtenir name_pdf_in_bucket
        const { data: pdfInfo, error: pdfError } = await getPdfInfoById(pdfId, entrepriseId);
        
        if (pdfError || !pdfInfo) {
            console.error('❌ Erreur lors de la récupération des infos PDF pour placeholder RAG:', pdfError);
            return;
        }

        if (!pdfInfo.name_pdf_in_bucket) {
            console.error('❌ name_pdf_in_bucket manquant pour créer placeholder RAG');
            return;
        }

        // 2. Récupérer l'URL signée du PDF
        const { data: signedUrlData, error: signedUrlError } = await createSignedUrl(pdfInfo.name_pdf_in_bucket, 3600);
        
        if (signedUrlError || !signedUrlData?.signedUrl) {
            console.error('❌ Erreur lors de la création de l\'URL signée pour placeholder RAG:', signedUrlError);
            return;
        }

        // 3. Télécharger le PDF et le convertir en File
        const blobResp = await fetch(signedUrlData.signedUrl);
        if (!blobResp.ok) {
            console.error('❌ Erreur lors du téléchargement du PDF pour placeholder RAG:', blobResp.statusText);
            return;
        }
        const pdfBlob = await blobResp.blob();
        const file = new File([pdfBlob], pdfInfo.name_pdf || 'document.pdf', { type: 'application/pdf' });

        // 4. Préparer FormData pour l'appel au backend
        const formData = new FormData();
        formData.append('file', file);
        formData.append('pdf_id', String(pdfId));
        formData.append('extracted_data', '{}'); // Vide pour placeholder
        formData.append('document_type', documentType || 'inconnu');
        formData.append('entreprise_id', String(entrepriseId));
        formData.append('create_placeholder_only', 'true'); // Flag pour créer un placeholder

        // 5. Appel à l'API backend Python
        const url = `${process.env.NEXT_PUBLIC_SERVER_PYTHON}/push_to_rag`;
        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
            console.error('❌ Erreur HTTP lors de la création du placeholder RAG:', errorData.error || response.status);
            return;
        }

        const result = await response.json() as { success: boolean; data?: unknown; error?: string };
        
        if (!result.success) {
            console.error('❌ Erreur lors de la création du placeholder RAG:', result.error);
            return;
        }

        // 6. Sauvegarder dans Supabase (même logique que Push2RAGButton mais avec perfect_answer = null)
        const ragData = result.data as {
            pdf_id: string;
            raw_text: string;
            embedding: number[] | null;
            gemini_answer: Record<string, unknown>;
            document_type: string;
            extraction_method: string;
            structured_data: Record<string, unknown>;
            requires_pdf_info_link?: boolean;
            is_update?: boolean;
            existing_rag_id?: string | number | null;
            preserve_prompt?: boolean;
            pdf_changed?: boolean;
            old_pdf_infos_id?: string | null;
        };

        const isUpdate = ragData.is_update === true;
        const existingRagId = ragData.existing_rag_id ? String(ragData.existing_rag_id) : null;
        const pdfChanged = ragData.pdf_changed === true;

        // Récupérer le prompt existant si mise à jour
        let existingPrompt: string | null = null;
        if (isUpdate && existingRagId) {
            const { data: existingRagData, error: fetchError } = await supabase
                .from('bdd_rag')
                .select('prompt')
                .eq('id', existingRagId)
                .maybeSingle();
            
            if (!fetchError && existingRagData?.prompt) {
                existingPrompt = existingRagData.prompt as string;
            }
        }

        const payload = {
            pdf_infos_id: String(pdfId),
            entreprise_id: Number(entrepriseId),
            user_id: userId,
            raw_text: ragData.raw_text,
            perfect_answer: null, // Placeholder : pas de perfect_answer
            document_type: ragData.document_type,
            force_image: false,
            embedding: ragData.embedding ?? null,
        };

        if (isUpdate && existingRagId) {
            // Mise à jour
            const updatePayload: Record<string, unknown> = {
                raw_text: payload.raw_text,
                perfect_answer: null, // S'assurer que perfect_answer est null
                document_type: payload.document_type,
                embedding: payload.embedding,
            };

            if (pdfChanged) {
                updatePayload.pdf_infos_id = payload.pdf_infos_id;
            }

            if (existingPrompt) {
                updatePayload.prompt = existingPrompt;
            }

            const { error: updateError } = await supabase
                .from('bdd_rag')
                .update(updatePayload)
                .eq('id', existingRagId);

            if (updateError) {
                console.error('❌ Erreur lors de la mise à jour du placeholder RAG:', updateError);
                return;
            }
        } else {
            // Création
            const { error: insertError } = await supabase
                .from('bdd_rag')
                .insert(payload);

            if (insertError) {
                console.error('❌ Erreur lors de l\'insertion du placeholder RAG:', insertError);
                return;
            }
        }

        // Lier le PDF au RAG créé/mis à jour
        if (ragData.requires_pdf_info_link) {
            const { data: ragRows } = await supabase
                .from('bdd_rag')
                .select('id')
                .eq('pdf_infos_id', pdfId)
                .eq('entreprise_id', entrepriseId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (ragRows?.id) {
                await supabase
                    .from('pdf_infos')
                    .update({ id_rag: ragRows.id })
                    .eq('id', pdfId)
                    .eq('entreprise_id', entrepriseId);
            }
        }

        console.log('✅ Placeholder RAG créé avec succès pour PDF:', pdfId);
    } catch (error) {
        // Gestion silencieuse des erreurs (log uniquement)
        console.error('❌ Erreur lors de la création du placeholder RAG:', error);
    }
};

