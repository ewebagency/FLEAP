import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/app/database/supabaseClient';
import { DataOnSupabase_infos_json } from '@/app/register/interface/BSD_Interface';

const url_sandbox = process.env.TRACKDECHETS_URL_SANDBOX;
const token_sandbox = process.env.TRACKDECHETS_TOKEN_SANDBOX;

const updateTrackdechets = async (data: DataOnSupabase_infos_json, bsdId: string) => {
    console.log('datalaaaaa', data);
    try {
        const mutation = `
            mutation UpdateForm($updateFormInput: UpdateFormInput!) {
                updateForm(updateFormInput: $updateFormInput) {
                    id
                    readableId
                    status
                }
            }
        `;

        // Préparer les données pour la mutation
        const variables = {
            updateFormInput: {
                ...data.formAPI.createFormInput,
                id: bsdId
            }
        };

        if (!url_sandbox) {
            throw new Error('TRACKDECHETS_URL_SANDBOX environment variable is not defined');
        }

        const response = await axios.post(
            url_sandbox,
            { query: mutation, variables },
            {
                headers: {
                    Authorization: `Bearer ${token_sandbox}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.status === 200) {
            console.log('BSD modifié avec succès sur Trackdéchets');
            return {
                success: true, 
                data: response.data,
                error: null
            };
        } else {
            return {
                success: false,
                error: "Erreur lors de la modification du BSD sur Trackdéchets",//response.data.errors[0].message,
                data: null
            };
        }
    } catch (error) {
        console.error('Erreur lors de la modification du BSD sur Trackdéchets:');//, error.response.data);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Une erreur inconnue est survenue',
            data: null
        };
    }
};

export async function POST(request: Request) {
    try {
        const { user_id, bsd_id, data } = await request.json();

        if (!user_id || !bsd_id || !data) {
            return NextResponse.json({ 
                success: false, 
                message: "Données manquantes" 
            });
        }

        // 1. Récupérer l'ID Trackdéchets du BSD
        const { data: bsdData, error: bsdError } = await supabase
            .from('bsd')
            .select('id_track_dechets')
            .eq('id', bsd_id)
            .single();

        if (bsdError || !bsdData) {
            throw new Error("Erreur lors de la récupération de l'ID Trackdéchets");
        }

        // 2. Mise à jour dans Trackdéchets
        const trackdechetsResponse = await updateTrackdechets(data, bsdData.id_track_dechets);
        
        if (!trackdechetsResponse.success) {
            return NextResponse.json({ 
                success: false, 
                message: `Erreur lors de la mise à jour sur Trackdéchets: ${trackdechetsResponse.error}` 
            });
        }

        // 3. Mise à jour dans Supabase
        const { error: supabaseError } = await supabase
            .from('bsd')
            .update({ 
                infos_json: data,
            })
            .eq('id', bsd_id)
            .eq('user_id', user_id);

        if (supabaseError) {
            throw new Error(supabaseError.message);
        }

        return NextResponse.json({ 
            success: true, 
            message: "BSD modifié avec succès",
            trackdechetsData: trackdechetsResponse.data
        });

    } catch (error) {
        console.error("Erreur lors de la modification du BSD:", error);
        return NextResponse.json({ 
            success: false, 
            message: "Erreur lors de la modification du BSD",
            error: error instanceof Error ? error.message : 'Une erreur inconnue est survenue'
        });
    }
}
