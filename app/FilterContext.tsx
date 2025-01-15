'use client'
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useModalContextNew } from './register/RegisterComponents/Modal/ContextModal';

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

  const toggleFiliere = (name: string) => {
    setFilieres(prev => prev.map(filiere => 
      filiere.name === name 
        ? { ...filiere, checked: !filiere.checked }
        : filiere
    ));
  };

  const toggleSite = (orgId: string) => {
    setSites(prev => prev.map(site => 
      site.orgId === orgId 
        ? { ...site, checked: !site.checked }
        : site
    ));
  };

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
    if (!isInitialized) {
      const savedFilieres = localStorage.getItem('filieres');
      if (savedFilieres) {
        setFilieres(JSON.parse(savedFilieres));
      }

      const savedSites = localStorage.getItem('sites');
      if (savedSites) {
        setSites(JSON.parse(savedSites));
      }

      const savedPointsCollecte = localStorage.getItem('points_collecte');
      if (savedPointsCollecte) {
        setPointsCollecte(JSON.parse(savedPointsCollecte));
      }

      setIsInitialized(true);
    }
  }, [isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('filieres', JSON.stringify(filieres));
      localStorage.setItem('sites', JSON.stringify(sites));
      localStorage.setItem('points_collecte', JSON.stringify(points_collecte));
    }
  }, [filieres, sites, points_collecte, isInitialized]);

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
