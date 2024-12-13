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

const getWasteIcon = (filiere: string): string => {
    const iconMapping: { [key: string]: string } = {
        'Bois': '🪵',
        'Métaux': '🔧',
        'Gravats': '🏗️',
        'DIB': '🗑️',
        'Cartons': '📦',
        'Plastiques': '♳',
        'DEEE': '💻',
        'Déchets dangereux': '⚠️',
        'Végétaux': '🌱',
        'Autres': '♻️'
    };
    return iconMapping[filiere] || '♻️';
};

const getSommeBSD = (facture_infos: {montant_ht: number}) => {
    //return facture_infos.ligne_compta_traitement.montant_ht + facture_infos.ligne_compta_tgap.montant_ht + facture_infos.ligne_compta_contenant.montant_ht + facture_infos.ligne_compta_transport.montant_ht + facture_infos.ligne_compta_preparation.montant_ht + facture_infos.ligne_compta_rachat_matiere.montant_ht;
    return facture_infos.montant_ht;
}

const fetchBSDs = async (user_id: string | null, filieres: Filiere[], sites: Site[], entreprise_id: string | null) => {
    console.log("Début fetchBSDs", { user_id, entreprise_id });
    
    if (!entreprise_id) return [];

    const { data, error } = await supabase
    .from('bsd')
    .select('id, created_at, infos_json, facture_treated, facture_infos, status_track_dechets, id_track_dechets, readable_id_track_dechets')
    .eq('entreprise_id', entreprise_id);

    if(error) {
        console.error("Error fetching BSD:", error);
        return [];
    }

    console.log("BSDs bruts récupérés:", data?.length);
    
    const checkedFilieres = filieres.filter(f => f.checked).map(f => f.name);
    console.log("Filières cochées:", checkedFilieres);

    // Si aucune filière n'est sélectionnée, retourner tous les BSDs
    if (checkedFilieres.length === 0) {
        console.log("Aucune filière sélectionnée, retour de tous les BSDs");
        return data || [];
    }

    const getCEDsFromFilieres = async (entreprise_id: string | null, checkedFilieres: string[]) => {
        const { data, error } = await supabase
        .from('entreprise')
        .select('mapping_ced_filiere')
        .eq('id', entreprise_id)
        .single();
        if(data){
            const mapping_table = data.mapping_ced_filiere;
            const ced_uniques:string[] = [];
            let other_ceds:string[] = mapping_table.map((mapping: {ced: string}) => mapping.ced);
            for(const mapping of mapping_table){
                for(const filiere of checkedFilieres){
                    const cond1 = mapping.filiere === filiere;
                    if(cond1){
                        ced_uniques.push(mapping.ced);
                        other_ceds = other_ceds.filter((ced)=>ced!==mapping.ced);
                    }
                }
            }
            /*if(checkedFilieres.includes('Autres')){
                ced_uniques = ced_uniques.concat(other_ceds);
            }*/
            
            return ced_uniques;
        }
        return [];
    }
    const checkedCEDs = await getCEDsFromFilieres(entreprise_id, checkedFilieres);
    console.log("CEDs correspondants:", checkedCEDs);

    let filteredBSD_onCED = data;
    if (checkedFilieres.length > 0) {
        const non_Autres = data.filter((bsd) => {
            const ced = bsd.infos_json.formAPI.createFormInput.wasteDetails.code;
            return checkedCEDs.includes(ced.replaceAll(' ', '').replace('*', ''));
        });

        const autres = data.filter((bsd) => {
            return !non_Autres.some(nonAutreBsd => nonAutreBsd.id === bsd.id);
        });

        if(checkedFilieres.includes('Autres')){
            filteredBSD_onCED = non_Autres.concat(autres);
        } else {
            filteredBSD_onCED = non_Autres;
        }
    } 
    const checkedSites = sites.filter(site => site.checked).map(site => site.name);
    console.log("Sites cochés:", checkedSites);

    // Si aucun site n'est sélectionné, retourner les BSDs filtrés par filières
    if (checkedSites.length === 0) {
        console.log("Aucun site sélectionné, retour des BSDs filtrés par filières");
        return filteredBSD_onCED;
    }

    let filteredBSD_onCED_andSite = filteredBSD_onCED.filter((bsd) => {
        return checkedSites.some(site => bsd.infos_json.formAPI.createFormInput.emitter.workSite ? site === bsd.infos_json.formAPI.createFormInput.emitter.workSite.name : false);
    });

    if(checkedSites.includes("Non renseigné")){
        const non_renseigne = data.filter((bsd) => {
            if(bsd.infos_json.formAPI.createFormInput.emitter.workSite){
                return bsd.infos_json.formAPI.createFormInput.emitter.workSite.name === ""
            } else {
                return true;
            }
        });
        filteredBSD_onCED_andSite = filteredBSD_onCED_andSite.concat(non_renseigne);
    }

    return filteredBSD_onCED_andSite;
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

    // Récupérer les BSDs de l'utilisateur
    useEffect(() => {
        const loadBSDs = async () => {
            if (!session?.user_id || !session?.entreprise_id) {
                setLoadingBSDs(false);
                return;
            }

            try {
                setLoadingBSDs(true);
                const data = await fetchBSDs(session.user_id, filieres, sites, session.entreprise_id);
                console.log("Données à afficher:", data?.length);
                if (data && data.length > 0) {
                    const sortedData = data.sort((a, b) => 
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    );
                    console.log("Données triées:", sortedData.length);
                    setBSDs(sortedData);
                } else {
                    setBSDs([]);
                }
            } catch (error) {
                console.error("Erreur lors du chargement:", error);
                setBSDs([]);
            } finally {
                setLoadingBSDs(false);
            }
        };

        loadBSDs();
    }, [session?.user_id, session?.entreprise_id, filieres, sites, modalReload, modalId, modalType]);


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
                                            /*: nonDangerousStatut(bsd.status_track_dechets) ?
                                                <select 
                                                    className="px-3 py-1 border border-gray-300 text-gray-600 rounded-md text-xs 
                                                    hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors" 
                                                    onChange={(e) => handleChangeNonDangerous(bsd, e.target.value)}
                                                >
                                                    <option value="Mail envoyé">Mail envoyé</option>
                                                    <option value="Accepté par le prestataire">Accepté par le prestataire</option>
                                                    <option value="Refusé par le prestataire">Refusé par le prestataire</option>
                                                    <option value="Pris en charge par le prestataire">Pris en charge par le prestataire</option>
                                                    <option value="En attente de prise en charge">En attente de prise en charge</option>
                                                    <option value="En attente de réception">En attente de réception</option>
                                                    <option value="Réceptionné">Réceptionné</option>
                                                    <option value="Réceptionné et traité">Réceptionné et traité</option>
                                                </select>*/
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
                                    {(bsd.status_track_dechets === 'DRAFT' || bsd.status_track_dechets === 'Brouillon Local') && (
                                        <button 
                                            className="px-3 py-1 border border-gray-300 text-gray-600 rounded-md 
                                            hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors" 
                                            onClick={() => handleModify(bsd.id)}
                                        >
                                            Modifier
                                        </button>
                                    )}
                                    {bsd.status_track_dechets !== 'DRAFT' && 
                                     bsd.status_track_dechets !== 'Brouillon Local' && (
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
        </div>
    )
}

export default TableBSD


/*const handleChangeNonDangerous = async (bsd: BSD, value: string) => {
    await supabase
    .from('bsd')
    .update({status_track_dechets: value})
    .eq('id', bsd.id);
}*/
