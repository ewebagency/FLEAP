import { useEffect } from "react";
import { supabase } from '@/app/database/supabaseClient';
import { toast } from 'react-hot-toast';
import Swal from "sweetalert2";

export const handleDeleteLinkBSD_PDF = async (pdfId: number, modalId: string, entreprise_id: string | null) => {

    //Message pour demander confirmation de suppression
    const confirm = await Swal.fire({
    title: "Supprimer le lien BSD-PDF",
    text: "Voulez-vous vraiment supprimer le lien entre le PDF et le BSD ?",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Oui, supprimer !',
    cancelButtonText: 'Annuler'
    });

    if (!confirm.isConfirmed) return;

    try {

    // 1. Récupérer l'ID du bsd_pdf et le linked_bsd_id
    const { data: bsdPdfData, error: bsdPdfError } = await supabase
      .from('bsd_pdf')
      .select('id, linked_bsd_id')
      .eq('pdf_id', pdfId)
      .eq('entreprise_id', entreprise_id)
      .single();

    if (bsdPdfError) throw new Error('Erreur lors de la récupération du BSD PDF');
    if (!bsdPdfData) throw new Error('BS PDF non trouvé');
    if (!bsdPdfData.linked_bsd_id) throw new Error('Aucun BSD lié à ce PDF');

    const linkedBsdId = bsdPdfData.linked_bsd_id;

    console.log("modalId", modalId, "linkedBsdId", linkedBsdId);

    // 2. Récupérer les pdf_ids actuels du BSD
    const { data: bsdData, error: bsdError } = await supabase
      .from('bsd')
      .select('pdf_ids')
      .eq('id', linkedBsdId)
      .eq('entreprise_id', entreprise_id)
      .single();

    if (bsdError) throw new Error('Erreur lors de la récupération du BSD');
    if (!bsdData) throw new Error('BSD non trouvé');

    // 3. Supprimer le pdf_id de l'array pdf_ids
    const currentPdfIds :string[] = bsdData.pdf_ids || [];
    const newPdfIds = currentPdfIds.filter((id: string) => id !== pdfId.toString());

    // 4. Mettre à jour le BSD : supprimer bsd_extracted_then_linked_id et mettre à jour pdf_ids
    const { error: updateBsdError } = await supabase
      .from('bsd')
      .update({
        bsd_extracted_then_linked_id: null,
        pdf_ids: newPdfIds
      })
      .eq('id', linkedBsdId)
      .eq('entreprise_id', entreprise_id);

    if (updateBsdError) throw new Error('Erreur lors de la mise à jour du BSD');

    // 5. Supprimer le linked_bsd_id du bsd_pdf
    const { error: updateBsdPdfError } = await supabase
      .from('bsd_pdf')
      .update({
        linked_bsd_id: null
      })
      .eq('id', bsdPdfData.id)
      .eq('entreprise_id', entreprise_id);

    if (updateBsdPdfError) throw new Error('Erreur lors de la mise à jour du BS PDF');

    // 6. Mettre à jour le statut dans pdf_infos à 'read'
    const { error: updatePdfInfosError } = await supabase
      .from('pdf_infos')
      .update({ 
        status: 'read'
      })
      .eq('id', pdfId)
      .eq('entreprise_id', entreprise_id);

    if (updatePdfInfosError) throw new Error('Erreur lors de la mise à jour du statut PDF');

    toast.success('Lien BSD-PDF supprimé avec succès');
    
    // Retourner les données mises à jour pour rafraîchir l'interface
    return {
      success: true,
      linkedBsdId,
      newPdfIds
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
    toast.error(errorMessage);
    return {
      success: false,
      error: errorMessage
    };
  }
};