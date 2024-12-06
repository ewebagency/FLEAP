"use client"
import React, { useEffect } from "react";
import { useFilterContext } from "../FilterContext";
import { useSession } from "./SessionProvider";
import { supabase } from "../database/supabaseClient";
import { getChecked, getColors } from "./Analyse/MetaComponent/Colours";

const FiltreFilieres = () => {
    const { filieres, setFilieres, toggleFiliere } = useFilterContext();
    const session = useSession();

    const getFilieresFromUser = async () => {
        if (session && session.user_id) {            
            const { data, error } = await supabase
            .from('bsd')
            .select('infos_json')
            .eq('user_id', session.user_id);
            
            if (error) {
                console.error('Error fetching filieres:', error);
                return;
            }

            //console.log("Raw data:", data);

            if(data && data.length > 0 && session.entreprise_id){
                const codes = data
                    .map(bsd => bsd?.infos_json?.formAPI?.createFormInput?.wasteDetails?.code)
                    .filter(code => code != null);
                
                const codes_uniques = Array.from(new Set(codes)).map(code => code.replaceAll(' ', '').replace('*', ''));
                
                const mapping = await supabase
                    .from('entreprise')
                    .select('mapping_ced_filiere')
                    .eq('id', session.entreprise_id)
                    .single();

                if (mapping?.data?.mapping_ced_filiere) {
                    const mappingArray = mapping.data.mapping_ced_filiere;

                    //console.log('mappingArray', mappingArray, 'codes_uniques', codes_uniques);
                    const filieres_uniques:string[] = [];
                    let others = false;
                    for(const code of codes_uniques){
                        const match = mappingArray.find((item:{ced:string, filiere:string}) => item.ced === code);
                        if(match) filieres_uniques.push(match.filiere);
                        else others = true;
                    }
                    if(others) filieres_uniques.push('Autres');

                    // Utiliser filieres_uniques pour le reste du code
                    const filieres_colors = getColors(filieres_uniques.length);
                    const filieres_checked = getChecked(filieres_uniques.length);
                    const formattedFilieres = filieres_uniques.map((filiere, index) => ({
                        name: filiere, 
                        color: filieres_colors[index], 
                        checked: filieres_checked[index]
                    }));

                    setFilieres(formattedFilieres);
                }
            }
        }
    }

    useEffect(() => {
        getFilieresFromUser();
    }, [session]);
    
    return (
        <div className="join m-5">
            {filieres && filieres.length > 0 ? (
                filieres.map((filiere, index) => (
                    <label
                        key={`filiere-${index}`}
                        className={`flex items-center cursor-pointer ${
                            index === 0 ? 'rounded-l-md' : ''
                        } ${index === filieres.length - 1 ? 'rounded-r-md' : ''}`}
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
                            className={`text-xs h-6 px-3 flex items-center justify-center transition-colors duration-200 text-sm ${
                                filiere.checked ? filiere.color : 'bg-gray-300'
                            } ${filiere.checked ? 'text-white' : 'text-gray-700'} ${
                                index > 0 ? 'border-l-0' : ''
                            } ${index === 0 ? 'rounded-l-md' : ''} ${
                                index === filieres.length - 1 ? 'rounded-r-md' : ''
                            }`}
                        >
                            {filiere.name}
                        </span>
                    </label>
                ))
            ) : (
                <div className="text-gray-500">Aucune filière disponible</div>
            )}
        </div>
    );
}

export default FiltreFilieres;
