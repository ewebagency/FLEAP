// SessionProvider.tsx
"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '../database/supabaseClient';
import { Session } from '@supabase/supabase-js';

type SessionContextType = {
    session: Session | null;
    user_id: string | null;
    entreprise_id: string | null;
    entreprise_name: string | null;
};

export interface SessionMore extends Session {
    session: Session | null;
    user_id: string | null;
    entreprise_id: string | null;
    entreprise_name: string | null;
}

const SessionContext = createContext<SessionContextType>({
    session: null,
    user_id: null,
    entreprise_id: null,
    entreprise_name: null
});

export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user_id, setUserId] = useState<string | null>(null);
    const [entreprise_id, setEntrepriseId] = useState<string | null>(null);
    const [entreprise_name, setEntrepriseName] = useState<string | null>(null);

    useEffect(() => {
        // Fonction pour récupérer les informations de l'entreprise
        const fetchEntrepriseInfo = async (userId: string) => {
            try {
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('entreprise_id')
                    .eq('user_id', userId)
                    .single();

                if (profileError) throw profileError;
                
                if (profile?.entreprise_id) {
                    setEntrepriseId(profile.entreprise_id);

                    // Récupérer le nom de l'entreprise
                    const { data: entreprise, error: entrepriseError } = await supabase
                        .from('entreprise')
                        .select('name')
                        .eq('id', profile.entreprise_id)
                        .single();
                    
                    if (entrepriseError) throw entrepriseError;
                    setEntrepriseName(entreprise?.name || null);
                }
            } catch (error) {
                console.error('Erreur lors de la récupération des informations de l\'entreprise:', error);
            }
        };

        supabase.auth.getSession().then(({ data }) => {
            const session = data?.session;
            setSession(session);
            const userId = session?.user?.id ?? null;
            setUserId(userId);
            
            if (userId) {
                fetchEntrepriseInfo(userId);
            }
        }).catch((error) => {
            console.error('Erreur lors de la récupération de la session:', error);
            setSession(null);
            setUserId(null);
            setEntrepriseId(null);
            setEntrepriseName(null);
        });

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, sessionData) => {
            setSession(sessionData);
            const userId = sessionData?.user?.id ?? null;
            setUserId(userId);
            
            if (userId) {
                fetchEntrepriseInfo(userId);
            } else {
                setEntrepriseId(null);
                setEntrepriseName(null);
            }
        });

        return () => {
            authListener.subscription?.unsubscribe();
        };
    }, []);

    let sessionValue = session as SessionMore;
    if (sessionValue) {
        sessionValue.user_id = user_id;
        sessionValue.entreprise_id = entreprise_id;
        sessionValue.entreprise_name = entreprise_name;
    }

    return (
        <SessionContext.Provider value={sessionValue}>
            {children}
        </SessionContext.Provider>
    );
}
