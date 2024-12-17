import { clients } from '../emit/route';

export async function GET() {
    const stream = new ReadableStream({
        start(controller) {
            clients.add(controller);
            console.log(`👥 Nouveau client connecté (total: ${clients.size})`);
            controller.enqueue(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);

            // PING régulier pour s'assurer que la connexion est active
            const pingInterval = setInterval(() => {
                try {
                    controller.enqueue(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
                } catch (error) {
                    console.log('⚠️ Connexion interrompue, nettoyage...');
                    clients.delete(controller);
                    clearInterval(pingInterval);
                }
            }, 10000); // Ping toutes les 10 secondes
            

            return () => {
                console.log(`👋 Client déconnecté (total: ${clients.size - 1})`);
                clients.delete(controller);
                clearInterval(pingInterval);
            };
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
