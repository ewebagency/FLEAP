'use client';

import { useEffect } from 'react';
import { useModalContextNew } from '../register/RegisterComponents/Modal/ContextModal';
import toast from 'react-hot-toast';
import { useSession } from './SessionProvider';
import { supabase } from '@/app/database/supabaseClient';

export function SSEHandler() {
    const { setModalReload } = useModalContextNew();
    const session = useSession();

    useEffect(() => {
        if (!session?.user_id) return;

        // S'abonner aux notifications via Supabase Realtime
        const subscription = supabase
            .channel('notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${session.user_id}`
                },
                (payload) => {
                    if (payload.new.type === 'bsd_update') {
                        toast.success('🔔 Nouvelle notification reçue');
                        setModalReload(prev => !prev);
                    }
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [session, setModalReload]);

    return null;
} 