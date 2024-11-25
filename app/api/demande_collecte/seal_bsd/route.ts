import { supabase } from "@/app/database/supabaseClient";
import { NextResponse } from "next/server";
import axios from "axios";

const token_sandbox = process.env.TRACKDECHETS_TOKEN_SANDBOX;
const url_sandbox = process.env.TRACKDECHETS_URL_SANDBOX;

export async function POST(request: Request) {
    const { id } = await request.json();

    //Check if the BSD is on TrackDéchets
    const { data:bsd, error:bsdError } = await supabase.from('bsd').select('on_track_dechets, status_track_dechets, id_track_dechets').eq('id', id).single();
    if(bsd?.on_track_dechets){
        const trackDechetsResponse = await Seal_BSD_API(bsd.id_track_dechets);
        if(trackDechetsResponse.success){
            //Delete from Supabase
            const { data, error } = await supabase.from('bsd').update({status_track_dechets: "SEALED"}).eq('id', id);
            return NextResponse.json({ data, error });
        } else {
            return NextResponse.json({ error: trackDechetsResponse.error });
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
    if(!url_sandbox || !token_sandbox) {
        throw new Error("URL ou token Trackdéchets non définis");
    }
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
    if(response.status !== 200) {
        console.log("Erreur dans le scellage du BSD", response.statusText);
        return {
            success: false,
            error: response.statusText
        }
    }
    if(!response.data) {
        //console.log("Erreur dans le scellage du BSD :", response.data.errors[0].message);
        return {
            success: false,
            error: "Erreur lors du scellage du BSD sur Trackdéchets"//response.data.errors[0].message
        }
    }
    return {
        success: true,
        //data: response.data.data
    };
}
