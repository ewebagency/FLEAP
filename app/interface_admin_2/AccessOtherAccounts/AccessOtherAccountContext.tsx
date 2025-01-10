'use client'
import { createContext, useContext, useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { supabase } from '@/app/database/supabaseClient';

export interface Profil {
    user_id: string;
    first_name: string;
    last_name: string;
}

interface AccessOtherAccountContextType {
    accounts: Profil[];
    selectedAccounts: Profil[];
    setAccounts: (accounts: Profil[]) => void;
    setSelectedAccounts: (accounts: Profil[]) => void;
}

const AccessOtherAccountContext = createContext<AccessOtherAccountContextType | undefined>(undefined);

export function AccessOtherAccountProvider({ children }: { children: React.ReactNode }) {
    const [accounts, setAccounts] = useState<Profil[]>([]);
    const [selectedAccounts, setSelectedAccounts] = useState<Profil[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('selectedAccounts');
            return saved ? JSON.parse(saved) : [];
        }
        return [];
    });

    useEffect(() => {
        async function fetchProfiles() {
            const { data, error } = await supabase
                .from('profiles')
                .select('user_id, first_name, last_name');
            
            if (error) {
                console.error('Error fetching profiles:', error);
                return;
            }
            
            setAccounts(data || []);
            // Ne définir selectedAccounts que s'il n'y a pas de données dans le localStorage
            if (!localStorage.getItem('selectedAccounts')) {
                setSelectedAccounts(data || []);
            }
        }

        fetchProfiles();
    }, []);

    // Sauvegarder dans le localStorage quand selectedAccounts change
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('selectedAccounts', JSON.stringify(selectedAccounts));
        }
    }, [selectedAccounts]);

    return (
        <AccessOtherAccountContext.Provider value={{ accounts, selectedAccounts, setAccounts, setSelectedAccounts }}>
            {children}
        </AccessOtherAccountContext.Provider>
    );
}

export function useAccessOtherAccount() {
    const context = useContext(AccessOtherAccountContext);
    if (context === undefined) {
        throw new Error('useAccessOtherAccount must be used within an AccessOtherAccountProvider');
    }
    return context;
}
