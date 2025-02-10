'use client'

import { useEffect, useState, useRef } from 'react';
import { useFilterContext, FilterContextType, Site as ContextSite } from '../FilterContext';
import { useModalContextNew } from '../register/RegisterComponents/Modal/ContextModal';
import { useSession } from '../component/SessionProvider';
import { supabase } from '../database/supabaseClient';
import Cookies from 'js-cookie';
import BoxIcon from '@/app/component/BoxIconWrapper';

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

interface SiteGroup {
    name: string;
    sirets: string[];
    checked: boolean;
}

const FiltreSiteEtablissement = () => {
    const [etablissementsWithStatus, setEtablissementsWithStatus] = useState<Etablissement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const { sites, setSites, toggleSite } = useFilterContext();

    const {modalReload, setFilterPendingBSDs} = useModalContextNew();
    const session = useSession();
    const [additionnalSites, setAdditionnalSites] = useState<AdditionalSite[]>([]);
    const [isLoadingTrack, setIsLoadingTrack] = useState(false);
    const [siteGroups, setSiteGroups] = useState<SiteGroup[]>([]);
    const [mappingSite, setMappingSite] = useState<Record<string, string[]>>({});
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (session?.entreprise_id) {
            const getAdditionnalSites = async () => {
                const pageSize = 1000;
                let allData: {siret:string, name:string}[] = [];
                let hasMore = true;
                let currentPage = 0;

                while (hasMore) {
                    const { data, error, count } = await supabase
                        .from('bsd')
                        .select(`
                            infos_json->formAPI->createFormInput->emitter->company->>siret,
                            infos_json->formAPI->createFormInput->emitter->company->>name
                        `, { count: 'exact' })
                        .order('created_at', { ascending: false })
                        .eq('entreprise_id', session?.entreprise_id)
                        .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);

                    if (error) {
                        console.error('Erreur lors de la récupération des BSDs:', error);
                        break;
                    }

                    if (!data || data.length === 0) {
                        hasMore = false;
                        break;
                    }

                    allData = [...allData, ...data];
                    
                    // Vérifier s'il reste des données à charger
                    hasMore = count ? allData.length < count : false;
                    currentPage++;
                }

                console.log(`Nombre total de BSDs collectés pour les sites: ${allData.length}`);

                const siteMap = new Map();
                allData.forEach(item => {
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
        console.log("1. Début de l'effet de mise à jour des sites");
        
        // Charger les états sauvegardés d'abord
        const savedSites = localStorage.getItem(`sites-${session?.entreprise_id}`);
        console.log("2. États sauvegardés:", savedSites);
        const savedSiteStates = savedSites ? JSON.parse(savedSites) : {};
        console.log("3. États parsés:", savedSiteStates);

        // Fonction utilitaire pour obtenir l'état sauvegardé
        const getSavedState = (orgId: string) => {
            // En mode mobile, on veut que seul le premier site soit coché
            if (window.innerWidth <= 768) {
                return false; // On mettra le premier à true après
            }
            return savedSiteStates[orgId]?.checked ?? false;
        };

        const sites_from_db: ContextSite[] = additionnalSites.map(site => ({
            orgId: site.siret,
            name: site.name,
            givenName: '',
            checked: getSavedState(site.siret),
            activated: true,
            isTrackDechets: false,
            isInDb: true
        }));

        const sites_autre: ContextSite = {
            orgId: '----',
            name: 'Autres',
            givenName: '',
            checked: getSavedState('----'),
            activated: true,
            isTrackDechets: false,
            isInDb: false
        };

        if (etablissementsWithStatus.length > 0) {
            const vrai_sites: ContextSite[] = etablissementsWithStatus.map((etablissement: Etablissement) => ({
                orgId: etablissement.orgId,
                name: etablissement.name,
                givenName: etablissement.givenName,
                checked: getSavedState(etablissement.orgId),
                activated: etablissement.activated,
                isTrackDechets: true,
                isInDb: false
            }));

            // Log avant la fusion
            console.log("4. Sites avant fusion:", { vrai_sites, sites_from_db, savedSiteStates });

            // Fusionner en donnant priorité aux noms de la BDD
            const mergedSites = vrai_sites.map(trackSite => {
                const dbSite = sites_from_db.find(dbSite => dbSite.orgId === trackSite.orgId);
                if (dbSite) {
                    return {
                        ...trackSite,
                        name: dbSite.name,
                        isInDb: true,
                        // Conserver l'état checked du site fusionné
                        checked: savedSiteStates[trackSite.orgId]?.checked ?? trackSite.checked
                    };
                }
                return trackSite;
            });

            // Ajouter les sites qui sont uniquement dans la BDD
            const trackDechetsSirets = new Set(vrai_sites.map(site => site.orgId));
            const uniqueDbSites = sites_from_db.filter(site => !trackDechetsSirets.has(site.orgId))
                .map(site => ({
                    ...site,
                    // Utiliser l'état sauvegardé pour les sites uniquement dans la BDD
                    checked: savedSiteStates[site.orgId]?.checked ?? site.checked
                }));

            // Ajouter le site "Autres" avec son état sauvegardé
            const sitesAutre = {
                ...sites_autre,
                checked: savedSiteStates['----']?.checked ?? sites_autre.checked
            };

            const allSites = [...mergedSites, ...uniqueDbSites, sitesAutre];
            console.log("5. Sites finaux avant setSites:", allSites);

            // Après avoir créé tous les sites, s'assurer qu'en mobile le premier site est coché
            if (window.innerWidth <= 768) {
                // Trouver le premier site valide (pas "Autres" et activé)
                const firstValidSite = allSites.find(site => site.orgId !== '----' && site.activated);
                if (firstValidSite) {
                    firstValidSite.checked = true;
                    // Mettre tous les autres sites à false
                    allSites.forEach(site => {
                        if (site.orgId !== firstValidSite.orgId) {
                            site.checked = false;
                        }
                    });
                }
                setSites(allSites);
            } else {
                // Code existant pour desktop
                if (Object.keys(mappingSite).length > 0) {
                    // Créer les groupes selon le mapping
                    const groups = Object.entries(mappingSite).map(([groupName, sirets]) => ({
                        name: groupName,
                        sirets: sirets,
                        checked: allSites.some(site => sirets.includes(site.orgId) && site.checked)
                    }));

                    setSiteGroups(groups);

                    // Mettre à jour les sites avec leur groupe
                    const sitesWithGroups = allSites.map(site => ({
                        ...site,
                        group: Object.entries(mappingSite).find(([_, sirets]) => sirets.includes(site.orgId))?.[0]
                    }));

                    setSites(sitesWithGroups);
                    console.log("6. Sites avec groupes:", sitesWithGroups);
                } else {
                    setSites(allSites);
                }
            }
        } else {
            // Si pas de connexion TrackDechets, utiliser uniquement les sites de la BDD
            const sitesWithSavedStates = [...sites_from_db, sites_autre].map(site => ({
                ...site,
                checked: savedSiteStates[site.orgId]?.checked ?? site.checked
            }));
            setSites(sitesWithSavedStates);
        }
    }, [etablissementsWithStatus, additionnalSites, setSites, mappingSite, session?.entreprise_id]);

    // Ajout d'un useEffect pour récupérer le mapping_site
    useEffect(() => {
        const fetchMappingSite = async () => {
            if (session?.entreprise_id) {
                const { data, error } = await supabase
                    .from('entreprise')
                    .select('mapping_site')
                    .eq('id', session.entreprise_id)
                    .single();

                if (error) {
                    console.error('Erreur lors de la récupération du mapping_site:', error);
                    return;
                }

                if (data?.mapping_site) {
                    setMappingSite(data.mapping_site);
                }
            }
        };

        fetchMappingSite();
    }, [session?.entreprise_id]);

    // Fonction pour vérifier si tous les sites d'un groupe sont cochés
    const isGroupChecked = (groupName: string) => {
        const groupSirets = mappingSite[groupName] || [];
        return sites.filter(site => groupSirets.includes(site.orgId))
                   .every(site => site.checked);
    };

    // Simplifier handleSiteToggle car la persistance est gérée dans le contexte
    const handleSiteToggle = (siteId: string) => {
        toggleSite(siteId);
        setFilterPendingBSDs(false);
    };

    // Fonction pour gérer le clic sur la checkbox d'un groupe
    const handleGroupToggle = (groupName: string, event: React.MouseEvent | React.ChangeEvent) => {
        event.stopPropagation();
        const isCurrentlyChecked = isGroupChecked(groupName);
        const groupSirets = mappingSite[groupName] || [];
        
        if (window.innerWidth <= 768) {
            sites.forEach(site => {
                if (site.checked) {
                    handleSiteToggle(site.orgId);
                }
            });
            
            const firstSite = sites.find(s => groupSirets.includes(s.orgId));
            if (firstSite) {
                handleSiteToggle(firstSite.orgId);
            }
        } else {
            groupSirets.forEach(siret => {
                const site = sites.find(s => s.orgId === siret);
                if (site && site.checked !== !isCurrentlyChecked) {
                    handleSiteToggle(siret);
                }
            });
        }
        setFilterPendingBSDs(false);
    };

    // Fonction pour gérer l'expansion/réduction d'un groupe
    const toggleGroupExpansion = (groupName: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [groupName]: !prev[groupName]
        }));
    };

    // Organiser les sites par groupe
    const renderSites = () => {
        if (!mappingSite || Object.keys(mappingSite).length === 0) {
            return sites.map(site => renderSite(site));
        }

        const groupedContent = Object.entries(mappingSite).map(([groupName, groupSirets]) => {
            const sitesInGroup = sites.filter(site => groupSirets.includes(site.orgId));
            
            if (sitesInGroup.length === 0) return null;

            const isExpanded = expandedGroups[groupName];

            return (
                <div key={groupName} className="mb-4">
                    {/* En-tête du groupe avec flèche d'expansion */}
                    <div 
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-md cursor-pointer hover:bg-gray-100"
                        onClick={() => toggleGroupExpansion(groupName)}
                    >
                        <div className="flex items-center gap-2">
                            <span className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                                ▶
                            </span>
                            <span className="font-semibold text-sm">{groupName}</span>
                        </div>
                        <input
                            type="checkbox"
                            checked={isGroupChecked(groupName)}
                            onChange={(e) => handleGroupToggle(groupName, e)}
                            className="form-checkbox h-4 w-4 text-blue-600"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    {/* Sites du groupe (conditionnellement affichés) */}
                    {isExpanded && (
                        <div className="ml-4">
                            {sitesInGroup.map(site => renderSite(site))}
                        </div>
                    )}
                </div>
            );
        });

        // Récupérer les sites qui ne sont pas dans des groupes
        const ungroupedSites = sites.filter(site => 
            !Object.values(mappingSite).flat().includes(site.orgId)
        );

        return (
            <>
                {groupedContent}
                {ungroupedSites.map(site => renderSite(site))}
            </>
        );
    };

    // Mise à jour du renderSite pour utiliser handleSiteToggle
    const renderSite = (site: ContextSite) => (
        <div key={site.orgId}>
            <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md mb-0">
                <div className="flex items-center">
                    <div className="flex items-center mr-2">
                        {site.isTrackDechets && (
                            <span className={`w-2 h-2 rounded-full mr-1 ${site.activated ? 'bg-[var(--green-medium)]' : 'bg-red-500'}`}></span>
                        )}
                        {site.isInDb && (
                            <span className="mr-1">
                                <BoxIcon name='data' size="16px" color="#666666" />
                            </span>
                        )}
                    </div>
                    <span className="text-sm text-gray-700 truncate">{site.name}</span>
                </div>
                <input
                    type="checkbox"
                    name="site-selection"
                    checked={site.checked}
                    onChange={() => {
                        if (window.innerWidth <= 768) {
                            sites.forEach(s => {
                                if (s.orgId !== site.orgId && s.checked) {
                                    handleSiteToggle(s.orgId);
                                }
                            });
                            if (!site.checked) {
                                handleSiteToggle(site.orgId);
                            }
                        } else {
                            handleSiteToggle(site.orgId);
                        }
                        setFilterPendingBSDs(false);
                    }}
                    className="md:form-checkbox form-radio h-4 w-4 text-blue-600"
                />
            </div>
            {site.givenName && (
                <div className="text-xs text-gray-500 relative top-[-6px] ml-6">{site.givenName}</div>
            )}
            <div className="text-xs text-gray-500 relative top-[-5px] ml-8">{site.orgId}</div>
        </div>
    );

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
                    <BoxIcon name='map' type='solid' size="18px" />
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
                        className="absolute top-full left-0 w-80 mt-0 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
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
                            {renderSites()}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default FiltreSiteEtablissement;