'use client'

import { useEffect, useState, useRef } from 'react';
import { useFilterContext, FilterContextType, Site as ContextSite } from '../FilterContext';
import { useModalContextNew } from '../register/RegisterComponents/Modal/ContextModal';
import { useSession } from '../component/SessionProvider';
import { supabase } from '../database/supabaseClient';
import Cookies from 'js-cookie';
import BoxIcon from '@/app/component/BoxIconWrapper';
import { RowBSD } from '../register/interface/BSD_Interface';
import useSWR from 'swr';

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

interface EmitterInfo {
    company: {
        siret: string;
        name: string;
    } | null;
}

// Fonction fetcher pour SWR
const fetcherSites = async (entreprise_id: string) => {
    //console.log('Début du fetch pour entreprise_id:', entreprise_id);
    const pageSize = 1000;
    let allData: EmitterInfo[] = [];
    let hasMore = true;
    let page = 0;

    while (hasMore) {
        //console.log(`Chargement de la page ${page}`);
        const { data, error, count } = await supabase
            .from('bsd')
            .select('infos_json', { count: 'exact' })
            .eq('entreprise_id', entreprise_id)
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Erreur Supabase:', error);
            throw error;
        }
        
        if (data && data.length > 0) {
            //console.log(`${data.length} enregistrements trouvés dans la page ${page}`);
            const validData = data
                .filter(row => {
                    const company = row.infos_json?.formAPI?.createFormInput?.emitter?.company;
                    return company && typeof company === 'object' && 'siret' in company && 'name' in company;
                })
                .map(row => ({
                    company: {
                        siret: row.infos_json.formAPI.createFormInput.emitter.company.siret as string,
                        name: row.infos_json.formAPI.createFormInput.emitter.company.name as string
                    }
                }));
            
            //console.log(`Données valides trouvées: ${validData.length}`);
            allData = [...allData, ...validData];
            
            hasMore = count ? allData.length < count : false;
            page++;
        } else {
            //console.log('Aucune donnée trouvée ou fin des données');
            hasMore = false;
        }
    }

    //console.log(`Total des sites trouvés: ${allData.length}`);
    return allData;
};

const FiltreSiteEtablissement = () => {
    const [etablissementsWithStatus, setEtablissementsWithStatus] = useState<Etablissement[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const { sites, setSites, toggleSite } = useFilterContext();

    const {modalReload, setFilterPendingBSDs} = useModalContextNew();
    const {entreprise_id, user_id} = useSession();
    const [additionnalSites, setAdditionnalSites] = useState<AdditionalSite[]>([]);
    const [isLoadingTrack, setIsLoadingTrack] = useState(false);
    const [siteGroups, setSiteGroups] = useState<SiteGroup[]>([]);
    const [mappingSite, setMappingSite] = useState<Record<string, string[]>>({});
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [isFullDataLoaded, setIsFullDataLoaded] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // Utilisation de SWR pour récupérer les données des émetteurs
    const { data: emitterData, error: swrError, isLoading: isLoadingSWR } = useSWR(
        entreprise_id ? ['sites', entreprise_id] : null,
        () => fetcherSites(entreprise_id!),
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            refreshInterval: 0,
            dedupingInterval: 60000,
            focusThrottleInterval: 60000
        }
    );

    // Effet pour traiter les données des émetteurs avec logs de débogage
    useEffect(() => {
        //console.log('État du chargement:', {
        //    isLoadingSWR,
        //    isLoadingTrack,
        //    hasEmitterData: !!emitterData,
        //    emitterDataLength: emitterData?.length,
        //    additionalSitesLength: additionnalSites.length,
        //    etablissementsLength: etablissementsWithStatus.length
        //});

        if (emitterData) {
            // Créer un Map pour regrouper les sites par SIRET
            const siteMap = new Map();
            emitterData.forEach((emitter) => {
                if (!emitter.company?.siret || !emitter.company?.name) return;
                
                if (!siteMap.has(emitter.company.siret)) {
                    siteMap.set(emitter.company.siret, new Map());
                }
                
                const nameCount = siteMap.get(emitter.company.siret);
                nameCount.set(emitter.company.name, (nameCount.get(emitter.company.name) || 0) + 1);
            });

            // Convertir le Map en tableau de sites uniques avec le nom le plus fréquent
            const uniqueSites = Array.from(siteMap.entries()).map(([siret, nameCount]) => {
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

            //console.log('Sites uniques trouvés:', uniqueSites.length);
            setAdditionnalSites(uniqueSites);
            setIsInitialLoad(false);
        }
    }, [emitterData, isLoadingSWR]);

    //On va chercher les webhook du compte track en parallèle
    useEffect(() => {
        const fetchData = async () => {
            const trackDechetsToken = Cookies.get('trackdechets_token');
            
            if (!trackDechetsToken) {
                //console.log('Pas de token TrackDéchets - skip');
                setIsLoadingTrack(false);
                return;
            }

            try {
                setIsLoadingTrack(true);
                const response = await fetch('/api/demande_collecte/web_hook/get_all_web_hooks_informations');
                if (!response.ok) {
                    //console.log('Erreur réponse webhook');
                    return;
                }
                const data = await response.json();
                //console.log('Webhooks reçus:', data.data?.length || 0);
                setEtablissementsWithStatus(data.data || []);
            } catch (err) {
                //console.error('Erreur webhook:', err);
            } finally {
                setIsLoadingTrack(false);
            }
        }

        // Lancer le chargement immédiatement
        fetchData();
    }, []);

    // Effet pour mettre à jour les sites quand les données changent
    useEffect(() => {

        if (!entreprise_id) {
            //console.log('[Effect 3] Pas d\'entreprise_id, retour');
            return;
        }

        // Charger les états sauvegardés
        const savedSites = localStorage.getItem(`sites-${entreprise_id}`);
        const savedSiteStates = savedSites ? JSON.parse(savedSites) : {};

        const getSavedState = (orgId: string) => {
            if (window.innerWidth <= 768) {
                return false;
            }
            return savedSiteStates[orgId]?.checked ?? true;
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

            const mergedSites = vrai_sites.map(trackSite => {
                const dbSite = sites_from_db.find(dbSite => dbSite.orgId === trackSite.orgId);
                if (dbSite) {
                    return {
                        ...trackSite,
                        name: dbSite.name,
                        isInDb: true,
                        checked: savedSiteStates[trackSite.orgId]?.checked ?? trackSite.checked
                    };
                }
                return trackSite;
            });

            const trackDechetsSirets = new Set(vrai_sites.map(site => site.orgId));
            const uniqueDbSites = sites_from_db.filter(site => !trackDechetsSirets.has(site.orgId))
                .map(site => ({
                    ...site,
                    checked: savedSiteStates[site.orgId]?.checked ?? site.checked
                }));

            const sitesAutre = {
                ...sites_autre,
                checked: savedSiteStates['----']?.checked ?? sites_autre.checked
            };

            let allSites = [...mergedSites, ...uniqueDbSites, sitesAutre];

            if (window.innerWidth <= 768) {
                const firstValidSite = allSites.find(site => site.orgId !== '----' && site.activated);
                if (firstValidSite) {
                    allSites = allSites.map(site => ({
                        ...site,
                        checked: site.orgId === firstValidSite.orgId
                    }));
                }
            }

            if (Object.keys(mappingSite).length > 0) {
                
                const groups = Object.entries(mappingSite).map(([groupName, sirets]) => ({
                    name: groupName,
                    sirets: sirets,
                    checked: allSites.some(site => sirets.includes(site.orgId) && site.checked)
                }));

                setSiteGroups(groups);

                const sitesWithGroups = allSites.map(site => ({
                    ...site,
                    group: Object.entries(mappingSite).find(([_, sirets]) => sirets.includes(site.orgId))?.[0]
                }));

                
                setSites(sitesWithGroups);
            } else {
                
                setSites(allSites);
            }
        } else {
            
            let sitesWithSavedStates = [...sites_from_db, sites_autre].map(site => ({
                ...site,
                checked: savedSiteStates[site.orgId]?.checked ?? site.checked
            }));

            if (window.innerWidth <= 768) {
                const firstValidSite = sitesWithSavedStates.find(site => site.orgId !== '----' && site.activated);
                if (firstValidSite) {
                    sitesWithSavedStates = sitesWithSavedStates.map(site => ({
                        ...site,
                        checked: site.orgId === firstValidSite.orgId
                    }));
                }
            }

            setSites(sitesWithSavedStates);
        }
    }, [etablissementsWithStatus, additionnalSites, mappingSite, entreprise_id]);

    // Effet pour récupérer le mapping_site
    useEffect(() => {
        
        const fetchMappingSite = async () => {
            if (!entreprise_id) {
                //console.log('[Effect 4] Pas d\'entreprise_id, retour');
                return;
            }
            
            try {
                const { data, error } = await supabase
                    .from('entreprise')
                    .select('mapping_site')
                    .eq('id', entreprise_id)
                    .single();

                if (error) {
                    //console.error('[Effect 4] Erreur mapping_site:', error);
                    return;
                }

                if (data?.mapping_site) {
                    
                    setMappingSite(data.mapping_site);
                }
            } catch (error) {
                //console.error('[Effect 4] Erreur mapping_site:', error);
            }
        };

        fetchMappingSite();
    }, [entreprise_id]);

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

    // Mise à jour de la condition de rendu pour le chargement
    if ((isLoadingSWR || isLoadingTrack) && additionnalSites.length === 0) {
        //console.log('Affichage du chargement - États:', { isLoadingSWR, isLoadingTrack });
        return <div className="text-sm text-gray-500 ml-2">Chargement des sites...</div>;
    }
    
    if (swrError) {
        //console.error('Erreur SWR:', swrError);
        return <div className="text-sm text-gray-500 ml-2">Erreur lors du chargement des sites</div>;
    }

    // Ne pas afficher "Aucun site disponible" pendant le chargement
    if (!isLoadingSWR && !isLoadingTrack && additionnalSites.length === 0 && etablissementsWithStatus.length === 0) {
        //console.log('Aucun site disponible après chargement complet');
        return <div className="text-sm text-gray-500 ml-2">Aucun site disponible</div>;
    }

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
                    <div className="flex items-center gap-2">
                        {window.innerWidth <= 768 ? (
                            <span className="text-sm text-gray-700">
                                Site : <span className="text-gray-500">{sites.find(site => site.checked)?.name || ''}</span>
                            </span>
                        ) : (
                            <h1 className="text-sm font-semibold text-gray-700">Sites</h1>
                        )}
                    </div>
                    {!isFullDataLoaded && !isInitialLoad && (
                        <span className="text-xs text-blue-600 flex items-center hidden">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </span>
                    )}
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