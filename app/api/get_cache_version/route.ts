import { NextResponse } from 'next/server';
import { redis } from '@/app/database/redisClient';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const entreprise_id = searchParams.get('entreprise_id');

        if (!entreprise_id) {
            return NextResponse.json(
                { error: 'entreprise_id requis' },
                { status: 400 }
            );
        }

        // Récupérer la version du cache depuis Redis
        const cacheKey = `cache_version:${entreprise_id}`;
        const version = await redis.get(cacheKey);

        // Si pas de version, en créer une (timestamp actuel)
        if (!version) {
            const newVersion = Date.now();
            await redis.set(cacheKey, newVersion);
            return NextResponse.json({ version: newVersion });
        }

        return NextResponse.json({ version });
    } catch (error) {
        console.error('Erreur get_cache_version:', error);
        return NextResponse.json(
            { error: 'Erreur serveur', version: Date.now() },
            { status: 500 }
        );
    }
}

