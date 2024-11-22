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
    //const [user_id, setUserId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data?.session || null);
        }).catch((error) => {
            console.error('Erreur lors de la récupération de la session:', error);
            setSession(null);
        });

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, sessionData) => {
            setSession(sessionData);
            //setUserId(sessionData?.user?.id || null); --> à faire un jour pour cleaner le code
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
