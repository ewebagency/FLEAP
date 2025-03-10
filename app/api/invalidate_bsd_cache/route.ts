import { redis } from '@/app/database/redisClient';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { entreprise_id, user_id } = await request.json();

        if (!entreprise_id || !user_id) {
            return NextResponse.json({ error: 'entreprise_id and user_id are required' }, { status: 400 });
        }

        const cacheKey = `bsds:${user_id}:${entreprise_id}`;
        const exists = await redis.exists(cacheKey);

        if (exists) {
            await redis.del(cacheKey);
            console.log(`[Cache] INVALIDATED 🔄 - ${cacheKey}`);
            return NextResponse.json({ success: true });
        } else {
            console.log(`[Cache] NOT_FOUND ❓ - ${cacheKey}`);
            return NextResponse.json({ success: true });
        }
    } catch (error) {
        console.error('[Error]', error);
        return NextResponse.json({ error: 'Failed to invalidate cache' }, { status: 500 });
    }
} 