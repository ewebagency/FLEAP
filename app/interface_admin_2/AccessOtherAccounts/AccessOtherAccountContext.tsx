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
    const [selectedAccounts, setSelectedAccounts] = useState<Profil[]>([]);

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
        }

        fetchProfiles();
    }, []);

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
