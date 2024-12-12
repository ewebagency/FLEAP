"use client"
import React, { useEffect, useState } from "react";
import { useFilterContext } from "../FilterContext";
import { useSession } from "./SessionProvider";
import { supabase } from "../database/supabaseClient";
import { getChecked, getColors } from "./Analyse/MetaComponent/Colours";

const FiltreFilieres = () => {
    const { filieres, setFilieres, toggleFiliere } = useFilterContext();
    const session = useSession();
    const [loadingFilieres, setLoadingFilieres] = useState(true);

    const getFilieresFromEntreprise = async () => {
        console.log("Début getFilieresFromEntreprise");
        const { data, error } = await supabase
        .from('bsd')
        .select('infos_json')
        .eq('entreprise_id', session?.entreprise_id);
        
        if (error) {
            console.error('Error fetching filieres:', error);
            return;
        }

        console.log("BSDs récupérés:", data?.length);
        if (!data || data.length === 0) {
            console.log("Pas de BSDs trouvés");
            return;
        }

        const codes = data
            .map(bsd => bsd?.infos_json?.formAPI?.createFormInput?.wasteDetails?.code)
            .filter(code => code != null);
        
        const codes_uniques = Array.from(new Set(codes)).map(code => code.replaceAll(' ', '').replace('*', ''));
        console.log("Codes uniques trouvés:", codes_uniques);
        
        const mapping = await supabase
            .from('entreprise')
            .select('mapping_ced_filiere')
            .eq('id', session?.entreprise_id)
            .single();

        console.log("Mapping récupéré:", mapping?.data?.mapping_ced_filiere);

        if (mapping?.data?.mapping_ced_filiere) {
            const mappingArray = mapping.data.mapping_ced_filiere;
            const filieres_uniques: string[] = [];
            let others = false;

            for(const code of codes_uniques) {
                const match = mappingArray.find((item:{ced:string, filiere:string}) => item.ced === code);
                if(match) {
                    console.log(`Match trouvé pour code ${code}:`, match.filiere);
                    filieres_uniques.push(match.filiere);
                }
                else others = true;
            }
            
            if(others) filieres_uniques.push('Autres');
            console.log("Filières uniques trouvées:", filieres_uniques);

            const filieres_colors = getColors(filieres_uniques.length);
            const formattedFilieres = filieres_uniques.map((filiere, index) => {
                const existingFiliere = filieres.find(f => f.name === filiere);
                return {
                    name: filiere,
                    color: filieres_colors[index],
                    checked: existingFiliere ? existingFiliere.checked : true
                };
            });

            console.log("Filières formatées à sauvegarder:", formattedFilieres);
            setFilieres(formattedFilieres);
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
    
    return (
        <div className="join m-5">
            {loadingFilieres ? (
                <div className="text-gray-500">Chargement des filières...</div>
            ) : filieres && filieres.length > 0 ? (
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
