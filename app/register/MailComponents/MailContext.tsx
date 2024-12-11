'use client';
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { toast } from 'react-hot-toast';

interface MailContextType {
    isValidMail: boolean;
    setIsValidMail: (value: boolean) => void;
    sendMail: (() => Promise<void>) | null;
    setSendMailFunction: (fn: () => Promise<void>) => void;
}

const MailContext = createContext<MailContextType | undefined>(undefined);

export function MailProvider({ children }: { children: ReactNode }) {
    const [isValidMail, setIsValidMail] = useState<boolean>(false);
    const [sendMail, setSendMail] = useState<(() => Promise<void>) | null>(null);

    const setSendMailFunction = useCallback((fn: () => Promise<void>) => {
        setSendMail(() => fn);
    }, []);

    return (
        <MailContext.Provider value={{
            isValidMail,
            setIsValidMail,
            sendMail,
            setSendMailFunction
        }}>
            {children}
        </MailContext.Provider>
    );
}

export function useMailContext() {
    const context = useContext(MailContext);
    if (context === undefined) {
        throw new Error('useMailContext must be used within a MailProvider');
    }
    return context;
} 