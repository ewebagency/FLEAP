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
        if (session?.user.id) {            
            const { data, error } = await supabase
            .from('bsd')
            .select('infos_json')
            .eq('user_id', session.user.id);
            
            if (error) {
                console.error('Error fetching filieres:', error);
                return;
            }

            //console.log("Raw data:", data);

            if(data && data.length > 0){
                const filieres = data
                    .filter(bsd => bsd.infos_json && bsd.infos_json.dataSupplementaire)
                    .map(bsd => bsd.infos_json.dataSupplementaire.filiere)
                    .filter(Boolean); // Filtrer les undefined/null

                //console.log("Extracted filieres:", filieres);

                const filieres_uniques = Array.from(new Set(filieres));
                //filieres_uniques.push('Autre');
                const filieres_colors = getColors(filieres_uniques.length);
                const filieres_checked = getChecked(filieres_uniques.length);

                const formattedFilieres = filieres_uniques.map((filiere, index) => ({
                    name: filiere, 
                    color: filieres_colors[index], 
                    checked: filieres_checked[index]
                }));

                //console.log("Formatted filieres:", formattedFilieres);
                setFilieres(formattedFilieres);
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
