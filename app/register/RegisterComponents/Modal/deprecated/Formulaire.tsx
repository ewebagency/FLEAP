/*import React, { useRef } from "react";
import InputDeroulant from "../../InputDeroulant";
import { useModalContextNew } from "../ContextModal";
import { formatText, getDataAutocompletion, sendData_to_Cloud } from "./utils";
import { useSession } from "@/app/component/SessionProvider";
import { DataTotalInterface } from "../../../interface/BSD_Interface";
import toast from "react-hot-toast";
import ModifyCardInFormulaire from './ModifyCardInFormulaire';
import ModifyCardInFormulaireNew from "../ModifyCardInFormulaireNew";


const Formulaire = () => {
    const session = useSession();
    const user_id = session?.user_id;
    //const [submitLoad, setSubmitLoad] = useState(false);

    const {             
        setModalReload, modalReload,
        setDisplayFormulaire,
        dataTotal,
        setDataTotal,
        options,
        setOptions } = useModalContextNew();

    // Ajouter une référence pour la section de modification
    const modifyCardRef = useRef<HTMLDivElement>(null);

    // Fonction pour gérer le défilement
    const scrollToModifyCard = () => {
        modifyCardRef.current?.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    };

    // Fonction utilitaire pour obtenir des valeurs uniques
    const getUniqueOptions = (optionsArray: DataTotalInterface[], selector: (opt: DataTotalInterface) => string) => {
        return Array.from(new Set(optionsArray.map(selector)));
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
            const pathMap: { [key: string]: (data: DataTotalInterface, value: string) => DataTotalInterface } = {
                "adresse_enlevement": (data, val) => ({
                    ...data,
                    dataFormAPI: {
                        ...data.dataFormAPI,
                        formAPI: {
                            ...data.dataFormAPI.formAPI,
                            createFormInput: {
                                ...data.dataFormAPI.formAPI.createFormInput,
                                emitter: {
                                    ...data.dataFormAPI.formAPI.createFormInput.emitter,
                                    workSite: {
                                        ...data.dataFormAPI.formAPI.createFormInput.emitter.workSite,
                                        address: val
                                    }
                                }
                            }
                        }
                    }
                }),
                "personne_a_contacter_prenom_nom": (data, val) => ({
                    ...data,
                    dataFormAPI: {
                        ...data.dataFormAPI,
                        formAPI: {
                            ...data.dataFormAPI.formAPI,
                            createFormInput: {
                                ...data.dataFormAPI.formAPI.createFormInput,
                                emitter: {
                                    ...data.dataFormAPI.formAPI.createFormInput.emitter,
                                    company: {
                                        ...data.dataFormAPI.formAPI.createFormInput.emitter.company,
                                        contact: val
                                    }
                                }
                            }
                        }
                    }
                }),
                "contenant": (data, val) => ({
                    ...data,
                    dataFormAPI: {
                        ...data.dataFormAPI,
                        formAPI: {
                            ...data.dataFormAPI.formAPI,
                            createFormInput: {
                                ...data.dataFormAPI.formAPI.createFormInput,
                                wasteDetails: {
                                    ...data.dataFormAPI.formAPI.createFormInput.wasteDetails,
                                    packagingInfos: data.dataFormAPI.formAPI.createFormInput.wasteDetails.packagingInfos.map(info => ({
                                        ...info,
                                        description: val
                                    }))
                                }
                            }
                        }
                    }
                }),
                "nombre_contenant": (data, val) => ({
                    ...data,
                    dataFormAPI: {
                        ...data.dataFormAPI,
                        formAPI: {
                            ...data.dataFormAPI.formAPI,
                            createFormInput: {
                                ...data.dataFormAPI.formAPI.createFormInput,
                                wasteDetails: {
                                    ...data.dataFormAPI.formAPI.createFormInput.wasteDetails,
                                    packagingInfos: data.dataFormAPI.formAPI.createFormInput.wasteDetails.packagingInfos.map(info => ({
                                        ...info,
                                        quantity: val
                                    }))
                                }
                            }
                        }
                    }
                }),
                "prestataire_final": (data, val) => ({
                    ...data,
                    dataFormAPI: {
                        ...data.dataFormAPI,
                        formAPI: {
                            ...data.dataFormAPI.formAPI,
                            createFormInput: {
                                ...data.dataFormAPI.formAPI.createFormInput,
                                recipient: {
                                    ...data.dataFormAPI.formAPI.createFormInput.recipient,
                                    company: {
                                        ...data.dataFormAPI.formAPI.createFormInput.recipient.company,
                                        name: val
                                    }
                                }
                            }
                        }
                    }
                }),
                "personne_referente": (data, val) => ({
                    ...data,
                    dataFormAPI: {
                        ...data.dataFormAPI,
                        formAPI: {
                            ...data.dataFormAPI.formAPI,
                            createFormInput: {
                                ...data.dataFormAPI.formAPI.createFormInput,
                                recipient: {
                                    ...data.dataFormAPI.formAPI.createFormInput.recipient,
                                    company: {
                                        ...data.dataFormAPI.formAPI.createFormInput.recipient.company,
                                        contact: val
                                    }
                                }
                            }
                        }
                    }
                })
            };

            const updateFn = pathMap[name];
            if (updateFn) {
                const newData = updateFn(dataTotal, value);
                setDataTotal(newData);
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

    const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        await handleSubmit(dataTotal);
    };

    /*const handleDetailChange = useCallback((path: string, value: string) => {
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
    }, []);//

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex flex-col items-center overflow-y-auto py-4 z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg mb-4 w-[80%] max-w-8xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-bold text-lg">Demande de collecte ♻</h3>
                <form onSubmit={handleFormSubmit} className="my-2 p-6 border-[1px] border-gray-400 rounded-xl">
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
                            <div className="mt-3 ml-4 w-[350px] h-[25px] text-xs text-gray-400 cursor-pointer hover:text-gray-600" 
                                 onClick={scrollToModifyCard}>
                                ▶ Pour ajuster les informations, remplissez les champs plus bas
                            </div>
                            <InputDeroulant
                                titre="Personne référente"
                                placeholder="Prénom Nom"
                                options={options.map(opt => opt.dataFormAPI.formAPI.createFormInput.emitter.company.contact.toString())}
                                width={2}
                                name="personne_a_contacter_prenom_nom"
                                value={dataTotal.dataFormAPI.formAPI.createFormInput.emitter.company.contact.toString()}
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
                                options={options.map(opt => `${opt.dataFormAPI.formAPI.createFormInput.wasteDetails.packagingInfos[0].type}`)}//`${opt.dataFormAPI.formAPI.createFormInput.wasteDetails.packagingInfos[0].description} / 
                                width={1}
                                name="contenant"
                                value={`${dataTotal.dataFormAPI.formAPI.createFormInput.wasteDetails.packagingInfos[0].type}`}
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
                            options={options.map(opt => opt.dataFormAPI.formAPI.createFormInput.recipient.company.name.toString())}
                            width={1}
                            name="prestataire_final"
                            value={dataTotal.dataFormAPI.formAPI.createFormInput.recipient.company.name.toString()}
                            onChange={handleChange}
                            enabled={false}
                            //changeLoad={changeLoad}
                        />
                        <InputDeroulant
                            titre="Personne référente"
                            placeholder="Prénom Nom"
                            options={options.map(opt => opt.dataFormAPI.formAPI.createFormInput.recipient.company.contact.toString())}
                            width={1}
                            name="personne_referente"
                            value={dataTotal.dataFormAPI.formAPI.createFormInput.recipient.company.contact.toString()}
                            onChange={handleChange}
                            enabled={false}
                            //changeLoad={changeLoad}
                        />
                    </div>
                    <div ref={modifyCardRef}>
                        <ModifyCardInFormulaireNew 
                            dataTotal={dataTotal}
                            setDataTotal={setDataTotal}
                            onSubmit={handleSubmit}
                            onClose={handleClose}
                        />
                    </div>
                </form>
            </div>
        </div>
    );
}

export default Formulaire;*/