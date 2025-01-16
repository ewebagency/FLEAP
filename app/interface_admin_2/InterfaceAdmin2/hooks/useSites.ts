import { useState, useEffect } from 'react';
import { supabase } from '@/app/database/supabaseClient';

export const useSites = (entrepriseId: string | null) => {
    const [sites, setSites] = useState<string[]>([]);

    useEffect(() => {
        const fetchSites = async () => {
            if (!entrepriseId) return;

            const { data, error } = await supabase
                .from('bsd')
                .select('infos_json')
                .eq('entreprise_id', entrepriseId);

            if (error) {
                console.error('Erreur lors de la récupération des sites:', error);
                return;
            }

            const sitesMap = new Map();
            data.forEach(bsd => {
                const emitter = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company;
                if (emitter?.name && emitter?.siret) {
                    sitesMap.set(emitter.siret, `${emitter.name} - ${emitter.siret}`);
                }
            });

            const sitesList = Array.from(sitesMap.values());
            setSites(sitesList);
        };

        fetchSites();
    }, [entrepriseId]);

    return { sites };
}; 