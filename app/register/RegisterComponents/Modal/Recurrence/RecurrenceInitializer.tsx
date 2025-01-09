'use client';

import { useEffect } from 'react';
import RecurrenceFunctions from './RecurrenceFunctionnal';

export const RecurrenceInitializer = () => {
    useEffect(() => {
        const interval = setInterval(() => {
            RecurrenceFunctions.checkRecurrences();
        }, 60 * 1000);

        RecurrenceFunctions.checkRecurrences();

        return () => clearInterval(interval);
    }, []);

    return null;
}; 