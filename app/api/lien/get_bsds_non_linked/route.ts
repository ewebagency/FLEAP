import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/database/supabaseClient";

export async function GET(request: NextRequest) {
    const user_ids: string[] = JSON.parse(request.nextUrl.searchParams.get('user_ids') || '[]');

    if (!user_ids || user_ids.length === 0) {
        return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    } else {
        const { data, error } = await supabase
        .from('bsd')
        .select('id, created_at, infos_json')
        .in('user_id', user_ids)
        .eq('facture_treated', false);
        
        if (error) {
            return NextResponse.json({ error: 'Erreur lors de la récupération des BSDs' }, { status: 500 });
        } else {
            return NextResponse.json({ bsds: data }, { status: 200 });
        }
    }
}