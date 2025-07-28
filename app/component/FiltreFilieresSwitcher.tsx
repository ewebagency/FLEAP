"use client";
import React from "react";
import { useFilterContext } from "../FilterContext";
import { useSession } from "./SessionProvider";
import { useSWRConfig } from "swr";
import FiltreFilieres from "./FiltreFilieres";
import FiltreFilieresNom from "./FiltreFilieresNom";

const FiltreFilieresSwitcher = () => {
    const { filieres_ou_prestataires, setFilieresOuPrestataires } = useFilterContext();
    const { entreprise_id } = useSession();
    const { mutate } = useSWRConfig();
    const mode = filieres_ou_prestataires.nom;

    return (
        <div className="mx-4 flex items-center justify-between w-full">
            <div>
                {mode === 'filiere' ? <FiltreFilieres /> : <FiltreFilieresNom />}
            </div>
            <div className="flex items-center gap-0 mb-2 text-sm">
                <button
                    onClick={() => {
                        setFilieresOuPrestataires({ nom: 'filiere' });
                        // Invalider le cache SWR pour forcer le rechargement
                        if (entreprise_id) {
                            mutate(`/api/get_mapping_nom_filiere?entreprise_id=${entreprise_id}`);
                        }
                    }}
                    className={`px-3 py-1 rounded-l-md ${mode === 'filiere' ? 'bg-green-600 text-white font-bold' : 'bg-gray-200 text-gray-700'}`}
                >
                    CED
                </button>
                <button
                    onClick={() => {
                        setFilieresOuPrestataires({ nom: 'filiere_nom' });
                        // Invalider le cache SWR pour forcer le rechargement
                        if (entreprise_id) {
                            mutate(`/api/get_mapping_nom_filiere?entreprise_id=${entreprise_id}`);
                        }
                    }}
                    className={`px-3 py-1 rounded-r-md ${mode === 'filiere_nom' ? 'bg-green-600 text-white font-bold' : 'bg-gray-200 text-gray-700'}`}
                >
                    Nom
                </button>
            </div>
        </div>
    );
};

export default FiltreFilieresSwitcher; 