"use client"; // Nécessaire car on utilise des hooks client-side

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '../database/supabaseClient';
import { Session } from '@supabase/supabase-js';


type SessionContextType = Session | null;
const SessionContext = createContext<SessionContextType>(null);

export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Fonction pour obtenir la session actuelle
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };

    getSession();

    // Écoute les changements de session
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, sessionData) => {
      const { data } = await supabase.auth.getSession(); // Récupère la session à chaque changement d'état
      setSession(data.session);
    });

    // Nettoyage de l'écouteur
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
