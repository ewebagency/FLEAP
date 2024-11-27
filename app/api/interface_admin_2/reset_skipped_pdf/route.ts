import { supabase } from '@/app/database/supabaseClient';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { user_id } = await request.json();

        const { data, error } = await supabase
            .from('pdf_infos')
            .update({ status: 'unread' })
            .eq('user_id', user_id)
            .eq('status', 'skipped');

        if (error) {
            throw error;
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Erreur lors de la réinitialisation des status des PDFs skipped:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
