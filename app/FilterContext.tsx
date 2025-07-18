'use client'
import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useMemo } from 'react';
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
  nom : 'filiere' | 'filiere_nom';
}

export interface FilterContextType {
  filieres: Filiere[];
  filieres_ced: Filiere[];
  filieres_nom: Filiere[];
  sites: Site[];
  points_collecte: PointCollecte[];
  prestataires: Prestataire[];
  segmentDates: SegmentDates;
  filieres_ou_prestataires: FiliereOuPrestataireInterface;

  setFilieres: (filieres: Filiere[]) => void;
  setFilieresCed: (filieres: Filiere[]) => void;
  setFilieresNom: (filieres: Filiere[]) => void;
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
  const [filieres_ced, setFilieresCed] = useState<Filiere[]>([]);
  const [filieres_nom, setFilieresNom] = useState<Filiere[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [points_collecte, setPointsCollecte] = useState<PointCollecte[]>([]);
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [segmentDates, setSegmentDates] = useState<SegmentDates>({ debut: null, fin: null });
  const [filieres_ou_prestataires, setFilieresOuPrestataires] = useState<FiliereOuPrestataireInterface>({ nom: 'filiere' });
  const [isInitialized, setIsInitialized] = useState(false);
  const session = useSession();

  // Calculer les filières actives selon le mode
  const filieres = useMemo(() => {
    if (filieres_ou_prestataires.nom === 'filiere_nom') {
      return filieres_nom;
    } else if (filieres_ou_prestataires.nom === 'filiere') {
      return filieres_ced;
    }
    return filieres_ced; // fallback
  }, [filieres_ced, filieres_nom, filieres_ou_prestataires.nom]);

  const toggleFiliere = (name: string) => {
    if (filieres_ou_prestataires.nom === 'filiere_nom') {
      setFilieresNom(prev => prev.map(filiere => 
        filiere.name === name 
          ? { ...filiere, checked: !filiere.checked }
          : filiere
      ));
    } else {
      setFilieresCed(prev => prev.map(filiere => 
        filiere.name === name 
          ? { ...filiere, checked: !filiere.checked }
          : filiere
      ));
    }
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
    setFilieresCed(prev => prev.map(f => ({ ...f, checked: true })));
    setFilieresNom(prev => prev.map(f => ({ ...f, checked: true })));
    setSites(prev => prev.map(s => ({ ...s, checked: true })));
    setPointsCollecte(prev => prev.map(p => ({ ...p, checked: true })));
    setPrestataires(prev => prev.map(p => ({ ...p, checked: true })));
    setSegmentDates({ debut: null, fin: null });
  };

  useEffect(() => {
    if (!isInitialized && session?.entreprise_id) {
      const savedFilieresCed = localStorage.getItem(`filieres_ced-${session.entreprise_id}`);
      if (savedFilieresCed) {
        setFilieresCed(JSON.parse(savedFilieresCed));
      }

      const savedFilieresNom = localStorage.getItem(`filieres_nom-${session.entreprise_id}`);
      if (savedFilieresNom) {
        setFilieresNom(JSON.parse(savedFilieresNom));
      }

      const savedSites = localStorage.getItem(`sites-${session.entreprise_id}`);
      if (savedSites) {
        const savedSiteStates = JSON.parse(savedSites);
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
    filieres_ced,
    filieres_nom,
    sites,
    points_collecte,
    prestataires,
    segmentDates,
    filieres_ou_prestataires,
    setFilieres: (filieres: Filiere[]) => {
      // Déterminer quel setter utiliser selon le mode actuel
      if (filieres_ou_prestataires.nom === 'filiere_nom') {
        setFilieresNom(filieres);
      } else {
        setFilieresCed(filieres);
      }
    },
    setFilieresCed,
    setFilieresNom,
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
