import { NextResponse } from 'next/server';
import { supabase } from '@/app/database/supabaseClient';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const { type, userId } = await req.json();
    
    if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Utiliser Supabase Realtime pour broadcaster
    await supabase
        .from('notifications')
        .insert({
            type,
            user_id: userId,
            created_at: new Date().toISOString()
        });

    return NextResponse.json({ success: true });
} 