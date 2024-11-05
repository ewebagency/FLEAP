import { useEffect, useState } from "react";
import { supabase } from "../database/supabaseClient";
import { useSession } from "../component/SessionProvider";
import { useModal } from "../component/context/ModalReloadcontext";

// Modifier le type FormDataType pour inclure un id
type BSD = {
    id: string;
    infos_json: {formAPI: FormAPI, formData: FormData};
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

const fetchBSDs = async (user_id: string | null) => {
    console.log("user_id : ", user_id);
    const { data, error } = await supabase
    .from('bsd')
    .select('id, infos_json')
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

    // Récupérer les BSDs de l'utilisateur
    useEffect(() => {
        const loadBSDs = async () => {
            if (session?.user?.id) {
                try {
                    const data = await fetchBSDs(session.user.id);
                    if (data) {
                        console.log("fetchBSDs : ", data);
                        setBSDs(data);
                        console.log("bsds : ", bsds);

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
        const result = await supabase.from('bsd').delete().eq('id', id);
        if (result.error) {
            console.error("Error deleting BSD:", result.error);
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
                    {bsds.slice().reverse().map((bsd) => (
                        <tr key={bsd.id} style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                <div className="text-xs">
                                    <div>{bsd.infos_json.formAPI.createFormInput.wasteDetails.code}</div>
                                    <div>{bsd.infos_json.formAPI.createFormInput.wasteDetails.name}</div>
                                    <div>{bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity} tonnes</div>
                                </div>
                            </td>
                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                <div className="text-xs">Brouillon[fixe]</div>
                            </td>
                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                <div className="text-xs ml-2">
                                    <div>🔽 {bsd.infos_json.formAPI.createFormInput.emitter.company.name}</div>
                                    <div>🚚 {bsd.infos_json.formAPI.createFormInput.transporter.company.name}</div>
                                    <div>♻ {bsd.infos_json.formAPI.createFormInput.recipient.company.name}</div>
                                </div>
                            </td>
                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                <div className="text-xs">- € HT[fixe]</div>
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
