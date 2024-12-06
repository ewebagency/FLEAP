import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/database/supabaseClient";

export async function GET(request: NextRequest) {
    try {
        const userIdsParam = request.nextUrl.searchParams.get('user_ids');
        const user_ids = userIdsParam ? JSON.parse(userIdsParam) : [];

        if (!user_ids || user_ids.length === 0) {
            return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('bsd')
            .select('id, created_at, infos_json')
            .in('user_id', user_ids)
            .eq('facture_treated', false);
        
        if (error) {
            console.log('Error:', error);
            return NextResponse.json({ error: 'Erreur lors de la récupération des BSDs' }, { status: 500 });
        }

        return NextResponse.json({ bsds: data }, { status: 200 });
    } catch (e) {
        console.error('Parse error:', e);
        return NextResponse.json({ error: 'Invalid user_ids format' }, { status: 400 });
    }
}