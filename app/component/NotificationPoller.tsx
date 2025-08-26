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
                console.log('------Notifications:', data);
                if (data.notifications && data.notifications.length > 0) {
                    //data.notifications.forEach(() => {
                        toast.success('Notification TrackDéchets reçue !', {
                            duration: 10000,
                            position: 'top-right',
                        });
                        setModalReload(prev => !prev);
                    //});
                }
            } catch (error) {
                console.error('Erreur lors de la récupération des notifications:', error);
            }
        };

        // Démarrer le polling toutes les 10 minutes
        const intervalId = setInterval(pollNotifications, 10*60*1000); // 10 minute

        // Cleanup à la destruction du composant
        return () => clearInterval(intervalId);
    }, [session?.user_id]);

    return null; // Ce composant n'a pas de rendu visuel
}