import { NextResponse } from 'next/server';
import { getClientsByUserId } from '../store';

export const dynamic = 'force-dynamic';

async function emitToClients(type: string, userId: string) {
    const clients = await getClientsByUserId(userId);
    console.log(`\n📢 Émission de notification "${type}" vers ${clients.length} clients pour l'utilisateur ${userId}\n`);
    
    for (const client of clients) {
        if (!client?.controller) continue;  // Skip si pas de controller
        
        try {
            client.controller.enqueue(`data: ${JSON.stringify({ type })}\n\n`);
        } catch (error) {
            console.log(`Erreur d'émission pour le client ${client.clientId}`);
        }
    }
}

export async function POST(req: Request) {
    const data = await req.json();
    const { type, userId } = data;
    
    if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    await emitToClients(type, userId);
    return NextResponse.json({ success: true });
} 