import { useEffect, useState } from "react";
import { supabase } from "../database/supabaseClient";
import { useSession } from "../component/SessionProvider";
import { useModalContextNew } from "./RegisterComponents/Modal/ContextModal";
import toast from "react-hot-toast";
import { Filiere, Site, useFilterContext } from "../FilterContext";
import { BSDD_TrackDechets, FormInput } from "./interface/BSD_Interface";
import Swal from 'sweetalert2';
import SendDraftModal from "./RegisterComponents/Modal/SendDraftModal";
import { getMappingTableFiliere, getFiliere } from "./RegisterComponents/Modal/utils_new";

const cleanCED = (ced: string): string => {
    const ced_clean = ced.replaceAll(' ', '').replace('*', '').trim();
    return String(parseInt(ced_clean));
}

// Modifier le type FormDataType pour inclure un id
type BSD = {
    id: string;
    created_at: string;
    readable_id_track_dechets: string;
    infos_json: {formAPI: {createFormInput: BSDD_TrackDechets}};
    facture_treated: boolean;
    facture_infos: {
        montant_ht: number;
        /*ligne_compta_traitement: {montant_ht: number}, 
        ligne_compta_tgap: {montant_ht: number}, 
        ligne_compta_contenant: {montant_ht: number},
        ligne_compta_transport: {montant_ht: number},
        ligne_compta_preparation: {montant_ht: number},
        ligne_compta_rachat_matiere: {montant_ht: number}*/
    };
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

const getWasteIcon = (filiere: string): string => {
    const filiereNormalized = normalizeString(filiere);
    
    const iconMapping: { keywords: string[], icon: string }[] = [
        {
            keywords: ['bois', 'palette', 'meuble'],
            icon: '🪵'
        },
        {
            keywords: ['metal', 'metaux', 'ferraille', 'fer', 'acier', 'aluminium', 'cuivre'],
            icon: '🔧'
        },
        {
            keywords: ['gravat', 'beton', 'pierre', 'construction', 'demolition', 'btp'],
            icon: '🏗️'
        },
        {
            keywords: ['dib', 'dechetindustriel', 'industriel', 'melange'],
            icon: '🗑️'
        },
        {
            keywords: ['carton', 'papier', 'emballage'],
            icon: '📦'
        },
        {
            keywords: ['plastique', 'pvc', 'pet', 'polyethylene', 'polystyrene'],
            icon: '♳'
        },
        {
            keywords: ['deee', 'electronique', 'electrique', 'informatique', 'ordinateur'],
            icon: '💻'
        },
        {
            keywords: ['dangereux', 'toxique', 'chimique', 'corrosif', 'inflammable'],
            icon: '⚠️'
        },
        {
            keywords: ['vegetal', 'vert', 'organique', 'plante', 'herbe', 'feuille'],
            icon: '🌱'
        }
    ];

    for (const mapping of iconMapping) {
        if (mapping.keywords.some(keyword => 
            normalizeString(filiereNormalized).includes(normalizeString(keyword))
        )) {
            return mapping.icon;
        }
    }

    return '♻️'; // Icône par défaut pour "Autres"
};

const getSommeBSD = (facture_infos: {montant_ht: number}) => {
    //return facture_infos.ligne_compta_traitement.montant_ht + facture_infos.ligne_compta_tgap.montant_ht + facture_infos.ligne_compta_contenant.montant_ht + facture_infos.ligne_compta_transport.montant_ht + facture_infos.ligne_compta_preparation.montant_ht + facture_infos.ligne_compta_rachat_matiere.montant_ht;
    return facture_infos.montant_ht;
}

const getCEDsFromFilieres = async (entreprise_id: string | null, checkedFilieres: string[]) => {
    const { data, error } = await supabase
        .from('entreprise')
        .select('mapping_ced_filiere')
        .eq('id', entreprise_id)
        .single();

    if (data) {
        const mapping_table = data.mapping_ced_filiere;
        const ced_uniques: string[] = [];
        let other_ceds: string[] = mapping_table.map((mapping: {ced: string}) => mapping.ced);

        for (const mapping of mapping_table) {
            for (const filiere of checkedFilieres) {
                if (mapping.filiere === filiere) {
                    ced_uniques.push(cleanCED(mapping.ced));
                    other_ceds = other_ceds.filter((ced) => cleanCED(ced) !== cleanCED(mapping.ced));
                }
            }
        }

        if (checkedFilieres.includes('Autres')) {
            return ced_uniques.concat(other_ceds.map(ced => cleanCED(ced)));
        }

        return ced_uniques;
    }
    return [];
}

const fetchBSDs = async (user_id: string | null, filieres: Filiere[], sites: Site[], entreprise_id: string | null, page: number = 1) => {
    console.log("Début fetchBSDs", { user_id, entreprise_id, page });
    
    if (!entreprise_id) return [];

    const limit = 50;
    const offset = (page - 1) * limit;

    // Récupérer les filières et sites cochés
    const checkedFilieres = filieres.filter(f => f.checked).map(f => f.name);
    const checkedSites = sites.filter(site => site.checked).map(site => site.name);

    // Si aucun filtre n'est sélectionné, retourner un tableau vide
    if (checkedFilieres.length === 0 || checkedSites.length === 0) {
        return [];
    }

    // Récupérer les CEDs correspondant aux filières
    const ceds = await getCEDsFromFilieres(entreprise_id, checkedFilieres);

    let query = supabase
        .from('bsd')
        .select('*')
        .eq('entreprise_id', entreprise_id);

    // Ajouter le filtre sur les CEDs
    //console.log("CEDs:", ceds);
    const ceds_all_types = ceds.map(ced => [
        ced,                         // Version propre
        ced.replace(/(\d{2})(?=\d)/g, '$1 ').trim(),   // Version avec espaces
        ced.replace(/(\d{2})(?=\d)/g, '$1 ').trim() + '*' // Version avec astérisque
    ]);
    const ced_all = ceds_all_types.flatMap(ced_all_types => ced_all_types);
    //console.log("CEDs all types:", ced_all);
    const toutes_filieres_cond = filieres.map(filiere => filiere.checked).includes(false); //Affiche false uniquement si tout est sélectionné

    if(toutes_filieres_cond && ceds.length > 0) {
        query = query.filter('infos_json->formAPI->createFormInput->wasteDetails->>code', 'in', `(${ced_all.join(',')})`);
    }
    //console.log("condition filieres:", (toutes_filieres_cond && ceds.length > 0));

   // Ajouter le filtre sur les sites
    if (checkedSites.length > 0) {
        if (!checkedSites.includes("Non renseigné")) {
            // Cas où "Non renseigné" n'est pas inclus
            query = query.filter('infos_json->formAPI->createFormInput->emitter->workSite->>name', 'in', `(${checkedSites.join(',')})`);
        } else {
            // Cas où "Non renseigné" est inclus
            query = query.or(
                `infos_json->formAPI->createFormInput->emitter->workSite.is.null,` +
                `infos_json->formAPI->createFormInput->emitter->workSite->>name.eq."",` +
                `infos_json->formAPI->createFormInput->emitter->workSite->>name.in.(${checkedSites.filter(site => site !== "Non renseigné").join(',')})`
            );
        }
    } else {
        return [];
    }

    // Ajouter la pagination
    query = query
        .order('created_at', { ascending: false })
        .range(0, offset + limit - 1);


    const { data, error } = await query;

    if (error) {
        console.error("Error fetching BSD:", error);
        return [];
    }

    return data || [];
}

const TableBSD = () => {
    const session = useSession();
    const [bsds, setBSDs] = useState<BSD[]>([]);
    //const { modalReload, setModalReload, modalId, setModalId, modalType, setModalType } = useModal();
    //A faire passer sur useModalContextNew
    const { modalReload, setModalReload, modalId, setModalId, modalType, setModalType } = useModalContextNew();
    const { filieres, sites } = useFilterContext();

    const [webhooksInitialized, setWebhooksInitialized] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showSendDraftModal, setShowSendDraftModal] = useState(false);
    const [selectedBsd, setSelectedBsd] = useState<BSD | null>(null);
    const [loadingBSDs, setLoadingBSDs] = useState(true);
    const [mappingTable, setMappingTable] = useState<{ ced: string, filiere: string }[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const itemsPerPage = 50;

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
    }, [filieres, sites]); // Se déclenche quand les filtres changent

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
                const newData = await fetchBSDs(session.user_id, filieres, sites, session.entreprise_id, currentPage);
                
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
    }, [session?.user_id, session?.entreprise_id, filieres, sites, modalReload, currentPage]);

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
    


    const handleDelete = async (id: string, silent: boolean = false) => {
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

    return (
        <div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ backgroundColor: 'white' }}>
                        <th style={{ padding: '10px', borderBottom: '1px solid #ddd', width: '20%', textAlign: 'left', paddingLeft: '3rem' }}>Déchet</th>
                        <th style={{ padding: '10px', borderBottom: '1px solid #ddd', width: '20%', textAlign: 'center' }}>Statut</th>
                        <th style={{ padding: '10px', borderBottom: '1px solid #ddd', width: '25%', textAlign: 'left', paddingLeft: '1rem' }}>Prestataires</th>
                        <th style={{ padding: '10px', borderBottom: '1px solid #ddd', width: '10%', textAlign: 'right', paddingRight: '1.25rem' }}>Montant</th>
                        <th style={{ padding: '10px', borderBottom: '1px solid #ddd', width: '15%', textAlign: 'center' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {loadingBSDs ? (
                        <tr><td colSpan={5}>Chargement des BSDs...</td></tr>
                    ) : bsds.length > 0 ? (
                        bsds.map((bsd) => (
                        <tr key={bsd.id} style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ padding: '10px', position: 'relative', height: '100px' }}>
                                <div className="absolute top-2 left-0 w-full">
                                    <div className="font-medium text-[10px] text-gray-600 ml-10">
                                        {bsd.readable_id_track_dechets || "ID non disponible"}
                                    </div>
                                    <div className="text-[8px] text-gray-400 ml-10">
                                        N° {bsd.id}
                                    </div>
                                </div>
                                <div className="h-full flex items-center mt-4">
                                    <div className="flex items-center justify-start gap-4 ml-10">
                                        <div className="text-2xl h-full">
                                            {getWasteIcon(getFiliere(
                                                bsd.infos_json.formAPI.createFormInput.wasteDetails.code,
                                                mappingTable
                                            ))}
                                        </div>
                                        <div className="text-xs space-y-1">
                                            {/* Informations sur le déchet */}
                                            <div>
                                                <div>{bsd.infos_json.formAPI.createFormInput.wasteDetails.code}</div>
                                                {bsd.infos_json.formAPI.createFormInput.wasteDetails.name && (
                                                    <div className="text-gray-500 text-xs">
                                                        {bsd.infos_json.formAPI.createFormInput.wasteDetails.name}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-gray-600">
                                                {getFiliere(
                                                    bsd.infos_json.formAPI.createFormInput.wasteDetails.code,
                                                    mappingTable
                                                )}
                                            </div>
                                            <div>{bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity} tonnes</div>
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td style={{ padding: '10px', position: 'relative', height: '100px' }}>
                                <div className="absolute top-2 left-0 w-full text-center">
                                    <div className="text-[10px] text-gray-600">
                                        Créé le {new Date(bsd.created_at).toLocaleDateString('fr-FR')}
                                    </div>
                                </div>
                                <div className="h-full flex items-center justify-center mt-4">
                                    {bsd.status_track_dechets !== null ? 
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="text-xs">{bsd.status_track_dechets}</div>
                                            {bsd.status_track_dechets === "DRAFT" ?
                                                <button 
                                                    className="px-3 py-1 border border-gray-300 text-gray-600 rounded-md text-xs 
                                                    hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors" 
                                                    onClick={() => handleSeal(bsd.id)}
                                                >
                                                    Sceller
                                                </button>
                                            : bsd.status_track_dechets === "SEALED" ?
                                                <button 
                                                    className="px-3 py-1 border border-gray-300 text-gray-600 rounded-md text-xs 
                                                    hover:bg-green-50 hover:border-green-200 hover:text-green-600 transition-colors" 
                                                    onClick={() => handleSign(bsd.id)}
                                                >
                                                    Signer
                                                </button>
                                            : bsd.status_track_dechets === "Brouillon Local" ?
                                                <button 
                                                    className="px-3 py-1 border border-gray-300 text-gray-600 rounded-md text-xs 
                                                    hover:bg-yellow-50 hover:border-yellow-200 hover:text-yellow-600 transition-colors" 
                                                    onClick={() => handleSendDraft(bsd)}
                                                >
                                                    Envoyer
                                                </button>
                                            : nonDangerousStatut(bsd.status_track_dechets) ?
                                                <div className="flex flex-col items-center gap-2">
                                                    {/* <div className="text-xs text-gray-600">Déchet non dangereux</div> */}
                                                    <div className="flex justify-between items-center gap-2">
                                                        <div className="text-xs text-gray-800">Statut :</div>
                                                        <select 
                                                            className="px-3 py-1 border border-gray-300 text-gray-600 rounded-md text-xs 
                                                            hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors w-[30px]" 
                                                            onChange={(e) => handleChangeNonDangerous(bsd, e.target.value)}
                                                            >
                                                                <option value="Brouillon">Brouillon</option>
                                                                <option value="Collecte demandée">Collecte demandée</option>
                                                                <option value="Collecté">Collecté</option>
                                                                <option value="Accepté">Accepté</option>
                                                                <option value="Traité">Traité</option>
                                                            {/*<option value="Rupture de traçabilité">Rupture de traçabilité</option>
                                                            <option value="Mail envoyé">Mail envoyé</option>
                                                            <option value="Accepté par le prestataire">Accepté par le prestataire</option>
                                                            <option value="Refusé par le prestataire">Refusé par le prestataire</option>
                                                            <option value="Pris en charge par le prestataire">Pris en charge par le prestataire</option>
                                                            <option value="En attente de prise en charge">En attente de prise en charge</option>
                                                            <option value="En attente de réception">En attente de réception</option>
                                                            <option value="Réceptionné">Réceptionné</option>
                                                            <option value="Réceptionné et traité">Réceptionné et traité</option>*/}
                                                        </select>
                                                    </div>
                                                </div>
                                            : null}
                                        </div>
                                    : 
                                        <div className="text-xs">...</div>
                                    }
                                </div>
                            </td>
                            <td style={{ padding: '10px' }}>
                                <div className="text-xs ml-4">
                                    {/* Site de travail */}
                                    <div className="mb-2 pr-2 line-clamp-1">
                                        📍 {bsd.infos_json.formAPI.createFormInput.emitter?.workSite?.name || "Site non spécifié"}
                                    </div>
                                    {/* Entreprises */}
                                    <div className="mb-2 pr-2 line-clamp-1">
                                        🚚 {bsd.infos_json.formAPI.createFormInput.transporter?.company?.name || ""}
                                    </div>
                                    <div className="mb-2 pr-2 line-clamp-1">
                                        🔩 {bsd.infos_json.formAPI.createFormInput.recipient?.company?.name || ""}
                                    </div>
                                </div>
                            </td>
                            <td style={{ padding: '10px' }}>
                                {
                                bsd.facture_treated ? 
                                    <div className="text-xs text-right mr-5">
                                        {getSommeBSD(bsd.facture_infos)} € HT
                                    </div> 
                                : 
                                    <div className="text-xs text-right mr-5">-€ HT</div>
                                }
                            </td>
                            <td style={{ padding: '10px' }}>
                                <div className="flex flex-col justify-center items-center gap-2 text-xs">
                                    {canModify(bsd.id_track_dechets, bsd.status_track_dechets) && (
                                        <button 
                                            className="px-3 py-1 border border-gray-300 text-gray-600 rounded-md 
                                            hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors" 
                                            onClick={() => handleModify(bsd.id)}
                                        >
                                            Modifier
                                        </button>
                                    )}
                                    {!canModify(bsd.id_track_dechets, bsd.status_track_dechets) && (
                                        <button 
                                            className="px-3 py-1 border border-gray-300 text-gray-600 rounded-md 
                                            hover:bg-green-50 hover:border-green-200 hover:text-green-600 transition-colors" 
                                            onClick={() => handleDisplay(bsd.id)}
                                        >
                                            Voir
                                        </button>
                                    )}
                                    <button 
                                        className="px-3 py-1 border border-gray-300 text-gray-600 rounded-md 
                                        hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors" 
                                        onClick={() => handleDelete(bsd.id)}
                                        disabled={deletingId === bsd.id}
                                    >
                                        {deletingId === bsd.id ? (
                                            <span className="loading loading-spinner loading-xs"></span>
                                        ) : (
                                            'Supprimer'
                                        )}
                                    </button>
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
    const acceptableStatuts = ["Déchet non dangereux", "Brouillon", "Collecte demandée", "Collecté", "Accepté", "Traité", "Rupture de traçabilité"];
    return acceptableStatuts.includes(statut);
}

const canModify = (id_track: string, statut_track: string) => {
    if(id_track === "Déchet non dangereux" || id_track === "draft" || statut_track === "IMPORTED") {
        return true;
    }
    return false;
}
