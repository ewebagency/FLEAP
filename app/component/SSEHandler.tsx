/*'use client';

import { useEffect } from 'react';
import { useModalContextNew } from '../register/RegisterComponents/Modal/ContextModal';
import toast from 'react-hot-toast';
import { useSession } from './SessionProvider';

let globalEventSource: EventSource | null = null;

export function SSEHandler() {
    const { setModalReload } = useModalContextNew();
    const session = useSession();

    useEffect(() => {
        if (globalEventSource) {
            console.log('🔄 Réutilisation de la connexion SSE existante');
            return;
        }

        console.log('🔄 Création nouvelle connexion SSE');
        const connect = () => {
            globalEventSource = new EventSource('/api/notifications/subscribe');
            console.log('📡 Tentative de connexion SSE');

            globalEventSource.onopen = () => {
                console.log('✅ Connexion SSE établie');
            };

            globalEventSource.onmessage = (event) => {
                console.log('📨 Message SSE reçu:', event.data);
                const data = JSON.parse(event.data);
                if (data.type === 'bsd_update') {
                    toast.success('🔔 Nouvelle notification reçue');
                    setTimeout(() => {
                        setModalReload(prev => !prev);
                    }, 2000);
                }
                if (data.type === 'ping') {
                    //toast.success('🔔 Ping');
                    console.log("🔔 Ping");
                }
                return {success: true};
            };

            globalEventSource.onerror = () => {
                console.log('❌ Erreur SSE - Tentative de reconnexion...');
                if (globalEventSource) {
                    globalEventSource.close();
                    globalEventSource = null;
                }
                setTimeout(connect, 1000);
            };
        };

        connect();

        return () => {
            // Ne pas fermer la connexion lors du démontage du composant
            console.log('⚠️ Composant démonté mais connexion SSE maintenue');
        };
    }, [setModalReload, session]);

    return null;
} */