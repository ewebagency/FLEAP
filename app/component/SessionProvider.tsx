// SessionProvider.tsx
"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '../database/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { identifyUser, resetUser } from '../utils/mixpanel';

export type EntrepriseOption = { id: number; name: string };

// Clé localStorage utilisée par les super-admins pour mémoriser l'entreprise active
export const SUPERADMIN_ENTREPRISE_KEY = 'superadmin_entreprise_id';

type SessionContextType = {
    session: Session | null;
    user_id: string | null;
    entreprise_id: string | null;
    entreprise_name: string | null;
    user_email: string | null;
    user_contact: string | null;
    user_phone: string | null;
    display_features: Record<string, boolean> | null;
    is_super_admin: boolean;
    entreprises: EntrepriseOption[];
    selectEntreprise: (id: number) => void;
};

export interface SessionMore extends Session {
    session: Session | null;
    user_id: string | null;
    entreprise_id: string | null;
    entreprise_name: string | null;
    user_email: string | null;
    user_contact: string | null;
    user_phone: string | null;
    display_features: Record<string, boolean> | null;
    is_super_admin: boolean;
    entreprises: EntrepriseOption[];
    selectEntreprise: (id: number) => void;
}

const SessionContext = createContext<SessionContextType>({
    session: null,
    user_id: null,
    entreprise_id: null,
    entreprise_name: null,
    user_email: null,
    user_contact: null,
    user_phone: null,
    display_features: null,
    is_super_admin: false,
    entreprises: [],
    selectEntreprise: () => {}
});

export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user_id, setUserId] = useState<string | null>(null);
    const [entreprise_id, setEntrepriseId] = useState<string | null>(null);
    const [entreprise_name, setEntrepriseName] = useState<string | null>(null);
    const [user_email, setUserEmail] = useState<string | null>(null);
    const [user_contact, setUserContact] = useState<string | null>(null);
    const [user_phone, setUserPhone] = useState<string | null>(null);
    const [display_features, setDisplayFeatures] = useState<Record<string, boolean> | null>(null);
    const [is_super_admin, setIsSuperAdmin] = useState<boolean>(false);
    const [entreprises, setEntreprises] = useState<EntrepriseOption[]>([]);

    // Permet à un super-admin de changer l'entreprise active.
    // On mémorise le choix puis on recharge pour réinitialiser proprement
    // tous les providers / caches indexés par entreprise_id.
    const selectEntreprise = (id: number) => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(SUPERADMIN_ENTREPRISE_KEY, String(id));
        window.location.reload();
    };

    useEffect(() => {
        setUserEmail(session?.user.email ?? null);
    }, [session]);

    // Identifier l'utilisateur dans Mixpanel quand toutes les infos sont disponibles
    useEffect(() => {
        if (user_id && entreprise_name && user_contact) {
            // Identifier l'utilisateur dans Mixpanel
            identifyUser(user_id, {
                $name: user_contact,
                entreprise_name: entreprise_name,
                entreprise_id: entreprise_id || undefined,
            });
            console.log('👤 Utilisateur identifié dans Mixpanel:', user_contact, '@', entreprise_name);
        } else if (!user_id) {
            // Déconnexion : reset Mixpanel
            resetUser();
            console.log('👋 Utilisateur déconnecté de Mixpanel');
        }
    }, [user_id, entreprise_name, user_contact, user_email, entreprise_id, user_phone]);

    useEffect(() => {
        // Fonction pour récupérer les informations de l'entreprise et du profil utilisateur
        const fetchUserInfo = async (userId: string) => {
            try {
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('entreprise_id, first_name, last_name, phone, display_features, is_super_admin')
                    .eq('user_id', userId)
                    .single();

                if (profileError) throw profileError;

                if (profile) {
                    // Set user contact (first_name + last_name)
                    const firstName = profile.first_name || '';
                    const lastName = profile.last_name || '';
                    setUserContact(firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || null);

                    // Set user phone
                    setUserPhone(profile.phone || null);

                    // Set display features
                    setDisplayFeatures(profile.display_features || null);

                    const superAdmin = !!profile.is_super_admin;
                    setIsSuperAdmin(superAdmin);

                    // Pour un super-admin : l'entreprise active est celle choisie via le
                    // sélecteur (mémorisée en localStorage), sinon celle de son profil.
                    let activeEntrepriseId = profile.entreprise_id;
                    if (superAdmin && typeof window !== 'undefined') {
                        const saved = localStorage.getItem(SUPERADMIN_ENTREPRISE_KEY);
                        if (saved) activeEntrepriseId = Number(saved);

                        // Charger la liste de toutes les entreprises pour le sélecteur
                        const { data: allEntreprises } = await supabase
                            .from('entreprise')
                            .select('id, name')
                            .order('name');
                        setEntreprises(allEntreprises || []);
                    }

                    if (activeEntrepriseId) {
                        setEntrepriseId(activeEntrepriseId);

                        // Récupérer le nom de l'entreprise active
                        const { data: entreprise, error: entrepriseError } = await supabase
                            .from('entreprise')
                            .select('name')
                            .eq('id', activeEntrepriseId)
                            .single();

                        if (entrepriseError) throw entrepriseError;
                        setEntrepriseName(entreprise?.name || null);
                    }
                }
            } catch (error) {
                console.error('Erreur lors de la récupération des informations:', error);
            }
        };

        supabase.auth.getSession().then(({ data }) => {
            const session = data?.session;
            setSession(session);
            const userId = session?.user?.id ?? null;
            setUserId(userId);
            
            if (userId) {
                fetchUserInfo(userId);
            }
        }).catch((error) => {
            console.error('Erreur lors de la récupération de la session:', error);
            setSession(null);
            setUserId(null);
            setEntrepriseId(null);
            setEntrepriseName(null);
            setUserContact(null);
            setUserPhone(null);
            setDisplayFeatures(null);
        });

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, sessionData) => {
            setSession(sessionData);
            const userId = sessionData?.user?.id ?? null;
            setUserId(userId);
            
            if (userId) {
                fetchUserInfo(userId);
            } else {
                setEntrepriseId(null);
                setEntrepriseName(null);
                setUserContact(null);
                setUserPhone(null);
                setDisplayFeatures(null);
            }
        });

        return () => {
            authListener.subscription?.unsubscribe();
        };
    }, []);

    const sessionValue = session as SessionMore;
    if (sessionValue) {
        sessionValue.user_id = user_id;
        sessionValue.entreprise_id = entreprise_id;
        sessionValue.entreprise_name = entreprise_name;
        sessionValue.user_email = user_email;
        sessionValue.user_contact = user_contact;
        sessionValue.user_phone = user_phone;
        sessionValue.display_features = display_features;
    }

    //avant on faisait <SessionContext.Provider value={sessionValue}>

    return (
        <SessionContext.Provider value={{
            session: session,
            user_id: user_id,
            entreprise_id: entreprise_id,
            entreprise_name: entreprise_name,
            user_email: user_email,
            user_contact: user_contact,
            user_phone: user_phone,
            display_features: display_features,
            is_super_admin: is_super_admin,
            entreprises: entreprises,
            selectEntreprise: selectEntreprise
        }}>
            {children}
        </SessionContext.Provider>
    );
}
