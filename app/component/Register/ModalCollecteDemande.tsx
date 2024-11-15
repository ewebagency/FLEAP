import React, { useEffect, useState } from "react";
import InputDeroulant from './InputDeroulant';
//import InputText from './InputText';
import { useSession } from "../SessionProvider";
import { useSite } from "../context/SiteContext";
import ToggleDisplayInfosAPI from "./ToggleDisplayInfosAPI";
import { useModal } from "../context/ModalReloadcontext";
import { supabase } from "@/app/database/supabaseClient";
import { BSD_Data_Interface, BSD_Data_Interface_WithoutOptions, Gouv } from "@/app/register/interface/BSD_Interface";
//import { type } from "os";
import { toast, Toaster } from 'react-hot-toast';

const getWeightEstimation = (
  volume: string,        // Volume exprimé en L ou m3 (ex: '200L' ou '15m3')
  consistance: string, // Consistance ('Solide' ou 'Liquide')
  nbBacs: number         // Nombre de bacs
): number => {
  // Masse volumique en kg/L pour chaque type de déchet
  const density = consistance === "Solide" ? 0.8 : 1;  // Solide = 0.8 kg/L, Liquide = 1 kg/L (approximation)

  // Convertir le volume en L si c'est en m3
  const volumeInLiters = volume.includes('m3')
    ? parseFloat(volume) * 1000  // Conversion m3 en L
    : parseFloat(volume);        // Si volume est déjà en L
  
  // Poids estimé par bac
  const totalWeight = volumeInLiters * density * nbBacs / 1000;  // Poids total estimé en tonnes

  return totalWeight;
};

const getVolumeEstimation = (unitaire: string, indicatif: number) => {
    let type = "L";
    if (unitaire.includes("m3")) {
        type = "m3";
    }
    const unitaire_number = Number(unitaire.replace(type, ""));
    const multiplier = type === "m3" ? 1000 : 1;
    return unitaire_number*indicatif*multiplier;
}

interface Form_API_Interface {
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

const extractSiret = (number: string) => {
    // Vérifie si le numéro est un SIRET (14 chiffres consécutifs)
    const siretPattern = /^\d{14}$/;
    if (siretPattern.test(number)) {
      return number;
    }
  
    // Vérifie si le numéro est un numéro de TVA (FR + 2 chiffres + 9 chiffres pour le SIREN)
    const tvaPattern = /^FR\d{2}(\d{9})$/;
    const matchTva = number.match(tvaPattern);
    if (matchTva) {
      return matchTva[1] + '00000'; // Compléter avec 00000 pour obtenir un SIRET
    }
  
    // Retourne null si aucun SIRET ou TVA valide trouvé
    return null;
}
  
const getRaisonSocial = async (siret_tva: string): Promise<Gouv> => {
    const siret = extractSiret(siret_tva);
    if (!siret) {
        //console.log("siret non trouvé", siret_tva);
        return { raison: { first: '' }, adresse: { first: '' } };
    }

    try {
        const response = await fetch(`/api/demande_collecte/infos_siren?siret=${siret}`);
        if (!response.ok) {
            //console.log('response non ok', response);
            return { raison: { first: '' }, adresse: { first: '' } };
        }
        
        const data = await response.json();
        //console.log('gouuv', data);
        return data; // L'API renvoie déjà le bon format
        
    } catch (error) {
        console.error('Erreur getRaisonSocial:', error);
        return { raison: { first: '' }, adresse: { first: '' } };
    }
};

const removeOptions = async (formData: BSD_Data_Interface): Promise<BSD_Data_Interface_WithoutOptions> => {
    const resultData: BSD_Data_Interface_WithoutOptions = {
        filiere: {
            nom: {first: formData.filiere.nom.first},
            ced: {first: formData.filiere.ced.first},
            consistance: {first: formData.filiere.consistance.first},
            cap: {first: formData.filiere.cap.first},
        },
        dechet_dangereux: {
            ced: {first: formData.dechet_dangereux.ced.first},
            onu: {first: formData.dechet_dangereux.onu.first},
            denomination: {first: formData.dechet_dangereux.denomination.first},
            danger: {first: formData.dechet_dangereux.danger.first},
            emballage: {first: formData.dechet_dangereux.emballage.first},
            collecte: {first: formData.dechet_dangereux.collecte.first}, //adresse de collecte
        },
        contenant: {
            nom: {first: formData.contenant.nom.first},
            code: {first: formData.contenant.code.first},
            identifiant: {first: formData.contenant.identifiant.first},
            description: {first: formData.contenant.description.first},
            unitaire: {first: formData.contenant.unitaire.first}, //volume unitaire
            indicatif: {first: formData.contenant.indicatif.first}, //nombre indicatif
            location: {first: formData.contenant.location.first}, //proprio ou location
            siret: {first: formData.contenant.siret.first}, //siret de prestataire qui loue les contenants
            gouv: await getRaisonSocial(String(formData.contenant.siret.first)),
        },
        site: {
            nom: {first: formData.site.nom.first},
            siret: {first: formData.site.siret.first},
            gouv: await getRaisonSocial(String(formData.site.siret.first)),
            adresse: {first: formData.site.adresse.first},
            gerep: {first: formData.site.gerep.first},
        },
        producteur_personne: {
            lastname: {first: formData.producteur_personne.lastname.first},
            firstname: {first: formData.producteur_personne.firstname.first},
            tel: {first: formData.producteur_personne.tel.first},
            email: {first: formData.producteur_personne.email.first},
        },
        operationnelle_personne: {
            lastname: {first: formData.operationnelle_personne.lastname.first},
            firstname: {first: formData.operationnelle_personne.firstname.first},
            tel: {first: formData.operationnelle_personne.tel.first},
            email: {first: formData.operationnelle_personne.email.first},
        },
        prestataire_final: {
            nom: {first: formData.prestataire_final.nom.first},
            siret: {first: formData.prestataire_final.siret.first},
            gouv: await getRaisonSocial(String(formData.prestataire_final.siret.first)),
            adresse: {first: formData.prestataire_final.adresse.first},
            numero: {first: formData.prestataire_final.numero.first},
            traitement: {first: formData.prestataire_final.traitement.first}, //code de traitement (R5)
            qualification: {first: formData.prestataire_final.qualification.first}, //qualification du traitement (recyclage ou incinération)
            lastname: {first: formData.prestataire_final.lastname.first},
            firstname: {first: formData.prestataire_final.firstname.first},
            tel: {first: formData.prestataire_final.tel.first},
            email: {first: formData.prestataire_final.email.first},
        },
        transporteur: {
            siret: {first: formData.transporteur.siret.first},
            gouv: await getRaisonSocial(String(formData.transporteur.siret.first)),
            nom: {first: formData.transporteur.nom.first},
            adresse: {first: formData.transporteur.adresse.first},
            numero: {first: formData.transporteur.numero.first},
            lastname: {first: formData.transporteur.lastname.first},
            firstname: {first: formData.transporteur.firstname.first},
            tel: {first: formData.transporteur.tel.first},
            email: {first: formData.transporteur.email.first},
        },
        installation_intermediaire: {
            nom: {first: formData.installation_intermediaire.nom.first},
            siret: {first: formData.installation_intermediaire.siret.first},
            gouv: await getRaisonSocial(String(formData.installation_intermediaire.siret.first)),
            adresse: {first: formData.installation_intermediaire.adresse.first},
            numero: {first: formData.installation_intermediaire.numero.first},
            traitement: {first: formData.installation_intermediaire.traitement.first},
            lastname: {first: formData.installation_intermediaire.lastname.first},
            firstname: {first: formData.installation_intermediaire.firstname.first},
            tel: {first: formData.installation_intermediaire.tel.first},
            email: {first: formData.installation_intermediaire.email.first},
        },
        eco_organisme: {
            nom: {first: formData.eco_organisme.nom.first},
            siret: {first: formData.eco_organisme.siret.first},
            gouv: await getRaisonSocial(String(formData.eco_organisme.siret.first)),
        },
        negociant: {
            nom: {first: formData.negociant.nom.first},
            siret: {first: formData.negociant.siret.first},
            gouv: await getRaisonSocial(String(formData.negociant.siret.first)),
            adresse: {first: formData.negociant.adresse.first},
            numero: {first: formData.negociant.numero.first},
            lastname: {first: formData.negociant.lastname.first},
            firstname: {first: formData.negociant.firstname.first},
            tel: {first: formData.negociant.tel.first},
            email: {first: formData.negociant.email.first},
        },
        date: {collecte: {first: formData.date.collecte.first}},
        volume: {first: getVolumeEstimation(formData.contenant.unitaire.first, formData.contenant.indicatif.first)}, //Volume toujours en litre
        estimated_weight: {first: getWeightEstimation(formData.contenant.unitaire.first, formData.filiere.consistance.first, Number(formData.contenant.indicatif.first))},
    };
    return Promise.resolve(resultData);
};

const initialFormData : BSD_Data_Interface = {
    site: {
        nom: {first: '', options: []},
        siret: {first: null, options: []},
        adresse: {
            first: {
                street: '',
                postal_code: '',
                city: '',
                fulladdress: '',
            },
            options: []
        },
        gerep: {first: null, options: []},
    },
    filiere: {
        nom: {first: '', options: []},
        ced: {first: '', options: []}   ,
        consistance: {first: '', options: []},
        cap: {first: '', options: []},
    },
    dechet_dangereux: {
        ced: {first: '', options: []},
        onu: {first: '', options: []},
        denomination: {first: '', options: []},
        danger: {first: '', options: []},
        emballage: {first: '', options: []},
        collecte: {first: null, options: []},
    },
    producteur_personne: {
        lastname: {first: '', options: []},
        firstname: {first: '', options: []},
        tel: {first: '', options: []},
        email: {first: '', options: []},
    },
    operationnelle_personne: {
        lastname: {first: '', options: []},
        firstname: {first: '', options: []},
        tel: {first: '', options: []},
        email: {first: '', options: []},
    },
    contenant: {
        nom: {first: null, options: []},
        code: {first: '', options: []},
        identifiant: {first: null, options: []},
        description: {first: '', options: []},
        unitaire: {first: '', options: []},
        indicatif: {first: 0, options: []},
        location: {first: '', options: []},
        siret: {first: null, options: []},
    },
    eco_organisme: {
        nom: {first: '', options: []},
        siret: {first: '', options: []},
    },
    negociant: {
        nom: {first: null, options: []},
        siret: {first: null, options: []},
        adresse: {first: '', options: []},
        numero: {first: null, options: []},
        lastname: {first: '', options: []},
        firstname: {first: '', options: []},
        tel: {first: null, options: []},
        email: {first: null, options: []},
    },
    transporteur: {
        nom: {first: '', options: []},
        siret: {first: 0, options: []},
        adresse: {first: '', options: []},
        numero: {first: '', options: []},
        lastname: {first: '', options: []},
        firstname: {first: '', options: []},
        tel: {first: '', options: []},
        email: {first: '', options: []},
    },
    installation_intermediaire: {
        nom: {first: '', options: []},
        siret: {first: '', options: []},
        adresse: {first: '', options: []},
        numero: {first: null, options: []},
        traitement: {first: '', options: []},
        lastname: {first: '', options: []},
        firstname: {first: '', options: []},
        tel: {first: '', options: []},
        email: {first: '', options: []},
    },
    prestataire_final: {
        nom: {first: '', options: []},
        siret: {first: null, options: []},
        adresse: {first: '', options: []},
        numero: {first: null, options: []},
        traitement: {first: '', options: []},
        qualification: {first: '', options: []},
        lastname: {first: '', options: []},
        firstname: {first: '', options: []},
        tel: {first: '', options: []},
        email: {first: '', options: []},
    },
    date: {collecte: {first: ''}}
};

function combineLists(separator: string, ...lists: string[][]) {
    const minLength = Math.max(...lists.map(list => list.length)); // Longueur minimale parmi toutes les listes
  
    return Array.from({ length: minLength }, (_, index) =>
      lists.map(list => list[index]).join(separator) // Combine les éléments de chaque liste à l'index courant
    );
  }

interface ModalCollecteDemandeProps {
    isOpen: boolean;
    setIsOpen: (value: boolean) => void;
    onClose: () => void;
    ready: boolean;
    setReady: (value: boolean) => void;
}

const ModalCollecteDemande = ({ isOpen, setIsOpen, onClose, ready, setReady }: ModalCollecteDemandeProps) => {
    const { sites } = useSite();
    const session = useSession();
    //const [ready, setReady] = useState(false);
    const [optionsInit, setOptionsInit] = useState<[]|null>(null);
    const [formData, setFormData] = useState<BSD_Data_Interface>(initialFormData);
    const [submitLoad, setSubmitLoad] = useState<boolean>(false);
    const { setModalReload, modalReload, modalId, setModalId, modalType, setModalType } = useModal();
    const [changeLoad, setChangeLoad] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

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
            /*if(!changeLoad){
                setChangeLoad(true);
            }*/
        }
    }, [optionsInit]);

    // Mise à jour de l'état à chaque modification
    const handleChange = async (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => {
        setChangeLoad(true);
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
                const result = await fetch(process.env.NEXT_PUBLIC_SERVER_PYTHON + `/get-table-demande-collecte/?userId=${session.user.id}&site=${formData.site.nom.first}&filiere=${value}`);
                const data = await result.json();
                console.log("data", data);
                setFormData(data);
            } else if (name === "dechet") {
                try{    
                    console.log("dechet changé", name, value);
                    const result = await fetch(process.env.NEXT_PUBLIC_SERVER_PYTHON + `/get-table-demande-collecte/?userId=${session.user.id}&site=${formData.site.nom.first}&filiere=${formData.filiere.nom.first}&dechet=${value}`);
                    const data = await result.json();
                    setFormData(data);
                } catch (error) {
                    console.error("Erreur lors de la récupération des données:", error);
                    alert("Veuillez remplir les champs filière avant");
                }
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
        setChangeLoad(false);
    };
    
    const handleSubmit = async (e: React.ChangeEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSubmitLoad(true);
        setError(null);

        const formAPI: Form_API_Interface = {
            "createFormInput": {
                "emitter": {
                    "type": "PRODUCER",
                    "workSite": {
                        "address": formData.site.adresse.first.street,
                        "postalCode": formData.site.adresse.first.postal_code,
                        "city": formData.site.adresse.first.city,
                        "infos": null
                    },
                    "company": {
                        "siret": String(process.env.NEXT_PUBLIC_FLEAP_SIRET),//ça doit être mon siret pour qu'il s'envoie sinon ça marche pas //String(formData.site.siret),
                        "name": formData.site.nom.first,
                        "address": formData.site.adresse.first.street + " " + formData.site.adresse.first.postal_code + " " + formData.site.adresse.first.city,
                        "contact": `${formData.producteur_personne.firstname.first} ${formData.producteur_personne.lastname.first}`,
                        "phone": formData.producteur_personne.tel.first,
                        "mail": formData.producteur_personne.email.first
                    }
                },
                "recipient": {
                    "processingOperation": formData.prestataire_final.traitement.first,
                    "cap": formData.filiere.cap.first,
                    "company": {
                        "siret": String(formData.prestataire_final.siret.first),
                        "name": formData.prestataire_final.nom.first,
                        "address": formData.prestataire_final.adresse.first,
                        "contact": `${formData.prestataire_final.firstname.first} ${formData.prestataire_final.lastname.first}`,
                        "phone": formData.prestataire_final.tel.first,
                        "mail": formData.prestataire_final.email.first
                    }
                },
                "transporter": {
                    "company": {
                        "siret": String(formData.transporteur.siret.first),
                        "name": formData.transporteur.nom.first,
                        "address": formData.transporteur.adresse.first,
                        "contact": `${formData.transporteur.firstname.first} ${formData.transporteur.lastname.first}`,
                        "mail": formData.transporteur.email.first,
                        "phone": formData.transporteur.tel.first
                    }
                },
                "wasteDetails": {
                    "code": formData.dechet_dangereux.ced.first,
                    "onuCode": String(formData.dechet_dangereux.onu.first) || "Non Soumis",
                    "name": formData.dechet_dangereux.denomination.first,
                    "packagingInfos": [
                        {
                            "type": formData.contenant.code.first, //FUT, GRV, CITERNE, BENNE, PIPELINE, AUTRE
                            "quantity": formData.contenant.indicatif.first // il faut un nmbre //parseInt(formData.contenant.first.nombre)
                        }
                    ],
                    "quantity": getWeightEstimation(formData.contenant.unitaire.first, formData.filiere.consistance.first, formData.contenant.indicatif.first),
                    "quantityType": "ESTIMATED",
                    "consistence": formData.filiere.consistance.first
                }
            }
        };
        const formData_WithoutOptions : BSD_Data_Interface_WithoutOptions = await removeOptions(formData);
        console.log("formAPI", formAPI);

        try {
            const response = await fetch('/api/demande_collecte/creation_bsdd', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: session?.user.id, 
                    data: {
                        formAPI: formAPI, 
                        formData: formData_WithoutOptions
                    }
                }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Erreur lors de l\'envoi des données');
            }

            toast.success('BSD créé avec succès dans TrackDéchets');
            handleClose();

        } catch (error) {
            console.error("Erreur:", error);
            setError(error.message);
            toast.error(`Erreur: ${error.message}`);
        } finally {
            setSubmitLoad(false);
        }
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
            const formAPI : Form_API_Interface = {
                "createFormInput": {
                    "emitter": {
                        "type": "PRODUCER",
                        "workSite": {
                            "address": formData.site.adresse.first.street,
                            "postalCode": formData.site.adresse.first.postal_code,
                            "city": formData.site.adresse.first.city,
                            "infos": null
                        },
                        "company": {
                            "siret": String(process.env.NEXT_PUBLIC_FLEAP_SIRET),//ça doit être mon siret pour qu'il s'envoie sinon ça marche pas //String(formData.site.siret),
                            "name": formData.site.nom.first,
                            "address": formData.site.adresse.first.street + " " + formData.site.adresse.first.postal_code + " " + formData.site.adresse.first.city,
                            "contact": `${formData.producteur_personne.firstname.first} ${formData.producteur_personne.lastname.first}`,
                            "phone": formData.producteur_personne.tel.first,
                            "mail": formData.producteur_personne.email.first
                        }
                    },
                    "recipient": {
                        "processingOperation": formData.prestataire_final.traitement.first,
                        "cap": formData.filiere.cap.first,
                        "company": {
                            "siret": String(formData.prestataire_final.siret.first),
                            "name": formData.prestataire_final.nom.first,
                            "address": formData.prestataire_final.adresse.first,
                            "contact": `${formData.prestataire_final.firstname.first} ${formData.prestataire_final.lastname.first}`,
                            "phone": formData.prestataire_final.tel.first,
                            "mail": formData.prestataire_final.email.first
                        }
                    },
                    "transporter": {
                        "company": {
                            "siret": String(formData.transporteur.siret.first),
                            "name": formData.transporteur.nom.first,
                            "address": formData.transporteur.adresse.first,
                            "contact": `${formData.transporteur.firstname.first} ${formData.transporteur.lastname.first}`,
                            "mail": formData.transporteur.email.first,
                            "phone": formData.transporteur.tel.first
                        }
                    },
                    "wasteDetails": {
                        "code": formData.dechet_dangereux.ced.first,
                        "onuCode": String(formData.dechet_dangereux.onu.first) || "Non Soumis",
                        "name": formData.dechet_dangereux.denomination.first,
                        "packagingInfos": [
                            {
                                "type": formData.contenant.code.first, //FUT, GRV, CITERNE, BENNE, PIPELINE, AUTRE
                                "quantity": formData.contenant.indicatif.first // il faut un nmbre //parseInt(formData.contenant.first.nombre)
                            }
                        ],
                        "quantity": getWeightEstimation(formData.contenant.unitaire.first, formData.filiere.consistance.first, formData.contenant.indicatif.first),
                        "quantityType": "ESTIMATED",
                        "consistence": formData.filiere.consistance.first
                    }
                }
            };
            const formData_WithoutOptions : BSD_Data_Interface_WithoutOptions = await removeOptions(formData);
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

    // Mettre à jour le parent quand ready change
    useEffect(() => {
        setReady(ready);
    }, [ready, setReady]);

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
                                            titre="1. Site" 
                                            placeholder="Sélectionner un site" 
                                            options={formData.site.nom.options} 
                                            width={2} 
                                            name="site" 
                                            value={formData.site.nom.first} 
                                            onChange={handleChange} 
                                            changeLoad={changeLoad}
                                        />
                                    <InputDeroulant
                                        titre="Adresse d'enlèvement"
                                        placeholder="Adresse"
                                        options={formData.site.adresse.options}
                                        width={2}
                                        name="adresse_enlevement"
                                        value={formData.site.adresse.first.street + " " + formData.site.adresse.first.postal_code + " " + formData.site.adresse.first.city}
                                        onChange={handleChange}
                                        enabled={false}
                                        changeLoad={changeLoad}
                                    />
                                </div>
                                <div>
                                    <div className="mt-3 ml-4 w-[350px] h-[25px] text-xs text-gray-400">▶ Pour ajuster les informations, remplissez les champs plus bas</div>
                                    <InputDeroulant
                                        titre="Personne référente"
                                        placeholder="Prénom Nom"
                                        options={combineLists(' ', formData.producteur_personne.firstname.options, formData.producteur_personne.lastname.options)}
                                        width={2}
                                        name="personne_a_contacter_prenom_nom"
                                        value={`${formData.producteur_personne.firstname.first} ${formData.producteur_personne.lastname.first}`}
                                        onChange={handleChange}
                                        enabled={false}
                                        changeLoad={changeLoad}
                                    />
                                </div>
                            </div>  
                            <div className='text-md font-bold mt-4'>Déchet</div>
                            <div className='flex justify-start gap-4 ml-8'>
                                <div>
                                    <InputDeroulant 
                                        titre="2. Filière" 
                                        placeholder="Sélectionner une filière" 
                                        options={formData.filiere.nom.options}
                                        width={2} 
                                        name="filiere" 
                                        value={formData.filiere.nom.first} 
                                        onChange={handleChange} 
                                        changeLoad={changeLoad}
                                    />
                                    <InputDeroulant
                                        titre="3. Déchet" 
                                        placeholder="Sélectionner un déchet" 
                                        options={formData.dechet_dangereux.ced.options}//{combineLists(' - ',formData.dechet_dangereux.ced.options, formData.dechet_dangereux.denomination.options)}
                                        width={2} 
                                        name="dechet" 
                                        value={formData.dechet_dangereux.ced.first}//{formData.dechet_dangereux.ced.first.toString() + " - " + formData.dechet_dangereux.denomination.first} 
                                        onChange={handleChange}
                                        changeLoad={changeLoad}
                                    />
                                </div>
                                <div>
                                    <InputDeroulant
                                        titre="Contenant" 
                                        placeholder="Sélectionner un contenant" 
                                        options={combineLists(' / ',formData.contenant.description.options, formData.contenant.location.options)}
                                        width={1} 
                                        name="contenant" 
                                        value={formData.contenant.description.first + " / " + formData.contenant.location.first} 
                                        onChange={handleChange} 
                                        enabled={false}
                                        changeLoad={changeLoad}
                                    />
                                    <InputDeroulant
                                        titre="Nombre" 
                                        placeholder="Nombre" 
                                        options={formData.contenant.indicatif.options.map((indicatif:number) => String(indicatif))}
                                        width={1} 
                                        name="nombre_contenant" 
                                        value={String(formData.contenant.indicatif.first)} 
                                        onChange={handleChange} 
                                        enabled={false}
                                        changeLoad={changeLoad}
                                    />
                                </div>
                            </div>
                            <div className='text-md font-bold mt-4'>Contacte Collecte</div>
                            <div className='flex justify-start gap-4 ml-8'>
                                <InputDeroulant
                                    titre="Prestataire"
                                    placeholder="Sélectionner un prestataire final"
                                    options={formData.prestataire_final.nom.options}
                                    width={1}
                                    name="prestataire_final"
                                    value={formData.prestataire_final.nom.first}
                                    onChange={handleChange}
                                    enabled={false}
                                    changeLoad={changeLoad}
                                />
                                <InputDeroulant
                                    titre="Personne référente"
                                    placeholder="Prénom Nom"
                                    options={combineLists(' ', formData.prestataire_final.firstname.options, formData.prestataire_final.lastname.options)}
                                    width={1}
                                    name="personne_referente"
                                    value={`${formData.prestataire_final.firstname.first} ${formData.prestataire_final.lastname.first}`}
                                    onChange={handleChange}
                                    enabled={false}
                                    changeLoad={changeLoad}
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
            
            {error && (
                <div className="text-red-500 text-sm mt-2 mb-4">
                    {error}
                </div>
            )}

            <Toaster position="top-right" />
        </div>
    )
}

export default ModalCollecteDemande;
