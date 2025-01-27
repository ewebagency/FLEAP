import { useEffect, useState } from "react";
import { supabase } from "../database/supabaseClient";
import { useSession } from "../component/SessionProvider";
import { useModalContextNew } from "./RegisterComponents/Modal/ContextModal";
import toast from "react-hot-toast";
import { Filiere, PointCollecte, Site, useFilterContext } from "../FilterContext";
import { BSDD_TrackDechets, FormInput } from "./interface/BSD_Interface";
import Swal from 'sweetalert2';
import SendDraftModal from "./RegisterComponents/Modal/SendDraftModal";
import { getMappingTableFiliere, getFiliere } from "./RegisterComponents/Modal/FormulaireFull/utils_new";
//import 'boxicons'
import { RecurrenceEntry } from "./RegisterComponents/Modal/Recurrence/RecurrenceFunctionnal";
import BoxIcon from "../component/BoxIconWrapper";
import { getPendingBSDs } from "./RegisterComponents/BordereauxRegister";
import { FactureJSON } from "../import_page/FactureImport/ButtonImportFacture";

const cleanCED = (ced: string): string => {
    const ced_clean = ced.replaceAll(' ', '').replace('*', '').trim();
    //return String(parseInt(ced_clean)); => attention, ne fonctionne pas pour les CEDs avec des 0 à gauche
    return ced_clean;
}

// Modifier le type FormDataType pour inclure un id
type BSD = {
    id: string;
    created_at: string;
    on_track_dechets: boolean;
    readable_id_track_dechets: string;
    infos_json: {formAPI: {createFormInput: BSDD_TrackDechets}};
    facture_treated: boolean;
    facture_infos: FactureJSON;
    status_track_dechets: string;
    id_track_dechets: string;
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
            keywords: ['gravat', 'beton', 'pierre', 'construction', 'demolition', 'btp'],
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

    return { name: 'question-mark' }; // Icône par défaut
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

const fetchBSDs = async (user_id: string | null, sites: Site[], filieres: Filiere[], points_collecte: PointCollecte[], entreprise_id: string | null, page: number = 1, filterPendingBSDs: boolean = false) => {
    if (!entreprise_id) return [];

    console.log("filterPendingBSDs dans fetchBSDs:", filterPendingBSDs);

    if (filterPendingBSDs) {
        console.log("Récupération des BSDs en attente");
        const pendingBSDs = await getPendingBSDs(entreprise_id);
        console.log("BSDs en attente récupérés:", pendingBSDs);
        return pendingBSDs || [];
    }

    const limit = 50;
    const offset = (page - 1) * limit;

    const checkedFilieres = filieres.filter(f => f.checked).map(f => f.name);
    const checkedPointsCollecte = points_collecte.filter(point_collecte => point_collecte.checked).map(point_collecte => point_collecte.name);
    const checkedSites = sites.filter(site => site.checked).map(site => site.orgId);

    if (checkedFilieres.length === 0 || checkedPointsCollecte.length === 0) {
        return [];
    }

    let query = supabase
        .from('bsd')
        .select('*')
        .eq('entreprise_id', entreprise_id);

    //const { data: datafalse, error: errorfalse } = await query; //---------------!!!!!!!!!!!
    //return datafalse || [];

    // Récupérer tous les CEDs de toutes les filières
    const { data: mappingData } = await supabase
        .from('entreprise')
        .select('mapping_ced_filiere')
        .eq('id', entreprise_id)
        .single();

    const filiere_conditions: string[] = [];
    
    // Conditions pour les CEDs (filières)
    if (mappingData) {
        const mapping_table = mappingData.mapping_ced_filiere;
        
        // Liste de tous les CEDs de toutes les filières
        const ced_from_all_filiere = mapping_table.map((mapping: {ced: string}) => cleanCED(mapping.ced));
        
        // Liste des CEDs des filières sélectionnées
        const ced_from_checked_filiere = mapping_table
            .filter((mapping: {filiere: string}) => 
                checkedFilieres.filter(f => f !== 'Autres').includes(mapping.filiere))
            .map((mapping: {ced: string}) => cleanCED(mapping.ced));

        const formatCEDs = (ceds: string[]) => {
            return ceds.flatMap(ced => [
                ced,
                ced.replace(/(\d{2})(?=\d)/g, '$1 ').trim(),
                ced.replace(/(\d{2})(?=\d)/g, '$1 ').trim() + '*'
            ]);
        };

        // Si "Autres" est sélectionné
        if (checkedFilieres.includes('Autres')) {
            const all_formatted_ceds = formatCEDs(ced_from_all_filiere);
            if (all_formatted_ceds.length > 0) {
                filiere_conditions.push(
                    `infos_json->formAPI->createFormInput->wasteDetails->>code.not.in.(${all_formatted_ceds.join(',')})`
                );
            }
        }

        // Pour les filières normales
        const checked_formatted_ceds = formatCEDs(ced_from_checked_filiere);
        if (checked_formatted_ceds.length > 0) {
            filiere_conditions.push(
                `infos_json->formAPI->createFormInput->wasteDetails->>code.in.(${checked_formatted_ceds.join(',')})`
            );
        }
    }

    // Appliquer les conditions de filière
    if (filiere_conditions.length > 0) {
        query = query.or(filiere_conditions.join(','));
    }

    // Conditions pour les sites
    const site_conditions: string[] = [];
    if (checkedSites.length > 0) {
        if (checkedSites.includes('----')) {
            site_conditions.push(`infos_json->formAPI->createFormInput->emitter->company->>siret.eq.""`);
        }
        
        const realSites = checkedSites.filter(site => site !== '----');
        if (realSites.length > 0) {
            site_conditions.push(`infos_json->formAPI->createFormInput->emitter->company->>siret.in.(${realSites.join(',')})`);
        }
    } else {
        return [];
    }

    // Appliquer les conditions de site
    if (site_conditions.length > 0) {
        query = query.or(site_conditions.join(','));
    }

    // Ajouter le filtre sur les points de collecte --> on ne met jamais  car ça a filtré des trucs qu'on voulait pas filtréé pour lallemand
    /*if (checkedPointsCollecte.length > 0) {
        if (!checkedPointsCollecte.includes("Non renseigné")) {
            query = query.filter('infos_json->formAPI->createFormInput->emitter->workSite->>name', 'in', `(${checkedPointsCollecte.join(',')})`);
        } else {
            query = query.or(
                `infos_json->formAPI->createFormInput->emitter->>workSite.is.null,` +
                `infos_json->formAPI->createFormInput->emitter->workSite->>name.eq."",` +
                `infos_json->formAPI->createFormInput->emitter->workSite->>name.in.(${checkedPointsCollecte.filter(point_collecte => point_collecte !== "Non renseigné").join(',')})`
            );
        }
    }*/
    
    // Ajouter la pagination
    query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching BSD:", error);
        return [];
    }

    return data || [];
};

const TableBSD = () => {
    const session = useSession();
    const [bsds, setBSDs] = useState<BSD[]>([]);
    //const { modalReload, setModalReload, modalId, setModalId, modalType, setModalType } = useModal();
    //A faire passer sur useModalContextNew
    const { modalReload, setModalReload, modalId, setModalId, modalType, setModalType, filterPendingBSDs, setFilterPendingBSDs } = useModalContextNew();
    const { sites, filieres, points_collecte } = useFilterContext();

    const [webhooksInitialized, setWebhooksInitialized] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showSendDraftModal, setShowSendDraftModal] = useState(false);
    const [selectedBsd, setSelectedBsd] = useState<BSD | null>(null);
    const [loadingBSDs, setLoadingBSDs] = useState(true);
    const [mappingTable, setMappingTable] = useState<{ ced: string, filiere: string }[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const itemsPerPage = 50;
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [hoveredMenuId, setHoveredMenuId] = useState<string | null>(null);
    const [weightInputs, setWeightInputs] = useState<Record<string, number>>({});

    // Ajouter un useEffect pour charger la table de mapping au démarrage
    useEffect(() => {
        const loadMappingTable = async () => {
            if (session?.entreprise_id) {
                const mapping = await getMappingTableFiliere(session.entreprise_id);
                setMappingTable(mapping || []);
            }
        };
        loadMappingTable();
    }, [session?.entreprise_id]);

    // Ajouter un useEffect pour réinitialiser la pagination quand les filtres changent
    useEffect(() => {
        setCurrentPage(1);
        setBSDs([]); // Vider la liste des BSDs
    }, [filieres, points_collecte]); // Se déclenche quand les filtres changent

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
            
            console.log('data_web_hooks', data);
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

    // Modifier le useEffect existant pour la récupération des BSDs
    useEffect(() => {
        const loadBSDs = async () => {
            if (!session?.user_id || !session?.entreprise_id) {
                setLoadingBSDs(false);
                return;
            }

            try {
                setLoadingBSDs(true);
                const newData = await fetchBSDs(
                    session.user_id, 
                    sites, 
                    filieres, 
                    points_collecte, 
                    session.entreprise_id, 
                    currentPage,
                    filterPendingBSDs
                );
                
                if (newData && newData.length > 0) {
                    setBSDs(prevBsds => {
                        // Si c'est la première page, on remplace complètement
                        if (currentPage === 1) return newData;
                        
                        // Sinon, on concatène en vérifiant les doublons
                        const existingIds = new Set(prevBsds.map(bsd => bsd.id));
                        const uniqueNewBsds = newData.filter(bsd => !existingIds.has(bsd.id));
                        return [...prevBsds, ...uniqueNewBsds];
                    });
                    setHasMore(newData.length === itemsPerPage);
                } else {
                    if (currentPage === 1) {
                        setBSDs([]);
                    }
                    setHasMore(false);
                }
            } catch (error) {
                console.error("Erreur lors du chargement:", error);
                if (currentPage === 1) {
                    setBSDs([]);
                }
            } finally {
                setLoadingBSDs(false);
            }
        };

        loadBSDs();
    }, [session?.user_id, session?.entreprise_id, sites, filieres, points_collecte, modalReload, currentPage, filterPendingBSDs]);

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
        if(on_track_dechets){
            try {
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
                    setModalReload(!modalReload);
                }
            } finally {
                setDeletingId(null);
            }
        } else {
            const result = await supabase
                .from('bsd')
                .delete()
                .eq('id', id);
            if(result.error){
                toast.error("Erreur lors de la suppression du BSD");
            } else {
                toast.success("BSD supprimé avec succès");
                setDeletingId(null);
                setModalReload(!modalReload);
            }
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
                setModalReload(!modalReload);
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
            setModalReload(!modalReload);
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
            // Mettre à jour le BSD modifié dans l'état local
            setBSDs(prevBsds => prevBsds.map(prevBsd => 
                prevBsd.id === bsd.id 
                    ? { ...prevBsd, status_track_dechets: value }
                    : prevBsd
            ));
        }
    };

    const handleValidateLine = async (bsd: BSD) => {
        const updatedFormInput = {
            ...bsd.infos_json.formAPI.createFormInput,
            wasteDetails: {
                ...bsd.infos_json.formAPI.createFormInput.wasteDetails,
                quantity: weightInputs[bsd.id] || 0
            }
        };

        const { data, error } = await supabase
            .from('bsd')
            .update({ 
                status_track_dechets: 'Collecté',
                infos_json: {
                    ...bsd.infos_json,
                    formAPI: {
                        ...bsd.infos_json.formAPI,
                        createFormInput: updatedFormInput
                    }
                }
            })
            .eq('id', bsd.id)
            .select()
            .single();

        if (!error && data) {
            setBSDs(prevBsds => prevBsds.map(prevBsd => 
                prevBsd.id === bsd.id 
                    ? { 
                        ...prevBsd, 
                        status_track_dechets: 'Collecté',
                        infos_json: {
                            ...prevBsd.infos_json,
                            formAPI: {
                                ...prevBsd.infos_json.formAPI,
                                createFormInput: updatedFormInput
                            }
                        }
                    }
                    : prevBsd
            ));
            toast.success("BSD mis à jour avec succès");
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
            "Ligne validée": { mainText: "Ligne validée", color: "text-[var(--green-light)]" },

        };

        return baseStatus[status] || { mainText: status, color: "text-[var(--green-light)]" };
    };

    const handleUpdateWeight = (bsd: BSD) => {
        // Initialiser le poids si pas encore défini
        if (weightInputs[bsd.id] === undefined) {
            setWeightInputs(prev => ({
                ...prev,
                [bsd.id]: bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity || 0
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

    const handleDeleteRecurrence = async (bsdId: string) => {
        try {
            const { data: recurrences, error: recurrenceError } = await supabase
                .from('recurrence')
                .select('*')
                .eq('entreprise_id', session?.entreprise_id);

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
                setModalReload(!modalReload);
            }
        } catch (error) {
            console.error("Erreur lors de la suppression de la récurrence:", error);
            toast.error("Erreur lors de la suppression de la récurrence");
        }
    };

    return (
        <div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }} className="table-fixed">
                <thead>
                    <tr style={{ backgroundColor: 'white' }}>
                        <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '20%', textAlign: 'left', paddingLeft: '0' }} 
                            className="text-sm font-normal text-gray-500 mb-0">Déchet</th>
                        <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '20%', textAlign: 'left', paddingLeft: '23px' }}
                            className="text-sm font-normal text-gray-500 mb-0">Statut</th>
                        <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '20%', textAlign: 'left', paddingLeft: '25px' }}
                            className="text-sm font-normal text-gray-500 mb-0 hidden md:table-cell">Prestataires</th>
                        <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '15%', textAlign: 'right', paddingRight: '1.25rem' }}
                            className="text-sm font-normal text-gray-500 mb-0 hidden md:table-cell">Montant</th>
                        <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '15%', textAlign: 'right', paddingRight: '3.5rem' }}
                            className="text-sm font-normal text-gray-500 mb-0">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {loadingBSDs ? (
                        <tr><td colSpan={5}>Chargement des BSDs...</td></tr>
                    ) : bsds.length > 0 ? (
                        OrderBSDs(bsds).map((bsd) => (
                        <tr key={bsd.id} style={{ borderBottom: '1px solid #ddd' }} className={`${bsd.status_track_dechets === "Ligne créée automatiquement" ? "bg-[var(--gray-light)]" : ""}`}>
                            <td style={{ padding: '6px', width: '20%', position: 'relative', height: '80px'}}>
                                <div className="absolute top-1 left-2 w-full">
                                    <div className="font-medium text-[10px] text-gray-600">
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
                                        <div className="text-2xl h-full">
                                            {(() => {
                                                const icon = getWasteIcon(getFiliere(
                                                    bsd.infos_json.formAPI.createFormInput.wasteDetails.code,
                                                    mappingTable
                                                ));
                                                return <BoxIcon type={icon.type} name={icon.name} color="#000000" size="30px" />;
                                            })()}
                                        </div>
                                        <div className="space-y-0.5">
                                            {/* Informations sur le déchet */}
                                            <div className="text-sm font-bold mb-[-5px]">
                                                <div>{bsd.infos_json.formAPI.createFormInput.wasteDetails.code}</div>
                                            </div>

                                            <div>
                                                <div className="text-blue-500 mb-0 hidden">
                                                    {getFiliere(
                                                        bsd.infos_json.formAPI.createFormInput.wasteDetails.code,
                                                        mappingTable
                                                    )}
                                                </div>
                                                {bsd.infos_json.formAPI.createFormInput.wasteDetails.name && (
                                                    <div className="text-xs mt-0 truncate overflow-hidden whitespace-nowrap w-[180px]">
                                                        {bsd.infos_json.formAPI.createFormInput.wasteDetails.name}
                                                    </div>
                                                )}
                                                
                                                {bsd.status_track_dechets === "Ligne créée automatiquement" ?
                                                    <div className="text-xs mt-0">
                                                        {handleUpdateWeight(bsd)} T
                                                    </div>
                                                :
                                                    <div className="text-xs mt-0">
                                                        {bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity !== null && 
                                                         bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity !== undefined ? 
                                                            `${bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity.toFixed(2)} T` : 
                                                            "-"}
                                                    </div>
                                                }

                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td style={{ padding: '6px', width: '20%', position: 'relative', height: '80px' }}>
                                <div className="absolute top-1 left-2 w-full">
                                    <div className="text-[10px] text-gray-600 ml-4 flex justify-start gap-2">
                                        {bsd.infos_json.formAPI.createFormInput.takenOverAt ? <p>Collecté le {new Date(bsd.infos_json.formAPI.createFormInput.takenOverAt as string).toLocaleDateString('fr-FR')}</p> : <p>Créé le {new Date(bsd.created_at).toLocaleDateString('fr-FR')}</p>}
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
                            <td style={{ padding: '6px', width: '15%', height: '80px' }} className="hidden md:table-cell">
                                {
                                bsd.facture_treated ? 
                                    <div className="text-md font-550 text-right mr-5">
                                        {getSommeBSD(bsd.facture_infos).toFixed(2)} € HT
                                    </div> 
                                : 
                                    <div className="text-md font-550 text-right mr-5">-€ HT</div>
                                }
                            </td>
                            <td style={{ padding: '6px', width: '15%', height: '80px' }}>
                                <div className="flex items-center justify-end gap-2 w-full">
                                    {/* Actions principales */}
                                    <div className="flex items-center gap-0">
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
                                                    <option value="Brouillon">Brouillon</option>
                                                    <option value="Collecte demandée">Collecte demandée</option>
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
                                                    {canModify(bsd.id_track_dechets, bsd.status_track_dechets) ? (
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
                                                    ) : (
                                                        <button 
                                                            className="w-full px-2 py-1 text-xs text-gray-700 hover:bg-green-50 hover:text-green-600 text-left"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDisplay(bsd.id);
                                                                setOpenMenuId(null);
                                                            }}
                                                        >
                                                            Voir
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
                    userId={session?.user_id || ''}
                    entrepriseId={session?.entreprise_id || ''}
                    bsdId={selectedBsd.id}
                    onDelete={handleDelete}
                />
            )}
            
            {hasMore && !loadingBSDs && (
                <div className="flex justify-center mt-4">
                    <button
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        onClick={() => setCurrentPage(prev => prev + 1)}
                    >
                        Charger plus de BSDs
                    </button>
                </div>
            )}
            
            {loadingBSDs && (
                <div className="flex justify-center mt-4">
                    <div className="loading loading-spinner loading-lg"></div>
                </div>
            )}
        </div>
    )
}

export default TableBSD

const nonDangerousStatut = (statut: string) => {
    const acceptableStatuts = ["Déchet non dangereux", "Brouillon", "Collecte demandée", "Collecté", "Accepté", "Traité", "Rupture de traçabilité", "Ligne créée"];
    return acceptableStatuts.includes(statut);
}

const canModify = (id_track: string, statut_track: string) => {
    if(id_track === "Déchet non dangereux" || id_track === "draft" || statut_track === "IMPORTED" || statut_track === "DRAFT" || id_track === "Ligne créée" || id_track === "Ligne automatique") {
        return true;
    }
    return false;
}

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


const OrderBSDs = (bsds: BSD[]) => {
    const getDate = (bsd: BSD) => {
        if(bsd.infos_json.formAPI.createFormInput.takenOverAt) return new Date(bsd.infos_json.formAPI.createFormInput.takenOverAt);
        return new Date(bsd.created_at);
    }
    return bsds.sort((a, b) => getDate(b).getTime() - getDate(a).getTime());
}
