'use client';

import { useEffect, useRef } from 'react';
import RecurrenceFunctions from './RecurrenceFunctionnal';
import toast from 'react-hot-toast';

export const RecurrenceInitializer = () => {
    const lastCheckRef = useRef<Date | null>(null);
    const checkingRef = useRef(false);

    const checkRecurrences = async () => {
        // Éviter les appels simultanés
        if (checkingRef.current) {
            console.log('[Recurrence] Check already in progress, skipping...');
            return;
        }

        // Vérifier si le dernier check était il y a moins de 5 secondes
        if (lastCheckRef.current && (new Date().getTime() - lastCheckRef.current.getTime()) < 5*1000) {
            console.log('[Recurrence] Last check was too recent, skipping...');
            return;
        }

        try {
            checkingRef.current = true;
            console.log('[Recurrence] Starting check...');
            
            const startTime = performance.now();
            await RecurrenceFunctions.checkRecurrences();
            const duration = Math.round(performance.now() - startTime);
            
            console.log(`[Recurrence] Check completed in ${duration}ms`);
            lastCheckRef.current = new Date();
        } catch (error) {
            console.error('[Recurrence] Check failed:', error);
            toast.error('Erreur lors de la vérification des récurrences');
        } finally {
            checkingRef.current = false;
        }
    };

    useEffect(() => {
        // Premier check au montage du composant
        checkRecurrences();

        // Mettre en place l'intervalle (toutes les 5 minutes)
        const interval = setInterval(checkRecurrences, 1 * 60 * 1000);

        // Cleanup à la destruction du composant
        return () => {
            clearInterval(interval);
            console.log('[Recurrence] Cleanup: interval cleared');
        };
    }, []);

    return null;
}; 