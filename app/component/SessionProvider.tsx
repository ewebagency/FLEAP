// SessionProvider.tsx
"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '../database/supabaseClient';
import { Session } from '@supabase/supabase-js';

type SessionContextType = Session | null;
const SessionContext = createContext<SessionContextType>(null);

export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);

    useEffect(() => {
        const getSession = async () => {
            try {
                const { data } = await supabase.auth.getSession();
                setSession(data?.session || null);
            } catch (error) {
                console.error('Erreur lors de la récupération de la session:', error);
                setSession(null);
            }
        };

        getSession();

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, sessionData) => {
            setSession(sessionData); // Utilisation de sessionData directement
        });

        return () => {
            authListener.subscription?.unsubscribe();
        };
    }, []);

    return (
        <SessionContext.Provider value={session}>
            {children}
        </SessionContext.Provider>
    );
}
