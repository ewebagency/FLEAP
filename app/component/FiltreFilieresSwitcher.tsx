"use client";
import React from "react";
import { useFilterContext } from "../FilterContext";
import { useSession } from "./SessionProvider";
import { useSWRConfig } from "swr";
import FiltreFilieres from "./FiltreFilieres";
import FiltreFilieresNom from "./FiltreFilieresNom";
import { useAnalysis } from "../analysis/AnalysisProvider";

const FiltreFilieresSwitcher = () => {
    const { filieres_ou_prestataires, setFilieresOuPrestataires } = useFilterContext();
    const { entreprise_id } = useSession();
    const { mutate } = useSWRConfig();
    const { filterImportedOnly, setFilterImportedOnly } = useAnalysis();
    const mode = filieres_ou_prestataires.nom;

    return (
        <div className="mx-4 flex items-center justify-between w-full">
            <div>
                {mode === 'filiere' ? <FiltreFilieres /> : <FiltreFilieresNom />}
            </div>
            <div className="flex gap-2 items-center">
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
                {/* Mini bouton filterLineRegister */}
                <div className="ml-4 mb-2">
                    <button
                        onClick={() => setFilterImportedOnly(!filterImportedOnly)}
                        className={`px-2 py-1 rounded text-xs font-medium border transition-colors duration-150 ${filterImportedOnly ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-blue-500 border-blue-500 hover:bg-blue-50'}`}
                        title={filterImportedOnly ? 'Afficher toutes les lignes' : 'Afficher uniquement les lignes importées'}
                    >
                        {filterImportedOnly ? 'Importées' : 'Toutes'}
                    </button>
                </div>        
            </div>    
        </div>
    );
};

export default FiltreFilieresSwitcher; 