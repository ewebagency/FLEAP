'use client'
import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useMemo } from 'react';
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
  siteFilterMode: 'all' | 'cumulative';
  selectedSiteId: string | null;
  points_collecte: PointCollecte[];
  prestataires: Prestataire[];
  segmentDates: SegmentDates;
  serverDateSearch: boolean;
  filieres_ou_prestataires: FiliereOuPrestataireInterface;

  setFilieres: (filieres: Filiere[]) => void;
  setFilieresCed: (filieres: Filiere[]) => void;
  setFilieresNom: (filieres: Filiere[]) => void;
  setSites: (sites: Site[]) => void;
  setPointsCollecte: (points_collecte: PointCollecte[]) => void;
  setPrestataires: (prestataires: Prestataire[]) => void;
  setSegmentDates: (dates: SegmentDates) => void;
  setServerDateSearch: (useServer: boolean) => void;
  setFilieresOuPrestataires: (filieres_ou_prestataires: FiliereOuPrestataireInterface) => void;
  setSiteFilterMode: (mode: 'all' | 'cumulative') => void;
  setSelectedSiteId: (siteId: string | null) => void;

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
  const [siteFilterMode, setSiteFilterMode] = useState<'all' | 'cumulative'>('all');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [points_collecte, setPointsCollecte] = useState<PointCollecte[]>([]);
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [segmentDates, setSegmentDates] = useState<SegmentDates>({ debut: null, fin: null });
  const [serverDateSearch, setServerDateSearch] = useState<boolean>(false);
  const [filieres_ou_prestataires, setFilieresOuPrestataires] = useState<FiliereOuPrestataireInterface>({ nom: 'filiere_nom' });
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
        console.log(`🔘 toggleSite appelé - siteId: ${siteId}, mode: ${siteFilterMode}, prevSites.length: ${prevSites.length}`);
        
        let newSites: Site[];
        if (siteFilterMode === 'cumulative') {
            // En mode cumulative, on peut cocher/décocher plusieurs sites
            newSites = prevSites.map(site =>
                site.orgId === siteId ? { ...site, checked: !site.checked } : site
            );
        } else {
            // Mode all: toggle classique
            newSites = prevSites.map(site =>
                site.orgId === siteId ? { ...site, checked: !site.checked } : site
            );
        }

        if (session?.entreprise_id) {
            // En mode cumulative, si on a un tableau incomplet, FUSIONNER avec le localStorage existant
            // au lieu d'écraser
            let siteStates: Record<string, { checked: boolean }>;
            
            if (siteFilterMode === 'cumulative' && newSites.length < 3) {
                // Tableau incomplet, fusionner avec l'existant
                const existingData = localStorage.getItem(`sites-${session.entreprise_id}`);
                const existingSites = existingData ? JSON.parse(existingData) : {};
                
                // Mettre à jour seulement le site qui a changé
                siteStates = {
                    ...existingSites,
                    [siteId]: {
                        checked: newSites.find(s => s.orgId === siteId)?.checked ?? false
                    }
                };
                
                console.log('💾 toggleSite - FUSION avec localStorage existant');
            } else {
                // Tableau complet, écraser normalement
                siteStates = newSites.reduce((acc, site) => ({
                    ...acc,
                    [site.orgId]: {
                        checked: site.checked
                    }
                }), {});
            }
            
            localStorage.setItem(
                `sites-${session.entreprise_id}`,
                JSON.stringify(siteStates)
            );
            
            console.log('💾 toggleSite - Sites sauvegardés dans localStorage:', Object.keys(siteStates).length, 'sites');
            console.log('📝 Contenu:', JSON.stringify(siteStates));
        }

        return newSites;
    });
  }, [session?.entreprise_id, siteFilterMode]);

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

      // Charger les états des sites depuis localStorage (ajouté pour mode cumulative)
      const savedSitesData = localStorage.getItem(`sites-${session.entreprise_id}`);
      if (savedSitesData) {
        try {
          const savedSiteStates = JSON.parse(savedSitesData);
          // Les sites seront reconstruits par FiltreSiteEtablissement avec ces états
          console.log('📦 Sites chargés depuis localStorage:', Object.keys(savedSiteStates).length);
        } catch (e) {
          console.error('Erreur parsing sites localStorage:', e);
        }
      }

      const savedPointsCollecte = localStorage.getItem(`points_collecte-${session.entreprise_id}`);
      if (savedPointsCollecte) {
        setPointsCollecte(JSON.parse(savedPointsCollecte));
      }

      const savedMode = localStorage.getItem(`siteFilterMode-${session.entreprise_id}`);
      if (savedMode === 'all' || savedMode === 'cumulative') {
        setSiteFilterMode(savedMode);
      }

      const savedSelected = localStorage.getItem(`selectedSiteId-${session.entreprise_id}`);
      if (savedSelected) {
        setSelectedSiteId(savedSelected);
      }

      setIsInitialized(true);
    }
  }, [isInitialized, session?.entreprise_id]);

  // Persistance du mode et du site sélectionné
  useEffect(() => {
    if (session?.entreprise_id) {
      localStorage.setItem(`siteFilterMode-${session.entreprise_id}`, siteFilterMode);
      if (selectedSiteId) {
        localStorage.setItem(`selectedSiteId-${session.entreprise_id}`, selectedSiteId);
      } else {
        localStorage.removeItem(`selectedSiteId-${session.entreprise_id}`);
      }
    }
  }, [siteFilterMode, selectedSiteId, session?.entreprise_id]);

  // Fonction pour changer le mode avec logique de recheck des sites
  const handleSetSiteFilterMode = useCallback((mode: 'all' | 'cumulative') => {
    setSiteFilterMode(mode);
    
    // Ne plus gérer le checked ici, c'est fait dans FiltreSiteEtablissement
    // avec la prise en compte de userSiteAccess
    setSelectedSiteId(null);
  }, []);

  const value = {
    filieres,
    filieres_ced,
    filieres_nom,
    sites,
    siteFilterMode,
    selectedSiteId,
    points_collecte,
    prestataires,
    segmentDates,
    serverDateSearch,
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
    setServerDateSearch,
    setFilieresOuPrestataires,
    setSiteFilterMode: handleSetSiteFilterMode,
    setSelectedSiteId,
    toggleFiliere,
    toggleSite,
    togglePointsCollecte,
    togglePrestataire,
    resetAllFilters,
  };

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
};
