"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSession } from '../SessionProvider';

interface SiteContextType {
    selectedSites: string[];
    sites: string[];
    toggleSite: (site: string) => void;
    isLoading: boolean;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

export function SiteProvider({ children }: { children: React.ReactNode }) {
    const session = useSession();
    const [sites, setSites] = useState<string[]>([]);
    const [selectedSites, setSelectedSites] = useState<string[]>(() => {
        // Initialiser depuis localStorage si disponible
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('selectedSites');
            return saved ? JSON.parse(saved) : [];
        }
        return [];
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (session && session.user.id) {
            // Charger les sites depuis l'API seulement si pas déjà en cache
            const cachedSites = localStorage.getItem('sites');
            if (cachedSites) {
                setSites(JSON.parse(cachedSites));
                setIsLoading(false);
            } else {
                setIsLoading(true);
                fetch(`/api/filtres_globales/filtre_sites?userId=${session.user.id}`)
                    .then(res => res.json())
                    .then(data => {
                        setSites(data);
                        localStorage.setItem('sites', JSON.stringify(data));
                        setIsLoading(false);
                    })
                    .catch(error => {
                        console.error('Error fetching sites:', error);
                        setIsLoading(false);
                    });
            }
        }
    }, [session]);

    // Sauvegarder selectedSites dans localStorage à chaque changement
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('selectedSites', JSON.stringify(selectedSites));
        }
    }, [selectedSites]);

    const toggleSite = (site: string) => {
        setSelectedSites(prev => {
            const newSelected = prev.includes(site)
                ? prev.filter(s => s !== site)
                : [...prev, site];
            return newSelected;
        });
    };

    return (
        <SiteContext.Provider value={{
            selectedSites,
            sites,
            toggleSite,
            isLoading
        }}>
            {children}
        </SiteContext.Provider>
    );
}

export function useSite() {
    const context = useContext(SiteContext);
    if (context === undefined) {
        throw new Error('useSite must be used within a SiteProvider');
    }
    return context;
} 