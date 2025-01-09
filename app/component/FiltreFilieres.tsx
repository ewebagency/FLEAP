"use client"
import React, { useEffect, useState } from "react";
import { useFilterContext } from "../FilterContext";
import { useSession } from "./SessionProvider";
import { supabase } from "../database/supabaseClient";
import { getColors } from "./Analyse/MetaComponent/Colours";
import { useModalContextNew } from "../register/RegisterComponents/Modal/ContextModal";

const FiltreFilieres = () => {
    const { filieres, setFilieres, toggleFiliere } = useFilterContext();
    const session = useSession();
    const [loadingFilieres, setLoadingFilieres] = useState(true);
    const {modalReload} = useModalContextNew();

    const getFilieresFromEntreprise = async () => {
        
        const { data:codes_all, error:error_codes } = await supabase
        .from('bsd')
        .select('infos_json->formAPI->createFormInput->wasteDetails->>code')
        .order('created_at', { ascending: false })
        .eq('entreprise_id', session?.entreprise_id);
        
        if (error_codes) {
            console.error('Error fetching codes:', error_codes);
            return;
        }

        
        if (!codes_all || codes_all.length === 0) {
            console.log("Pas de BSDs trouvés");
            return;
        }

        /*const codes = data
            .map(bsd => bsd?.infos_json?.formAPI?.createFormInput?.wasteDetails?.code)
            .filter(code => code != null);*/
        const codes = codes_all.map(code => code.code).filter(code => code != null); //tous les codes CED
        
        const array_codes_propres = codes.map(code => code.replaceAll(' ', '').replace('*', '').trim());
        
        const array_codes_clean = array_codes_propres.map(code => String(parseInt(code)));
        
        const set_codes_clean = new Set(array_codes_clean);
        const codes_uniques = Array.from(set_codes_clean); //tous les codes CED uniques de l'entreprise
        
        
        const mapping = await supabase
            .from('entreprise')
            .select('mapping_ced_filiere')
            .eq('id', session?.entreprise_id)
            .single();


        if (mapping?.data?.mapping_ced_filiere) {
            const mappingArray = mapping.data.mapping_ced_filiere;
            let filieres_uniques: string[] = [];
            let others = false;
            
            for(const code of codes_uniques) {
                const match = mappingArray.find((item:{ced:string, filiere:string}) => item.ced.replaceAll(' ', '').replace('*', '').trim() === code.replaceAll(' ', '').replace('*', '').trim());
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

            // Séparer "Autres" des autres filières
            const autresIndex = formattedFilieres.findIndex(f => f.name === 'Autres');
            let autresFiliere;
            if (autresIndex !== -1) {
                autresFiliere = formattedFilieres[autresIndex];
                formattedFilieres.splice(autresIndex, 1);
            }

            setFilieres(autresFiliere ? [...formattedFilieres, autresFiliere] : formattedFilieres);
            
            //console.log("Filières formatées à sauvegarder:", formattedFilieres);
        } else {
            console.log("Pas de mapping trouvé");
        }
    }

    useEffect(() => {
        const loadData = async () => {
            /*console.log("État initial:", { 
                session: !!session, 
                user_id: session?.user_id, 
                entreprise_id: session?.entreprise_id,
                filieres_actuelles: filieres
            });*/
            
            if (!session?.user_id || !session?.entreprise_id) {
                //console.log("Session incomplète, arrêt du chargement");
                setLoadingFilieres(false);
                return;
            }

            try {
                setLoadingFilieres(true);
                await getFilieresFromEntreprise();
            } catch (error) {
                console.error("Erreur lors du chargement des filières:", error);
            } finally {
                setLoadingFilieres(false);
            }
        };

        loadData();
    }, [session?.user_id, session?.entreprise_id, modalReload]);
    
    const toggleAll = () => {
        const areAllChecked = filieres
            .filter(f => f.name !== 'Autres')
            .every(f => f.checked);
        const updatedFilieres = filieres.map(f => ({
            ...f,
            checked: f.name === 'Autres' ? false : !areAllChecked
        }));
        setFilieres(updatedFilieres);
    };

    return (
        <div className="my-2">
            <div className="flex flex-wrap gap-2">
                {filieres && filieres.filter(f => f.name !== 'Autres').length > 0 && (
                    <button
                        onClick={toggleAll}
                        className="text-xs h-[22px] px-3 flex items-center justify-center transition-colors duration-200 
                        bg-gray-200 hover:bg-gray-300 rounded-md border"
                    >
                        {filieres.filter(f => f.name !== 'Autres').every(f => f.checked) 
                            ? 'Tout désélectionner' 
                            : 'Tout sélectionner'}
                    </button>
                )}
                <div className="join flex flex-wrap">
                    {loadingFilieres ? (
                        <div className="text-gray-500">Chargement des filières...</div>
                    ) : filieres && filieres.length > 0 ? (
                        <>
                            {/* Afficher d'abord toutes les filières sauf "Autres" */}
                            {filieres
                                .filter(f => f.name !== 'Autres')
                                .map((filiere, index, filteredArray) => (
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
                                            onChange={() => toggleFiliere(filiere.name)}
                                        />
                                        <span
                                            className={`text-xs h-[22px] px-3 flex items-center justify-center transition-colors duration-200 
                                            ${filiere.checked ? filiere.color : 'bg-gray-300'} 
                                            ${filiere.checked ? 'text-white' : 'text-gray-700'}
                                            ${index === 0 ? 'rounded-l-md' : ''}
                                            ${index === filteredArray.length - 1 ? 'rounded-r-md' : ''}`}
                                        >
                                            {filiere.name}
                                        </span>
                                    </label>
                                ))}
                            
                            {/* Afficher "Autres" séparément s'il existe */}
                            {filieres.find(f => f.name === 'Autres') && (
                                <label className="flex items-center cursor-pointer ml-2">
                                    <input
                                        className="hidden"
                                        type="checkbox"
                                        name="options_filiere"
                                        aria-label="Autres"
                                        checked={filieres.find(f => f.name === 'Autres')?.checked}
                                        onChange={() => toggleFiliere('Autres')}
                                    />
                                    <span
                                        className={`text-xs h-[22px] px-3 flex items-center justify-center transition-colors duration-200 rounded-md
                                        ${filieres.find(f => f.name === 'Autres')?.checked 
                                            ? filieres.find(f => f.name === 'Autres')?.color 
                                            : 'bg-gray-300'} 
                                        ${filieres.find(f => f.name === 'Autres')?.checked 
                                            ? 'text-white' 
                                            : 'text-gray-700'}`}
                                    >
                                        Autres
                                    </span>
                                </label>
                            )}
                        </>
                    ) : (
                        <div className="text-gray-500">Aucune filière disponible</div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default FiltreFilieres;
