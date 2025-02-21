"use client"
import React, { useEffect, useState, useRef } from "react";
import { useFilterContext } from "../FilterContext";
import { useSession } from "./SessionProvider";
import { supabase } from "../database/supabaseClient";
import { useModalContextNew } from "../register/RegisterComponents/Modal/ContextModal";

const FiltrePointCollecte = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { points_collecte, setPointsCollecte, togglePointsCollecte } = useFilterContext();
    const {entreprise_id} = useSession();
    const containerRef = useRef<HTMLDivElement>(null);
    const { modalReload, setFilterPendingBSDs } = useModalContextNew();

    useEffect(() => {
        const getPointsCollecteFromEntreprise = async () => {
            if (entreprise_id) {
                const { data, error } = await supabase
                    .from('bsd')
                    .select('infos_json')
                    .order('created_at', { ascending: false })
                    .eq('entreprise_id', entreprise_id);
                
                if (error) {
                    console.error('Error fetching points collecte:', error);
                    return;
                }
                
                if(data && data.length > 0) {
                    const points_collecte = data
                        .filter(bsd => 
                            bsd.infos_json?.formAPI?.createFormInput?.emitter?.workSite
                        )
                        .map(bsd => {
                            const workSite = bsd.infos_json.formAPI.createFormInput.emitter.workSite;
                            return workSite.name; //`${workSite.address} ${workSite.postalCode} ${workSite.city}`;
                        })
                        .filter(Boolean);

                    const points_collecte_uniques = Array.from(new Set(points_collecte));
                    //console.log("points_collecte_uniques:", points_collecte_uniques);
                    
                    const formattedPointsCollecte = points_collecte_uniques.map(point_collecte => ({
                        name: point_collecte,
                        checked: true
                    }));
                    const {data: points_collecte_non_renseignes, error: error_points_collecte_non_renseignes} = await supabase
                    .from('bsd')
                    .select('*')
                    .eq('entreprise_id', entreprise_id)
                    .or('infos_json->formAPI->createFormInput->emitter->>workSite.is.null,'+
                    'infos_json->formAPI->createFormInput->emitter->workSite->>name.eq.""');
                    if(error_points_collecte_non_renseignes) {
                        console.error("Error fetching points collecte non renseignes:", error_points_collecte_non_renseignes);
                    } else {
                        if(points_collecte_non_renseignes && points_collecte_non_renseignes.length > 0) {
                            //console.log("points_collecte_non_renseignes:", points_collecte_non_renseignes);
                            formattedPointsCollecte.push({
                                name: "Non renseigné",
                                checked: true
                            });
                        }
                    }
                    
                    setPointsCollecte(formattedPointsCollecte);
                }
            }
        };
        
        //console.log('refresh des filtres', modalReload);
        
        if (entreprise_id) {
            getPointsCollecteFromEntreprise();
        }

        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [entreprise_id, setPointsCollecte, modalReload]);

    return (
        <div 
            ref={containerRef}
            className="relative hidden"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            <div className="flex items-center justify-between px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                <div className="flex items-center space-x-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium text-gray-700">Point de collecte</span>
                </div>
                <span className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </span>
            </div>

            {isOpen && (
                <div 
                    className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg"
                    onMouseEnter={() => setIsOpen(true)}
                    onMouseLeave={() => setIsOpen(false)}
                >
                    <div className="p-3 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-700">
                            Sélectionner les points de collecte
                        </span>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {points_collecte && points_collecte.length > 0 ? (
                            points_collecte.map((point_collecte) => (
                                <label 
                                    key={point_collecte.name} 
                                    className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={point_collecte.checked}
                                        onChange={() => {
                                            setFilterPendingBSDs(false);
                                            togglePointsCollecte(point_collecte.name);
                                        }}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="ml-3 text-sm text-gray-700">
                                        {point_collecte.name}
                                    </span>
                                </label>
                            ))
                        ) : (
                            <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                Aucun point de collecte disponible
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default FiltrePointCollecte;