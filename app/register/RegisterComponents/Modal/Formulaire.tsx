import React, { useState, useCallback } from "react";
import InputDeroulant from "../InputDeroulant";
import { useModalContextNew } from "./ContextModal";
import { formatText, getDataAutocompletion, sendData_to_Cloud } from "./utils";
import { useSession } from "@/app/component/SessionProvider";
import { DataTotalInterface } from "../../interface/BSD_Interface";
import toast from "react-hot-toast";
import ModifyCard from "./ModifyCard";
import ModifyCardInFormulaire from './ModifyCardInFormulaire';

const Formulaire = () => {
    const session = useSession();
    const user_id = session?.user.id;
    const [submitLoad, setSubmitLoad] = useState(false);

    const {             
        setModalReload, modalReload,
        setModalType,
        displayFormulaire,
        setDisplayFormulaire,
        dataTotal,
        setDataTotal,
        options,
        setOptions } = useModalContextNew();

    // Fonction utilitaire pour obtenir des valeurs uniques
    const getUniqueOptions = (optionsArray: DataTotalInterface[], selector: (opt: DataTotalInterface) => string) => {
        return [...new Set(optionsArray.map(selector))];
    };

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;

        if(user_id && (name === "site" || name === "filiere" || name === "dechet")) {
            switch (name) {
                case "site":
                    getDataAutocompletion(user_id, value).then(data => {
                        if(data) {
                            setDataTotal(data[0]);
                            setOptions(data);
                        }
                    });
                    break;
                case "filiere":
                    getDataAutocompletion(user_id, dataTotal.dataSupplementaire.site, value).then(data => {
                        if(data) {
                            setOptions(data);
                            setDataTotal(data[0]);
                        }
                    });
                    break;
                case "dechet":
                    const true_value = value.split(" - ")[0];
                    getDataAutocompletion(user_id, dataTotal.dataSupplementaire.site, dataTotal.dataSupplementaire.filiere, true_value).then(data => {
                        if(data) {
                            setOptions(data);
                            setDataTotal(data[0]);
                        }
                    });
                    break;
            }
        } else {
            // Mapping des noms de champs vers leurs chemins dans dataTotal
            const pathMap: { [key: string]: string[] } = {
                "adresse_enlevement": ["dataFormAPI", "formAPI", "createFormInput", "emitter", "workSite", "address"],
                "personne_a_contacter_prenom_nom": ["dataFormAPI", "formAPI", "createFormInput", "emitter", "company", "contact"],
                "contenant": ["dataFormAPI", "formAPI", "createFormInput", "wasteDetails", "packagingInfos", 0, "description"],
                "nombre_contenant": ["dataFormAPI", "formAPI", "createFormInput", "wasteDetails", "packagingInfos", 0, "quantity"],
                "prestataire_final": ["dataFormAPI", "formAPI", "createFormInput", "recipient", "company", "name"],
                "personne_referente": ["dataFormAPI", "formAPI", "createFormInput", "recipient", "company", "contact"]
            };
            const path = pathMap[name];
            if (path) {
                setDataTotal(prevData => {
                    const newData = { ...prevData };
                    let current: any = newData;
                    
                    // Parcourt le chemin jusqu'à l'avant-dernière clé
                    for (let i = 0; i < path.length - 1; i++) {
                        if (!(path[i] in current)) {
                            current[path[i]] = {};
                        }
                        current = current[path[i]];
                    }
                    
                    // Définit la valeur à la dernière clé
                    current[path[path.length - 1]] = value;
                    return newData;
                });
            }
        }
    };

    const handleClose = () => {
        setDisplayFormulaire(false);
    }
    const ResetData = () => {
        if(user_id) {
            getDataAutocompletion(user_id).then(data => {
                if(data) {
                setDataTotal(data[0]);
                setOptions(data);
            }
            });
        }
    }

    const handleSubmit = async (data: DataTotalInterface) => {
        if(user_id) {
            const result = await sendData_to_Cloud(data, user_id);
            if(result.success) {
                toast.success(result.message);
                setDataTotal(data);
                setDisplayFormulaire(false);
                setModalReload(!modalReload);
            } else {
                toast.error(result.message);
            }
        }
    };

    const handleDetailChange = useCallback((path: string, value: string) => {
        setDataTotal(prev => {
            if (!prev) return prev;
            const newData = JSON.parse(JSON.stringify(prev));
            const keys = path.split('.');
            let current = newData;
            
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) current[keys[i]] = {};
                current = current[keys[i]];
            }
            
            current[keys[keys.length - 1]] = value;
            return newData;
        });
    }, []);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex flex-col items-center overflow-y-auto py-4 z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg mb-4 w-[90%] max-w-4xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-bold text-lg">Demande de collecte [NEW 🎇]</h3>
                <form onSubmit={handleSubmit} className="my-2 p-6 border-[1px] border-gray-400 rounded-xl">
                    <div className="flex justify-between items-center gap-4 mr-5">
                        <div className='text-md font-bold'>Point de départ</div>
                        <button type="button" className="text-xs h-[25px] text-gray-500 font-thin hover:text-gray-700 active:font-bold" onClick={ResetData}>Réinitialiser</button>
                    </div>
                    
                    <div className='flex justify-start gap-4 ml-8'>
                        <div>
                            
                            <InputDeroulant
                                titre="1. Site"
                                placeholder="Sélectionner un site"
                                options={getUniqueOptions(options, opt => opt.dataSupplementaire.site)}
                                width={2}
                                name="site"
                                value={dataTotal.dataSupplementaire.site}
                                onChange={handleChange}
                                //changeLoad={changeLoad}
                            />
                            <InputDeroulant
                                titre="Adresse d'enlèvement"
                                placeholder="Adresse"
                                options={options.map(opt => `${formatText(opt.dataFormAPI.formAPI.createFormInput.emitter.workSite?.address)} ${formatText(opt.dataFormAPI.formAPI.createFormInput.emitter.workSite?.city)}`)}
                                width={2}
                                name="adresse_enlevement"
                                value={`${formatText(dataTotal.dataFormAPI.formAPI.createFormInput.emitter.workSite?.address)} ${formatText(dataTotal.dataFormAPI.formAPI.createFormInput.emitter.workSite?.city)}`}
                                onChange={handleChange}
                                enabled={false}
                                //changeLoad={changeLoad}
                            />
                        </div>
                        <div>
                            <div className="mt-3 ml-4 w-[350px] h-[25px] text-xs text-gray-400">▶ Pour ajuster les informations, remplissez les champs plus bas</div>
                            <InputDeroulant
                                titre="Personne référente"
                                placeholder="Prénom Nom"
                                options={options.map(opt => opt.dataFormAPI.formAPI.createFormInput.emitter.company.contact)}
                                width={2}
                                name="personne_a_contacter_prenom_nom"
                                value={dataTotal.dataFormAPI.formAPI.createFormInput.emitter.company.contact}
                                onChange={handleChange}
                                enabled={false}
                                //changeLoad={changeLoad}
                            />
                        </div>
                    </div>
                    <div className='text-md font-bold mt-4'>Déchet</div>
                    <div className='flex justify-start gap-4 ml-8'>
                        <div>
                            <InputDeroulant
                                titre="2. Filière"
                                placeholder="Sélectionner une filière"
                                options={getUniqueOptions(options, opt => opt.dataSupplementaire.filiere)}
                                width={2}
                                name="filiere"
                                value={dataTotal.dataSupplementaire.filiere}
                                onChange={handleChange}
                                //changeLoad={changeLoad}
                            />
                            <InputDeroulant
                                titre="3. Déchet"
                                placeholder="Sélectionner un déchet"
                                options={getUniqueOptions(options, opt => 
                                    `${opt.dataFormAPI.formAPI.createFormInput.wasteDetails.code} - ${opt.dataFormAPI.formAPI.createFormInput.wasteDetails.name}`
                                )}
                                width={2}
                                name="dechet"
                                value={`${dataTotal.dataFormAPI.formAPI.createFormInput.wasteDetails.code} - ${dataTotal.dataFormAPI.formAPI.createFormInput.wasteDetails.name}`}
                                onChange={handleChange}
                                //changeLoad={changeLoad}
                            />
                        </div>
                        <div>
                            <InputDeroulant
                                titre="Contenant"
                                placeholder="Sélectionner un contenant"
                                options={options.map(opt => `${opt.dataFormAPI.formAPI.createFormInput.wasteDetails.packagingInfos[0].description} / ${opt.dataFormAPI.formAPI.createFormInput.wasteDetails.packagingInfos[0].type}`)}
                                width={1}
                                name="contenant"
                                value={`${dataTotal.dataFormAPI.formAPI.createFormInput.wasteDetails.packagingInfos[0].description} / ${dataTotal.dataFormAPI.formAPI.createFormInput.wasteDetails.packagingInfos[0].type}`}
                                onChange={handleChange}
                                enabled={false}
                                //changeLoad={changeLoad}
                            />
                            <InputDeroulant
                                titre="Nombre"
                                placeholder="Nombre"
                                options={options.map(opt => String(opt.dataFormAPI.formAPI.createFormInput.wasteDetails.packagingInfos[0].quantity))}
                                width={1}
                                name="nombre_contenant"
                                value={String(dataTotal.dataFormAPI.formAPI.createFormInput.wasteDetails.packagingInfos[0].quantity)}
                                onChange={handleChange}
                                enabled={false}
                                //changeLoad={changeLoad}
                            />
                        </div>
                    </div>
                    <div className='text-md font-bold mt-4'>Contacte Collecte</div>
                    <div className='flex justify-start gap-4 ml-8'>
                        <InputDeroulant
                            titre="Prestataire"
                            placeholder="Sélectionner un prestataire final"
                            options={options.map(opt => opt.dataFormAPI.formAPI.createFormInput.recipient.company.name)}
                            width={1}
                            name="prestataire_final"
                            value={dataTotal.dataFormAPI.formAPI.createFormInput.recipient.company.name}
                            onChange={handleChange}
                            enabled={false}
                            //changeLoad={changeLoad}
                        />
                        <InputDeroulant
                            titre="Personne référente"
                            placeholder="Prénom Nom"
                            options={options.map(opt => opt.dataFormAPI.formAPI.createFormInput.recipient.company.contact)}
                            width={1}
                            name="personne_referente"
                            value={dataTotal.dataFormAPI.formAPI.createFormInput.recipient.company.contact}
                            onChange={handleChange}
                            enabled={false}
                            //changeLoad={changeLoad}
                        />
                    </div>
                    <ModifyCardInFormulaire 
                        dataTotal={dataTotal}
                        setDataTotal={setDataTotal}
                        onSubmit={handleSubmit}
                        onClose={handleClose}
                    />
                    {/*<div className="modal-action mt-6">
                        <button type="button" id="fermer-btn" className="btn" onClick={handleClose}>Fermer</button>
                        <button type="submit" id="envoyer-btn" className="btn" disabled={submitLoad}>
                            {submitLoad ? "En cours..." : "Envoyer"}
                        </button>
                    </div>*/}
                </form>
            </div>
        </div>
    );
}

export default Formulaire;