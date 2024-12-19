import { NextResponse } from 'next/server';
import { getActiveConnections } from '../store';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { userId: string } }) {
    const connections = await getActiveConnections(params.userId);
    
    if (connections.length === 0) {
        return NextResponse.json({ message: 'No active connections' }, { status: 404 });
    }

    return NextResponse.json({ 
        connections: connections.map(c => c.client_id),
        message: 'Active connections found'
    });
} 