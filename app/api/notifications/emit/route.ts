import { NextResponse } from 'next/server';
import { clients } from '../store';

export const dynamic = 'force-dynamic';

async function emitToClients(type: string) {
    console.log(`\n📢 Émission de notification "${type}" vers ${clients.size} clients\n`);
    const deadClients = new Set<ReadableStreamDefaultController>();

    clients.forEach(client => {
        try {
            client.enqueue(`data: ${JSON.stringify({ type })}\n\n`);
        } catch (error) {
            deadClients.add(client);
        }
    });

    deadClients.forEach(client => clients.delete(client));
}

export async function POST(req: Request) {
    const data = await req.json();
    await emitToClients(data.type);
    return NextResponse.json({ success: true });
} 