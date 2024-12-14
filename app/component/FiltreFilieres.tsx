"use client"
import React, { useEffect, useState } from "react";
import { useFilterContext } from "../FilterContext";
import { useSession } from "./SessionProvider";
import { supabase } from "../database/supabaseClient";
import { getColors } from "./Analyse/MetaComponent/Colours";

const FiltreFilieres = () => {
    const { filieres, setFilieres, toggleFiliere } = useFilterContext();
    const session = useSession();
    const [loadingFilieres, setLoadingFilieres] = useState(true);

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
        const codes = codes_all.map(code => code.code).filter(code => code != null);
        
        const array_codes_propres = codes.map(code => code.replaceAll(' ', '').replace('*', '').trim());
        
        const array_codes_clean = array_codes_propres.map(code => String(parseInt(code)));
        
        const set_codes_clean = new Set(array_codes_clean);
        const codes_uniques = Array.from(set_codes_clean);
        
        
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
                const match = mappingArray.find((item:{ced:string, filiere:string}) => item.ced === code);
                if(match) {
                    filieres_uniques.push(match.filiere);
                }
                else others = true;
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
            console.log("Filières formatées à sauvegarder:", formattedFilieres);
        } else {
            console.log("Pas de mapping trouvé");
        }
    }

    useEffect(() => {
        const loadData = async () => {
            console.log("État initial:", { 
                session: !!session, 
                user_id: session?.user_id, 
                entreprise_id: session?.entreprise_id,
                filieres_actuelles: filieres
            });
            
            if (!session?.user_id || !session?.entreprise_id) {
                console.log("Session incomplète, arrêt du chargement");
                setLoadingFilieres(false);
                return;
            }

            try {
                console.log("Début du chargement des filières");
                setLoadingFilieres(true);
                await getFilieresFromEntreprise();
            } catch (error) {
                console.error("Erreur lors du chargement des filières:", error);
            } finally {
                console.log("Fin du chargement des filières, état final:", filieres);
                setLoadingFilieres(false);
            }
        };

        loadData();
    }, [session?.user_id, session?.entreprise_id]);
    
    const toggleAll = () => {
        const areAllChecked = filieres.every(f => f.checked);
        const updatedFilieres = filieres.map(f => ({
            ...f,
            checked: !areAllChecked
        }));
        setFilieres(updatedFilieres);
    };

    return (
        <div className="m-5">
            <div className="flex flex-wrap gap-2">
            {filieres && filieres.length > 0 && (
                    <button
                        onClick={toggleAll}
                        className="text-xs h-[22px] px-3 flex items-center justify-center transition-colors duration-200 
                        bg-gray-200 hover:bg-gray-300 rounded-md"
                    >
                        {filieres.every(f => f.checked) ? 'Tout désélectionner' : 'Tout sélectionner'}
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
                                    onChange={() => toggleFiliere(filiere.name)}
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
