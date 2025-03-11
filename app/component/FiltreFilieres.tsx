"use client"
import React, { useEffect, useState } from "react";
import { useFilterContext } from "../FilterContext";
import { useSession } from "./SessionProvider";
import { supabase } from "../database/supabaseClient";
import { getColors } from "./Analyse/MetaComponent/Colours";
import { useModalContextNew } from "../register/RegisterComponents/Modal/ContextModal";
import { RowBSD } from "../register/interface/BSD_Interface";
import useSWR from 'swr';

const cleanCED = (ced: string): string => {
    if(ced == null || ced == undefined || ced == '') {
        return ced.replaceAll(' ', '').replaceAll('*', '').trim();
    } else {
        return ced.replace(/[^\d]/g,'');
    }
};

// Type pour les données de code BSD
interface BSDCode {
    code: string | null;
}

// Fonction fetcher pour SWR
const fetcher = async (entreprise_id: string) => {
    const pageSize = 1000; // Taille de la page
    let allData: BSDCode[] = [];
    let hasMore = true;
    let page = 0;

    while (hasMore) {
        const { data, error, count } = await supabase
            .from('bsd')
            .select('infos_json->formAPI->createFormInput->wasteDetails->>code', { count: 'exact' })
            .eq('entreprise_id', entreprise_id)
            .order('created_at', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        
        if (data) {
            allData = [...allData, ...data];
            // Vérifier s'il y a plus de données à charger
            hasMore = count ? allData.length < count : false;
            page++;
        } else {
            hasMore = false;
        }
    }

    return allData;
};

const FiltreFilieres = () => {
    const { filieres, setFilieres, toggleFiliere } = useFilterContext();
    const {entreprise_id, user_id} = useSession();
    const [loadingFilieres, setLoadingFilieres] = useState(true);
    const {modalReload, setFilterPendingBSDs} = useModalContextNew();
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // Utilisation de SWR pour récupérer les BSDs avec un temps de cache plus long
    const { data: bsds, error } = useSWR(
        entreprise_id ? entreprise_id : null,
        fetcher,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            refreshInterval: 0,
            dedupingInterval: 60000, // Déduplication pendant 1 minute
            focusThrottleInterval: 60000 // Throttle des revalidations pendant 1 minute
        }
    );

    const getFilieresFromEntreprise = async (forceReload = false) => {
        if (!bsds) return;

        try {
            // Extraire les codes des BSDs
            const codes = bsds
                .map((bsd: BSDCode) => bsd.code)
                .filter((code): code is string => code !== null);
            
            const array_codes_propres = codes.map((code: string) => cleanCED(code));
            const array_codes_clean = array_codes_propres.map((code: string) => String(code));
            const set_codes_clean = new Set(array_codes_clean);
            const codes_uniques = Array.from(set_codes_clean) as string[];

            // Récupérer le mapping depuis l'API avec forceReload
            const mappingData = await fetch(`/api/get_mapping_ced_filiere?entreprise_id=${entreprise_id}&forceReload=${forceReload}`);
            const { data: mappingCedFiliere } = await mappingData.json();

            if (mappingCedFiliere) {
                const mappingArray = mappingCedFiliere;
                let filieres_uniques: string[] = [];
                let others = false;
                
                for(const code of codes_uniques) {
                    const match = mappingArray.find((item:{ced:string, filiere:string}) => cleanCED(item.ced) === cleanCED(code));
                    if(match) {
                        filieres_uniques.push(match.filiere);
                    } else {
                        others = true;
                    }
                }
                
                filieres_uniques = Array.from(new Set(filieres_uniques));
                if(others) filieres_uniques.push('Autres');

                const filieres_colors = getColors(filieres_uniques.length);
                const formattedFilieres = filieres_uniques.map((filiere, index) => {
                    const existingFiliere = filieres.find(f => f.name === filiere);
                    return {
                        name: filiere,
                        color: filieres_colors[index],
                        checked: existingFiliere ? existingFiliere.checked : true
                    };
                });

                setFilieres(formattedFilieres);
            }
        } catch (error) {
            console.error("Erreur lors du chargement des filières:", error);
        } finally {
            setLoadingFilieres(false);
            setIsInitialLoad(false);
        }
    }

    useEffect(() => {
        if (entreprise_id && bsds) {
            getFilieresFromEntreprise();
        }
    }, [entreprise_id, bsds, modalReload]);

    const toggleAll = () => {
        const areAllChecked = filieres.every(f => f.checked);
        const updatedFilieres = filieres.map(f => ({
            ...f,
            checked: !areAllChecked
        }));
        setFilieres(updatedFilieres);
    };

    if (error) {
        return <div className="text-red-500">Erreur lors du chargement des filières</div>;
    }

    return (
        <div className="my-2">
            <div className="flex flex-wrap gap-2">
                {filieres && filieres.length > 0 && (
                    <button
                        onClick={() => {
                            setFilterPendingBSDs(false);
                            toggleAll();
                        }}
                        className="text-xs h-[22px] px-3 flex items-center justify-center transition-colors duration-200 
                        bg-gray-200 hover:bg-gray-300 rounded-md border"
                    >
                        {filieres.every(f => f.checked) 
                            ? 'Tout désélectionner' 
                            : 'Tout sélectionner'}
                    </button>
                )}
                <div className="join flex flex-wrap">
                    {loadingFilieres ? (
                        <div className="text-gray-500">Chargement des filières...</div>
                    ) : filieres && filieres.length > 0 ? (
                        filieres.map((filiere, index) => (
                            <label
                                key={`filiere-${index}`}
                                className="flex items-center cursor-pointer join-item"
                            >
                                <input
                                    className="hidden"
                                    type="checkbox"
                                    name="options_filiere"
                                    aria-label={filiere.name}
                                    checked={filiere.checked}
                                    onChange={() => {
                                        setFilterPendingBSDs(false);
                                        toggleFiliere(filiere.name);
                                    }}
                                />
                                <span
                                    className={`text-xs h-[22px] px-3 flex items-center justify-center transition-colors duration-200 
                                    ${filiere.checked ? filiere.color : 'bg-gray-300'} 
                                    ${filiere.checked ? 'text-white' : 'text-gray-700'}
                                    ${index === 0 ? 'rounded-l-md' : ''}
                                    ${index === filieres.length - 1 ? 'rounded-r-md' : ''}`}
                                >
                                    {filiere.name}
                                </span>
                            </label>
                        ))
                    ) : (
                        <div className="text-gray-500">Aucune filière disponible</div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default FiltreFilieres;
