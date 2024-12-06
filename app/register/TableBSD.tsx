import { useEffect, useState } from "react";
import { supabase } from "../database/supabaseClient";
import { useSession } from "../component/SessionProvider";
import { useModalContextNew } from "./RegisterComponents/Modal/ContextModal";
import toast from "react-hot-toast";
import { Filiere, Site, useFilterContext } from "../FilterContext";
import { BSDD_TrackDechets, FormInput } from "./interface/BSD_Interface";
import Swal from 'sweetalert2';
import { sendData_to_Cloud } from "./RegisterComponents/Modal/utils_new";

// Modifier le type FormDataType pour inclure un id
type BSD = {
    id: string;
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


const getSommeBSD = (facture_infos: {montant_ht: number}) => {
    //return facture_infos.ligne_compta_traitement.montant_ht + facture_infos.ligne_compta_tgap.montant_ht + facture_infos.ligne_compta_contenant.montant_ht + facture_infos.ligne_compta_transport.montant_ht + facture_infos.ligne_compta_preparation.montant_ht + facture_infos.ligne_compta_rachat_matiere.montant_ht;
    return facture_infos.montant_ht;
}

const fetchBSDs = async (user_id: string | null, filieres: Filiere[], sites: Site[], entreprise_id: string | null) => {
    //console.log("user_id : ", user_id);
    const { data, error } = await supabase
    .from('bsd')
    .select('id, created_at, infos_json, facture_treated, facture_infos, status_track_dechets, id_track_dechets')
    .eq('entreprise_id', entreprise_id);

    if(error){
        //console.error("Error fetching BSD:", error);
    } else {
        //console.log("BSDs fetched");
        
        // Filtrer les BSDs si des filières sont sélectionnées
        const checkedFilieres = filieres.filter(f => f.checked).map(f => f.name);
        
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
        
        //console.log('checkedFilieres', checkedFilieres);
        //console.log('checkedCEDs', checkedCEDs);
        let filteredBSD_onCED = data
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
        const filteredBSD_onCED_andSite = filteredBSD_onCED.filter((bsd) => {
            return checkedSites.some(site => site === bsd.infos_json.formAPI.createFormInput.emitter.workSite.name);
        });
        return filteredBSD_onCED_andSite;

    }
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
    
    // Récupérer les BSDs de l'utilisateur
    useEffect(() => {
        const loadBSDs = async () => {
            if (session?.user_id) {
                try {
                    const data = await fetchBSDs(session.user_id, filieres, sites, session.entreprise_id);
                    if (data) {
                        const sortedData = data.sort((a, b) => 
                            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                        );
                        setBSDs(sortedData);
                    }
                } catch (error) {
                    console.error("Error loading BSDs:", error);
                }
            }
        };
        loadBSDs();
        //console.log('mon bsd', bsds);
    }, [session, modalReload, modalId, modalType, filieres, sites]);


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
                !silent && Swal.fire('Erreur !', data.error, 'error');
            } else {
                !silent && toast.success("BSD supprimé avec succès");
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

    const handleSendDraft = async (bsd: BSD) => {
        const result = await Swal.fire({
            title: 'Envoyer le brouillon ?',
            text: "Voulez-vous envoyer ce brouillon à TrackDéchets ?",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Oui, envoyer',
            cancelButtonText: 'Annuler'
        });

        if (result.isConfirmed) {
            try {
                if (session?.user_id && session?.entreprise_id) {
                    const result = await sendData_to_Cloud(
                        bsd.infos_json.formAPI.createFormInput as FormInput,
                        session.user_id,
                        session.entreprise_id,
                        false // isDraft = false car on veut l'envoyer
                    );
                    if (result.success) {
                        // Supprimer l'ancien brouillon local
                        await handleDelete(bsd.id, true); // true = silent delete
                        toast.success("Brouillon envoyé avec succès sur TrackDéchets");
                        setModalReload(!modalReload);
                    } else {
                        toast.error(result.message);
                    }
                }
            } catch (error) {
                console.error("Erreur lors de l'envoi du brouillon:", error);
                toast.error("Erreur lors de l'envoi du brouillon");
            }
        }
    };

    return (
        <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none' }}>
                <thead>
                    <tr style={{ backgroundColor: 'white' }}>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Déchet</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Statut</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Prestataires</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Montant</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {bsds.map((bsd) => (
                        <tr key={bsd.id} style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                <div className="text-xs">
                                    <div>{bsd.infos_json.formAPI.createFormInput.wasteDetails.code}</div>
                                    <div>{bsd.infos_json.formAPI.createFormInput.wasteDetails.name}</div>
                                    <div>{bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity} tonnes</div>
                                </div>
                            </td>
                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                {
                                    bsd.status_track_dechets !== null ? 
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="text-xs">{bsd.status_track_dechets}</div>
                                            {bsd.status_track_dechets === "DRAFT" ?
                                                <div className="btn btn-primary btn-sm" onClick={() => handleSeal(bsd.id)}>Seller</div>
                                            : bsd.status_track_dechets === "SEALED" ?
                                                <div className="btn btn-primary btn-sm" onClick={() => handleSign(bsd.id)}>Signer</div>
                                            : bsd.status_track_dechets === "Brouillon Local" ?
                                                <div 
                                                    className="text-xs text-white font-thin btn btn-success bg-green-600 btn-sm flex flex-col items-center justify-center h-[40px] px-2" 
                                                    onClick={() => handleSendDraft(bsd)}
                                                >
                                                    <span>Envoyer sur</span>
                                                    <span className="-mt-1">TrackDéchets</span>
                                                </div>
                                            : null}
                                        </div>
                                    : 
                                    <div className="text-xs">...</div>
                                }
                            </td>
                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                <div className="text-xs ml-2">
                                    <div>🔽 {bsd.infos_json.formAPI.createFormInput.emitter.company.name}</div>
                                    <div>🚚 {bsd.infos_json.formAPI.createFormInput.transporter.company.name}</div>
                                    <div>♻ {bsd.infos_json.formAPI.createFormInput.recipient.company.name}</div>
                                </div>
                            </td>
                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                {
                                bsd.facture_treated ? 
                                    <div className="text-xs">
                                        {getSommeBSD(bsd.facture_infos)} € HT
                                    </div> 
                                : 
                                    <div className="text-xs">Pas encore lié à une facture</div>
                                }
                            </td>
                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                <div className="flex justify-center items-center gap-2 text-xs">
                                    {(bsd.status_track_dechets === 'DRAFT' || bsd.status_track_dechets === 'Brouillon Local') && (
                                        <button 
                                            className="bg-blue-400 text-white rounded-lg h-[30px] w-[70px] p-1" 
                                            onClick={() => handleModify(bsd.id)}
                                        >
                                            Modifier
                                        </button>
                                    )}
                                    {bsd.status_track_dechets !== 'DRAFT' && 
                                     bsd.status_track_dechets !== 'Brouillon Local' && (
                                        <button 
                                            className="bg-green-400 text-white rounded-lg h-[30px] w-[60px] p-1" 
                                            onClick={() => handleDisplay(bsd.id)}
                                        >
                                            Voir
                                        </button>
                                    )}
                                    <button 
                                        className="bg-red-400 text-white rounded-lg h-[30px] w-[70px] p-1" 
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
                    ))}
                </tbody>
            </table>
            
        </div>
    )
}

export default TableBSD
