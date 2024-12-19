'use client';

import { useEffect } from 'react';
import { useModalContextNew } from '../register/RegisterComponents/Modal/ContextModal';
import toast from 'react-hot-toast';
import { useSession } from './SessionProvider';

export function SSEHandler() {
    const { setModalReload } = useModalContextNew();
    const session = useSession();

    useEffect(() => {
        if (!session?.user_id) {
            console.log('Pas de session utilisateur, connexion SSE impossible');
            return;
        }

        let eventSource: EventSource | null = null;

        const connect = () => {
            if (eventSource) {
                eventSource.close();
            }

            console.log('🔄 Création nouvelle connexion SSE');
            eventSource = new EventSource(`/api/notifications/subscribe?userId=${session.user_id}`, {
                withCredentials: true
            });

            eventSource.onopen = () => {
                console.log('✅ Connexion SSE établie');
            };

            eventSource.onmessage = (event) => {
                console.log('📨 Message SSE reçu:', event.data);
                const data = JSON.parse(event.data);
                if (data.type === 'bsd_update') {
                    toast.success('🔔 Nouvelle notification reçue');
                    setModalReload(prev => !prev);
                }
                if (data.type === 'ping') {
                    console.log("🔔 Ping");
                }
            };

            eventSource.onerror = () => {
                console.log('❌ Erreur SSE - Tentative de reconnexion...');
                if (eventSource) {
                    eventSource.close();
                    eventSource = null;
                }
                setTimeout(connect, 1000);
            };
        };

        connect();

        return () => {
            if (eventSource) {
                console.log('🔌 Fermeture de la connexion SSE');
                eventSource.close();
                eventSource = null;
            }
        };
    }, [setModalReload, session]);

    return null;
} 