'use client'
import React, { createContext, useState, useContext, ReactNode } from 'react';

export interface Filiere {
    name: string;
    color: string;
    checked: boolean;
}

interface Site {
  name: string;
  checked: boolean;
}

interface Prestataire {
  name: string;
  checked: boolean;
}

interface SegmentDates {
  debut: Date | null;
  fin: Date | null;
}

export interface FiliereOuPrestataireInterface {
  nom : 'filiere' | 'prestataire';
}

interface FilterContextType {
  filieres: Filiere[];
  sites: Site[];
  prestataires: Prestataire[];
  segmentDates: SegmentDates;
  filieres_ou_prestataires: FiliereOuPrestataireInterface;

  setFilieres: (filieres: Filiere[]) => void;
  setSites: (sites: Site[]) => void;
  setPrestataires: (prestataires: Prestataire[]) => void;
  setSegmentDates: (dates: SegmentDates) => void;
  setFilieresOuPrestataires: (filieres_ou_prestataires: FiliereOuPrestataireInterface) => void;

  toggleFiliere: (name: string) => void;
  toggleSite: (name: string) => void;
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
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [segmentDates, setSegmentDates] = useState<SegmentDates>({ debut: null, fin: null });
  const [filieres_ou_prestataires, setFilieresOuPrestataires] = useState<FiliereOuPrestataireInterface>({ nom: 'filiere' });
  const toggleFiliere = (name: string) => {
    setFilieres(prev => prev.map(filiere => 
      filiere.name === name 
        ? { ...filiere, checked: !filiere.checked }
        : filiere
    ));
  };

  const toggleSite = (name: string) => {
    setSites(prev => prev.map(site => 
      site.name === name 
        ? { ...site, checked: !site.checked }
        : site
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
    setFilieres(prev => prev.map(f => ({ ...f, checked: false })));
    setSites(prev => prev.map(s => ({ ...s, checked: false })));
    setPrestataires(prev => prev.map(p => ({ ...p, checked: false })));
    setSegmentDates({ debut: null, fin: null });
  };

  const value = {
    filieres,
    sites,
    prestataires,
    segmentDates,
    filieres_ou_prestataires,
    setFilieres,
    setSites,
    setPrestataires,
    setSegmentDates,
    setFilieresOuPrestataires,
    toggleFiliere,
    toggleSite,
    togglePrestataire,
    resetAllFilters,
  };

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
};
