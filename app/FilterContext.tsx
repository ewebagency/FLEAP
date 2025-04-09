'use client'
import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { useModalContextNew } from './register/RegisterComponents/Modal/ContextModal';
import { useSession } from './component/SessionProvider';

export interface Filiere {
    name: string;
    color: string;
    checked: boolean;
}

export interface Site {
  orgId: string;
  name: string;
  givenName: string;
  checked: boolean;
  activated: boolean;
  isTrackDechets?: boolean;
  isInDb?: boolean;
}

export interface PointCollecte {
  name: string;
  checked: boolean;
}

export interface Prestataire {
  name: string;
  checked: boolean;
}

export interface SegmentDates {
  debut: Date | null;
  fin: Date | null;
}

export interface FiliereOuPrestataireInterface {
  nom : 'filiere' | 'prestataire';
}

export interface FilterContextType {
  filieres: Filiere[];
  sites: Site[];
  points_collecte: PointCollecte[];
  prestataires: Prestataire[];
  segmentDates: SegmentDates;
  filieres_ou_prestataires: FiliereOuPrestataireInterface;

  setFilieres: (filieres: Filiere[]) => void;
  setSites: (sites: Site[]) => void;
  setPointsCollecte: (points_collecte: PointCollecte[]) => void;
  setPrestataires: (prestataires: Prestataire[]) => void;
  setSegmentDates: (dates: SegmentDates) => void;
  setFilieresOuPrestataires: (filieres_ou_prestataires: FiliereOuPrestataireInterface) => void;

  toggleFiliere: (name: string) => void;
  toggleSite: (orgId: string) => void;
  togglePointsCollecte: (name: string) => void;
  togglePrestataire: (name: string) => void;
  resetAllFilters: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const useFilterContext = () => {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilterContext must be used within a FilterProvider');
  }
  return context;
};

interface FilterProviderProps {
  children: ReactNode;
}

export const FilterProvider: React.FC<FilterProviderProps> = ({ children }) => {
  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [points_collecte, setPointsCollecte] = useState<PointCollecte[]>([]);
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [segmentDates, setSegmentDates] = useState<SegmentDates>({ debut: null, fin: null });
  const [filieres_ou_prestataires, setFilieresOuPrestataires] = useState<FiliereOuPrestataireInterface>({ nom: 'filiere' });
  const [isInitialized, setIsInitialized] = useState(false);
  const session = useSession();

  const toggleFiliere = (name: string) => {
    setFilieres(prev => prev.map(filiere => 
      filiere.name === name 
        ? { ...filiere, checked: !filiere.checked }
        : filiere
    ));
  };

  const toggleSite = useCallback((siteId: string) => {
    setSites(prevSites => {
        const newSites = prevSites.map(site =>
            site.orgId === siteId ? { ...site, checked: !site.checked } : site
        );

        if (session?.entreprise_id) {
            const siteStates = newSites.reduce((acc, site) => ({
                ...acc,
                [site.orgId]: {
                    checked: site.checked
                }
            }), {});
            
            localStorage.setItem(
                `sites-${session.entreprise_id}`,
                JSON.stringify(siteStates)
            );
            
            //console.log('Sites sauvegardés dans le localStorage:', siteStates);
        }

        return newSites;
    });
  }, [session?.entreprise_id]);

  const togglePointsCollecte = (name: string) => {
    setPointsCollecte(prev => prev.map(point_collecte => 
      point_collecte.name === name 
        ? { ...point_collecte, checked: !point_collecte.checked }
        : point_collecte
    ));
  };

  const togglePrestataire = (name: string) => {
    setPrestataires(prev => prev.map(prestataire => 
      prestataire.name === name 
        ? { ...prestataire, checked: !prestataire.checked }
        : prestataire
    ));
  };

  const resetAllFilters = () => {
    setFilieres(prev => prev.map(f => ({ ...f, checked: true })));
    setSites(prev => prev.map(s => ({ ...s, checked: true })));
    setPointsCollecte(prev => prev.map(p => ({ ...p, checked: true })));
    setPrestataires(prev => prev.map(p => ({ ...p, checked: true })));
    setSegmentDates({ debut: null, fin: null });
  };

  useEffect(() => {
    if (!isInitialized && session?.entreprise_id) {
      const savedFilieres = localStorage.getItem(`filieres-${session.entreprise_id}`);
      if (savedFilieres) {
        setFilieres(JSON.parse(savedFilieres));
      }

      const savedSites = localStorage.getItem(`sites-${session.entreprise_id}`);
      if (savedSites) {
        const savedSiteStates = JSON.parse(savedSites);
        //console.log('Sites chargés depuis le localStorage:', savedSiteStates);
        setSites(prevSites => 
          prevSites.map(site => ({
            ...site,
            checked: savedSiteStates[site.orgId]?.checked ?? false
          }))
        );
      }

      const savedPointsCollecte = localStorage.getItem(`points_collecte-${session.entreprise_id}`);
      if (savedPointsCollecte) {
        setPointsCollecte(JSON.parse(savedPointsCollecte));
      }

      setIsInitialized(true);
    }
  }, [isInitialized, session?.entreprise_id]);

  const value = {
    filieres,
    sites,
    points_collecte,
    prestataires,
    segmentDates,
    filieres_ou_prestataires,
    setFilieres,
    setSites,
    setPointsCollecte,
    setPrestataires,
    setSegmentDates,
    setFilieresOuPrestataires,
    toggleFiliere,
    toggleSite,
    togglePointsCollecte,
    togglePrestataire,
    resetAllFilters,
  };

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
};
