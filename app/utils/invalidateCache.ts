export const invalidateCache = async (entreprise_id: string|null, user_id: string|null) => {
    if (!entreprise_id || !user_id) return;
    
    try {
        const response = await fetch('/api/invalidate_bsd_cache', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                entreprise_id,
                user_id,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to invalidate cache');
        }

        console.log('Cache invalidated successfully');
    } catch (error) {
        console.error('Error invalidating cache:', error);
    }
};