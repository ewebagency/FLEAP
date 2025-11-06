import { redis } from '@/app/database/redisClient';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { entreprise_id, user_id } = await request.json();

        if (!entreprise_id || !user_id) {
            return NextResponse.json({ error: 'entreprise_id and user_id are required' }, { status: 400 });
        }

        // Keys format used in get_data_bsd: bsds:${user_id}:${entreprise_id}:${site || 'ALL'}
        const basePattern = `bsds:${user_id}:${entreprise_id}:*`;
        const legacyKey = `bsds:${user_id}:${entreprise_id}`; // in case older keys exist without site suffix

        // Use KEYS to list all variants (Upstash HTTP client can error with SCAN options)
        const keys = await (redis as unknown as { keys: (pattern: string) => Promise<string[]> }).keys(basePattern);
        const keysToDelete: string[] = Array.isArray(keys) ? keys : [];

        // Add legacy key if present
        if (await redis.exists(legacyKey)) {
            keysToDelete.push(legacyKey);
        }

        let deleted = 0;
        if (keysToDelete.length > 0) {
            // Upstash del supports multiple keys
            deleted = await (redis as unknown as { del: (...keys: string[]) => Promise<number> }).del(...keysToDelete);
            console.log(`[Cache] INVALIDATED 🔄 - ${deleted} key(s) for pattern ${basePattern}${keysToDelete.includes(legacyKey) ? ' (+ legacy key)' : ''}`);
        } else {
            console.log(`[Cache] NOT_FOUND ❓ - No keys for pattern ${basePattern}`);
        }

        // Incrémenter la version du cache pour synchroniser tous les clients
        const versionKey = `cache_version:${entreprise_id}`;
        const newVersion = Date.now();
        await redis.set(versionKey, newVersion);
        console.log(`[Cache] VERSION UPDATED ⬆️ - ${versionKey} = ${newVersion}`);

        return NextResponse.json({ success: true, deleted, pattern: basePattern, version: newVersion });
    } catch (error) {
        console.error('[Error]', error);
        return NextResponse.json({ error: 'Failed to invalidate cache' }, { status: 500 });
    }
} 