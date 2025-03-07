'use client';

import { useEffect } from 'react';
import RecurrenceFunctions from './RecurrenceFunctionnal';

export const RecurrenceInitializer = () => {
    useEffect(() => {
        const interval = setInterval(() => {
            console.log('Checking recurrences...');
            RecurrenceFunctions.checkRecurrences();
        }, 10 * 1000);

        console.log('Initial recurrence check...');
        RecurrenceFunctions.checkRecurrences();

        return () => clearInterval(interval);
    }, []);

    return null;
}; 