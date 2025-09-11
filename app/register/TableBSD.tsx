import { useEffect, useState, useRef } from "react";
import { supabase } from "../database/supabaseClient";
import { useSession } from "../component/SessionProvider";
import { useModalContextNew } from "./RegisterComponents/Modal/ContextModal";
import toast from "react-hot-toast";
import { useFilterContext } from "../FilterContext";
import { Company, FormInput, OtherInfos } from "./interface/BSD_Interface";
import Swal from 'sweetalert2';
import SendDraftModal from "./RegisterComponents/Modal/SendDraftModal";
import { getMappingTableFiliere, getFiliere } from "./RegisterComponents/Modal/FormulaireFull/utils_new";
//import 'boxicons'
import { RecurrenceEntry } from "./RegisterComponents/Modal/Recurrence/RecurrenceFunctionnal";
import BoxIcon from "../component/BoxIconWrapper";
import { FactureJSON } from "../import_page/FactureImport/ButtonImportFacture";
import { useFiltresPerso } from "../component/FiltresPerso/FiltresPersoProvider";
// import NewFormulaireDemande from "./DemandeCollecteNew/NewFormulaireDemande";
import { filterBSDs } from "./FiltreFunctionnal";
import { CommonBSD } from "./FiltreFunctionnal";
import ValidateCollecte from "./DemandeCollecteNew/ValidateCollecte";
import { handleCancelCollecte } from "./DemandeCollecteNew/DemandeFonctions";
import { useBSDs } from './BSDsProvider';
// import { handleDeleteLinkBon_PDF } from './RegisterComponents/Modal/DisplayModifyOnTable/deleteLinkBon_PDF';
import { handleDeleteLinkMetaDoc } from '@/app/import_page/ImportComponents/ExtractMetaDoc/utils/link_or_create_bdd';


const cleanCED = (ced: string): string => {
    const ced_clean = ced.replace(/[^\d]/g,'');
    //return String(parseInt(ced_clean)); => attention, ne fonctionne pas pour les CEDs avec des 0 à gauche
    return ced_clean;
}

// Utiliser l'interface commune
export type BSD = CommonBSD & {
    pdf_ids?: string[];
};

const normalizeString = (str: string): string => {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
};

const getWasteIcon = (filiere: string): { name: string, type?: 'solid' | 'regular' | 'logo' } => {
    const filiereNormalized = normalizeString(filiere);
    
    const iconMapping: { keywords: string[], icon: { name: string, type?: 'solid' | 'regular' | 'logo' } }[] = [
        {
            keywords: ['bois', 'palette', 'palettes', 'meuble'],
            icon: { name: 'tree' }
        },
        {
            keywords: ['metal', 'metaux', 'ferraille', 'fer', 'acier', 'aluminium', 'cuivre'],
            icon: { name: 'wrench' }
        },
        {
            keywords: ['gravat', 'gravats', 'beton', 'pierre', 'construction', 'demolition', 'btp'],
            icon: { name: 'building-house' }
        },
        {
            keywords: ['dib', 'dechetindustriel', 'industriel', 'melange'],
            icon: { name: 'trash' }
        },
        {
            keywords: ['carton', 'papier', 'emballage'],
            icon: { name: 'package' }
        },
        {
            keywords: ['plastique', 'pvc', 'pet', 'polyethylene', 'polystyrene'],
            icon: { name: 'recycle' }
        },
        {
            keywords: ['deee', 'electronique', 'electrique', 'informatique', 'ordinateur'],
            icon: { name: 'microchip' }
        },
        {
            keywords: ['dangereux', 'toxique', 'chimique', 'corrosif', 'inflammable'],
            icon: { name: 'error' }
        },
        {
            keywords: ['vegetal', 'vert', 'organique', 'plante', 'herbe', 'feuille',  'biodechets'],
            icon: { name: 'leaf' }
        },
    ];

    for (const mapping of iconMapping) {
        if (mapping.keywords.some(keyword => 
            normalizeString(filiereNormalized).includes(normalizeString(keyword))
        )) {
            return mapping.icon;
        }
    }

    return { name: 'trash-alt' }; // Icône par défaut question-mark
};

const getSommeBSD = (facture_infos: FactureJSON) => {
    return facture_infos.footer.total_ht;
}

//Renvoie les CEDs cleaned des filières sélectionnées dans la table de mapping (en filtrant "Autres")
const getCEDsFromFilieres = async (entreprise_id: string | null, checkedFilieres: string[]) => {
    const { data, error } = await supabase
        .from('entreprise')
        .select('mapping_ced_filiere')
        .eq('id', entreprise_id)
        .single();

    if (data) {
        const mapping_table = data.mapping_ced_filiere;
        const ced_uniques: string[] = [];
        
        // Si seul "Autres" est sélectionné, retourner un tableau vide
        // car on gérera ce cas spécial différemment
        if (checkedFilieres.length === 1 && checkedFilieres[0] === 'Autres') {
            return [];
        }

        // Filtrer "Autres" de checkedFilieres pour le traitement normal
        const checkedFilieres_sans_autres = checkedFilieres.filter(filiere => filiere !== 'Autres');
        
        for (const mapping of mapping_table) {
            for (const filiere of checkedFilieres_sans_autres) {
                if (mapping.filiere === filiere) {
                    ced_uniques.push(cleanCED(mapping.ced));
                }
            }
        }

        return ced_uniques;
    }
    return [];
}

const DateToDisplay = ({ status, created_at, takenOverAt }: { status: string, created_at: string, takenOverAt: string }) => {
    if (status === "Ligne demandée") {
        if(takenOverAt !== "") {
            return <div><p><span className="md:inline hidden">Attendu le </span>{new Date(takenOverAt as string).toLocaleDateString('fr-FR')}</p></div>;
        } else {
            return <div><p><span className="md:inline hidden">Crée le </span>{new Date(created_at as string).toLocaleDateString('fr-FR')}</p></div>;
        }
    } else {
        if(takenOverAt !== "") {
            return <div><p><span className="md:inline hidden">Collecté le </span>{new Date(takenOverAt as string).toLocaleDateString('fr-FR')}</p></div>
        } else {
            return <div><p><span className="md:inline hidden">Créé le </span>{new Date(created_at as string).toLocaleDateString('fr-FR')}</p></div>
        }
    }
}

const TableBSD = () => {
    const {entreprise_id, user_id} = useSession();
    
    //const { modalReload, setModalReload, modalId, setModalId, modalType, setModalType } = useModal();
    //A faire passer sur useModalContextNew
    const { modalReload, setModalReload, modalId, setModalId, modalType, setModalType, filterPendingBSDs, setFilterPendingBSDs } = useModalContextNew();
    const { sites, filieres, points_collecte, segmentDates, siteFilterMode, selectedSiteId, filieres_ou_prestataires, serverDateSearch } = useFilterContext();
    const { allBSDs, setAllBSDs, allFilteredBSDs, setAllFilteredBSDs, displayedBSDs, setDisplayedBSDs } = useBSDs();

    const [webhooksInitialized, setWebhooksInitialized] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showSendDraftModal, setShowSendDraftModal] = useState(false);
    const [selectedBsd, setSelectedBsd] = useState<BSD | null>(null);
    const [loadingBSDs, setLoadingBSDs] = useState(true);
    const [mappingTable, setMappingTable] = useState<{ ced: string, filiere: string }[]>([]);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const itemsPerPage = 50;
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [hoveredMenuId, setHoveredMenuId] = useState<string | null>(null);
    const [weightInputs, setWeightInputs] = useState<Record<string, number>>({});
    const { filterFunctions } = useFiltresPerso();
    
    const [showValidateModal, setShowValidateModal] = useState(false);
    const [selectedBsdForValidation, setSelectedBsdForValidation] = useState<BSD | null>(null);

    const prevModalReload = useRef(modalReload);

    const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
    const [isLoadingFullData, setIsLoadingFullData] = useState(false);
    const [filtersEnabled, setFiltersEnabled] = useState(false);
    const [isPartialData, setIsPartialData] = useState(false);
    const [lastLoadedDate, setLastLoadedDate] = useState<string | null>(null);
    const [lastLoadedId, setLastLoadedId] = useState<string | null>(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [totalBSDsCount, setTotalBSDsCount] = useState(0);
    const [displayLimit, setDisplayLimit] = useState(50);

    // Charger la table de mapping en fonction du mode (CED vs NOM)
    useEffect(() => {
        const loadMappingTable = async () => {
            if (!entreprise_id) return;
            if (filieres_ou_prestataires?.nom === 'filiere_nom') {
                try {
                    const res = await fetch(`/api/get_mapping_nom_filiere?entreprise_id=${entreprise_id}`);
                    const json = await res.json();
                    setMappingTable(json.data || []);
                } catch (e) {
                    console.error('Erreur chargement mapping nom filiere', e);
                    setMappingTable([]);
                }
            } else {
                const mapping = await getMappingTableFiliere(entreprise_id);
                setMappingTable(mapping || []);
            }
        };
        loadMappingTable();
    }, [entreprise_id, filieres_ou_prestataires?.nom]);



    // Fonction pour vérifier et initialiser les webhooks
    const initializeWebhooks = async () => {
        try {
            const response_token_cookies = await fetch('/api/auth_track_dechet/token');
            const token_cookies_data = await response_token_cookies.json();
            const token_cookies = token_cookies_data.data;
            const url_with_token = `/api/demande_collecte/web_hook/get_webhooks?token_cookies=${token_cookies}`;
            
            // Vérifier si les webhooks existent
            const response = await fetch(url_with_token);
            const data = await response.json();
            
            //console.log('data_web_hooks', data);
            //console.log('condition 1', !data.webhooks);
            //console.log('condition 3', data.webhooks.activated === false);
            if (data.webhooks && data.webhooks.activated === false) {
                //Activation du webhook
                console.log('Activation du webhook');
                await fetch('/api/demande_collecte/web_hook/activate_a_web_hook', {
                    method: 'POST',
                    body: JSON.stringify({
                        webhook: data.webhooks
                    })
                });
            }

            if (!data.webhooks) {
                // Créer le webhook si aucun n'existe
                console.log('Création du webhook en client side');
                await fetch('/api/demande_collecte/web_hook/create_a_web_hook', {
                    method: 'POST',
                    body: JSON.stringify({
                        url: '/api/demande_collecte/web_hook/receive_web_hook',
                        //id_company: data.webhooks.orgId
                    })
                });
            }
            setWebhooksInitialized(true);
        } catch (error) {
            console.error("Error initializing webhooks:", error);
        }
    };

    const invalidateCache = async () => {
        if (!entreprise_id || !user_id) return;
        
        try {
            const response = await fetch('/api/invalidate_bsd_cache', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    entreprise_id,
                    user_id,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to invalidate cache');
            }

            console.log('Cache invalidated successfully');
        } catch (error) {
            console.error('Error invalidating cache:', error);
        }
    };

    // Fonction pour charger toutes les données en arrière-plan
    const fetchFullData = async () => {
        if (!entreprise_id) return;
        
        try {
            const response = await fetch(`/api/get_data_bsd?entreprise_id=${entreprise_id}`);
            const result = await response.json();
            
            setIsPartialData(false);
            
            if (result.totalCount) {
                setTotalBSDsCount(result.totalCount);
            }
            
            const sortedData = result.data.sort((a: BSD, b: BSD) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            setAllBSDs(sortedData);
            setFiltersEnabled(true);
            
        } catch (error) {
            console.error('Error fetching full BSDs:', error);
        } finally {
            setIsLoadingFullData(false);
        }
    };

    const fetchBSDs = async (loadMore: boolean = false) => {
        if (!entreprise_id || !user_id) return;
        
        try {
            if (!isLoadingMore) {
                setLoadingBSDs(true);
            }
            
            const shouldFastLoad = (isLoadingInitialData && !isLoadingFullData) && !serverDateSearch;
            const forceReload = prevModalReload.current !== modalReload;
            
            if (forceReload) {
                await invalidateCache();
            }
            
            const siteParam = siteFilterMode === 'per_site' && selectedSiteId ? `&site=${encodeURIComponent(selectedSiteId)}` : '';
            const dateParam = (serverDateSearch && segmentDates?.debut && segmentDates?.fin) 
                ? `&startDate=${encodeURIComponent(segmentDates.debut.toISOString())}&endDate=${encodeURIComponent(segmentDates.fin.toISOString())}`
                : '';
            const url = `/api/get_data_bsd?entreprise_id=${entreprise_id}&user_id=${user_id}${shouldFastLoad ? '&fastLoad=true' : ''}${loadMore && lastLoadedDate && lastLoadedId ? `&lastDate=${encodeURIComponent(lastLoadedDate)}&lastId=${encodeURIComponent(lastLoadedId)}` : ''}${siteParam}${dateParam}`;
            //console.log('Fetching BSDs from:', url);
            const response = await fetch(url);
            const result = await response.json();
            
            //console.log('Received BSDs response:', {
            //    count: result.data.length,
            //    hasMore: result.hasMore,
            //    totalCount: result.totalCount,
            //    fullResponse: result
            //});
            
            setIsPartialData(result.isPartialData);
            const newHasMore = result.hasMore === undefined ? true : result.hasMore;
            //console.log('Setting hasMore to:', newHasMore);
            setHasMore(newHasMore);
            
            if (result.totalCount) {
                setTotalBSDsCount(result.totalCount);
            }
            
            if (shouldFastLoad) {
                const sortedData = result.data.sort((a: BSD, b: BSD) => 
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );
                setAllBSDs(sortedData);
                console.log("sortedData", sortedData);
                setIsLoadingInitialData(false);
                
                setTimeout(() => {
                    setIsLoadingFullData(true);
                    fetchFullData();
                }, 100);
                
                return;
            }

            // Si recherche côté serveur, on désactive le mode partiel et on ne lance pas le chargement complet
            if (serverDateSearch) {
                setIsPartialData(false);
                setIsLoadingInitialData(false);
            }
            
            if (loadMore) {
                const newData = [...allBSDs, ...result.data];
                // Dédupliquer les BSDs en utilisant l'ID comme clé unique
                const uniqueBSDs = Array.from(new Map(newData.map(bsd => [bsd.id, bsd])).values());
                const sortedData = uniqueBSDs.sort((a: BSD, b: BSD) => 
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );
                setAllBSDs(sortedData);
            } else {
                const sortedData = result.data.sort((a: BSD, b: BSD) => 
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );
                setAllBSDs(sortedData);
            }
            
            if (result.data.length > 0) {
                const last = result.data[result.data.length - 1];
                setLastLoadedDate(last.created_at);
                setLastLoadedId(last.id);
            }
            
        } catch (error) {
            console.error('Error fetching BSDs:', error);
        } finally {
            setLoadingBSDs(false);
            setIsLoadingMore(false);
        }
    };

    // Déclencher un fetch quand on demande une recherche côté serveur ou quand on revient au mode client
    useEffect(() => {
        if (!entreprise_id || !user_id) return;
        
        // Reset pagination
        setLastLoadedDate(null);
        setLastLoadedId(null);
        setIsLoadingInitialData(false);
        
        fetchBSDs(false).finally(() => {
            // Laisser le flag actif jusqu'à ce que l'utilisateur change à nouveau
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverDateSearch, segmentDates?.debut, segmentDates?.fin, siteFilterMode, selectedSiteId]);

    const applyFilters = () => {
        //console.log("=== Début applyFilters ===");
        //console.log("Nombre de BSDs avant filtrage:", allBSDs?.length);
        
        if (allBSDs?.length > 0) {
            const filteredData = filterBSDs(
                allBSDs,
                filieres,
                sites,
                points_collecte,
                segmentDates,
                mappingTable,
                filterFunctions,
                filterPendingBSDs,
                filieres_ou_prestataires?.nom === 'filiere_nom' ? 'nom' : 'ced',
                siteFilterMode === 'per_site'
            );
            
            //console.log("Nombre de BSDs après filtrage (filteredData):", filteredData.length);
            setAllFilteredBSDs(filteredData);
            //setDisplayLimit(50);
            const newDisplayedBSDs = filteredData.slice(0, displayLimit);
            //console.log("Nombre de BSDs à afficher (newDisplayedBSDs):", newDisplayedBSDs.length);
            setDisplayedBSDs(newDisplayedBSDs);
        }
        //console.log("=== Fin applyFilters ===");
    };

    // Effet pour les changements de filtres
    useEffect(() => {
        //console.log("=== Début useEffect filtres ===");
        const hasActiveFilters = 
            filieres.length > 0 || 
            sites.length > 0 || 
            points_collecte.length > 0 || 
            (segmentDates && segmentDates.debut !== null) || 
            (segmentDates && segmentDates.fin !== null) ||
            filterPendingBSDs ||
            (filterFunctions && Object.keys(filterFunctions).length > 0);
        
        //console.log("Filtres actifs:", hasActiveFilters);
        setFiltersEnabled(hasActiveFilters);
        applyFilters();
        //console.log("=== Fin useEffect filtres ===");
    }, [
        filieres,
        sites,
        points_collecte,
        segmentDates,
        filterPendingBSDs,
        filterFunctions,
        allBSDs,
        siteFilterMode,
        selectedSiteId,
        mappingTable
    ]);

    // Effet pour charger les données initiales
    useEffect(() => {
        if (entreprise_id) {
            setIsLoadingInitialData(true);
            setIsLoadingFullData(false);
            fetchBSDs();
        }
    }, [entreprise_id, siteFilterMode, selectedSiteId]);

    // Effet pour charger plus de données quand nécessaire
    useEffect(() => {
        const shouldLoadMore = displayedBSDs.length < 25 && !isLoadingMore && !loadingBSDs && hasMore && !filterPendingBSDs;
        
        if (shouldLoadMore) {
            //console.log('Chargement de plus de données...', {
            //    displayedCount: displayedBSDs.length,
            //    hasMore,
            //    isLoadingMore,
            //    loadingBSDs,
            //    lastLoadedId,
            //    totalCount: totalBSDsCount,
            //    allBSDsCount: allBSDs.length
            //});
            setIsLoadingMore(true);
            fetchBSDs(true);
        } else if (!hasMore) {
            //console.log('Arrêt du chargement progressif - Plus de données à charger', {
            //    displayedCount: displayedBSDs.length,
            //    totalCount: totalBSDsCount
            //});
        }
    }, [displayedBSDs.length, hasMore, isLoadingMore, loadingBSDs, lastLoadedDate, lastLoadedId, totalBSDsCount, allBSDs]);

    useEffect(() => {
        // Exécution immédiate
        if (!webhooksInitialized) {
            initializeWebhooks();
        }
    
        // Exécution périodique
        const interval = setInterval(() => {
            if (!webhooksInitialized) {
                initializeWebhooks();
            }
        }, 10000); // 10 secondes
    
        return () => clearInterval(interval);
    }, [webhooksInitialized, modalReload]);
    


    const handleDelete = async (id: string, on_track_dechets: boolean, silent: boolean = false) => {
        if (!silent) {
            const result = await Swal.fire({
                title: 'Êtes-vous sûr ?',
                text: "Cette action est irréversible !",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Oui, supprimer',
                cancelButtonText: 'Annuler'
            });
            if (!result.isConfirmed) return;
        }

        setDeletingId(id);
        try {
            if(on_track_dechets){
                const result = await fetch('/api/demande_collecte/delete_bsd', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: id })
                });
                const data = await result.json();
                if (data.error) {
                    if (!silent) {
                        Swal.fire('Erreur !', data.error, 'error');
                    }
                } else {
                    if (!silent) {
                        toast.success("BSD supprimé avec succès");
                    }
                    
                    // Mettre à jour l'état local
                    setAllBSDs(prev => prev.filter(bsd => bsd.id !== id));
                    setAllFilteredBSDs(prev => prev.filter(bsd => bsd.id !== id));
                    setDisplayedBSDs(prev => prev.filter(bsd => bsd.id !== id));
                    
                    await invalidateCache();
                    //setModalReload(prev => !prev);
                }
            } else {
                // Récupérer d'abord les informations du BSD pour avoir l'URL de la photo et vérifier s'il est lié à un Meta Doc, bon PDF ou BSD PDF
                const { data: bsd, error: bsdError } = await supabase
                    .from('bsd')
                    .select('photo, bon_extracted_then_linked_id, bsd_extracted_then_linked_id, pdf_ids, index_dechet_pdf')
                    .eq('id', id)
                    .single();

                // Supprimer la photo si elle existe
                if (bsd?.photo) {
                    // Extract filename from full URL
                    const photoFileName = bsd.photo.split('/').pop();
                    if (photoFileName) {
                        const { error: storageError } = await supabase.storage
                            .from('photos')
                            .remove([photoFileName]);
                        
                        if (storageError) {
                            console.error('Erreur lors de la suppression de la photo:', storageError);
                        }
                    }
                }

                // Si le BSD est lié à un Meta Doc (pdf_infos + index_dechet_pdf), supprimer proprement le lien
                if (bsd?.pdf_ids && bsd?.pdf_ids.length > 0 && (bsd.index_dechet_pdf!== null && bsd.index_dechet_pdf>=0)) {
                    for (const pdfId of bsd.pdf_ids) {
                        try {
                            await handleDeleteLinkMetaDoc(pdfId, id, bsd.index_dechet_pdf as number, entreprise_id);
                        } catch (e) {
                            console.warn('Erreur lors de la suppression du lien Meta Doc-BSD:', e);
                        }
                    }
                }

                // Si le BSD est lié à un bon PDF, supprimer les liens associés
                if (bsd?.bon_extracted_then_linked_id && bsd?.pdf_ids && bsd.pdf_ids.length > 0) {
                    console.log('BSD lié à un bon PDF, suppression des liens...');
                    
                    // Pour chaque pdf_id associé au BSD, supprimer le lien dans bon_pdf
                    for (const pdfId of bsd.pdf_ids) {
                        try {
                            // Récupérer l'ID du bon_pdf
                            const { data: bonPdfData, error: bonPdfError } = await supabase
                                .from('bon_pdf')
                                .select('id')
                                .eq('pdf_id', pdfId)
                                .eq('entreprise_id', entreprise_id)
                                .single();

                            if (bonPdfError) {
                                console.warn(`Erreur lors de la récupération du bon_pdf pour pdf_id ${pdfId}:`, bonPdfError);
                                continue;
                            }

                            if (bonPdfData) {
                                // Supprimer le linked_bsd_id du bon_pdf
                                const { error: updateBonPdfError } = await supabase
                                    .from('bon_pdf')
                                    .update({
                                        linked_bsd_id: null
                                    })
                                    .eq('id', bonPdfData.id)
                                    .eq('entreprise_id', entreprise_id);

                                if (updateBonPdfError) {
                                    console.warn(`Erreur lors de la mise à jour du bon_pdf pour pdf_id ${pdfId}:`, updateBonPdfError);
                                }

                                // Mettre à jour le statut dans pdf_infos à 'read'
                                const { error: updatePdfInfosError } = await supabase
                                    .from('pdf_infos')
                                    .update({ 
                                        status: 'read'
                                    })
                                    .eq('id', pdfId)
                                    .eq('entreprise_id', entreprise_id);

                                if (updatePdfInfosError) {
                                    console.warn(`Erreur lors de la mise à jour du statut pdf_infos pour pdf_id ${pdfId}:`, updatePdfInfosError);
                                }
                            }
                        } catch (error) {
                            console.warn(`Erreur lors de la suppression du lien pour pdf_id ${pdfId}:`, error);
                        }
                    }
                }

                // Si le BSD est lié à un BSD PDF, supprimer les liens associés
                if (bsd?.bsd_extracted_then_linked_id && bsd?.pdf_ids && bsd.pdf_ids.length > 0) {
                    console.log('BSD lié à un BSD PDF, suppression des liens...');
                    
                    // Pour chaque pdf_id associé au BSD, supprimer le lien dans bsd_pdf
                    for (const pdfId of bsd.pdf_ids) {
                        try {
                            // Récupérer l'ID du bsd_pdf
                            const { data: bsdPdfData, error: bsdPdfError } = await supabase
                                .from('bsd_pdf')
                                .select('id')
                                .eq('pdf_id', pdfId)
                                .eq('entreprise_id', entreprise_id)
                                .single();

                            if (bsdPdfError) {
                                console.warn(`Erreur lors de la récupération du bsd_pdf pour pdf_id ${pdfId}:`, bsdPdfError);
                                continue;
                            }

                            if (bsdPdfData) {
                                // Supprimer le linked_bsd_id du bsd_pdf
                                const { error: updateBsdPdfError } = await supabase
                                    .from('bsd_pdf')
                                    .update({
                                        linked_bsd_id: null
                                    })
                                    .eq('id', bsdPdfData.id)
                                    .eq('entreprise_id', entreprise_id);

                                if (updateBsdPdfError) {
                                    console.warn(`Erreur lors de la mise à jour du bsd_pdf pour pdf_id ${pdfId}:`, updateBsdPdfError);
                                }

                                // Mettre à jour le statut dans pdf_infos à 'read'
                                const { error: updatePdfInfosError } = await supabase
                                    .from('pdf_infos')
                                    .update({ 
                                        status: 'read'
                                    })
                                    .eq('id', pdfId)
                                    .eq('entreprise_id', entreprise_id);

                                if (updatePdfInfosError) {
                                    console.warn(`Erreur lors de la mise à jour du statut pdf_infos pour pdf_id ${pdfId}:`, updatePdfInfosError);
                                }
                            }
                        } catch (error) {
                            console.warn(`Erreur lors de la suppression du lien pour pdf_id ${pdfId}:`, error);
                        }
                    }
                }

                // Supprimer le BSD
                const result = await supabase
                    .from('bsd')
                    .delete()
                    .eq('id', id);

                if(result.error){
                    toast.error("Erreur lors de la suppression du BSD");
                } else {
                    toast.success("BSD supprimé avec succès");
                    setAllBSDs(prev => prev.filter(bsd => bsd.id !== id));
                    setAllFilteredBSDs(prev => prev.filter(bsd => bsd.id !== id));
                    setDisplayedBSDs(prev => prev.filter(bsd => bsd.id !== id));
                    await invalidateCache();
                    //setModalReload(prev => !prev);
                }
            }
        } finally {
            setDeletingId(null);
        }
    }

    const handleDisplay = (id: string) => {
        setModalId(id); //=bsd.id clef primaire de la table bsd
        setModalType("display");
    }

    const handleModify = (id: string) => {
        setModalId(id); //=bsd.id clef primaire de la table bsd
        setModalType("modify");
    }

    const handleSeal = async (id: string) => {
        const checkedBSD = checkBSDBeforeSeal(displayedBSDs.find(bsd => bsd.id === id));
        if(checkedBSD){
            const result = await Swal.fire({
                title: 'Attention !',
                text: "Une fois le BSD scellé, vous ne pourrez plus le modifier. Voulez-vous continuer ?",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Oui, sceller',
                cancelButtonText: 'Annuler'
            });
    
            if (result.isConfirmed) {
                const apiResult = await fetch('/api/demande_collecte/seal_bsd', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: id })
                });
                const data = await apiResult.json();
                if (data.error) {
                    Swal.fire('Erreur !', data.error, 'error');
                    //toast.error('Erreur : ' + data.error);
                } else {
                    //Swal.fire('Scellé !', 'Le BSD a été scellé avec succès.', 'success');
                    toast.success("BSD scellé avec succès");
                    await invalidateCache();
                    //setModalReload(!modalReload);
                    setAllBSDs(prev => prev.map(bsd => bsd.id === id ? {...bsd, status: 'SEALED'} : bsd));
                    setAllFilteredBSDs(prev => prev.map(bsd => bsd.id === id ? {...bsd, status: 'SEALED'} : bsd));
                    setDisplayedBSDs(prev => prev.map(bsd => bsd.id === id ? {...bsd, status: 'SEALED'} : bsd));
                }
            }
        }
    }

    const handleSign = async (id: string) => {
        const result = await fetch('/api/demande_collecte/sign_bsd', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        });
        const data = await result.json();
        if (data.success === false) {
            toast.error(data.error);
        } else {
            toast.success("BSD signé avec succès");
            await invalidateCache();
            //setModalReload(!modalReload);
            setAllBSDs(prev => prev.map(bsd => bsd.id === id ? {...bsd, status: 'SIGNED_BY_PRODUCER'} : bsd));
            setAllFilteredBSDs(prev => prev.map(bsd => bsd.id === id ? {...bsd, status: 'SIGNED_BY_PRODUCER'} : bsd));
            setDisplayedBSDs(prev => prev.map(bsd => bsd.id === id ? {...bsd, status: 'SIGNED_BY_PRODUCER'} : bsd));
        }
    }

    const handleSendDraft = (bsd: BSD) => {
        setSelectedBsd(bsd);
        setShowSendDraftModal(true);
    };

    const handleChangeNonDangerous = async (bsd: BSD, value: string) => {
        const { data, error } = await supabase
            .from('bsd')
            .update({ status_track_dechets: value })
            .eq('id', bsd.id)
            .select()
            .single();
        
        if (!error && data) {
            setAllBSDs(prevBsds => prevBsds.map(prevBsd => 
                prevBsd.id === bsd.id 
                    ? { ...prevBsd, status_track_dechets: value }
                    : prevBsd
            ));
            setAllFilteredBSDs(prev => prev.map(prevbsd => prevbsd.id === bsd.id ? {...prevbsd, status_track_dechets: value} : prevbsd));
            setDisplayedBSDs(prev => prev.map(prevbsd => prevbsd.id === bsd.id ? {...prevbsd, status_track_dechets: value} : prevbsd));
            await invalidateCache();
        }
    };

    const handleValidateLine = async (bsd: BSD) => {
        const {data: bsdFromSupabase, error: bsdError} = await supabase.from('bsd').select('*').eq('id', bsd.id).single();
        if(bsdError){
            toast.error("Erreur lors de la récupération du BSD");
            return;
        }
        const updatedFormInput = {
            ...bsdFromSupabase.infos_json.formAPI.createFormInput,
            wasteDetails: {
                ...bsdFromSupabase.infos_json.formAPI.createFormInput.wasteDetails,
                quantity: weightInputs[bsd.id] || 0
            }
        };

        const { data, error } = await supabase
            .from('bsd')
            .update({ 
                status_track_dechets: 'Collecté',
                infos_json: {
                    ...bsdFromSupabase.infos_json,
                    formAPI: {
                        ...bsdFromSupabase.infos_json.formAPI,
                        createFormInput: updatedFormInput
                    }
                }
            })
            .eq('id', bsd.id)
            .select()
            .single();

        if (!error && data) {
            setAllBSDs(prevBsds => prevBsds.map(prevBsd => 
                prevBsd.id === bsd.id 
                    ? { 
                        ...bsdFromSupabase, 
                        status_track_dechets: 'Collecté',
                        infos_json: {
                            ...bsdFromSupabase.infos_json,
                            formAPI: {
                                ...bsdFromSupabase.infos_json.formAPI,
                                createFormInput: updatedFormInput
                            }
                        }
                    }
                    : prevBsd
            ));
            setAllFilteredBSDs(prev => prev.map(prevbsd => prevbsd.id === bsd.id ? {...prevbsd, status_track_dechets: 'Collecté', infos_json: {...prevbsd.infos_json, formAPI: {...prevbsd.infos_json.formAPI, createFormInput: updatedFormInput}}} : prevbsd));
            setDisplayedBSDs(prev => prev.map(prevbsd => prevbsd.id === bsd.id ? {...prevbsd, status_track_dechets: 'Collecté', infos_json: {...prevbsd.infos_json, formAPI: {...prevbsd.infos_json.formAPI, createFormInput: updatedFormInput}}} : prevbsd));
            toast.success("BSD mis à jour avec succès");
            await invalidateCache();
            //setModalReload(!modalReload);
        } else {
            toast.error("Erreur lors de la mise à jour du BSD");
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (openMenuId !== null) {
                setOpenMenuId(null);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [openMenuId]);

    const getStatusStyle = (status: string): { mainText: string, subText?: string, color: string } => {
        const baseStatus: Record<string, { mainText: string, subText?: string, color: string }> = {
            "DRAFT": { mainText: "Brouillon", subText: "en attente de finalisation", color: "text-[var(--green-light)]" },
            "Brouillon": { mainText: "Brouillon", subText: "en attente de finalisation", color: "text-[var(--green-light)]" },
            "Brouillon Local": { mainText: "Brouillon", subText: "en attente d'envoi", color: "text-[var(--green-light)]" },
            
            // En cours
            "SEALED": { mainText: "Finalisé", subText: "en attente de signature", color: "text-blue-600" },
            "SIGNED_BY_PRODUCER": { mainText: "Signé", subText: "en attente d'enlèvement", color: "text-blue-600" },
            "SENT": { mainText: "Envoyé", subText: "en cours de transport", color: "text-blue-600" },
            "Collecte demandée": { mainText: "Collecte demandée", subText: "en attente d'enlèvement", color: "text-blue-600" },
            "Collecté": { mainText: "Collecté", subText: "en cours de transport", color: "text-blue-600" },
            
            // Réception/Traitement
            "RECEIVED": { mainText: "Reçu", subText: "en attente d'acceptation", color: "text-orange-600" },
            "ACCEPTED": { mainText: "Accepté", subText: "en attente de traitement", color: "text-orange-600" },
            "Accepté": { mainText: "Accepté", subText: "en attente de traitement", color: "text-orange-600" },
            
            'GROUPED': { mainText: "Groupé", color: "text-green-600" },
            'AWAITING_GROUP': { mainText: "Regroupement", subText: "en attente", color: "text-orange-600" },

            // Terminé
            "PROCESSED": { mainText: "Traité", color: "text-[var(--green-light)]" },
            "Traité": { mainText: "Traité", color: "text-[var(--green-light)]" },
            
            // Autres cas
            "REFUSED": { mainText: "Refusé", color: "text-red-600" },
            "NO_TRACEABILITY": { mainText: "Rupture de traçabilité", color: "text-red-600" },
            "CANCELED": { mainText: "Annulé", color: "text-red-600" },
            "IMPORTED": { mainText: "Importé", subText: "dans FLEAP", color: "text-gray-600" },
            
            "Ligne créée": { mainText: "Ligne créée", color: "text-gray-600" },
            "Ligne validée": { mainText: "Collecté", subText: "en cours de transport", color: "text-blue-600" },
            "Ligne demandée": { mainText: "Collecte demandée", subText: "en attente de collecte", color: "text-red-600" },

        };

        return baseStatus[status] || { mainText: status, color: "text-[var(--green-light)]" };
    };

    const handleUpdateWeight = (bsd: BSD) => {
        // Initialiser le poids si pas encore défini
        if (weightInputs[bsd.id] === undefined) {
            setWeightInputs(prev => ({
                ...prev,
                [bsd.id]: parseFloat(String(bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity)) || 0
            }));
        }

        return (
            <input 
                type="number" 
                value={weightInputs[bsd.id] || 0}
                onChange={(e) => setWeightInputs(prev => ({
                    ...prev,
                    [bsd.id]: parseFloat(e.target.value)
                }))}
                className="w-12 text-xs border-[var(--green-medium)] border-[1px] rounded pl-1"
                step="0.1"
            />
        );
    };

    const handleToggleChecked = async (bsd: BSD) => {
        try {
            // Récupérer other_infos depuis la BDD pour ne pas écraser des champs non présents en local
            const { data: currentRow, error: fetchError } = await supabase
                .from('bsd')
                .select('other_infos')
                .eq('id', bsd.id)
                .eq('entreprise_id', entreprise_id)
                .single();

            if (fetchError) {
                console.error('Erreur récupération other_infos:', fetchError);
                toast.error("Erreur lors de la récupération des infos");
                return;
            }

            const dbOtherInfos = (currentRow?.other_infos || {}) as OtherInfos;
            const existsInDb = typeof (dbOtherInfos as Partial<OtherInfos>).checked !== 'undefined';
            const nextChecked = existsInDb ? !Boolean(dbOtherInfos.checked) : true;
            const updatedOtherInfos: OtherInfos = { ...dbOtherInfos, checked: nextChecked };

            const { error } = await supabase
                .from('bsd')
                .update({ other_infos: updatedOtherInfos })
                .eq('id', bsd.id)
                .eq('entreprise_id', entreprise_id);

            if (error) {
                console.error('Erreur mise à jour checked:', error);
                toast.error("Erreur lors de la mise à jour");
                return;
            }

            // Update local states (merge)
            setAllBSDs(prev => prev.map(prevBsd => prevBsd.id === bsd.id ? { ...prevBsd, other_infos: updatedOtherInfos } : prevBsd));
            setAllFilteredBSDs(prev => prev.map(prevBsd => prevBsd.id === bsd.id ? { ...prevBsd, other_infos: updatedOtherInfos } : prevBsd));
            setDisplayedBSDs(prev => prev.map(prevBsd => prevBsd.id === bsd.id ? { ...prevBsd, other_infos: updatedOtherInfos } : prevBsd));

            await invalidateCache();

        } catch (e) {
            console.error('Exception mise à jour checked:', e);
            toast.error("Erreur inattendue");
        }
    };

    const handleDeleteRecurrence = async (bsdId: string) => {
        try {
            const { data: recurrences, error: recurrenceError } = await supabase
                .from('recurrence')
                .select('*')
                .eq('entreprise_id', entreprise_id);

            if (recurrenceError) {
                throw recurrenceError;
            }

            const recurrence = recurrences?.find(rec => 
                rec.pattern.created_bsd_ids?.includes(bsdId)
            ) as RecurrenceEntry;

            if (!recurrence) {
                toast.error("Aucune récurrence trouvée pour ce BSD");
                return;
            }

            const result = await Swal.fire({
                title: 'Êtes-vous sûr de vouloir supprimer cette récurrence ?',
                html: `
                    <div class="p-3">
                        <div class="mb-0">
                            <h3 class="text-2xl font-bold mt-[-10px] mb-4">${recurrence.pattern.name}</h3>
                            <div class="flex justify-center gap-8 text-sm">
                                <div class="text-center bg-gray-100 rounded-md p-2">
                                    <p class="text-gray-600">Fréquence</p>
                                    <p class="font-medium mt-1">${recurrence.pattern.frequencyNumber} ${recurrence.pattern.frequency}</p>
                                </div>
                                <div class="text-center bg-gray-100 rounded-md p-2">
                                    <p class="text-gray-600">BSDs créés</p>
                                    <p class="font-medium mt-1">${recurrence.execution_count}</p>
                                </div>
                            </div>
                        </div>
                        <div class="text-left text-sm text-red-500 mt-4">
                                Cette action supprimera la récurrence mais pas les BSDs déjà créés.
                        </div>
                    </div>
                `,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Oui, supprimer',
                cancelButtonText: 'Annuler',
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                customClass: {
                    confirmButton: 'swal2-confirm',
                    cancelButton: 'swal2-cancel'
                }
            });

            if (result.isConfirmed) {
                const { error: deleteError } = await supabase
                    .from('recurrence')
                    .delete()
                    .eq('id', recurrence.id);

                if (deleteError) {
                    toast.error("Erreur lors de la suppression de la récurrence");
                    console.error("Erreur suppression récurrence:", deleteError);
                    return;
                }

                toast.success("Récurrence supprimée avec succès");
                await invalidateCache();
                setModalReload(!modalReload);
            }
        } catch (error) {
            console.error("Erreur lors de la suppression de la récurrence:", error);
            toast.error("Erreur lors de la suppression de la récurrence");
        }
    };

    const handleValidateCollecte = (bsd: BSD) => {
        setSelectedBsdForValidation(bsd);
        setShowValidateModal(true);
    };

    const openPDFs = async (pdfIds: string[]) => {
        if (!pdfIds || pdfIds.length === 0) return;
        
        try {
            // Récupérer les informations des PDFs depuis la table pdf_infos
            const { data: pdfInfos, error } = await supabase
                .from('pdf_infos')
                .select('name_pdf_in_bucket')
                .in('id', pdfIds)
                .eq('entreprise_id', entreprise_id);

            if (error) {
                console.error('Erreur lors de la récupération des PDFs:', error);
                toast.error('Erreur lors de l\'ouverture des PDFs');
                return;
            }

            if (!pdfInfos || pdfInfos.length === 0) {
                toast.error('Aucun PDF trouvé');
                return;
            }

            // Générer l'URL signée pour chaque PDF et l'ouvrir
            for (let i = 0; i < pdfInfos.length; i++) {
                const pdfInfo = pdfInfos[i];
                if (pdfInfo.name_pdf_in_bucket) {
                    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                        .from('pdfs_bucket')
                        .createSignedUrl(pdfInfo.name_pdf_in_bucket, 3600); // URL valide 1h

                    if (signedUrlError) {
                        console.error('Erreur lors de la génération de l\'URL signée:', signedUrlError);
                        continue;
                    }

                    if (signedUrlData?.signedUrl) {
                        // Ajouter un délai pour éviter le blocage des popups par le navigateur
                        setTimeout(() => {
                            window.open(signedUrlData.signedUrl, '_blank');
                        }, i * 100); // 100ms de délai entre chaque ouverture
                    }
                }
            }

        } catch (error) {
            console.error('Erreur lors de l\'ouverture des PDFs:', error);
            toast.error('Erreur lors de l\'ouverture des PDFs');
        }
    };

    return (
        <>
            <div className="overflow-x-auto">
                {(isPartialData && false) && (
                    <div className="bg-blue-50 p-2 mb-4 rounded-md text-sm text-blue-700 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Chargement rapide en cours... Affichage des {displayedBSDs.length} premiers BSDs sur un total de {totalBSDsCount}. Les filtres seront activés une fois toutes les données chargées.
                    </div>
                )}
                {/*<p>ici BSD displayd: {displayedBSDs.length}</p>
                <p>Total bsd dans la base: {totalBSDsCount}</p>
                <p>totalBSDsCount chargé en local: {allBSDs?.length}</p>
                <p>allFilteredBSDs: {allFilteredBSDs.length}</p>
                <p>displayedBSDs contenu: {JSON.stringify(displayedBSDs.map(bsd => bsd.id))}</p>
                <p>est en train de load plus :{isLoadingMore.toString()} : 25: {(displayedBSDs.length < 25).toString()} && hasmore : {hasMore?.toString()} && loadingmore{(!isLoadingMore)?.toString()} && loadingbsd {(!loadingBSDs)?.toString()}</p>*/}
                <table style={{ width: '100%', borderCollapse: 'collapse' }} className="table-fixed">
                    <thead>
                        <tr style={{ backgroundColor: 'white' }}>
                            <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '20%', textAlign: 'left', paddingLeft: '0' }} 
                                className="text-sm font-normal text-gray-500 mb-0">Déchet</th>
                            <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '20%', textAlign: 'left', paddingLeft: '23px' }}
                                className="text-sm font-normal text-gray-500 mb-0">Statut</th>
                            <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '20%', textAlign: 'left', paddingLeft: '25px' }}
                                className="text-sm font-normal text-gray-500 mb-0 hidden md:table-cell">Prestataires</th>
                            {/*<th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '15%', textAlign: 'right', paddingRight: '1.25rem' }}
                                className="text-sm font-normal text-gray-500 mb-0 hidden md:table-cell">Montant</th>*/}
                            <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '5%', textAlign: 'center' }}
                                className="text-sm font-normal text-gray-500 mb-0 hidden md:table-cell">Infos</th>
                            <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '15%', textAlign: 'right', paddingRight: '3.5rem' }}
                                className="text-sm font-normal text-gray-500 mb-0">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loadingBSDs && displayedBSDs.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center py-4">
                                    <div className="loading loading-spinner loading-md hidden"></div>
                                </td>
                            </tr>
                        ) : displayedBSDs.length > 0 ? (
                            displayedBSDs.map((bsd, index) => (
                            <tr key={`${bsd.id}-${index}`} style={{ borderBottom: '1px solid #ddd' }} 
                                className={`${bsd.status_track_dechets === "Ligne créée automatiquement" ? 
                                    "bg-[var(--gray-light)]" : 
                                    bsd.status_track_dechets === "Ligne demandée" ? 
                                        "bg-[var(--gray-light)]" : ""}`}>
                                <td style={{ padding: '6px', width: '20%', position: 'relative', height: '80px'}}>
                                    <div className="absolute top-1 left-2 w-full">
                                        <div className="font-medium text-[10px] text-gray-600 md:block hidden">
                                            {bsd.readable_id_track_dechets ? 
                                                (bsd.readable_id_track_dechets.startsWith('BSD-') ? 
                                                    `${bsd.readable_id_track_dechets.substring(0, 15)}...` : 
                                                    bsd.readable_id_track_dechets) : 
                                                "ID non disponible"
                                            }
                                        </div>
                                    </div>
                                    <div className="h-full flex items-center mt-2">
                                        <div className="flex items-center justify-start gap-4">
                                            <div 
                                                className={`mt-3 inline-flex items-center justify-center w-10 h-10 rounded-full transition-colors ${bsd.other_infos?.checked ? 'border-2 border-black bg-gray-100' : 'bg-white'}`}
                                                onClick={(e) => { e.stopPropagation(); handleToggleChecked(bsd); }}
                                                title={bsd.other_infos?.checked ? 'Vérifié' : 'Marquer comme vérifié'}
                                            >
                                                {(() => {
                                                    const icon = getWasteIcon(getFiliere(
                                                        bsd.infos_json.formAPI.createFormInput.wasteDetails.code,
                                                        mappingTable
                                                    ));
                                                    return <BoxIcon type={icon.type} name={icon.name} color={bsd.other_infos?.checked ? '#374151' : '#111827'} size="22px" />;
                                                })()}
                                            </div>
                                            <div className="space-y-0.5">
                                                {/* Informations sur le déchet */}
                                                {bsd.infos_json.formAPI.createFormInput.wasteDetails.name && (
                                                        <div className="text-sm mt-2 mb-1 truncate overflow-hidden whitespace-nowrap md:w-[180px] w-[90px]">
                                                            {bsd.infos_json.formAPI.createFormInput.wasteDetails.name}
                                                        </div>
                                                    )}                                                

                                                <div>
                                                    <div className="text-blue-500 mb-0 hidden">
                                                        {getFiliere(
                                                            bsd.infos_json.formAPI.createFormInput.wasteDetails.code,
                                                            mappingTable
                                                        )}
                                                    </div>
                                                    <div className="text-xs font-bold ml-[-1px] mt-[-4px]">
                                                        <div>{bsd.infos_json.formAPI.createFormInput.wasteDetails.code}</div>
                                                    </div>
                                                    
                                                    {bsd.status_track_dechets === "Ligne créée automatiquement" ?
                                                        <div className="text-xs mt-0">
                                                            {handleUpdateWeight(bsd)} T
                                                        </div>
                                                    :
                                                        <div className="text-sm mt-0">
                                                            {bsd.infos_json.formAPI.createFormInput.quantityReceived 
                                                            ? 
                                                                `${parseFloat(String(bsd.infos_json.formAPI.createFormInput.quantityReceived)).toFixed(2)} T` 
                                                            :
                                                                bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity !== null && 
                                                                bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity !== undefined 
                                                                    ? 
                                                                        `${parseFloat(String(bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity)).toFixed(2)} T` 
                                                                    : 
                                                                        "-"}
                                                        </div>
                                                }




                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ padding: '6px', width: '20%', position: 'relative', height: '80px' }}>
                                    <div className="absolute top-1 left-1.5 w-full">
                                        <div className="text-[13px] text-gray-600 ml-4 flex justify-start gap-2">
                                            <DateToDisplay status={bsd.status_track_dechets} created_at={bsd.created_at} takenOverAt={bsd.infos_json.formAPI.createFormInput.takenOverAt || ""} />
                                            {/* {bsd.infos_json.formAPI.createFormInput.takenOverAt ? <p><span className="md:inline hidden">Collecté le </span>{new Date(bsd.infos_json.formAPI.createFormInput.takenOverAt as string).toLocaleDateString('fr-FR')}</p> : <p>{bsd.status_track_dechets === "Ligne demandée" ? <p><span className="md:inline hidden">Attendu le </span>{new Date(bsd.created_at).toLocaleDateString('fr-FR')}</p> : <p><span className="md:inline hidden">Créé le </span>{new Date(bsd.created_at).toLocaleDateString('fr-FR')}</p>}</p>}
                                            {/*<p>CREE le {new Date(bsd.created_at).toLocaleDateString('fr-FR')}</p>*/}
                                            {/* {bsd.infos_json.formAPI.createFormInput.emittedAt} */}
                                            {/* {bsd.infos_json.formAPI.createFormInput.createdAt} */}
                                            {/* {bsd.infos_json.formAPI.createFormInput.processedAt} */}
                                            {/* {bsd.infos_json.formAPI.createFormInput.receivedAt} */}
                                            {/* {bsd.infos_json.formAPI.createFormInput.signedAt} */}  
                                            {/* {bsd.infos_json.formAPI.createFormInput.takenOverAt} */}
                                            {/* {bsd.infos_json.formAPI.createFormInput.updatedAt} */}
                                        </div>
                                    </div>
                                    <div className="h-full flex flex-col justify-center ml-4 mt-0">
                                        {bsd.status_track_dechets !== null ? (
                                            <>
                                                <div className={`text-md md:text-md font-semibold ${getStatusStyle(bsd.status_track_dechets).color} text-[13px] md:text-base`}>
                                                    {getStatusStyle(bsd.status_track_dechets).mainText}
                                                </div>
                                                {getStatusStyle(bsd.status_track_dechets).subText && (
                                                    <div className={`text-xs ${getStatusStyle(bsd.status_track_dechets).color} mt-[-4px] hidden md:block`}>
                                                        {getStatusStyle(bsd.status_track_dechets).subText}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="text-md">...</div>
                                        )}
                                    </div>
                                </td>
                                <td style={{ padding: '6px', width: '20%', height: '80px' }} className="hidden md:table-cell overflow-hidden">
                                    <div className="text-xs ml-4 overflow-hidden space-y-0">
                                        {/* Site Etablissement */}
                                        <div className="overflow-hidden">
                                            <span className="flex items-center gap-2">
                                                <BoxIcon type='solid' color='#727272' size="20px" name='map' className="flex-shrink-0" />
                                                <span className="truncate block">{bsd.infos_json.formAPI.createFormInput.emitter?.company?.name || "Site non spécifié"}</span>
                                            </span>
                                        </div>
                                        {/* Entreprises */}
                                        <div className="overflow-hidden">
                                            <span className="flex items-center gap-2">
                                                <BoxIcon type='solid' color='#727272' size="20px" name='truck' className="flex-shrink-0" />
                                                <span className="truncate block">{bsd.infos_json.formAPI.createFormInput.transporter?.company?.name || ""}</span>
                                            </span>
                                        </div>
                                        <div className="overflow-hidden">
                                            <span className="flex items-center gap-2">
                                                <BoxIcon type='solid' color='#727272' size="20px" name='factory' className="flex-shrink-0" />
                                                <span className="truncate block">{bsd.infos_json.formAPI.createFormInput.recipient?.company?.name || ""}</span>
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                {/*<td style={{ padding: '6px', width: '15%', height: '80px' }} className="hidden md:table-cell">
                                    {
                                    bsd.facture_treated ? 
                                        <div className="text-md font-550 text-right mr-5">
                                            {getSommeBSD(bsd.facture_infos).toFixed(2)} € HT
                                        </div> 
                                    : 
                                        <div className="text-md font-550 text-right mr-5">-€ HT</div>
                                    }
                                </td>*/}
                                <td style={{ padding: '6px', width: '5%', height: '80px' }} className="hidden md:table-cell">                                     
                                    <div className="flex flex-wrap items-center justify-center space-y-1">
                                        {bsd.pdf_ids && Array.isArray(bsd.pdf_ids) && bsd.pdf_ids.length > 0 && (
                                            <div 
                                                className="flex items-center justify-center cursor-pointer hover:opacity-70 transition-opacity"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openPDFs(bsd.pdf_ids || []);
                                                }}
                                                title="Cliquer pour ouvrir les PDFs"
                                            >
                                                <BoxIcon type='solid' name='file-pdf' color='red' size="30px" />
                                                {bsd.pdf_ids.length > 1 && (
                                                    <span className="text-xs text-gray-600 ml-1">+{bsd.pdf_ids.length - 1}</span>
                                                )}
                                            </div>
                                        )}
                                        
                                        {/* Affichage DOE, Flux et REP */}
                                        {bsd.other_infos && (
                                            <div className="flex flex-col items-center text-xs space-y-0.5">                                             
                                                {bsd.other_infos?.doe && (
                                                    <div className="bg-green-100 text-green-800 px-1 py-0.5 rounded text-[10px] font-medium">
                                                        DOE
                                                    </div>
                                                )}
                                                {bsd.other_infos.flux == "entrant" && (
                                                    <div className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-[10px] font-medium">
                                                        Entrant
                                                    </div>
                                                )}
                                                {bsd.other_infos.flux == "sortant" && (
                                                    <div className="bg-orange-100 text-orange-800 px-1 py-0.5 rounded text-[10px] font-medium">
                                                        Sortant
                                                    </div>
                                                )}
                                                {bsd.other_infos?.rep?.sent_to_rep && (
                                                    <div className={`px-1 py-0.5 rounded text-[10px] font-medium ${String(bsd.other_infos.rep.sent_to_rep) === "true" ? "bg-purple-100 text-purple-800" : "hidden"}`}>
                                                        REP
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td style={{ padding: '6px', width: '15%', height: '80px' }}>
                                    <div className="flex items-center justify-end gap-2 w-full">

                                        {/* Actions principales */}
                                        <div className="flex items-center">
                                            {["Ligne demandée", "Ligne créée"].includes(bsd.status_track_dechets) && (
                                                <div className="text-center items-center ml-16 mr-[-15px] md:mr-[-5px]">
                                                    <button 
                                                        className="px-3 py-1 bg-[var(--green-medium)] text-white rounded-md text-xs 
                                                        hover:bg-[var(--green-dark)] transition-colors whitespace-nowrap" 
                                                         onClick={() => handleValidateCollecte(bsd)}
                                                    >
                                                        Valider
                                                    </button>
                                                    {/*<button 
                                                        className="px-3 py-1 bg-[var(--red-medium)] text-white rounded-md text-xs 
                                                        hover:bg-[var(--red-dark)] transition-colors whitespace-nowrap" 
                                                        onClick={() => {
                                                            handleCancelCollecte(bsd).then(() => {
                                                                setModalReload(!modalReload);
                                                            });
                                                        }}
                                                    >
                                                        Annuler
                                                    </button>*/}
                                                </div>
                                            )}
                                            {bsd.status_track_dechets === "DRAFT" && (
                                                <button 
                                                    className="px-3 py-1 bg-[var(--green-medium)] text-white rounded-md text-xs 
                                                    hover:bg-[var(--green-dark)] transition-colors whitespace-nowrap" 
                                                    onClick={() => handleSeal(bsd.id)}
                                                >
                                                    Sceller 
                                                </button>
                                            )}
                                            {bsd.status_track_dechets === "SEALED" && (
                                                <button 
                                                    className="px-3 py-1 bg-[var(--green-medium)] text-white rounded-md text-xs 
                                                    hover:bg-[var(--green-dark)] transition-colors whitespace-nowrap" 
                                                    onClick={() => handleSign(bsd.id)}
                                                >
                                                    Signer
                                                </button>
                                            )}
                                            {bsd.status_track_dechets === "Brouillon Local" && (
                                                <button 
                                                    className="px-3 py-1 bg-[var(--green-medium)] text-white rounded-md text-xs 
                                                    hover:bg-[var(--green-dark)] transition-colors whitespace-nowrap" 
                                                    onClick={() => handleSendDraft(bsd)}
                                                >
                                                    Envoyer
                                                </button>
                                            )}
                                            {nonDangerousStatut(bsd.status_track_dechets) && (
                                                <div className="relative">
                                                    <select 
                                                        className="appearance-none px-2 py-1 bg-[var(--green-medium)] text-white rounded-md text-xs
                                                        hover:bg-[var(--green-dark)] transition-colors w-[60px] cursor-pointer"
                                                        onChange={(e) => handleChangeNonDangerous(bsd, e.target.value)}
                                                        value={bsd.status_track_dechets}
                                                    >
                                                        <option value={bsd.status_track_dechets} hidden></option>
                                                        {bsd.readable_id_track_dechets !== "Ligne validée" && <option value="Brouillon">Brouillon</option>}
                                                        {bsd.readable_id_track_dechets !== "Ligne validée" && <option value="Collecte demandée">Collecte demandée</option>}
                                                        <option value="Collecté">Collecté</option>
                                                        <option value="Accepté">Accepté</option>
                                                        <option value="Traité">Traité</option>
                                                    </select>
                                                    <div className="pointer-events-none absolute inset-0 flex items-center px-2 py-1 text-white text-xs ml-1">
                                                        Statut
                                                    </div>
                                                </div>
                                            )}
                                            {bsd.status_track_dechets === "Ligne créée automatiquement" && (
                                                <button 
                                                    className="px-3 py-1 bg-[var(--green-medium)] text-white rounded-md text-xs
                                                    hover:bg-[var(--green-dark)] transition-colors whitespace-nowrap" 
                                                    onClick={() => handleValidateLine(bsd)}
                                                >
                                                    <span className="hidden md:inline">Ajouter au registre</span>
                                                    <span className="md:hidden">Ajouter</span>
                                                </button>
                                            )}
                                            {/*bsd.status_track_dechets === "Ligne validée" && (
                                                <button 
                                                    className="px-1 py-1 text-[var(--green-medium)] rounded-md text-xs mr-3 whitespace-nowrap" 
                                                >
                                                    Validée
                                                </button>
                                            )*/}
                                        </div>

                                        {/* Menu trois points */}
                                        <div className="relative">
                                            {bsd.other_infos?.numeroBon && (
                                                <div className="text-gray-600 text-[10px] absolute -top-4 right-2 whitespace-nowrap">
                                                    {bsd.other_infos.numeroBon}
                                                </div>
                                            )}                                           
                                            <button 
                                                className="px-1 py-1 text-gray-600 rounded-md hover:bg-gray-100 mt-0.5 h-8"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenMenuId(openMenuId === bsd.id ? null : bsd.id);
                                                }}
                                                onMouseEnter={() => setHoveredMenuId(bsd.id)}
                                                onMouseLeave={() => setHoveredMenuId(null)}
                                            >
                                                <BoxIcon name='dots-vertical-rounded' size="20px" />
                                            </button>

                                            {/* Menu déroulant (inchangé) */}
                                            {openMenuId === bsd.id && (
                                                <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-50 top-8">
                                                    <div className="py-1">
                                                        {!canModify(bsd.id_track_dechets, bsd.status_track_dechets) && (<button 
                                                            className="w-full px-2 py-1 text-xs text-gray-700 hover:bg-green-50 hover:text-green-600 text-left"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDisplay(bsd.id);
                                                                setOpenMenuId(null);
                                                            }}
                                                        >
                                                            Voir
                                                        </button>)}

                                                        {canModify(bsd.id_track_dechets, bsd.status_track_dechets) && (
                                                            <button 
                                                                className="w-full px-2 py-1 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-600 text-left"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleModify(bsd.id);
                                                                    setOpenMenuId(null);
                                                                }}
                                                            >
                                                                Modifier
                                                            </button>
                                                        )}
                                                        
                                                        <button 
                                                            className="w-full px-2 py-1 text-xs text-gray-700 hover:bg-red-50 hover:text-red-600 text-left relative"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDelete(bsd.id, bsd.on_track_dechets);
                                                                setOpenMenuId(null);
                                                            }}
                                                            disabled={deletingId === bsd.id}
                                                        >
                                                            <span className="flex items-center">
                                                                {deletingId === bsd.id ? (
                                                                    <>
                                                                        <span className="mr-2">Suppression</span>
                                                                        <span className="loading loading-spinner loading-xs"></span>
                                                                    </>
                                                                ) : (
                                                                    'Supprimer'
                                                                )}
                                                            </span>
                                                        </button>
                                                        {bsd.id_track_dechets === "Ligne automatique" && <button 
                                                            className="w-full px-2 py-1 text-xs text-gray-700 hover:bg-orange-50 hover:text-orange-600 text-left"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteRecurrence(bsd.id);
                                                                setOpenMenuId(null);
                                                            }}
                                                        >
                                                            Supprimer la récurrence
                                                        </button>}     
                                                    {bsd.status_track_dechets === "Ligne demandée" && (
                                                        <button 
                                                            className="w-full px-2 py-1 text-xs text-gray-700 hover:bg-red-50 hover:text-red-600 text-left"
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                const result = await handleCancelCollecte(bsd);
                                                                if (result) {
                                                                        setModalReload(!modalReload);
                                                                        invalidateCache();
                                                                        setAllBSDs(prev => prev.filter(prevBsd => prevBsd.id !== bsd.id));
                                                                        setAllFilteredBSDs(prev => prev.filter(prevBsd => prevBsd.id !== bsd.id));
                                                                        setDisplayedBSDs(prev => prev.filter(prevBsd => prevBsd.id !== bsd.id));
                                                                    }
                                                            }}
                                                        >
                                                            Annuler la collecte
                                                        </button>
                                                    )}                                                   
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="relative h-0">
                                    {hoveredMenuId === bsd.id && (
                                            <div className="absolute text-[8px] text-gray-400 text-right mr-14 z-50 right-0 top-0">
                                            N° {bsd.id}
                                        </div>
                                    )}
                                    </div>
                                </td>
                            </tr>
                            ))
                        ) : (
                            <tr><td colSpan={5}>Aucun BSD disponible</td></tr>
                        )}
                    </tbody>
                </table>
                
                {showSendDraftModal && selectedBsd && (
                    <SendDraftModal
                        isOpen={showSendDraftModal}
                        onClose={() => {
                            setShowSendDraftModal(false);
                            setSelectedBsd(null);
                        }}
                        formData={selectedBsd.infos_json.formAPI.createFormInput as FormInput}
                        userId={user_id || ''}
                        entrepriseId={entreprise_id || ''}
                        bsdId={selectedBsd.id}
                        onDelete={handleDelete}
                    />
                )}
                
                {isLoadingMore && (
                    <div className="flex justify-center mt-4">
                        <div className="loading loading-spinner loading-md"></div>
                    </div>
                )}
                
                {!hasMore && allFilteredBSDs.length > 0 && (
                    <div className="text-center mt-4 text-sm text-gray-500">
                        Tous les BSDs ({allBSDs.length}) ont été chargés
                    </div>
                )}
                <div className="text-center mt-4">
                    {allFilteredBSDs.length === 0 ? (
                        <div className="text-sm text-gray-500">Aucun BSD disponible pour ces filtres.</div>
                    ) : (
                        <button 
                            onClick={() => {
                                const newLimit = displayLimit + 50;
                                setDisplayLimit(newLimit);
                                
                                // Si on a besoin de plus de données que ce qu'on a en local
                                if (newLimit > allBSDs.length && hasMore && !isLoadingMore) {
                                    setIsLoadingMore(true);
                                    fetchBSDs(true); // Appel API avec loadMore=true
                                    
                                } else {
                                    // Sinon on affiche juste plus de données depuis le cache
                                    setDisplayedBSDs(allFilteredBSDs.slice(0, newLimit));
                                }
                            }}
                            className="px-4 py-2 bg-[var(--green-medium)] text-white rounded-md text-sm hover:bg-[var(--green-dark)] transition-colors"
                            disabled={isLoadingMore || !hasMore}
                        >
                            {isLoadingMore ? (
                                <span className="flex items-center gap-2">
                                    <span className="loading loading-spinner loading-sm"></span>
                                    Chargement...
                                </span>
                            ) : !hasMore ? (
                                "Toutes les données ont été chargées"
                            ) : (
                                "Charger plus " + "("+displayLimit+")"
                            )}
                        </button>
                    )}
                </div>
                
                {showValidateModal && selectedBsdForValidation && (
                    <ValidateCollecte
                        bsd={selectedBsdForValidation}
                        onClose={() => {
                            setShowValidateModal(false);
                            setSelectedBsdForValidation(null);
                        }}
                        onValidate={() => {
                            setModalReload(!modalReload);
                        }}
                    />
                )}
            </div>
        </>
    )
}

export default TableBSD

const nonDangerousStatut = (statut: string) => {
    const acceptableStatuts = ["Déchet non dangereux", "Brouillon", "Collecte demandée", "Collecté", "Accepté", "Traité", "Rupture de traçabilité", "Ligne validée"];
    return acceptableStatuts.includes(statut);
}

const canModify = (id_track: string, statut_track: string) => {
    if(id_track === "Déchet non dangereux" || id_track === "draft" || statut_track === "IMPORTED" || statut_track === "DRAFT" || id_track === "Ligne validée" || id_track === "Ligne créée" || id_track === "Ligne automatique" || id_track === "Ligne demandée" || id_track === "Ligne de BSD PDF" || id_track === "Ligne de Bon PDF" || id_track === "Ligne de Facture PDF") {
        return true;
    }
    return false;
};

const frenchTranslation = (statut: string): string => {
    const mapping: Record<string, string> = {
        "DRAFT": "TrackDéchets : Brouillon",
        "SEALED": "TrackDéchets : Finalisé",
        "SIGNED_BY_PRODUCER": "TrackDéchets : Signé par le producteur",
        "SENT": "TrackDéchets : Envoyé",
        "RECEIVED": "TrackDéchets : Reçu",
        "ACCEPTED": "TrackDéchets : Accepté",
        "REFUSED": "TrackDéchets : Refusé",
        "PROCESSED": "TrackDéchets : Traité",
        "NO_TRACEABILITY": "TrackDéchets : Rupture de traçabilité",
        "AWAITING_GROUP": "TrackDéchets : En attente de regroupement",
        "FOLLOWED_WITH_PNTTD": "TrackDéchets : Traité sans rupture de traçabilité",
        "GROUPED": "TrackDéchets : Groupé",
        "TEMP_STORED": "TrackDéchets : Reçu (entreposage provisoire)",
        "TEMP_STORED_ACCEPTED": "TrackDéchets : Accepté (entreposage provisoire)",
        "RESEALED": "TrackDéchets : Finalisé (entreposage provisoire)",
        "SIGNED_BY_TEMP_STORER": "TrackDéchets : Signé par l'entreposage provisoire",
        "RESENT": "TrackDéchets : Réexpédié",
        "CANCELED": "TrackDéchets : Annulé",
        "IMPORTED": "Importé dans FLEAP",
    };
    return mapping[statut] || statut;
};


/*const OrderBSDs = (bsds: BSD[]) => {
    const getDate = (bsd: BSD) => {
        //if(bsd.infos_json.formAPI.createFormInput.takenOverAt) return new Date(bsd.infos_json.formAPI.createFormInput.takenOverAt);
        return new Date(bsd.created_at);
    }
    return bsds.sort((a, b) => getDate(b).getTime() - getDate(a).getTime());
}*/


const checkBSDBeforeSeal = (bsd: BSD|undefined) => {
    if (!bsd) return false;

    const form = bsd.infos_json.formAPI.createFormInput;
    const isDangerous = form.wasteDetails.code.endsWith('*');

    // Vérification de l'émetteur
    if (!form.emitter?.type) {
        toast.error("Le type d'émetteur est obligatoire");
        return false;
    }

    if (!form.emitter?.company) {
        toast.error("Les informations de l'entreprise émettrice sont obligatoires");
        return false;
    }

    const emitterFields = ['siret', 'name', 'address', 'contact', 'phone', 'mail'];
    for (const field of emitterFields) {
        if (!form.emitter.company[field as keyof Company]) {
            toast.error(`Le champ ${field} de l'émetteur est obligatoire`);
            return false;
        }
    }

    // Vérification du destinataire
    if (!form.recipient?.processingOperation) {
        toast.error("L'opération de traitement est obligatoire");
        return false;
    }

    if (isDangerous && !form.recipient?.cap) {
        toast.error("Le CAP du destinataire est obligatoire pour les déchets dangereux");
        return false;
    }

    if (!form.recipient?.company) {
        toast.error("Les informations de l'entreprise destinataire sont obligatoires");
        return false;
    }

    const recipientFields = ['siret', 'name', 'address', 'contact', 'phone', 'mail'];
    for (const field of recipientFields) {
        if (!form.recipient.company[field as keyof Company]) {
            toast.error(`Le champ ${field} du destinataire est obligatoire`);
            return false;
        }
    }

    // Vérification du transporteur
    if (!form.transporter?.company) {
        toast.error("Les informations de l'entreprise de transport sont obligatoires");
        return false;
    }

    const transporterFields = ['siret', 'name', 'address', 'contact', 'mail', 'phone'];
    for (const field of transporterFields) {
        if (!form.transporter.company[field as keyof Company]) {
            toast.error(`Le champ ${field} du transporteur est obligatoire`);
            return false;
        }
    }

    if (!form.transporter.isExemptedOfReceipt) {
        if (!form.transporter.receipt) {
            toast.error("Le récépissé du transporteur est obligatoire");
            return false; 
        }
        if (!form.transporter.department) {
            toast.error("Le département du transporteur est obligatoire");
            return false;
        }
        if (!form.transporter.validityLimit) {
            toast.error("La date limite de validité du transporteur est obligatoire");
            return false;
        }
    }

    // Vérification des détails du déchet
    if (!form.wasteDetails?.code) {
        toast.error("Le code déchet est obligatoire");
        return false;
    }

    if (isDangerous && !form.wasteDetails?.onuCode) {
        toast.error("Le code ONU est obligatoire pour les déchets dangereux");
        return false;
    }

    if (!form.wasteDetails?.packagingInfos) {
        toast.error("Les informations d'emballage sont obligatoires");
        return false;
    }

    if(form.wasteDetails.packagingInfos.length > 0){
        if (!form.wasteDetails.packagingInfos[0].type) {
            toast.error("Le type d'emballage est obligatoire");
            return false;
        }

        if (form.wasteDetails.packagingInfos[0].type === "AUTRE" && !form.wasteDetails.packagingInfos[0].other) {
            toast.error("La description de l'emballage est obligatoire quand le type est 'Autre'");
            return false;
        }

        if (!form.wasteDetails.packagingInfos[0].quantity) {
            toast.error("La quantité d'emballages est obligatoire");
            return false;
        }
    } else {
        toast.error("Les informations d'emballage sont obligatoires");
        return false;
    }


    if (!form.wasteDetails.quantity) {
        toast.error("La quantité de déchet est obligatoire");
        return false;
    }

    if (!form.wasteDetails.quantityType) {
        toast.error("Le type de quantité est obligatoire");
        return false;
    }

    if (!form.wasteDetails.consistence) {
        toast.error("La consistance du déchet est obligatoire");
        return false;
    }

    if (form.wasteDetails.pop === undefined || form.wasteDetails.pop === null) {
        toast.error("L'information POP est obligatoire");
        return false;
    }

    return true;
}



