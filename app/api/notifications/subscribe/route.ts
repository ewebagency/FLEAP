import { addClient, updateClientTimestamp, removeClient, cleanupInactiveClients } from '../store';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
        return new Response('User ID required', { status: 400 });
    }

    const clientId = crypto.randomUUID();

    const stream = new ReadableStream({
        start: async (controller) => {
            await addClient(clientId, {
                controller,
                userId
            });

            console.log(`👥 Nouveau client connecté (ID: ${clientId}, UserID: ${userId})`);
            controller.enqueue(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);

            const pingInterval = setInterval(async () => {
                try {
                    controller.enqueue(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
                    await updateClientTimestamp(clientId);
                    await cleanupInactiveClients();
                } catch (error) {
                    console.log(`⚠️ Connexion interrompue pour ${clientId}, nettoyage...`);
                    await removeClient(clientId);
                    clearInterval(pingInterval);
                }
            }, 10000);

            return async () => {
                await removeClient(clientId);
                clearInterval(pingInterval);
                console.log(`👋 Client déconnecté (ID: ${clientId})`);
            };
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
