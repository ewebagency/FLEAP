import { supabase } from "@/app/database/supabaseClient";
import { NextResponse } from "next/server";
import axios from "axios";

const token_sandbox = 'tCJJTq0Da55LuoJMc35QEqwomMRDwl10xT1hI2UV';
const url_sandbox = 'https://api.sandbox.trackdechets.beta.gouv.fr';

export async function POST(request: Request) {
    const { id } = await request.json();

    //Check if the BSD is on TrackDéchets
    const { data:bsd, error:bsdError } = await supabase.from('bsd').select('on_track_dechets, status_track_dechets, id_track_dechets').eq('id', id).single();
    if(bsd?.on_track_dechets){
        const trackDechetsResponse = await Seal_BSD_API(bsd.id_track_dechets);
        if(trackDechetsResponse.status === 200){
            //Delete from Supabase
            const { data, error } = await supabase.from('bsd').update({status_track_dechets: "SEALED"}).eq('id', id);
            return NextResponse.json({ data, error });
        }
    }
    return NextResponse.json({ error: "BSD not on TrackDéchets" });
}

const Seal_BSD_API = async (id:string) => {

    const query = `
    mutation {
        markAsSealed(id: "${id}") {
            id
        }
    }
    `;
    const response = await axios.post(
        url_sandbox,
        { query: query },
        {
            headers: {
                Authorization: `Bearer ${token_sandbox}`,
                'Content-Type': 'application/json'
            }
        }
    );

    return response;
}
