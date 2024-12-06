"use client"
import React, { useEffect, useState, useRef } from "react";
import { useFilterContext } from "../FilterContext";
import { useSession } from "./SessionProvider";
import { supabase } from "../database/supabaseClient";

const FiltreSite = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { sites, setSites, toggleSite } = useFilterContext();
    const session = useSession();
    const containerRef = useRef<HTMLDivElement>(null);

    const getSitesFromUser = async () => {
        if (session?.user_id) {
            const { data, error } = await supabase
            .from('bsd')
            .select('infos_json')
            .eq('user_id', session.user_id);
            
            if (error) {
                console.error('Error fetching sites:', error);
                return;
            }

            if(data && data.length > 0) {
                const sites = data
                    .filter(bsd => 
                        bsd.infos_json?.formAPI?.createFormInput?.emitter?.workSite
                    )
                    .map(bsd => {
                        const workSite = bsd.infos_json.formAPI.createFormInput.emitter.workSite;
                        return workSite.name; //`${workSite.address} ${workSite.postalCode} ${workSite.city}`;
                    })
                    .filter(Boolean);

                const sites_uniques = Array.from(new Set(sites));
                const formattedSites = sites_uniques.map(site => ({
                    name: site,
                    checked: true
                }));
                setSites(formattedSites);
            }
        }
    }

    useEffect(() => {
        getSitesFromUser();

        // Gestionnaire d'événements pour fermer le menu quand on clique en dehors
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [session]);

    return (
        <div 
            ref={containerRef}
            className="m-4 relative"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            <div className="btn flex items-center justify-between px-4 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-center space-x-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    <h1 className="text-lg font-semibold text-gray-700">Sites</h1>
                </div>
                <span className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    ▼
                </span>
            </div>

            {isOpen && (
                <>
                    {/* Zone invisible pour combler l'espace entre le bouton et le menu */}
                    <div 
                        className="absolute left-0 w-full h-2 -bottom-2"
                        onMouseEnter={() => setIsOpen(true)}
                    />
                    
                    <div 
                        className="absolute top-full left-0 w-80 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
                        onMouseEnter={() => setIsOpen(true)}
                        onMouseLeave={() => setIsOpen(false)}
                    >
                        <div className="p-3 border-b border-gray-200">
                            <span className="text-sm font-semibold text-gray-700">
                                Sélectionner les sites
                            </span>
                        </div>
                        <div className="max-h-64 overflow-y-auto p-2">
                            {sites && sites.length > 0 ? (
                                sites.map((site) => (
                                    <label 
                                        key={site.name} 
                                        className="flex items-center p-2 hover:bg-gray-50 rounded-md cursor-pointer transition-colors duration-150"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={site.checked}
                                            onChange={() => toggleSite(site.name)}
                                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="ml-3 text-sm text-gray-700 truncate">
                                            {site.name}
                                        </span>
                                    </label>
                                ))
                            ) : (
                                <div className="text-sm text-gray-500 p-2 text-center">
                                    Aucun site disponible
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default FiltreSite;