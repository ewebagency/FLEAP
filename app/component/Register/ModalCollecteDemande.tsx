import React, { useEffect, useState } from "react";
import InputDeroulant from './InputDeroulant';
import InputText from './InputText';
import { useSession } from "../SessionProvider";
import { useSite } from "../context/SiteContext";
import ToggleDisplayInfosAPI from "./ToggleDisplayInfosAPI";
import { useModal } from "../context/ModalReloadcontext";
import { supabase } from "@/app/database/supabaseClient";

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
                postal_code: string[];
                city: string[];
            };
            siret: string[];
        };
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
                nom: string;
                prenom: string;
                tel: string;
                email: string;
            }[];
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

interface FormDataWithoutOptions {
    filiere: {
        first: string;
    };
    dechet: {
        first: {
            ced: string;
            description: string;
        };
    };
    contenant: {
        first: {
            nom: string;
            volume: string;
            nombre: string;
        };
    };
    site: {
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
        first: string;
    };
    personne_producteur: {
        first: {
            nom: string;
            prenom: string;
            tel: string;
            email: string;
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
    };
    dechet_details: {
        first: {
            ced: string;
            onu: string;
            description: string;
        };
    };
    mail?: {
        destinataire: string;
        cc: string[];
        sujet: string;
        message: string;
    };
}

const initialFormData: FormData = {
    filiere: {
        options: [],
        first: ''
    },
    dechet: {
        options: [],
        first: {
            ced: '',
            description: ''
        }
    },
    contenant: {
        options: [],
        first: {
            nom: '',
            volume: '',
            nombre: ''
        }
    },
    site: {
        options: {
            nom : [],
            adresse: {
                street: [],
                postal_code: [],
                city: []
            },
            siret: []
        },
        first: {
            nom: '',
            adresse: {
                street: '',
                postal_code: '',
                city: ''
            },
            siret: ''
        }
    },
    adresse_collecte: {
        options: [],
        first: ''
    },
    personne_producteur: {
        first: {
            nom: '',
            prenom: '',
            tel: '',
            email: ''
        },
        options: []
    },
    prestataire_final: {
        first: {
            code_traitement: '',
            cap: '',
            siret: '',
            nom: '',
            adresse: '',
            personne: {
                nom: '',
                prenom: '',
                tel: '',
                email: ''
            }
        },
        options: {
            code_traitement: [],
            cap: [],
            siret: [],
            nom: [],
            adresse: [],
            personne: [{
                nom: '',
                prenom: '',
                tel: '',
                email: ''
            }]
        }
    },
    transporteur: {
        first: {
            siret: '',
            nom: '',
            adresse: '',
            personne: {
                nom: '',
                prenom: '',
                email: '',
                tel: ''
            }
        },
        options: {
            siret: [],
            nom: [],
            adresse: [],
            personne: {
                nom: [],
                prenom: [],
                email: [],
                tel: []
            }
        }
    },
    dechet_details: {
        first: {
            ced: '',
            onu: '',
            description: ''
        },
        options: {
            ced: [],
            onu: [],
            description: []
        }
    }
};

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
};

const removeOptions = (formData: FormData) => {
    const resultData: FormDataWithoutOptions = {
        filiere: {
            first: formData.filiere.first,
        },
        dechet: {
            first: {
                ced: formData.dechet.first.ced,
                description: formData.dechet.first.description,
            },
        },
        contenant: {
            first: {
                nom: formData.contenant.first.nom,
                volume: formData.contenant.first.volume,
                nombre: formData.contenant.first.nombre,
            },
        },
        site: {
            first: {
                nom: formData.site.first.nom,
                adresse: {
                    street: formData.site.first.adresse.street,
                    postal_code: formData.site.first.adresse.postal_code,
                    city: formData.site.first.adresse.city,
                },
                siret: formData.site.first.siret,
            },
        },
        adresse_collecte: {
            first: formData.adresse_collecte.first,
        },
        personne_producteur: {
            first: {
                nom: formData.personne_producteur.first.nom,
                prenom: formData.personne_producteur.first.prenom,
                tel: formData.personne_producteur.first.tel,
                email: formData.personne_producteur.first.email,
            },
        },
        prestataire_final: {
            first: {
                code_traitement: formData.prestataire_final.first.code_traitement,
                cap: formData.prestataire_final.first.cap,
                siret: formData.prestataire_final.first.siret,
                nom: formData.prestataire_final.first.nom,
                adresse: formData.prestataire_final.first.adresse,
                personne: {
                    nom: formData.prestataire_final.first.personne.nom,
                    prenom: formData.prestataire_final.first.personne.prenom,
                    tel: formData.prestataire_final.first.personne.tel,
                    email: formData.prestataire_final.first.personne.email,
                },
            },
        },
        transporteur: {
            first: {
                siret: formData.transporteur.first.siret,
                nom: formData.transporteur.first.nom,
                adresse: formData.transporteur.first.adresse,
                personne: {
                    nom: formData.transporteur.first.personne.nom,
                    prenom: formData.transporteur.first.personne.prenom,
                    email: formData.transporteur.first.personne.email,
                    tel: formData.transporteur.first.personne.tel,
                },
            },
        },
        dechet_details: {
            first: {
                ced: formData.dechet_details.first.ced,
                onu: formData.dechet_details.first.onu,
                description: formData.dechet_details.first.description,
            },
        },
        mail: {
            destinataire: formData.mail?.destinataire || '',
            cc: formData.mail?.cc || [],
            sujet: formData.mail?.sujet || '',
            message: formData.mail?.message || '',
        },
    };
    return resultData;
}


const ModalCollecteDemande = ({ isOpen, setIsOpen, onClose }: { isOpen: boolean, setIsOpen: (value: boolean) => void, onClose: () => void }) => {
    const { sites } = useSite();
    const session = useSession();
    const [ready, setReady] = useState(false);
    const [optionsInit, setOptionsInit] = useState<[]|null>(null);
    const [formData, setFormData] = useState<FormData>(initialFormData);
    const [submitLoad, setSubmitLoad] = useState<boolean>(false);
    const { setModalReload, modalReload, modalId, setModalId, modalType, setModalType } = useModal();

    // Afficher le modal quand on clique sur le bouton "voir"
    useEffect(() => {
        const displayMyBSD = async (modalId: string) => {
            const { data, error } = await supabase.from('bsd').select('*').eq('id', modalId).single();
            if (data) {
                console.log("BSD data found:", data);
                setFormData(data.infos_json.formData);
            } else {
                console.log("No BSD data found or error:", error);
            }
        }
        if (modalType === "display" && modalId) {
            console.log("Fetching BSD for modalId:", modalId);
            displayMyBSD(modalId);
            setIsOpen(true);
        }
    }, [modalId, modalType]);

    //Aller chercher les options initiales de l'automcomplétion
    useEffect(() => {
        try{
            if(session && session.user && session.user.id && sites.length > 0 && modalType !== 'display'){
                const fetchOptionsInit = async () => {
                const response = await fetch(`/api/demande_collecte/infos_form_autocompletion?userId=${session.user.id}&site=${sites[0]}`);
                const data = await response.json();
                setOptionsInit(data);
            }
                fetchOptionsInit();
                console.log("optionsInit", optionsInit);
            }
        } catch (error) {
            console.error("Erreur lors de la récupération des données:", error);
        }
    }, [session, sites, onClose]);


    //Ajouter les options initials dans le formulaire
    useEffect(() => {
        if(optionsInit && modalType !== 'display'){
            setFormData((prevData) => ({...prevData, ...optionsInit}));
            console.log("formData", formData);
            setReady(true);
        }
    }, [optionsInit]);

    // Mise à jour de l'état à chaque modification
    const handleChange = async (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => {
        if (!e.target || !e.target.name) return;
        
        const { name, value } = e.target;
        
        // Gestion des cas spéciaux (site, filiere, dechet)
        if (session && session.user && session.user.id && (name === "site" || name === "filiere" || name === "dechet")) {
            if (name === "site"){
                console.log("site changée", name, value);
                const result = await fetch(process.env.NEXT_PUBLIC_SERVER_PYTHON + `/get-table-demande-collecte/?userId=${session.user.id}&site=${value}`);
                const data = await result.json();
                console.log("data changé de site", data);
                //setFormData(prevData => ({...prevData, site: {options: data.site.options, first: data.site.first}, filiere: {options: data.filiere.options, first: data.filiere.first}, dechet: {options: data.dechet.options, first: data.dechet.first}, adresse_collecte: {options: data.adresse_collecte.options, first: data.adresse_collecte.first}, personne_producteur: {options: data.personne_producteur.options, first: data.personne_producteur.first}}));
                setFormData(data);
            }
            else if(name === "filiere"){ 
                console.log("filière changée", name, value);
                console.log("formData.site", formData.site);
                const result = await fetch(process.env.NEXT_PUBLIC_SERVER_PYTHON + `/get-table-demande-collecte/?userId=${session.user.id}&site=${formData.site.first.nom}&filiere=${value}`);
                const data = await result.json();
                console.log("data", data);
                setFormData(data);
            } else if (name === "dechet") {
                const result = await fetch(process.env.NEXT_PUBLIC_SERVER_PYTHON + `/get-table-demande-collecte/?userId=${session.user.id}&site=${formData.site.first.nom}&filiere=${formData.filiere.first}&dechet=${value}`);
                const data = await result.json();
                setFormData(data);
            }
        } else {
            // Créer une copie profonde de formData
            const newFormData = JSON.parse(JSON.stringify(formData));
            
            // Diviser le chemin en segments
            const segments = name.split('.');
            
            // Naviguer dans l'objet et mettre à jour la valeur
            let current = newFormData;
            for (let i = 0; i < segments.length - 1; i++) {
                current = current[segments[i]];
            }
            current[segments[segments.length - 1]] = value;
            
            // Mettre à jour l'état avec le nouvel objet
            setFormData(newFormData);
            
            console.log('Updated formData:', newFormData); // Pour déboguer
        }
    };
    
    const handleSubmit = async (e:React.ChangeEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSubmitLoad(true);
        const formAPI = {
            "createFormInput": {
                "emitter": {
                    "type": "PRODUCER",
                    "workSite": {
                        "address": formData.site.first.adresse.street,
                        "postalCode": formData.site.first.adresse.postal_code,
                        "city": formData.site.first.adresse.city,
                        "infos": null
                    },
                    "company": {
                        "siret": '00000063963334',//ça doit être mon siret pour qu'il s'envoie sinon ça marche pas //String(formData.site.first.siret),
                        "name": formData.site.first.nom,
                        "address": formData.site.first.adresse.street + " " + formData.site.first.adresse.postal_code + " " + formData.site.first.adresse.city,
                        "contact": `${formData.personne_producteur.first.prenom} ${formData.personne_producteur.first.nom}`,
                        "phone": formData.personne_producteur.first.tel,
                        "mail": formData.personne_producteur.first.email
                    }
                },
                "recipient": {
                    "processingOperation": formData.prestataire_final.first.code_traitement,
                    "cap": formData.prestataire_final.first.cap,
                    "company": {
                        "siret": String(formData.prestataire_final.first.siret),
                        "name": formData.prestataire_final.first.nom,
                        "address": formData.prestataire_final.first.adresse,
                        "contact": `${formData.prestataire_final.first.personne.prenom} ${formData.prestataire_final.first.personne.nom}`,
                        "phone": formData.prestataire_final.first.personne.tel,
                        "mail": formData.prestataire_final.first.personne.email
                    }
                },
                "transporter": {
                    "company": {
                        "siret": String(formData.transporteur.first.siret),
                        "name": formData.transporteur.first.nom,
                        "address": formData.transporteur.first.adresse,
                        "contact": `${formData.transporteur.first.personne.prenom} ${formData.transporteur.first.personne.nom}`,
                        "mail": formData.transporteur.first.personne.email,
                        "phone": formData.transporteur.first.personne.tel
                    }
                },
                "wasteDetails": {
                    "code": formData.dechet_details.first.ced,
                    "onuCode": formData.dechet_details.first.onu || "Non Soumis",
                    "name": formData.dechet_details.first.description,
                    "packagingInfos": [
                        {
                            "type": 'FUT',//formData.contenant.first.nom, //FUT, GRV, CITERNE, BENNE, PIPELINE, AUTRE
                            "quantity": 1 // il faut un nmbre //parseInt(formData.contenant.first.nombre)
                        }
                    ],
                    "quantity": 1, //tonnes
                    "quantityType": "ESTIMATED",
                    "consistence": "LIQUID"
                }
            }
        };
        const formData_WithoutOptions = removeOptions(formData);
        console.log("formAPI", formAPI);

        try {
            const response = await fetch('/api/demande_collecte/creation_bsdd', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({user_id: session?.user.id, data: {formAPI:formAPI, formData:formData_WithoutOptions}}),
            });

            if (!response.ok) {
                throw new Error('Erreur lors de l\'envoi des données');
            }

            handleClose();
        } catch (error) {
            console.error("Erreur lors de l'envoi des données:", error);
        }
        setSubmitLoad(false);
    };

    const handleClose = () => {
        setFormData(initialFormData); // Réinitialiser le formulaire
        onClose(); // Fermer la modal
        setModalType("close");
        setModalId(null);
        setTimeout(() => {
            setModalReload(!modalReload);
        }, 1500);
    };

    const handleModify = async () => {
        try {
            setSubmitLoad(true);
            const formAPI = {
                "createFormInput": {
                    "emitter": {
                        "type": "PRODUCER",
                        "workSite": {
                            "address": formData.site.first.adresse.street,
                            "postalCode": formData.site.first.adresse.postal_code,
                            "city": formData.site.first.adresse.city,
                            "infos": null
                        },
                        "company": {
                            "siret": '00000063963334',//ça doit être mon siret pour qu'il s'envoie sinon ça marche pas //String(formData.site.first.siret),
                            "name": formData.site.first.nom,
                            "address": formData.site.first.adresse.street + " " + formData.site.first.adresse.postal_code + " " + formData.site.first.adresse.city,
                            "contact": `${formData.personne_producteur.first.prenom} ${formData.personne_producteur.first.nom}`,
                            "phone": formData.personne_producteur.first.tel,
                            "mail": formData.personne_producteur.first.email
                        }
                    },
                    "recipient": {
                        "processingOperation": formData.prestataire_final.first.code_traitement,
                        "cap": formData.prestataire_final.first.cap,
                        "company": {
                            "siret": String(formData.prestataire_final.first.siret),
                            "name": formData.prestataire_final.first.nom,
                            "address": formData.prestataire_final.first.adresse,
                            "contact": `${formData.prestataire_final.first.personne.prenom} ${formData.prestataire_final.first.personne.nom}`,
                            "phone": formData.prestataire_final.first.personne.tel,
                            "mail": formData.prestataire_final.first.personne.email
                        }
                    },
                    "transporter": {
                        "company": {
                            "siret": String(formData.transporteur.first.siret),
                            "name": formData.transporteur.first.nom,
                            "address": formData.transporteur.first.adresse,
                            "contact": `${formData.transporteur.first.personne.prenom} ${formData.transporteur.first.personne.nom}`,
                            "mail": formData.transporteur.first.personne.email,
                            "phone": formData.transporteur.first.personne.tel
                        }
                    },
                    "wasteDetails": {
                        "code": formData.dechet_details.first.ced,
                        "onuCode": formData.dechet_details.first.onu || "Non Soumis",
                        "name": formData.dechet_details.first.description,
                        "packagingInfos": [
                            {
                                "type": 'FUT',//formData.contenant.first.nom, //FUT, GRV, CITERNE, BENNE, PIPELINE, AUTRE
                                "quantity": 1 // il faut un nmbre //parseInt(formData.contenant.first.nombre)
                            }
                        ],
                        "quantity": 1, //tonnes
                        "quantityType": "ESTIMATED",
                        "consistence": "LIQUID"
                    }
                }
            };
            const formData_WithoutOptions = removeOptions(formData);
            const { error } = await supabase
                .from('bsd')
                .update({ 
                    infos_json: {
                        formAPI: formAPI,
                        formData: formData_WithoutOptions
                    }
                })
                .eq('id', modalId);

            if (error) throw error;

            // Reset and close modal
            handleClose();
            // Optionnel: Afficher une notification de succès
            console.log("Modification effectuée avec succès", formData);
            setSubmitLoad(false);
            
        } catch (error) {
            console.error('Erreur lors de la modification:', error);
            alert('Erreur lors de la modification');
            setSubmitLoad(false);
        }
    };

    return (
        <div>
            {isOpen && ready && 
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"> {/*onClick={handleClose}>*/}
                <div className="bg-white p-6 rounded-lg shadow-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                    <h3 className="font-bold text-lg">Demande de collecte</h3>
                    <form className="my-2 p-6 border-[1px] border-gray-400 rounded-xl" onSubmit={handleSubmit}>
                            { !(modalType==='display') && <div>
                            <div className='text-md font-bold'>Point de départ</div>
                            
                            <div className='flex justify-start gap-4 ml-8'>
                                <div>
                                    <InputDeroulant
                                            titre="Site" 
                                            placeholder="Sélectionner un site" 
                                            options={formData.site.options.nom} 
                                            width={2} 
                                            name="site" 
                                            value={formData.site.first.nom} 
                                            onChange={handleChange} 
                                        />
                                    <InputDeroulant
                                        titre="Adresse d'enlèvement"
                                        placeholder="Adresse"
                                        options={formData.adresse_collecte.options}
                                        width={2}
                                        name="adresse_enlevement"
                                        value={formData.adresse_collecte.options[0]}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div>
                                    <div className="w-[200px] h-[35px]"></div>
                                    <InputDeroulant
                                        titre="Personne référente"
                                        placeholder="Prénom Nom"
                                        options={formData.personne_producteur.options.map((personne:{prenom:string, nom:string}) => String(personne.prenom) + " " + String(personne.nom))}
                                        width={2}
                                        name="personne_a_contacter_prenom_nom"
                                        value={formData.personne_producteur.first.prenom + " " + formData.personne_producteur.first.nom}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>  
                            <div className='text-md font-bold mt-4'>Déchet</div>
                            <div className='flex justify-start gap-4 ml-8'>
                                <div>
                                    <InputDeroulant 
                                        titre="Filière" 
                                        placeholder="Sélectionner une filière" 
                                        options={formData.filiere.options} 
                                        width={2} 
                                        name="filiere" 
                                        value={formData.filiere.first} 
                                        onChange={handleChange} 
                                    />
                                    <InputDeroulant
                                        titre="Déchet" 
                                        placeholder="Sélectionner un déchet" 
                                        options={formData.dechet.options.map((dechet:{ced:string, description:string}) => String(dechet.ced) + " - " + String(dechet.description))} 
                                        width={2} 
                                        name="dechet" 
                                        value={formData.dechet.first.ced.toString() + " - " + formData.dechet.first.description} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div>
                                    <InputDeroulant
                                        titre="Contenant" 
                                        placeholder="Sélectionner un contenant" 
                                        options={formData.contenant.options.map((contenant:{nom:string, volume:string, nombre:string}) => String(contenant.nom) + " - " + String(contenant.volume))} 
                                        width={1} 
                                        name="contenant" 
                                        value={formData.contenant.first.nom + " - " + formData.contenant.first.volume} 
                                        onChange={handleChange} 
                                            />
                                    <InputDeroulant
                                        titre="Nombre" 
                                        placeholder="Nombre" 
                                        options={formData.contenant.options.length === 1 ? ['1','2','3','4','5'] : formData.contenant.options.map((contenant:{nombre:string}) => String(contenant.nombre))}
                                        width={1} 
                                        name="nombre_contenant" 
                                        value={formData.contenant.first.nombre} 
                                        onChange={handleChange} 
                                        />
                                </div>
                            </div>
                            <div className='text-md font-bold mt-4'>Contacte Collecte</div>
                            <div className='flex justify-start gap-4 ml-8'>
                                <InputDeroulant
                                    titre="Prestataire"
                                    placeholder="Sélectionner un prestataire final"
                                    options={formData.prestataire_final.options.personne.map((personne:{prenom:string, nom:string}) => String(personne.prenom) + " " + String(personne.nom))}
                                    width={1}
                                    name="prestataire_final"
                                    value={formData.prestataire_final.first.personne.prenom + " " + formData.prestataire_final.first.personne.nom}
                                    onChange={handleChange}
                                />
                                <InputDeroulant
                                    titre="Personne référente"
                                    placeholder="Prénom Nom"
                                    options={formData.prestataire_final.options.personne.map((personne:{prenom:string, nom:string}) => String(personne.prenom) + " " + String(personne.nom))}
                                    width={1}
                                    name="personne_referente"
                                    value={formData.prestataire_final.first.personne.prenom + " " + formData.prestataire_final.first.personne.nom}
                                    onChange={handleChange}
                                />
                            </div>
                            {/*<div className='bg-gray-300'>
                                <h3 className="font-bold text-md mt-10">Envoie Mail -- plus tard</h3>
                                <div className='flex justify-start gap-4 items-center'>
                                    <div className='mr-2 mt-9 text-md w-[80px]'>Email :</div>
                                    <InputDeroulant 
                                        titre="Prestataire destinataire" 
                                        placeholder="Prestataire" 
                                        options={['Incineration&Co', 'RecyclageInc']} 
                                        width={1} 
                                        name="prestataire_destinataire" 
                                        value={formData.mail?.prestataire_destinataire || ''} 
                                        onChange={handleChange} 
                                    />
                                    <InputDeroulant 
                                        titre="Modèle d'email" 
                                        placeholder="Modèle d'email" 
                                        options={['Rapide', 'Long']} 
                                        width={1} 
                                        name="modele_email" 
                                        value={formData.mail?.modele_email || ''} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div className='flex justify-start gap-4 items-center h-[70px]'>
                                    <div className='mr-2 mt-0 text-md w-[80px]'>À :</div>
                                    <InputText 
                                        titre="" 
                                        placeholder="exemple@prestataire.fr" 
                                        type="email" 
                                        width={2} 
                                        name="a" 
                                        value={formData.mail?.destinataire || ''} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div className='flex justify-start gap-4 items-center h-[50px]'>
                                    <div className='mr-2 mt-0 text-md w-[80px]'>Sujet :</div>
                                    <InputText 
                                        titre="" 
                                        placeholder="Demande de collecte" 
                                        type="text" 
                                        width={2} 
                                        name="sujet" 
                                        value={formData.mail?.sujet || ''} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div className='flex justify-start gap-4 items-center h-[70px] mt-3'>
                                    <div className='mr-2 mt-0 text-md w-[80px]'>Message :</div>
                                    <textarea 
                                        className="input input-bordered w-[460px] h-[72px]" 
                                        placeholder="Votre message ici..." 
                                        rows={3} 
                                        name="message" 
                                        value={formData.mail?.message || ''} 
                                        onChange={handleChange} 
                                    ></textarea>
                                </div>
                            </div>*/}
                        </div>}
                        
                        <ToggleDisplayInfosAPI data={formData} onChange={handleChange}/>

                        <div className="modal-action">
                            <button type="button" id="fermer-btn" className="btn" onClick={handleClose}>Fermer</button>
                            { modalType === "display" 
                            ? <button type="button" id="modifier-btn" className="btn" onClick={handleModify} disabled={submitLoad}>{submitLoad ? "En cours..." : "Modifier"}</button>
                            : <button type="submit" id="envoyer-btn" className="btn" disabled={submitLoad}>{submitLoad ? "En cours..." : "Envoyer"}</button>}
                        </div>
                    </form>
                </div>
            </div>}
            
        </div>
    )
}

export default ModalCollecteDemande;
