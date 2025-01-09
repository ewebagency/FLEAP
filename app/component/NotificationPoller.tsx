'use client';

import { useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useSession } from './SessionProvider';
import { useModalContextNew } from '../register/RegisterComponents/Modal/ContextModal';

export default function NotificationPoller() {
    const session = useSession();
    const {setModalReload, modalReload} = useModalContextNew();

    useEffect(() => {
        if (!session?.user_id) return;

        const pollNotifications = async () => {
            try {
                const response = await fetch(`/api/notifications/cache?userId=${session.user_id}`);
                const data = await response.json();

                if (data.notifications && data.notifications.length > 0) {
                    //data.notifications.forEach(() => {
                        toast.success('Notification TrackDéchets reçue !', {
                            duration: 3000,
                            position: 'top-right',
                        });
                        setModalReload(prev => !prev);
                    //});
                }
            } catch (error) {
                console.error('Erreur lors de la récupération des notifications:', error);
            }
        };

        // Démarrer le polling toutes les 5 secondes
        const intervalId = setInterval(pollNotifications, 5000);

        // Cleanup à la destruction du composant
        return () => clearInterval(intervalId);
    }, [session?.user_id]);

    return null; // Ce composant n'a pas de rendu visuel
}