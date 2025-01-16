import { useState, useEffect } from 'react';
import { supabase } from '@/app/database/supabaseClient';

interface FiliereItem {
    filiere?: string;
}

export const useWasteData = (entrepriseId: string | null) => {
    const [wasteTypes, setWasteTypes] = useState<string[]>([]);
    const [wasteCodes, setWasteCodes] = useState<string[]>([]);
    const [filieres, setFilieres] = useState<string[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            if (!entrepriseId) return;

            // Récupérer les données des déchets des BSDs
            const { data: bsdData, error: bsdError } = await supabase
                .from('bsd')
                .select('infos_json')
                .eq('entreprise_id', entrepriseId);

            if (bsdError) {
                console.error('Erreur lors de la récupération des BSDs:', bsdError);
                return;
            }

            // Récupérer les filières depuis la table entreprise
            const { data: entrepriseData, error: entrepriseError } = await supabase
                .from('entreprise')
                .select('mapping_ced_filiere')
                .eq('id', entrepriseId)
                .single();

            if (entrepriseError) {
                console.error('Erreur lors de la récupération des filières:', entrepriseError);
                return;
            }

            // Traiter les données des BSDs
            const typesSet = new Set<string>();
            const codesSet = new Set<string>();

            bsdData.forEach(bsd => {
                const wasteDetails = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails;
                if (wasteDetails?.name) typesSet.add(wasteDetails.name);
                if (wasteDetails?.code) codesSet.add(wasteDetails.code);
            });

            const typesList = Array.from(typesSet);
            const codesList = Array.from(codesSet);

            // Transformer le mapping_ced_filiere en tableau de filières unique
            const filieresSet = new Set(
                entrepriseData?.mapping_ced_filiere
                    ? Object.values(entrepriseData.mapping_ced_filiere)
                        .map(item => {
                            if (typeof item === 'object' && item !== null) {
                                const filiereItem = item as FiliereItem;
                                return filiereItem.filiere?.trim().toLowerCase();
                            }
                            return String(item).trim().toLowerCase();
                        })
                        .filter(Boolean)
                    : []
            );
            const filieresList = Array.from(filieresSet)
                .filter((f): f is string => typeof f === 'string')
                .map(f => f.charAt(0).toUpperCase() + f.slice(1))
                .sort();

            setWasteTypes(typesList);
            setWasteCodes(codesList);
            setFilieres(filieresList);
        };

        fetchData();
    }, [entrepriseId]);

    return { wasteTypes, wasteCodes, filieres };
}; 