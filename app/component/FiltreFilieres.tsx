"use client"
import React, { useEffect, useState } from "react";
import { useFilterContext } from "../FilterContext";
import { useSession } from "./SessionProvider";
//import { supabase } from "../database/supabaseClient";
import { getColors } from "./Analyse/MetaComponent/Colours";
import { useModalContextNew } from "../register/RegisterComponents/Modal/ContextModal";
import { RowBSD } from "../register/interface/BSD_Interface";

const cleanCED = (ced: string): string => {
    if(ced == null || ced == undefined || ced == '') {
        return ced.replaceAll(' ', '').replaceAll('*', '').trim();
    } else {
        return ced.replace(/[^\d]/g,'');
    }
};

const FiltreFilieres = () => {
    const { filieres, setFilieres, toggleFiliere } = useFilterContext();
    const {entreprise_id, user_id} = useSession();
    const [loadingFilieres, setLoadingFilieres] = useState(true);
    const {modalReload, setFilterPendingBSDs} = useModalContextNew();
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [isFullDataLoaded, setIsFullDataLoaded] = useState(false);

    const getFilieresFromEntreprise = async (forceReload = false) => {
        // Récupérer tous les BSDs depuis l'API
        const response = await fetch(`/api/get_data_bsd?entreprise_id=${entreprise_id}&user_id=${user_id}`);
        const { data: bsds, isPartialData } = await response.json();

        // Mettre à jour l'état de chargement complet
        setIsFullDataLoaded(!isPartialData);

        if (!bsds || bsds.length === 0) {
            console.log("Pas de BSDs trouvés");
            return;
        }

        // Extraire les codes des BSDs
        const codes = bsds
            .map((bsd:RowBSD) => bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code)
            .filter((code:string) => code != null);
        
        const array_codes_propres = codes.map((code:string) => cleanCED(code));
        const array_codes_clean = array_codes_propres.map((code:string) => String(code));
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
                    //console.log("Code non trouvé:", code);
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
            
        } else {
            console.log("Pas de mapping trouvé");
        }
    }

    useEffect(() => {
        const loadData = async () => {
            if (!entreprise_id) {
                setLoadingFilieres(false);
                return;
            }

            try {
                setLoadingFilieres(true);
                // Forcer le rechargement si modalReload a changé
                await getFilieresFromEntreprise();
                setIsInitialLoad(false);
            } catch (error) {
                console.error("Erreur lors du chargement des filières:", error);
            } finally {
                setLoadingFilieres(false);
            }
        };

        loadData();
    }, [entreprise_id, modalReload, isFullDataLoaded]);
    
    const toggleAll = () => {
        const areAllChecked = filieres.every(f => f.checked);
        const updatedFilieres = filieres.map(f => ({
            ...f,
            checked: !areAllChecked
        }));
        setFilieres(updatedFilieres);
    };

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
                {!isFullDataLoaded && !isInitialLoad && (
                    <div className="text-xs text-blue-600 flex items-center hidden">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Chargement complet des filières en cours...
                    </div>
                )}
            </div>
        </div>
    );
}

export default FiltreFilieres;
