/*import { supabase } from "@/app/database/supabaseClient";
import { FormInput, CompleteFormInput } from "../interface/BSD_Interface";

export const createCollectRequest = async (
    userId: string,
    entrepriseId: string,
    baseData: {
        emitter: FormInput['emitter'];
        transporter?: FormInput['transporter'];
        recipient?: FormInput['recipient'];
    },
    wasteLines: {
        wasteDetails: FormInput['wasteDetails'];
        collectDate: string;
    }[]
) => {
    try {
        const promises = wasteLines.map(line => {
            const formData: FormInput = {
                ...baseData,
                wasteDetails: line.wasteDetails,
                created_at: line.collectDate,
                // Autres champs requis avec valeurs par défaut...
            } as FormInput;

            return supabase
                .from('bsd')
                .insert({
                    user_id: userId,
                    entreprise_id: entrepriseId,
                    infos_json: {
                        formAPI: { createFormInput: formData }
                    },
                    status_track_dechets: 'Ligne demandée',
                    created_on_fleap: true
                });
        });

        await Promise.all(promises);
        return { success: true, message: "Demandes de collecte créées avec succès" };
    } catch (error) {
        console.error('Erreur lors de la création des demandes:', error);
        return { success: false, message: "Erreur lors de la création des demandes" };
    }
};

// Fonction pour récupérer toutes les options depuis Supabase
export const getAllOptions = async (entreprise_id: string): Promise<CompleteFormInput[]> => {
    try {
        const { data, error } = await supabase
            .from('table_parametrage')
            .select('json_row, other_infos')
            .eq('entreprise_id', entreprise_id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erreur lors de la récupération des options:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Erreur lors de la récupération des options:', error);
        return [];
    }
};

*/

import { BSD } from "../TableBSD";
import { supabase } from "@/app/database/supabaseClient";
import { toast } from "react-hot-toast";
import Swal from 'sweetalert2';
import { OtherInfos } from "../interface/BSD_Interface";

interface OtherInfosWithRecipient extends OtherInfos {
    recipientEmail?: string;
}

interface BSDWithRecipient extends BSD {
    other_infos: OtherInfosWithRecipient;
}

export const handleCancelCollecte = async (bsd: BSDWithRecipient) => {
    try {
        // Vérifier si l'email du destinataire est disponible
        const recipientEmail = bsd.other_infos?.recipientEmail;
        
        if (!recipientEmail) {
            await Swal.fire({
                title: 'Erreur',
                text: "Impossible d'annuler : l'email du destinataire n'est pas disponible",
                icon: 'error',
                confirmButtonText: 'OK'
            });
            return false;
        }

        // Préparer les données du mail
        const wasteDetails = bsd.infos_json.formAPI.createFormInput.wasteDetails;
        const collectDate = new Date(bsd.created_at).toLocaleDateString('fr-FR');
        const containerInfo = bsd.other_infos?.containerDescription || 'Non spécifié';
        const volume = bsd.other_infos?.volume ? `${bsd.other_infos.volume} ${bsd.other_infos.volumeUnit || ''}` : 'Non spécifié';
        const emitterEmail = bsd.infos_json.formAPI.createFormInput.emitter?.company?.mail;

        // Afficher l'aperçu du mail
        const mailPreviewResult = await Swal.fire({
            title: 'Aperçu du mail d\'annulation',
            html: `
                <div class="text-left text-sm">
                    <p><strong>De :</strong> ${emitterEmail || 'Non spécifié'}</p>
                    <p><strong>À :</strong> ${recipientEmail}</p>
                    <p><strong>Objet :</strong> Annulation de la demande de collecte</p>
                    <hr class="my-3">
                    <div class="mt-4 ml-4">
                        <h2 class="font-bold">Annulation de la demande de collecte</h2>
                        <p>Bonjour, j'aimerais annuler la demande de collecte suivante :</p>
                        <ul class="list-disc pl-5">
                            <li>Date de collecte prévue : ${collectDate}</li>
                            <li>Déchet : ${wasteDetails.name} (${wasteDetails.code})</li>
                            <li>Contenant : ${containerInfo} ${volume}</li>
                        </ul>
                        <p>Merci et bonne journée</p>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Envoyer et annuler',
            cancelButtonText: 'Retour',
            confirmButtonColor: '#d33',
            width: '600px',
            customClass: {
                htmlContainer: 'text-left'
            }
        });

        if (!mailPreviewResult.isConfirmed) {
            return false;
        }

        // Envoyer le mail d'annulation
        try {
            const mailResponse = await fetch('/api/send_mail', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: recipientEmail,
                    cc: '',  // Champ optionnel
                    replyTo: emitterEmail,
                    subject: 'Annulation de la demande de collecte',
                    text: `Bonjour, j'aimerais annuler la demande de collecte suivante :

Date de collecte prévue : ${collectDate}
Déchet : ${wasteDetails.name} (${wasteDetails.code})
Contenant : ${containerInfo} ${volume}

Merci et bonne journée`
                })
            });

            if (!mailResponse.ok) {
                throw new Error('Erreur lors de l\'envoi du mail');
            }
        } catch (error) {
            console.error('Erreur lors de l\'envoi du mail:', error);
            const continueResult = await Swal.fire({
                title: 'Erreur d\'envoi du mail',
                text: "Le mail d'annulation n'a pas pu être envoyé. Voulez-vous quand même supprimer la demande ?",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Oui, supprimer',
                cancelButtonText: 'Non, annuler'
            });

            if (!continueResult.isConfirmed) {
                return false;
            }
        }

        // Si le BSD a une photo, la supprimer du storage
        if (bsd.photo && typeof bsd.photo === 'string') {
            const photoFileName = bsd.photo.split('/').pop();
            if (photoFileName) {
                const { error: storageError } = await supabase.storage
                    .from('photos')
                    .remove([photoFileName]);
                
                if (storageError) {
                    console.error('Erreur lors de la suppression de la photo:', storageError);
                }
            }
        }

        // Supprimer le BSD
        const { error: deleteError } = await supabase
            .from('bsd')
            .delete()
            .eq('id', bsd.id);

        if (deleteError) {
            throw deleteError;
        }

        toast.success('La demande de collecte a été annulée avec succès');
        return true;

    } catch (error) {
        console.error('Erreur lors de l\'annulation de la collecte:', error);
        await Swal.fire({
            title: 'Erreur',
            text: 'Une erreur est survenue lors de l\'annulation de la collecte',
            icon: 'error',
            confirmButtonText: 'OK'
        });
        return false;
    }
};
