import { supabase } from "@/app/database/supabaseClient";
import { NextResponse } from "next/server";
import axios from "axios";
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    const { id } = await request.json();
    
    const token_track = cookies().get('trackdechets_token')?.value;
    let url_track = process.env.TRACKDECHETS_URL_SANDBOX;
    if(process.env.NEXT_PUBLIC_TRACK_TYPE === 'app'){
        url_track = process.env.TRACKDECHETS_URL_APP;
    }
    if (!token_track || !url_track) {
        return NextResponse.json({ 
            success: false, 
            message: 'Token ou URL TrackDéchets non trouvés',
            error: 'Token ou URL TrackDéchets non trouvés'
        }, { status: 400 });
    }

    //Check if the BSD is on TrackDéchets
    const { data:bsd, error:bsdError } = await supabase
        .from('bsd')
        .select('on_track_dechets, status_track_dechets, id_track_dechets, photo')
        .eq('id', id)
        .single();

    if(bsd?.on_track_dechets){
        const trackDechetsResponse = await deleteBSDD_API(bsd.id_track_dechets, token_track, url_track);
        if(trackDechetsResponse.status === 200){
            // Delete photo from storage if exists
            if (bsd.photo) {
                // Extract filename from full URL
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
            //Delete from Supabase
            const { data, error } = await supabase.from('bsd').delete().eq('id', id);
            return NextResponse.json({ data, error });
        }
    }

    // Delete photo from storage if exists
    if (bsd?.photo) {
        // Extract filename from full URL
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

    const { data, error } = await supabase.from('bsd').delete().eq('id', id);
    return NextResponse.json({ data, error });
}

const deleteBSDD_API = async (id:string, token_track:string, url_track:string) => {

    const query = `
    mutation {
        deleteForm(id: "${id}") {
            id
        }
    }
    `;
    const response = await axios.post(
        url_track,
        { query: query },
        {
            headers: {
                Authorization: `Bearer ${token_track}`,
                'Content-Type': 'application/json'
            }
        }
    );

    return response;
}
