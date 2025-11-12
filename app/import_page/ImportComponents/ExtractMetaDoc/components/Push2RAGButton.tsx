import { useState, useCallback } from "react";
import { toast } from 'react-hot-toast';
import Swal from "sweetalert2";
import { supabase } from "@/app/database/supabaseClient";
import { useSession } from "@/app/component/SessionProvider";

interface Push2RAGButtonProps {
    pdfId: string | number;
    pdfPath: string;
    docData: Record<string, unknown> | null; // Les données extraites/modifiées du document
    documentType?: string; // Type de document (bon, bsd, facture)
    disabled?: boolean;
    forceImage?: boolean; // Indique si le mode image a été utilisé pour l'extraction
}

const Push2RAGButton = ({ pdfId, pdfPath, docData, documentType, disabled, forceImage = false }: Push2RAGButtonProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const { entreprise_id, user_id } = useSession();

    const handlePushToRAG = useCallback(async () => {
        if (!docData) {
            toast.error("Aucune donnée de document à envoyer");
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
            formData.append('extracted_data', JSON.stringify(docData));
            formData.append('document_type', documentType || 'inconnu');

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

            const result = await response.json();
            
            console.log('📊 Réponse complète push to RAG:', result);
            
            if (result.success) {
                // Sauvegarder dans Supabase
                console.log('💾 Tentative de sauvegarde dans bdd_rag avec:', {
                    pdf_infos_id: String(pdfId),
                    entreprise_id: Number(entreprise_id),
                    user_id: user_id,
                    document_type: result.data.document_type,
                    raw_text_length: result.data.raw_text?.length || 0,
                    perfect_answer_keys: Object.keys(result.data.gemini_answer || {})
                });

                const { error: dbError } = await supabase
                    .from('bdd_rag')
                    .insert({
                        pdf_infos_id: String(pdfId),
                        entreprise_id: Number(entreprise_id),
                        user_id: user_id,
                        raw_text: result.data.raw_text,
                        perfect_answer: result.data.gemini_answer,
                        document_type: result.data.document_type,
                        force_image: forceImage
                    });

                if (dbError) {
                    console.error('❌ Erreur sauvegarde BDD RAG:', dbError);
                    console.error('❌ Détails de l\'erreur:', {
                        code: dbError.code,
                        message: dbError.message,
                        details: dbError.details,
                        hint: dbError.hint
                    });
                    toast.error(`Erreur sauvegarde: ${dbError.message}`);
                } else {
                    toast.success('Document envoyé vers RAG et sauvegardé avec succès');
                    console.log('✅ Données RAG traitées et sauvegardées:', result.data);
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
    }, [pdfId, pdfPath, docData, documentType, entreprise_id, user_id, forceImage]);

    return (
        <button
            onClick={handlePushToRAG}
            disabled={disabled || isLoading || !docData}
            className="bg-purple-600 text-sm text-white px-3 py-1 w-[80px] rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Envoyer vers RAG"
        >
            {isLoading ? '...' : 'RAG'}
        </button>
    );
};

export default Push2RAGButton;
