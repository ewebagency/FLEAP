import { useState, useEffect } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { useAccessOtherAccount } from '../../AccessOtherAccounts/AccessOtherAccountContext';

interface Prestataire {
    nom: string;
    siret: string;
}

export const usePrestataires = (entrepriseId: string | null) => {
    const [prestataires, setPrestataires] = useState<{ nom: string; siret: string; }[]>([]);
    const [prestataireType, setPrestataireType] = useState<'transporteur' | 'destinataire'>('transporteur');

    useEffect(() => {
        const fetchPrestataires = async () => {
            if (!entrepriseId) return;

            console.log('Fetching prestataires for entreprise_id:', entrepriseId);

            const { data, error } = await supabase
                .from('bsd')
                .select('infos_json')
                .eq('entreprise_id', entrepriseId);

            if (error) {
                console.error('Erreur lors de la récupération des prestataires:', error);
                return;
            }

            const prestataireMap = new Map();
            data.forEach(bsd => {
                const transporteur = bsd.infos_json?.formAPI?.createFormInput?.transporter?.company;
                const destinataire = bsd.infos_json?.formAPI?.createFormInput?.recipient?.company;

                if (prestataireType === 'transporteur' && transporteur?.name && transporteur?.siret) {
                    prestataireMap.set(transporteur.siret, {
                        nom: transporteur.name,
                        siret: transporteur.siret
                    });
                }

                if (prestataireType === 'destinataire' && destinataire?.name && destinataire?.siret) {
                    prestataireMap.set(destinataire.siret, {
                        nom: destinataire.name,
                        siret: destinataire.siret
                    });
                }
            });

            const prestatairesList = Array.from(prestataireMap.values());
            setPrestataires(prestatairesList);
        };

        fetchPrestataires();
    }, [entrepriseId, prestataireType]);

    return { prestataires, prestataireType, setPrestataireType };
}; 