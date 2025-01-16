import { useState, useEffect } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { defaultFormData } from '../utils/defaultValues';
import { FactureLine } from '../types/interfaces';

export const useFormData = (currentPdfId: string | null) => {
    const [formData, setFormData] = useState<FactureLine>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('formData');
            if (saved) return JSON.parse(saved);
            return defaultFormData;
        }
        return {} as FactureLine;
    });

    // Sauvegarder dans le localStorage
    useEffect(() => {
        localStorage.setItem('formData', JSON.stringify(formData));
    }, [formData]);

    // Charger les données existantes
    useEffect(() => {
        const loadExistingData = async () => {
            if (!currentPdfId) return;
            
            const { data, error } = await supabase
                .from('facture')
                .select('infos_json')
                .eq('pdf_infos_id', currentPdfId)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error("Erreur lors du chargement des données:", error);
                return;
            }

            if (data) {
                setFormData(data.infos_json);
            }
        };

        loadExistingData();
    }, [currentPdfId]);

    return { formData, setFormData };
}; 