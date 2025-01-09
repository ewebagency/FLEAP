'use client'

import { useEffect, useState, useRef } from 'react';
import { useFilterContext, FilterContextType, Site as ContextSite } from '../FilterContext';
import { useModalContextNew } from '../register/RegisterComponents/Modal/ContextModal';
import { useSession } from '../component/SessionProvider';
import { supabase } from '../database/supabaseClient';
import Cookies from 'js-cookie';

interface AdditionalSite {
    siret: string;
    name: string;
}

interface Etablissement {
    orgId: string;
    name: string;
    givenName: string;
    activated: boolean;
}

const FiltreSiteEtablissement = () => {
    const [etablissementsWithStatus, setEtablissementsWithStatus] = useState<Etablissement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const { sites, setSites, toggleSite } = useFilterContext();

    const {modalReload} = useModalContextNew();
    const session = useSession();
    const [additionnalSites, setAdditionnalSites] = useState<AdditionalSite[]>([]);
    const [isLoadingTrack, setIsLoadingTrack] = useState(false);

    useEffect(() => {
        if (session?.entreprise_id) {
            const getAdditionnalSites = async () => {
                const {data, error} = await supabase
                .from('bsd')
                .select(`
                    infos_json->formAPI->createFormInput->emitter->company->>siret,
                    infos_json->formAPI->createFormInput->emitter->company->>name
                `)
                .order('created_at', { ascending: false })
                .eq('entreprise_id', session?.entreprise_id)
                .limit(10000);
                if (error) {
                    console.error(error);
                    return;
                }

                const siteMap = new Map();
                data.forEach(item => {
                    const siret = item.siret;
                    const name = item.name;
                    if (!siret) return;
                    
                    if (!siteMap.has(siret)) {
                        siteMap.set(siret, new Map());
                    }
                    
                    const nameCount = siteMap.get(siret);
                    nameCount.set(name, (nameCount.get(name) || 0) + 1);
                });

                // Convertir le Map en tableau de sites uniques avec le nom le plus fréquent
                const uniqueSites = Array.from(siteMap.entries()).map(([siret, nameCount]) => {
                    // Trouver le nom avec le plus d'occurrences
                    let mostFrequentName = '';
                    let maxCount = 0;
                    
                    nameCount.forEach((count: number, name: string) => {
                        if (count > maxCount) {
                            maxCount = count;
                            mostFrequentName = name;
                        }
                    });

                    return {
                        siret: siret,
                        name: mostFrequentName
                    };
                });

                setAdditionnalSites(uniqueSites);
                console.log('Sites additionnels après traitement:', uniqueSites);
            }
            getAdditionnalSites();
        }
    }, [modalReload, session?.entreprise_id]);

    //On va chercher les webhook du compte track
    useEffect(() => {
        const fetchData = async () => {
            const trackDechetsToken = Cookies.get('trackdechets_token');
            
            if (!trackDechetsToken) {
                setIsLoadingTrack(false);
                return;
            }

            try {
                setIsLoadingTrack(true);
                const response = await fetch('/api/demande_collecte/web_hook/get_all_web_hooks_informations');
                if (!response.ok) {
                    setSites([]);
                    return;
                }
                const data = await response.json();
                setEtablissementsWithStatus(data.data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setIsLoadingTrack(false);
            }
        }
        fetchData();

        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        // Sites de la BDD
        const sites_from_db: ContextSite[] = additionnalSites.map(site => ({
            orgId: site.siret,
            name: site.name,
            givenName: '',
            checked: true,
            activated: true,
            isTrackDechets: false,
            isInDb: true
        }));

        const sites_autre: ContextSite = {
            orgId: '----',
            name: 'Autres',
            givenName: '',
            checked: true,
            activated: true,
            isTrackDechets: false,
            isInDb: false
        };

        if (etablissementsWithStatus.length > 0) {
            const vrai_sites: ContextSite[] = etablissementsWithStatus.map((etablissement: Etablissement) => ({
                orgId: etablissement.orgId,
                name: etablissement.name,
                givenName: etablissement.givenName,
                checked: etablissement.activated,
                activated: etablissement.activated,
                isTrackDechets: true,
                isInDb: false
            }));

            // Fusionner en donnant priorité aux noms de la BDD
            const mergedSites = vrai_sites.map(trackSite => {
                const dbSite = sites_from_db.find(dbSite => dbSite.orgId === trackSite.orgId);
                if (dbSite) {
                    return {
                        ...trackSite,
                        name: dbSite.name,
                        isInDb: true
                    };
                }
                return trackSite;
            });

            // Ajouter les sites qui sont uniquement dans la BDD
            const trackDechetsSirets = new Set(vrai_sites.map(site => site.orgId));
            const uniqueDbSites = sites_from_db.filter(site => !trackDechetsSirets.has(site.orgId));

            setSites([...mergedSites, ...uniqueDbSites, sites_autre]);
        } else {
            // Si pas de connexion TrackDechets, utiliser uniquement les sites de la BDD
            setSites([...sites_from_db, sites_autre]);
        }
    }, [etablissementsWithStatus, additionnalSites, setSites]);

    if (isLoading && additionnalSites.length === 0) return <div className="text-sm text-gray-500 ml-2">Chargement...</div>;
    if (error) return <div className="text-sm text-gray-500 ml-2">Erreur: {error}</div>;

    return (
        <div
            ref={containerRef}
            className="my-1 relative"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            <div className="btn flex items-center justify-between px-2 py-0 bg-white rounded-lg hover:bg-gray-50 transition-all duration-200 w-full">
                <div className="flex items-center space-x-4">
                    <box-icon name='map' type='solid' size="18px"></box-icon>
                    <h1 className="text-sm font-semibold text-gray-700">Sites</h1>
                </div>
                <span className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    ▼
                </span>
            </div>

            {isOpen && (
                <>
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
                                Sites disponibles
                            </span>
                            {isLoadingTrack && (
                                <div className="text-xs text-gray-500 mt-1">
                                    Chargement des sites TrackDéchets...
                                </div>
                            )}
                        </div>
                        <div className="overflow-y-auto p-2">
                            {sites.length > 0 ? (
                                sites.map((site: ContextSite): JSX.Element => (
                                    <div key={site.orgId}>
                                        <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md mb-0">
                                            <div className="flex items-center">
                                                <div className="flex items-center mr-2">
                                                    {site.isTrackDechets && (
                                                        <span className={`w-2 h-2 rounded-full mr-1 ${site.activated ? 'bg-[var(--green-medium)]' : 'bg-red-500'}`}></span>
                                                    )}
                                                    {site.isInDb && (
                                                        <span className="mr-1">
                                                            <box-icon name='data' size="16px" color="#666666"></box-icon>
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-sm text-gray-700 truncate">{site.name}</span>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={site.checked}
                                                onChange={() => toggleSite(site.orgId)}
                                                disabled={!site.activated}
                                                className="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out"
                                            />
                                        </div>
                                        {site.givenName && (
                                            <div className="text-xs text-gray-500 relative top-[-6px] ml-6">{site.givenName}</div>
                                        )}
                                        <div className="text-xs text-gray-500 relative top-[-5px] ml-8">{site.orgId}</div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-sm text-gray-500 p-2 text-center">
                                    {additionnalSites.length === 0 
                                        ? "Aucun site disponible" 
                                        : isLoadingTrack 
                                            ? "Sites BDD chargés, chargement TrackDéchets en cours..." 
                                            : "Sites chargés"
                                    }
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default FiltreSiteEtablissement;