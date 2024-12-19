import { supabase } from '@/app/database/supabaseClient';

export interface Client {
    userId: string;
    connectionId: string;
}

export async function addClient(connectionId: string, userId: string) {
    await supabase
        .from('notifications_connections')
        .insert({
            client_id: connectionId,
            user_id: userId,
            last_ping: new Date().toISOString()
        });
}

export async function removeClient(connectionId: string) {
    await supabase
        .from('notifications_connections')
        .delete()
        .eq('client_id', connectionId);
}

export async function getActiveConnections(userId: string) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const { data: connections } = await supabase
        .from('notifications_connections')
        .select('client_id')
        .eq('user_id', userId)
        .gt('last_ping', fiveMinutesAgo.toISOString());

    return connections || [];
}

export async function updateClientTimestamp(connectionId: string) {
    await supabase
        .from('notifications_connections')
        .update({ last_ping: new Date().toISOString() })
        .eq('client_id', connectionId);
}

export async function cleanupOldConnections() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await supabase
        .from('notifications_connections')
        .delete()
        .lt('created_at', oneDayAgo.toISOString());
}