import { useState, useEffect } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { useAccessOtherAccount } from '../../AccessOtherAccounts/AccessOtherAccountContext';

export const useEntrepriseId = () => {
    const [entrepriseId, setEntrepriseId] = useState<string | null>(null);
    const { selectedAccounts } = useAccessOtherAccount();

    useEffect(() => {
        const fetchEntrepriseId = async () => {
            if (!selectedAccounts[0]?.user_id) return;

            console.log('Fetching entreprise_id for user_id:', selectedAccounts[0].user_id);

            const { data: profilData, error } = await supabase
                .from('profiles')
                .select('entreprise_id')
                .eq('user_id', selectedAccounts[0].user_id)
                .single();

            if (error) {
                console.error('Error fetching entreprise_id:', error);
                return;
            }

            if (profilData?.entreprise_id) {
                setEntrepriseId(profilData.entreprise_id);
            }
        };

        fetchEntrepriseId();
    }, [selectedAccounts]);

    return entrepriseId;
}; 