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