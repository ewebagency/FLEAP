import { useEffect, useState } from "react";
import { supabase } from "../database/supabaseClient";
import { useSession } from "../component/SessionProvider";
import { useModal } from "../component/context/ModalReloadcontext";

// Modifier le type FormDataType pour inclure un id
type BSD = {
    id: string;
    infos_json: {formAPI: FormAPI, formData: FormData};
    facture_treated: boolean;
    facture_infos: {
        ligne_compta_traitement: {montant_ht: number}, 
        ligne_compta_tgap: {montant_ht: number}, 
        ligne_compta_contenant: {montant_ht: number},
        ligne_compta_transport: {montant_ht: number},
        ligne_compta_preparation: {montant_ht: number},
        ligne_compta_rachat_matiere: {montant_ht: number}
    };
    status_track_dechets: string;
    id_track_dechets: string;

};

interface FormData {
    filiere: {
        options: string[];
        first: string;
    };
    dechet: {
        options: {
            ced: string;
            description: string;
        }[];
        first: {
            ced: string;
            description: string;
        };
    };
    contenant: {
        options: {
            nom: string;
            volume: string;
            nombre: string;
        }[];
        first: {
            nom: string;
            volume: string;
            nombre: string;
        };
    };
    site: {
        options: {
            nom : string[];
            adresse: {
                street: string[];
                postal_code: string;
                city: string;
            };
            siret: string;
        }[];
        first: {
            nom: string;
            adresse: {
                street: string;
                postal_code: string;
                city: string;
            };
            siret: string;
        };
    };
    adresse_collecte: {
        options: string[];
        first: string;
    };
    personne_producteur: {
        first: {
            nom: string;
            prenom: string;
            tel: string;
            email: string;
        };
        options: {
            nom: string;
            prenom: string;
            telephone: string;
            email: string;
        }[];
    };
    site_details: {
        first: {
            adresse: string;
            siret: string;
            nom: string;
        };
        options: {
            adresse: string[];
            siret: string[];
            nom: string[];
        };
    };
    prestataire_final: {
        first: {
            code_traitement: string;
            cap: string;
            siret: string;
            nom: string;
            adresse: string;
            personne: {
                nom: string;
                prenom: string;
                tel: string;
                email: string;
            };
        };
        options: {
            code_traitement: string[];
            cap: string[];
            siret: string[];
            nom: string[];
            adresse: string[];
            personne: {
                nom: string[];
                prenom: string[];
                tel: string[];
                email: string[];
            };
        };
    };
    transporteur: {
        first: {
            siret: string;
            nom: string;
            adresse: string;
            personne: {
                nom: string;
                prenom: string;
                email: string;
                tel: string;
            };
        };
        options: {
            siret: string[];
            nom: string[];
            adresse: string[];
            personne: {
                nom: string[];
                prenom: string[];
                email: string[];
                tel: string[];
            };
        };
    };
    dechet_details: {
        first: {
            ced: string;
            onu: string;
            description: string;
        };
        options: {
            ced: string[];
            onu: string[];
            description: string[];
        };
    };
    mail?: {
        destinataire: string;
        cc: string[];
        sujet: string;
        message: string;
    };
}

interface FormAPI {
    createFormInput: {
        emitter: {
                type: string,
                workSite: {
                    address: string,
                    postalCode: string,
                    city: string,
                    infos: null
                },
                company: {
                    siret: string,
                    name: string,
                    address: string,
                    contact: string,
                    phone: string,
                    mail: string
            }
        },
        recipient: {
            processingOperation: string,
                cap: string,
                company: {
                    siret: string,
                    name: string,
                    address: string,
                    contact: string,
                    phone: string,
                    mail: string
                }
            },
            transporter: {
                company: {
                    siret: string,
                    name: string,
                    address: string,
                    contact: string,
                    mail: string,
                    phone: string
                }
            },
            wasteDetails: {
                code: string,
                onuCode: string,
                name: string,
                packagingInfos: [
                    {
                        type: string, //FUT, GRV, CITERNE, BENNE, PIPELINE, AUTRE
                        quantity: number // il faut un nmbre //parseInt(formData.contenant.first.nombre)
                    }
                ],
                quantity: number, //tonnes
                quantityType: string,
                consistence: string
            }
        }
}

const getSommeBSD = (facture_infos: BSD['facture_infos']) => {
    return facture_infos.ligne_compta_traitement.montant_ht + facture_infos.ligne_compta_tgap.montant_ht + facture_infos.ligne_compta_contenant.montant_ht + facture_infos.ligne_compta_transport.montant_ht + facture_infos.ligne_compta_preparation.montant_ht + facture_infos.ligne_compta_rachat_matiere.montant_ht;
}

const fetchBSDs = async (user_id: string | null) => {
    console.log("user_id : ", user_id);
    const { data, error } = await supabase
    .from('bsd')
    .select('id, created_at, infos_json, facture_treated, facture_infos, status_track_dechets, id_track_dechets')
    .eq('user_id', user_id);
    if(error){
        console.error("Error fetching BSD:", error);
    } else {
        console.log("BSDs fetched");
        return data;
    }
}

const TableBSD = () => {
    const session = useSession();
    const [bsds, setBSDs] = useState<BSD[]>([]);
    const { modalReload, setModalReload, modalId, setModalId, modalType, setModalType } = useModal();
    const [webhooksInitialized, setWebhooksInitialized] = useState(false);

    // Fonction pour vérifier et initialiser les webhooks
    const initializeWebhooks = async () => {
        try {
            // Vérifier si les webhooks existent
            const response = await fetch('/api/demande_collecte/web_hook/get_webhooks');
            const data = await response.json();
            
            console.log('data_web_hooks', data);
            console.log('condition 1', !data.webhooks);
            console.log('condition 3', data.webhooks.activated === false);
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
            if (session?.user?.id) {
                try {
                    const data = await fetchBSDs(session.user.id);
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
    }, [session, modalReload, modalId, modalType]);


    const handleDelete = async (id: string) => {
        const result = await fetch('/api/demande_collecte/delete_bsd', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        });
        const data = await result.json();
        if (data.error) {
            console.error("Error deleting BSD:", data.error);
        } else {
            console.log("BSD deleted");
            setModalReload(!modalReload);
        }
    }

    const handleDisplay = (id: string) => {
        setModalId(id);
        setModalType("display");
        console.log("id : ", id);
    }

    const handleSeal = async (id: string) => {
        const result = await fetch('/api/demande_collecte/seal_bsd', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        });
        const data = await result.json();
        if (data.error) {
            console.error("Error sealing BSD:", data.error);
        } else {
            console.log("BSD sealed");
            setModalReload(!modalReload);
        }
    }

    const handleSign = async (id: string) => {
        const result = await fetch('/api/demande_collecte/sign_bsd', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        });
        const data = await result.json();
        if (data.error) {
            console.error("Error signing BSD:", data.error);
        } else {
            console.log("BSD signed");
            setModalReload(!modalReload);
        }
    }

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
                                        <div className="flex items-center justify-center gap-4">
                                            <div className="text-xs">{bsd.status_track_dechets}</div>
                                            {bsd.status_track_dechets === "DRAFT" ?
                                                <div className="btn btn-primary btn-sm" onClick={() => handleSeal(bsd.id)}>Seller</div>
                                            : bsd.status_track_dechets === "SEALED" ?
                                                <div className="btn btn-primary btn-sm" onClick={() => handleSign(bsd.id)}>Signer</div>
                                            : null}
                                        </div>
                                    : 
                                    <div className="text-xs">Sur FLEAP uniquement</div>
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
                                    <button id="display" className="bg-green-400 text-white rounded-lg h-[30px] w-[90px] p-1" onClick={() => handleDisplay(bsd.id)}>Voir et modifier</button>
                                    <button id="delete" className="bg-red-400 text-white rounded-lg h-[30px] w-[70px] p-1" onClick={() => handleDelete(bsd.id)}>Supprimer</button>
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
