import { supabase } from "@/app/database/supabaseClient";
import { NextResponse } from "next/server";
import axios from "axios";
import { FormInput } from "@/app/register/interface/BSD_Interface";

const token_sandbox = process.env.TRACKDECHETS_TOKEN_SANDBOX;
const url_sandbox = process.env.TRACKDECHETS_URL_SANDBOX;

interface FormAPI_en_gros {formAPI: {createFormInput: {emitter: {company: {contact: string}}, wasteDetails: {onuCode: string, quantity: number}}}};
interface ReponseTrack {
    status: number,
    status_signed_by_producer: string
}


export async function POST(request: Request) {
    try {
        const { id } = await request.json();

        const { data: bsd, error: bsdError } = await supabase
            .from('bsd')
            .select('infos_json, on_track_dechets, status_track_dechets, id_track_dechets')
            .eq('id', id)
            .single();

        if (bsdError) {
            return NextResponse.json({ 
                success: false, 
                error: "Erreur lors de la récupération du BSD"
            }, { status: 404 });
        }

        if (!bsd?.on_track_dechets) {
            return NextResponse.json({ 
                success: false, 
                error: "BSD non présent sur TrackDéchets"
            }, { status: 400 });
        }

        const trackDechetsResponse = await Sign_BSD_API(bsd.id_track_dechets, bsd.infos_json);
        
        if (!trackDechetsResponse.success) {
            return NextResponse.json(trackDechetsResponse, { status: trackDechetsResponse.status });
        }

        const { error: updateError } = await supabase
            .from('bsd')
            .update({ status_track_dechets: trackDechetsResponse.status_signed_by_producer })
            .eq('id', id);

        if (updateError) {
            return NextResponse.json({ 
                success: false, 
                error: "Erreur lors de la mise à jour du statut",
                details: updateError
            }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            data: trackDechetsResponse.status_signed_by_producer
        }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ 
            success: false, 
            error: "Erreur lors du traitement de la requête",
            details: error
        }, { status: 500 });
    }
}

const Sign_BSD_API = async (id: string, infos_json: { formAPI: { createFormInput: FormInput } }) => {
    try {
        const json_form = infos_json;
        const formInput = json_form.formAPI.createFormInput;
        
        // Extraction des données nécessaires
        const personne = formInput.emitter.company.contact;
        const onuCode = formInput.wasteDetails.onuCode;   
        const quantity = formInput.wasteDetails.quantity;
        const transporterNumberPlate = formInput.transporter.numberPlate;
        const packagingInfos = formInput.wasteDetails.packagingInfos;
        const nonRoadRegulationMention = formInput.wasteDetails.nonRoadRegulationMention;

        /*if (!transporterNumberPlate || transporterNumberPlate.trim() === '') {
            return {
                success: false,
                error: "La plaque d'immatriculation du transporteur est requise",
                status: 400
            };
        }*/

        const SignEmissionFormInput = {
            quantity,                    // Float! (<40T route, <50000T tous transports)
            onuCode,                    // String (ADR)
            packagingInfos,             // [PackagingInfoInput!]
            nonRoadRegulationMention,   // String (optionnel - RID, ADNR, IMDG)
            transporterNumberPlate,      // String
            emittedAt: new Date().toISOString().split('T')[0], // DateTime!
            emittedBy: personne,        // String!
            emittedByEcoOrganisme: false // Boolean
        };

        const query = `
            mutation SignEmissionForm($id: ID!, $input: SignEmissionFormInput!) {
            signEmissionForm(id: $id, input: $input) {
                id
                status
            }
            }
        `;

        if(!url_sandbox || !token_sandbox) {
            throw new Error("URL ou token Trackdéchets non définis");
        }
        try {
            //console.log("SignEmissionFormInput", SignEmissionFormInput);
            const response: {status: number, data: {data: {signEmissionForm: {status: string}}, errors: {message: string}[] | null}} = await axios.post(
                url_sandbox,
                {   
                    query: query,
                    variables: {
                        id: id,
                        input: SignEmissionFormInput
                    }
                },
                {
                    headers: {
                        Authorization: `Bearer ${token_sandbox}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // Vérification des erreurs GraphQL
            if (response.data.errors) {
                return {
                    success: false,
                    error: response.data.errors[0]?.message || "Erreur lors de la signature",
                    status: 400
                };
            }

            // Vérification de la présence des données
            if (!response.data?.data?.signEmissionForm) {
                return {
                    success: false,
                    error: "Réponse invalide de TrackDéchets",
                    status: 500
                };
            }

            console.log("Statut Response pour Sign by Producer", response.status);
            const data = response.data as {data: {signEmissionForm: {status: string}}};

            return {
                success: true,
                status: response.status,
                status_signed_by_producer: data.data.signEmissionForm.status
            };
        } catch (error) {
            // Gestion des erreurs GraphQL spécifiques
            const axiosError = error as { response?: { data?: { errors?: { message: string }[] } } };
            if (axiosError.response?.data?.errors) {
                return {
                    success: false,
                    error: axiosError.response.data.errors[0]?.message || "Erreur GraphQL",
                    status: 400
                };
            }
            throw error;
        }
    } catch (error) {
        return {
            success: false,
            error: "Erreur lors de la signature sur TrackDéchets",
            details: error,
            status: 500
        };
    }
}
