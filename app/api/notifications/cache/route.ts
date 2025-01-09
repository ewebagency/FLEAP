import { NextResponse } from 'next/server';

// Cache temporaire pour stocker les notifications
let notificationCache: { userId: string, type: string, timestamp: number }[] = [];

export async function POST(req: Request) {
    const { userId, type } = await req.json();
    
    notificationCache.push({
        userId,
        type,
        timestamp: Date.now()
    });

    return NextResponse.json({ success: true });
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Récupérer les notifications pour cet utilisateur
    const userNotifications = notificationCache.filter(n => n.userId === userId);
    
    // Nettoyer les notifications récupérées du cache
    notificationCache = notificationCache.filter(n => n.userId !== userId);

    return NextResponse.json({ notifications: userNotifications });
} 