'use client';

import { useEffect } from 'react';
import RecurrenceFunctions from './RecurrenceFunctionnal';
import { useModalContextNew } from '../ContextModal';

export const RecurrenceInitializer = () => {
    const { setNextFullReload } = useModalContextNew();

    useEffect(() => {
        const interval = setInterval(() => {
            console.log('Checking recurrences...');
            RecurrenceFunctions.checkRecurrences(setNextFullReload);
        }, 10 * 1000);

        console.log('Initial recurrence check...');
        RecurrenceFunctions.checkRecurrences(setNextFullReload);

        return () => clearInterval(interval);
    }, [setNextFullReload]);

    return null;
}; 