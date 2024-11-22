import { supabase } from "@/app/database/supabaseClient";
import { NextResponse } from "next/server";
import axios from "axios";

const token_sandbox = process.env.TRACKDECHETS_TOKEN_SANDBOX;
const url_sandbox = process.env.TRACKDECHETS_URL_SANDBOX;

interface FormAPI_en_gros {formAPI: {createFormInput: {emitter: {company: {contact: string}}, wasteDetails: {onuCode: string, quantity: number}}}};
interface ReponseTrack {
    status: number,
    status_signed_by_producer: string
}


export async function POST(request: Request) {
    const { id } = await request.json();

    //Check if the BSD is on TrackDéchets
    const { data:bsd } = await supabase.from('bsd').select('infos_json, on_track_dechets, status_track_dechets, id_track_dechets').eq('id', id).single();

    if(bsd?.on_track_dechets){
        const trackDechetsResponse : ReponseTrack = await Sign_BSD_API(bsd.id_track_dechets, bsd.infos_json);
        if(trackDechetsResponse.status === 200){
            //Delete from Supabase
            const statut_signed_by_producer = trackDechetsResponse.status_signed_by_producer;
            const { data, error } = await supabase.from('bsd').update({status_track_dechets: statut_signed_by_producer}).eq('id', id);
            return NextResponse.json({ data, error });
        }
    }
    return NextResponse.json({ error: "BSD not on TrackDéchets" });
}

const Sign_BSD_API = async (id:string, infos_json:FormAPI_en_gros) => {

    const json_form = infos_json;//JSON.parse(JSON.stringify(infos_json));
    const personne = json_form.formAPI.createFormInput.emitter.company.contact;
    const onuCode = json_form.formAPI.createFormInput.wasteDetails.onuCode;   
    const quantity = json_form.formAPI.createFormInput.wasteDetails.quantity;
    const emittedAt = new Date().toISOString().split('T')[0];

    const transporterNumberPlate = "AA-123456-BB"; // à changer très vitee


    const SignEmissionFormInput = {
        "quantity": quantity,
        "onuCode": onuCode,
        "transporterNumberPlate": transporterNumberPlate,
        "emittedAt": emittedAt,
        "emittedBy": personne,
        "emittedByEcoOrganisme": false
    }

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
        const response = await axios.post(
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
        console.log("Statut Response pour Sign by Producer", response.status);
        const data = response.data as {data: {signEmissionForm: {status: string}}};
        return {status: response.status, status_signed_by_producer: data.data.signEmissionForm.status};
    } catch (error) {
        console.log(error);
        throw error;
    }
}
