import { supabase } from "@/app/database/supabaseClient";
import { NextResponse } from "next/server";
import axios from "axios";
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    const token_track = cookies().get('trackdechets_token')?.value;
    let url_track = process.env.TRACKDECHETS_URL_SANDBOX;
    if(process.env.NEXT_PUBLIC_TRACK_TYPE === 'app'){
        url_track = process.env.TRACKDECHETS_URL_APP;
    }

    if (!token_track || !url_track) {
        return NextResponse.json({ 
            success: false, 
            message: "Configuration manquante (token ou URL)" 
        }, { status: 500 });
    }

    try {
        const { id } = await request.json();

        const { data: bsd, error: bsdError } = await supabase
            .from('bsd')
            .select('on_track_dechets, status_track_dechets, id_track_dechets')
            .eq('id', id)
            .single();

        if (!bsd?.on_track_dechets) {
            return NextResponse.json({ 
                success: false, 
                error: "BSD not on TrackDéchets" 
            }, { status: 400 });
        }

        const trackDechetsResponse = await Seal_BSD_API(bsd.id_track_dechets, token_track, url_track);
        
        if (trackDechetsResponse.success) {
            const { error } = await supabase
                .from('bsd')
                .update({ status_track_dechets: "SEALED" })
                .eq('id', id);

            if (error) {
                throw new Error(error.message);
            }

            return NextResponse.json({ 
                success: true, 
                message: "BSD scellé avec succès" 
            });
        }

        return NextResponse.json({ 
            success: false, 
            error: trackDechetsResponse.error 
        }, { status: 400 });

    } catch (error) {
        console.error("Erreur lors du scellage du BSD:", error);
        return NextResponse.json({ 
            success: false, 
            error: error instanceof Error ? error.message : "Erreur inconnue" 
        }, { status: 500 });
    }
}

const Seal_BSD_API = async (id: string, token: string, url: string) => {
    const query = `
        mutation {
            markAsSealed(id: "${id}") {
                id
            }
        }
    `;

    try {
        const response = await axios.post(
            url,
            { query: query },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.status !== 200) {
            return {
                success: false,
                error: "Erreur lors du scellage du BSD"
            };
        }

        return {
            success: true
        };
    } catch (error) {
        console.error('Erreur Seal_BSD_API:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erreur inconnue"
        };
    }
}
