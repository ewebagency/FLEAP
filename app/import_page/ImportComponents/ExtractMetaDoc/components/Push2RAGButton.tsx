import { useState, useCallback, MutableRefObject } from "react";
import { toast } from 'react-hot-toast';
import Swal from "sweetalert2";
import { supabase } from "@/app/database/supabaseClient";
import { useSession } from "@/app/component/SessionProvider";

interface RagObjects {
    pdf_id: string;
    raw_text: string;
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
}

interface ProcessDocumentForRagSuccess {
    success: true;
    message: string;
    data: RagObjects;
}

interface ProcessDocumentForRagError {
    success: false;
    error: string;
    pdf_id?: string;
}

type ProcessDocumentForRagResponse = ProcessDocumentForRagSuccess | ProcessDocumentForRagError;

interface BddRagInsertPayload {
    pdf_infos_id: string;
    entreprise_id: number;
    user_id: string | number;
    raw_text: string;
    perfect_answer: Record<string, unknown>;
    document_type: string;
    force_image: boolean;
}

interface BddRagRow {
    id: string | number;
}

interface Push2RAGButtonProps {
    pdfId: string | number;
    pdfPath: string;
    docData?: Record<string, unknown> | null; // Les données extraites/modifiées du document
    docDataRef?: MutableRefObject<Record<string, unknown> | null>;
    documentType?: string; // Type de document (bon, bsd, facture)
    disabled?: boolean;
    forceImage?: boolean; // Indique si le mode image a été utilisé pour l'extraction
    onRagPushSuccess?: () => void; // Callback appelé après un push réussi pour recharger id_rag
}

const Push2RAGButton = ({ pdfId, pdfPath, docData = null, docDataRef, documentType, disabled, forceImage = false, onRagPushSuccess }: Push2RAGButtonProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const { entreprise_id, user_id } = useSession();

    const handlePushToRAG = useCallback(async () => {
        const currentDocData = docDataRef?.current ?? docData;

        if (!currentDocData) {
            toast.error("Aucune donnée de document à envoyer");
            return;
        }

        if (user_id == null) {
            toast.error("Utilisateur non identifié, impossible d'envoyer vers RAG");
            return;
        }

        // Confirmation avec SweetAlert
            const result = await Swal.fire({
            title: 'Êtes-vous sûr ?',
            text: 'Voulez-vous envoyer ce document et ses données extraites vers le système RAG ?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Oui, envoyer',
            cancelButtonText: 'Annuler'
        });

        if (!result.isConfirmed) {
            return;
        }

        try {
            setIsLoading(true);

            // Utiliser l'URL signée déjà en cache dans sessionStorage (comme dans ExtractDoc)
            const pdfUrlStorageKey = `extractDoc:pdfUrl:${pdfPath}`;
            let signedUrl = sessionStorage.getItem(pdfUrlStorageKey);
            
            // Si pas en cache, récupérer l'URL signée
            if (!signedUrl) {
                const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                    .from('pdfs_bucket')
                    .createSignedUrl(pdfPath, 3600);

                if (signedUrlError || !signedUrlData?.signedUrl) {
                    throw new Error('Impossible d\'obtenir l\'URL signée du PDF');
                }
                
                signedUrl = signedUrlData.signedUrl;
                // Mettre en cache pour les prochaines utilisations
                try { sessionStorage.setItem(pdfUrlStorageKey, signedUrl); } catch {}
            }

            // Télécharger le PDF et le convertir en File
            const blobResp = await fetch(signedUrl);
            if (!blobResp.ok) {
                throw new Error('Impossible de télécharger le PDF');
            }
            const pdfBlob = await blobResp.blob();
            const file = new File([pdfBlob], `document_${pdfId}.pdf`, { type: 'application/pdf' });

            // Préparer FormData comme dans meta-ocr
            const formData = new FormData();
            formData.append('file', file);
            formData.append('pdf_id', String(pdfId));
            formData.append('extracted_data', JSON.stringify(currentDocData));
            formData.append('document_type', documentType || 'inconnu');
            formData.append('entreprise_id', String(entreprise_id));

            // Appel à l'API backend Python
            const url = `${process.env.NEXT_PUBLIC_SERVER_PYTHON}/push_to_rag`;
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
                throw new Error(errorData.error || `Erreur HTTP: ${response.status}`);
            }

            const result = await response.json() as ProcessDocumentForRagResponse;
            
            console.log('📊 Réponse complète push to RAG:', result);
            
            if (result.success) {
                // Sauvegarder dans Supabase
                const ragData = result.data;
                console.log('💾 Tentative de sauvegarde dans bdd_rag avec:', {
                    pdf_infos_id: String(pdfId),
                    entreprise_id: Number(entreprise_id),
                    user_id: user_id,
                    document_type: ragData.document_type,
                    raw_text_length: ragData.raw_text?.length || 0,
                    perfect_answer_keys: Object.keys(ragData.gemini_answer || {}),
                    requires_pdf_info_link: ragData.requires_pdf_info_link
                });

                // Vérifier si un enregistrement RAG existe déjà pour ce PDF
                // Le backend retourne déjà cette info dans ragData.is_update et ragData.existing_rag_id
                const isUpdate = ragData.is_update === true;
                const existingRagId = ragData.existing_rag_id ? String(ragData.existing_rag_id) : null;
                const pdfChanged = ragData.pdf_changed === true;

                // Si c'est une mise à jour, récupérer le prompt existant pour le préserver
                let existingPrompt: string | null = null;
                if (isUpdate && existingRagId) {
                    const { data: existingRagData, error: fetchError } = await supabase
                        .from('bdd_rag')
                        .select('prompt')
                        .eq('id', existingRagId)
                        .maybeSingle();
                    
                    if (!fetchError && existingRagData?.prompt) {
                        existingPrompt = existingRagData.prompt as string;
                        console.log('📝 Prompt existant récupéré, sera préservé');
                    }
                }

                const payload: BddRagInsertPayload = {
                    pdf_infos_id: String(pdfId),
                    entreprise_id: Number(entreprise_id),
                    user_id: user_id,
                    raw_text: ragData.raw_text,
                    perfect_answer: ragData.gemini_answer,
                    document_type: ragData.document_type,
                    force_image: forceImage
                };

                let newRagId: string | null = null;

                if (isUpdate && existingRagId) {
                    // Mise à jour de l'enregistrement existant
                    console.log('🔄 Mise à jour de l\'enregistrement RAG existant:', existingRagId);
                    if (pdfChanged) {
                        console.log('📄 PDF changé, mise à jour de pdf_infos_id et raw_text');
                    }
                    
                    // Préparer les données de mise à jour (sans écraser le prompt s'il existe)
                    const updateData: Record<string, unknown> = {
                        raw_text: payload.raw_text,
                        perfect_answer: payload.perfect_answer,
                        document_type: payload.document_type,
                        force_image: payload.force_image,
                        user_id: payload.user_id
                    };
                    
                    // Si le PDF a changé, mettre à jour aussi pdf_infos_id
                    if (pdfChanged) {
                        updateData.pdf_infos_id = String(pdfId);
                        console.log('📄 Mise à jour pdf_infos_id:', payload.pdf_infos_id);
                    }
                    
                    // Ne pas écraser le prompt s'il existe déjà
                    if (existingPrompt !== null) {
                        updateData.prompt = existingPrompt;
                    }
                    
                    const { data: updatedRagRow, error: updateError } = await supabase
                        .from('bdd_rag')
                        .update(updateData)
                        .eq('id', existingRagId)
                        .select('id')
                        .single<BddRagRow>();

                    if (updateError) {
                        console.error('❌ Erreur mise à jour BDD RAG:', updateError);
                        console.error('❌ Détails de l\'erreur:', {
                            code: updateError.code,
                            message: updateError.message,
                            details: updateError.details,
                            hint: updateError.hint
                        });
                        toast.error(`Erreur mise à jour: ${updateError.message}`);
                        return;
                    }

                    newRagId = updatedRagRow?.id ? String(updatedRagRow.id) : existingRagId;
                    console.log('✅ Enregistrement RAG mis à jour:', newRagId);
                } else {
                    // Insertion d'un nouvel enregistrement
                    console.log('➕ Création d\'un nouvel enregistrement RAG');
                    
                    const { data: insertedRagRow, error: insertError } = await supabase
                        .from('bdd_rag')
                        .insert(payload)
                        .select('id')
                        .single<BddRagRow>();

                    if (insertError) {
                        console.error('❌ Erreur sauvegarde BDD RAG:', insertError);
                        console.error('❌ Détails de l\'erreur:', {
                            code: insertError.code,
                            message: insertError.message,
                            details: insertError.details,
                            hint: insertError.hint
                        });
                        toast.error(`Erreur sauvegarde: ${insertError.message}`);
                        return;
                    }

                    newRagId = insertedRagRow?.id ? String(insertedRagRow.id) : null;

                    if (!newRagId) {
                        toast.error('Impossible de récupérer l\'identifiant RAG nouvellement créé');
                        console.error('❌ Aucune donnée renvoyée après insertion dans bdd_rag');
                        return;
                    }
                    
                    console.log('✅ Nouvel enregistrement RAG créé:', newRagId);
                }

                // Mettre à jour pdf_infos du nouveau PDF avec id_rag
                // Note: On ne retire pas id_rag de l'ancien PDF car plusieurs PDFs peuvent partager le même RAG
                const { error: updatePdfErr } = await supabase
                    .from('pdf_infos')
                    .update({ id_rag: newRagId })
                    .eq('id', String(pdfId))
                    .eq('entreprise_id', Number(entreprise_id));

                if (updatePdfErr) {
                    console.error('❌ Erreur mise à jour pdf_infos avec id_rag:', updatePdfErr);
                    const action = isUpdate ? 'mis à jour' : 'créé';
                    toast.error(`RAG ${action} mais lien PDF infos impossible: ${updatePdfErr.message}`);
                    return;
                }

                const action = isUpdate ? 'mis à jour' : 'créé';
                const pdfChangeMsg = pdfChanged ? ' (PDF changé)' : '';
                toast.success(`Document envoyé vers RAG (${action})${pdfChangeMsg} et lié à la fiche PDF`);
                console.log(`✅ Données RAG traitées, ${action} et liées:`, { ...ragData, rag_id: newRagId });
                
                // Recharger id_rag depuis la BDD pour que ModifyPrompts puisse fonctionner
                if (onRagPushSuccess) {
                    await onRagPushSuccess();
                }
            } else {
                toast.error(`Erreur RAG: ${result.error || 'Erreur inconnue'}`);
                console.error('❌ Erreur RAG:', result);
            }

        } catch (error) {
            console.error('Erreur lors de l\'envoi vers RAG:', error);
            toast.error(`Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        } finally {
            setIsLoading(false);
        }
    }, [pdfId, pdfPath, docData, docDataRef, documentType, entreprise_id, user_id, forceImage]);

    return (
        <button
            onClick={handlePushToRAG}
            disabled={disabled || isLoading || (!docData && !docDataRef?.current)}
            className="bg-purple-600 text-sm text-white px-3 py-1 w-[80px] rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Envoyer vers RAG"
        >
            {isLoading ? '...' : 'RAG'}
        </button>
    );
};

export default Push2RAGButton;
