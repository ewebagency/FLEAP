import { supabase } from "@/app/database/supabaseClient";
import { NextResponse } from "next/server";
import axios from "axios";

const token_sandbox = 'tCJJTq0Da55LuoJMc35QEqwomMRDwl10xT1hI2UV';
const url_sandbox = 'https://api.sandbox.trackdechets.beta.gouv.fr';

export async function POST(request: Request) {
    const { id } = await request.json();

    //Check if the BSD is on TrackDéchets
    const { data:bsd, error:bsdError } = await supabase.from('bsd').select('infos_json, on_track_dechets, status_track_dechets, id_track_dechets').eq('id', id).single();

    if(bsd?.on_track_dechets){
        const trackDechetsResponse = await Sign_BSD_API(bsd.id_track_dechets, bsd.infos_json);
        if(trackDechetsResponse.status === 200){
            //Delete from Supabase
            const statut_signed_by_producer = trackDechetsResponse.data.data.signEmissionForm.status;
            const { data, error } = await supabase.from('bsd').update({status_track_dechets: statut_signed_by_producer}).eq('id', id);
            return NextResponse.json({ data, error });
        }
    }
    return NextResponse.json({ error: "BSD not on TrackDéchets" });
}

const Sign_BSD_API = async (id:string, infos_json:any) => {

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
        return response;
    } catch (error:{response?:{data:string}}) {
        console.log(error.response ? error.response.data : error.message);
        throw error;
    }
}
