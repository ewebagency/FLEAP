import { supabase } from '@/app/database/supabaseClient';

export interface Client {
    controller: ReadableStreamDefaultController;
    userId: string;
}

// Store local pour les controllers qui ne peuvent pas être sérialisés
const controllers = new Map<string, ReadableStreamDefaultController>();

export async function addClient(clientId: string, client: Client) {
    controllers.set(clientId, client.controller);
    
    // Nettoyer les anciennes connexions avant d'en ajouter une nouvelle
    await cleanupOldConnections();
    
    await supabase
        .from('notifications_connections')
        .insert({
            client_id: clientId,
            user_id: client.userId,
        });
}

export async function removeClient(clientId: string) {
    controllers.delete(clientId);
    
    await supabase
        .from('notifications_connections')
        .delete()
        .eq('client_id', clientId);
}

export async function getClientsByUserId(userId: string) {
    const { data: connections } = await supabase
        .from('notifications_connections')
        .select('client_id')
        .eq('user_id', userId);

    return connections
        ?.map(conn => ({
            controller: controllers.get(conn.client_id),
            clientId: conn.client_id
        }))
        .filter(client => client.controller) || [];
}

export async function updateClientTimestamp(clientId: string) {
    await supabase
        .from('notifications_connections')
        .update({ last_ping: new Date().toISOString() })
        .eq('client_id', clientId);
}

// Nettoie les connexions inactives (plus vieilles que 5 minutes)
export async function cleanupInactiveClients() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const { data: inactiveConnections } = await supabase
        .from('notifications_connections')
        .select('client_id')
        .lt('last_ping', fiveMinutesAgo.toISOString());

    inactiveConnections?.forEach(conn => {
        controllers.delete(conn.client_id);
    });

    await supabase
        .from('notifications_connections')
        .delete()
        .lt('last_ping', fiveMinutesAgo.toISOString());
}

// Nettoie les anciennes connexions (plus vieilles que 24 heures)
async function cleanupOldConnections() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Supprimer les connexions plus vieilles que 24 heures
    await supabase
        .from('notifications_connections')
        .delete()
        .lt('created_at', oneDayAgo.toISOString());

    // Nettoyer aussi les connexions inactives
    await cleanupInactiveClients();
}