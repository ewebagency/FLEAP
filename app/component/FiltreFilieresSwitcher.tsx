"use client";
import React from "react";
import { useFilterContext } from "../FilterContext";
import { useSession } from "./SessionProvider";
import { useSWRConfig } from "swr";
import FiltreFilieres from "./FiltreFilieres";
import FiltreFilieresNom from "./FiltreFilieresNom";
import { useAnalysis } from "../analysis/AnalysisProvider";

const FiltreFilieresSwitcher = ({ showTypeFilter = true }: { showTypeFilter?: boolean }) => {
    const { filieres_ou_prestataires, setFilieresOuPrestataires } = useFilterContext();
    const { entreprise_id } = useSession();
    const { mutate } = useSWRConfig();
    const { filterType, setFilterType } = useAnalysis();
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
                {/* Bouton à 3 états pour le filtrage - masqué si showTypeFilter = false */}
                {showTypeFilter && (
                    <div className="ml-4 mb-2">
                        <div className="flex rounded-md overflow-hidden border border-gray-300">
                            <button
                                onClick={() => setFilterType('all')}
                                className={`px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                                    filterType === 'all' 
                                        ? 'bg-blue-500 text-white' 
                                        : 'bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                                title="Affiche tout (Excels, PDFs, Demandes)"
                            >
                                Tous
                            </button>
                            <button
                                onClick={() => setFilterType('imported')}
                                className={`px-3 py-1 text-xs font-medium transition-colors duration-150 border-l border-gray-300 ${
                                    filterType === 'imported' 
                                        ? 'bg-blue-500 text-white' 
                                        : 'bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                                title="Affiche uniquement les données importés (Excels, PDFs)"
                            >
                                Importés
                            </button>
                            <button
                                onClick={() => setFilterType('registres')}
                                className={`hidden px-3 py-1 text-xs font-medium transition-colors duration-150 border-l border-gray-300 ${
                                    filterType === 'registres' 
                                        ? 'bg-blue-500 text-white' 
                                        : 'bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                                title="Affiche uniquement les registres (Excels)"
                            >
                                Registres
                            </button>
                        </div>
                    </div>
                )}
            </div>    
        </div>
    );
};

export default FiltreFilieresSwitcher; 