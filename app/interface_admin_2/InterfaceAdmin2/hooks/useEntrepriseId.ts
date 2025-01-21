import { useState, useEffect } from 'react';
import { supabase } from '@/app/database/supabaseClient';

export const useEntrepriseId = (currentPdfId: string | null) => {
    const [entrepriseId, setEntrepriseId] = useState<string | null>(null);

    useEffect(() => {
        const fetchEntrepriseId = async () => {
            if (!currentPdfId) return;

            const { data: pdfData, error } = await supabase
                .from('pdf_infos')
                .select('entreprise_id')
                .eq('id', currentPdfId)
                .single();

            if (error) {
                console.error('Error fetching entreprise_id:', error);
                return;
            }

            if (pdfData?.entreprise_id) {
                setEntrepriseId(pdfData.entreprise_id);
            }
        };

        fetchEntrepriseId();
    }, [currentPdfId]);

    return entrepriseId;
}; 