import React, { useEffect, useRef, useState } from "react";
import InputDeroulant from "../InputDeroulant";
import { useModalContextNew } from "./ContextModal";
import { formatText, getDataAutocompletion, getMappingTableFiliere, getFiliere, parseAddress, getDataAutocompletionVertical } from "./utils_new";
import { useSession } from "@/app/component/SessionProvider";
import { FormInput } from "../../interface/BSD_Interface";
import ModifyCardInFormulaireNew from "./ModifyCardInFormulaireNew";

type StadeType = "current" | "freeze" | "done";

const initialToogleData: FormInput = {
    emitter: {
      type: "PRODUCER",
      workSite: { name: "", fullAddress: "", address: "", postalCode: "", city: "", infos: "" },
      company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
      isPrivateIndividual: false,
      isForeignShip: false,
    },
    recipient: {
      company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
      cap: "",
      processingOperation: "",
      isTempStorage: false,
    },
    transporter: {
      company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
      isExemptedOfReceipt: false,
      receipt: "",
      numberPlate: "",
      customInfo: "",
    },
    wasteDetails: {
      code: "",
      name: "",
      isSubjectToADR: false,
      onuCode: "",
      packagingInfos: [{ type: "AUTRE", quantity: 0 }],
      quantity: 0,
      quantityType: "ESTIMATED",
      consistence: "",
      pop: false,
      isDangerous: false,
      parcelNumbers: { city: "", postalCode: "", prefix: "", section: "", number: "" },
      analysisReferences: "",
      landIdentifiers: "",
      sampleNumber: "",
    },
    trader: {
      receipt: "",
      department: "",
      //validityLimit: "",
      company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
    },
    broker: {
      receipt: "",
      department: "",
      //validityLimit: "",
      company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
    },
    //grouping: { form: { id: "" }, quantity: 0 },//Pour l'instant on va dire qu'on ne permet pas de grouper les déchets
    ecoOrganisme: { name: "", siret: "" },
    temporaryStorageDetail: {
      company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
      cap: "",
      processingOperation: "",
    }, //Si le recipient est un stockage provisoire, on va mettre les infos du destinataire final pour le traitement 
    //intermediaries: [],
  };

const initialStadeAvancement: Record<string, StadeType> = {
    "workSiteName": "current",
    "pickupAddress": "freeze",
    "wasteStream": "freeze",
    "wasteType": "freeze",
    "transporterName": "freeze",
    "recipientName": "freeze",
    "contactPerson": "freeze",
    "transporterContact": "freeze",
    "recipientContact": "freeze",
    "packagingType": "freeze",
    "packagingQuantity": "freeze",
};

const FormulaireNew = () => {
    const getInfosEntreprise = async () => {
        try {
            const response = await fetch('/api/demande_collecte/get_my_company_infos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            });
    
            if (!response.ok) {
            throw new Error('Failed to fetch company info');
            }
    
            const infos_entreprise = await response.json();
            //console.log('infos_entreprise', infos_entreprise);
    
            if (infos_entreprise) {
            const dataAlreadyHere = JSON.parse(JSON.stringify(dataText));
            dataAlreadyHere.emitter.type = "PRODUCER";
            dataAlreadyHere.emitter.company.siret = infos_entreprise.siret;
            dataAlreadyHere.emitter.company.name = infos_entreprise.name;
            dataAlreadyHere.emitter.company.contact = infos_entreprise.contact;
            dataAlreadyHere.emitter.company.phone = infos_entreprise.contactPhone;
            dataAlreadyHere.emitter.company.mail = infos_entreprise.contactEmail;
            dataAlreadyHere.emitter.company.address = infos_entreprise.address;
            setDataText(dataAlreadyHere);

            }
        } catch (error) {
            console.error('Error fetching company info:', error);
        }
    };

    const session = useSession();
    const [ced_table, setCedTable] = useState<{ ced: string, filiere: string }[]>([]);
    const [dataText, setDataText] = useState<FormInput>(initialToogleData);
    const [currentFiliere, setCurrentFiliere] = useState<string>("");
    const [stadeAvancement, setStadeAvancement] = useState<Record<string, StadeType>>(initialStadeAvancement);



    const {             
        setDisplayFormulaire, displayFormulaire,
        dataToogle,
        setDataToogle,
        options,
        setOptions } = useModalContextNew();

    useEffect(() => {
        //aller chercher la table mapping filiere
        if(session && session.entreprise_id) {
            getMappingTableFiliere(session.entreprise_id).then(data => setCedTable(data));
        }
    }, [session]);

    useEffect(() => {
        //aller chercher les infos de l'entreprise et les options au début
        getInfosEntreprise();
        if(session && session.entreprise_id) {
            getDataAutocompletion(session.entreprise_id).then(data => { //Attention, ça renvoie touuuuuut
                if(data) {
                    setOptions(data);
                }
            });
        }
    }, [session]);

    useEffect(() => {
        if(displayFormulaire) {
            ResetData();
        }
    }, [displayFormulaire]);


    /*useEffect(() => {
        //Recréer la fullAddress à chaque changement du worksite pour la fullAddress
        if(dataToogle.emitter.workSite.address.length > 0) {
            dataText.emitter.workSite.fullAddress = dataToogle.emitter.workSite.address + ' ' + dataToogle.emitter.workSite.postalCode + ' ' + dataToogle.emitter.workSite.city;
            //setDataText(dataText);
        }
      }, [dataToogle.emitter.workSite]);*/

    const modifyCardRef = useRef<HTMLDivElement>(null);

    const scrollToModifyCard = () => {
        modifyCardRef.current?.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    };

    const getUniqueOptions = (optionsArray: FormInput[], selector: (opt: FormInput) => string) => {
        return Array.from(new Set(optionsArray.map(selector)));
    };

    const ResetData = async () => {
        // Reset les données d'abord
        setDataToogle({...JSON.parse(JSON.stringify(initialToogleData))});
        setDataText({...JSON.parse(JSON.stringify(initialToogleData))});
        setCurrentFiliere("");
        setStadeAvancement(initialStadeAvancement);
        // Ensuite récupérer les nouvelles données
        if(session && session.entreprise_id) {
            try {
                const [autocompletionData, entrepriseInfo] = await Promise.all([
                    getDataAutocompletion(session.entreprise_id),
                    fetch('/api/demande_collecte/get_my_company_infos', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                    })
                ]);

                if(autocompletionData) {
                    setOptions([...autocompletionData]);
                }

                if(entrepriseInfo.ok) {
                    const infos = await entrepriseInfo.json();
                    if(infos) {
                        const newDataText = {...JSON.parse(JSON.stringify(initialToogleData))};
                        newDataText.emitter.type = "PRODUCER";
                        newDataText.emitter.company.siret = infos.siret;
                        newDataText.emitter.company.name = infos.name;
                        newDataText.emitter.company.contact = infos.contact;
                        newDataText.emitter.company.phone = infos.contactPhone;
                        newDataText.emitter.company.mail = infos.contactEmail;
                        newDataText.emitter.company.address = infos.address;
                        setDataText(newDataText);
                    }
                }
            } catch (error) {
                console.error('Error in ResetData:', error);
            }
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;

        if (session && session.entreprise_id && 
             (  name === "workSiteName" || 
                name === "wasteStream" || 
                name === "wasteType" || 
                name === "pickupAddress" ||
                name === "contactPerson" ||
                name === "transporterName" ||
                name === "recipientName" ||
                name === "transporterContact" ||
                name === "recipientContact"
            )) {
            switch (name) {
                case "workSiteName":
                    getDataAutocompletion(session.entreprise_id, value).then(data => {
                        if (data) {
                            const data_aval_text = JSON.parse(JSON.stringify(dataText)); //⚠ setDataText(dataToogle) quand [dataToogle] 
                            const data_from_autocompletion = data[0];
                            setOptions([...data]);
                            delete data_aval_text.emitter.workSite.fullAddress;
                            data_aval_text.emitter.workSite = data_from_autocompletion.emitter.workSite;                            
                            setDataText({...data_aval_text});
                            const data_past_toogle = JSON.parse(JSON.stringify(dataToogle));
                            data_past_toogle.emitter.workSite.name = data_from_autocompletion.emitter.workSite.name;
                            data_past_toogle.emitter.company.contact = data_from_autocompletion.emitter.company.contact;
                            data_past_toogle.emitter.workSite.fullAddress = data_from_autocompletion.emitter.workSite.fullAddress;
                            setDataToogle({...data_past_toogle});
                            //console.log('data_past_toogle', data_past_toogle);
                            setStadeAvancement(prev => ({
                                ...prev,
                                workSiteName: "done",
                                pickupAddress: "done",
                                contactPerson: "done",
                                wasteStream: "current",
                            }));
                        }
                    });
                    break;
                case "pickupAddress":
                    const newDataToogle = JSON.parse(JSON.stringify(dataToogle));
                    newDataToogle.emitter.workSite.fullAddress = value;
                    const {street, postalCode, city} = parseAddress(value);
                    newDataToogle.emitter.workSite.address = street;
                    newDataToogle.emitter.workSite.postalCode = postalCode;
                    newDataToogle.emitter.workSite.city = city;
                    
                    const newDataText = JSON.parse(JSON.stringify(dataText));
                    delete newDataText.emitter.workSite.fullAddress;
                    newDataText.emitter.workSite = {...newDataToogle.emitter.workSite};
                    
                    setDataToogle(newDataToogle);
                    setDataText(newDataText);
                    break;
                case "wasteStream":
                    getDataAutocompletion(session.entreprise_id, dataToogle.emitter.workSite.name, value).then(data => {
                        if (data) {
                            const newDataToogle = JSON.parse(JSON.stringify(dataToogle));
                            //newDataToogle.wasteDetails.code = value;
                            //const newDataText = JSON.parse(JSON.stringify(dataText));
                            //setDataToogle({...newDataToogle});
                            setOptions([...data]);
                            //setDataText({...newDataText, wasteDetails: data[0].wasteDetails}); //ne change rien en texte juste filtre les ceds en toogle
                            setCurrentFiliere(value);
                            setStadeAvancement(prev => ({
                                ...prev,
                                wasteStream: "done",
                                wasteType: "current",
                            }));
                        }
                    });
                    break;
                case "wasteType":
                    const true_value = value.split(" - ")[0];
                    getDataAutocompletion(session.entreprise_id, dataToogle.emitter.workSite.name, dataToogle.wasteDetails.code, true_value).then(data => {
                        if (data) {
                            const newDataToogle = JSON.parse(JSON.stringify(dataToogle));
                            const newDataText = JSON.parse(JSON.stringify(dataText));
                            setOptions([...data]);
                            setDataToogle({...newDataToogle, wasteDetails: data[0].wasteDetails});
                            setDataText({...newDataText, wasteDetails: data[0].wasteDetails});
                            //setCurrentFiliere(getFiliere(data[0].wasteDetails.code, ced_table));
                            setStadeAvancement(prev => ({
                                ...prev,
                                wasteType: "done",
                                packagingType: "done",
                                packagingQuantity: "done",
                                transporterName: "current",
                            }));
                        }
                    });
                    break;
                case "transporterName":
                    getDataAutocompletionVertical(session.entreprise_id, dataToogle.emitter.workSite.name, dataToogle.wasteDetails.code, "transporterName", value).then(data => {
                        if (data) {
                            const newDataToogle = JSON.parse(JSON.stringify(dataToogle));
                            const newDataText = JSON.parse(JSON.stringify(dataText));
                            
                            newDataToogle.transporter.company.name = value;
                            newDataToogle.transporter.company.contact = data.transporter.company.contact;
                            
                            newDataText.transporter = data.transporter;
                            
                            setDataToogle(newDataToogle);
                            setDataText(newDataText);
                            setStadeAvancement(prev => ({
                                ...prev,
                                transporterName: "done",
                                transporterContact: "done",
                                recipientName: "current",
                            }));
                        }
                    });
                    break;
                case "recipientName":
                    getDataAutocompletionVertical(session.entreprise_id, dataToogle.emitter.workSite.name, dataToogle.wasteDetails.code, "recipientName", value).then(data => {
                        if (data) {
                            const newDataToogle = JSON.parse(JSON.stringify(dataToogle));
                            const newDataText = JSON.parse(JSON.stringify(dataText));
                            
                            newDataToogle.recipient.company.name = value;
                            newDataToogle.recipient.company.contact = data.recipient.company.contact;
                            
                            newDataText.recipient = data.recipient;
                            
                            setDataToogle(newDataToogle);
                            setDataText(newDataText);
                            setStadeAvancement(prev => ({
                                ...prev,
                                recipientName: "done",
                                recipientContact: "done",
                            }));
                        }
                    });
                    break;
                case "transporterContact":
                    getDataAutocompletionVertical(session.entreprise_id, dataToogle.emitter.workSite.name, dataToogle.wasteDetails.code, "transporterContact", value).then(data => {
                        if (data) {
                            const newDataToogle = JSON.parse(JSON.stringify(dataToogle));
                            const newDataText = JSON.parse(JSON.stringify(dataText));
                            
                            newDataToogle.transporter.company.contact = value;
                            newDataText.transporter.company.contact = data.transporter.company.contact;
                            newDataText.transporter.company.phone = data.transporter.company.phone;
                            newDataText.transporter.company.mail = data.transporter.company.mail;
                            
                            setDataToogle(newDataToogle);
                            setDataText(newDataText);
                        }
                    });
                    break;
                case "recipientContact":
                    getDataAutocompletionVertical(session.entreprise_id, dataToogle.emitter.workSite.name, dataToogle.wasteDetails.code, "recipientContact", value).then(data => {
                        if (data) {
                            const newDataToogle = JSON.parse(JSON.stringify(dataToogle));
                            const newDataText = JSON.parse(JSON.stringify(dataText));
                            
                            newDataToogle.recipient.company.contact = value;
                            newDataText.recipient.company.contact = data.recipient.company.contact;
                            newDataText.recipient.company.phone = data.recipient.company.phone;
                            newDataText.recipient.company.mail = data.recipient.company.mail;
                            
                            setDataToogle(newDataToogle);
                            setDataText(newDataText);
                        }
                    });
                    break;
                case "contactPerson":
                    getDataAutocompletionVertical(session.entreprise_id, dataToogle.emitter.workSite.name, dataToogle.wasteDetails.code, "contactPerson", value).then(data => {
                        if (data) {
                            const newDataToogle = JSON.parse(JSON.stringify(dataToogle));
                            const newDataText = JSON.parse(JSON.stringify(dataText));
                            
                            newDataToogle.emitter.company.contact = value;
                            newDataText.emitter.company.contact = data.emitter.company.contact;
                            newDataText.emitter.company.phone = data.emitter.company.phone;
                            newDataText.emitter.company.mail = data.emitter.company.mail;
                            
                            setDataToogle(newDataToogle);
                            setDataText(newDataText);
                        }
                    });
                    break;
            }
        } else {
            const pathMap: { [key: string]: (data: FormInput, value: string) => FormInput } = {
                "packagingType": (data, val) => ({
                    ...data,
                    wasteDetails: {
                        ...data.wasteDetails,
                        packagingInfos: [{
                            ...data.wasteDetails.packagingInfos[0],
                            type: val as "FUT" | "GRV" | "CITERNE" | "BENNE" | "PIPELINE" | "AUTRE"
                        }]
                    }
                }),
                "packagingQuantity": (data, val) => ({
                    ...data,
                    wasteDetails: {
                        ...data.wasteDetails,
                        packagingInfos: [{
                            ...data.wasteDetails.packagingInfos[0],
                            quantity: parseInt(val)
                        }]
                    }
                }),
            };

            const updateFn = pathMap[name];
            if (updateFn) {
                const newData = updateFn(dataToogle, value);
                //setDataToogle(newData);
                //setDataText(newData);
            }
        }
    };

    const handleChangeTexte = (name: string, value: string) => {
        const pathMap: { [key: string]: (data: FormInput, value: string) => FormInput } = {
            "workSiteName": (data, val) => ({
                ...data,
                emitter: {
                    ...data.emitter,
                    workSite: {
                        ...data.emitter.workSite,
                        name: val
                    }
                }
            }),
            "pickupAddress": (data, val) => ({
                ...data,
                emitter: {
                    ...data.emitter,
                    workSite: {
                        ...data.emitter.workSite,
                        fullAddress: val
                    }
                }
            }),
            "contactPerson": (data, val) => ({
                ...data,
                emitter: {
                    ...data.emitter,
                    company: {
                        ...data.emitter.company,
                        contact: val
                    }
                }
            }),
            "wasteType": (data, val) => ({
                ...data,
                wasteDetails: {
                    ...data.wasteDetails,
                    name: "",
                    code: val
                }
            }),
            "packagingType": (data, val) => ({
                ...data,
                wasteDetails: {
                    ...data.wasteDetails,
                    packagingInfos: [{
                        ...data.wasteDetails.packagingInfos[0],
                        type: val as "FUT" | "GRV" | "CITERNE" | "BENNE" | "PIPELINE" | "AUTRE"
                    }]
                }
            }),
            "packagingQuantity": (data, val) => ({
                ...data,
                wasteDetails: {
                    ...data.wasteDetails,
                    packagingInfos: [{
                        ...data.wasteDetails.packagingInfos[0],
                        quantity: parseInt(val)
                    }]
                }
            }),
            "recipientName": (data, val) => ({
                ...data,
                recipient: {
                    ...data.recipient,
                    company: {
                        ...data.recipient.company,
                        name: val
                    }
                }
            }),
            "recipientContact": (data, val) => ({
                ...data,
                recipient: {
                    ...data.recipient,
                    company: {
                        ...data.recipient.company,
                        contact: val
                    }
                }
            }),
            "transporterName": (data, val) => ({
                ...data,
                transporter: {
                    ...data.transporter,
                    company: {
                        ...data.transporter.company,
                        name: val
                    }
                }
            }),
            "transporterContact": (data, val) => ({
                ...data,
                transporter: {
                    ...data.transporter,
                    company: {
                        ...data.transporter.company,
                        contact: val
                    }
                }
            })
        };

        const updateFn = pathMap[name];
        if (updateFn) {
            const newData = updateFn(dataToogle, value);
            //setDataToogle(newData);
        }
    };

    const handleClose = () => {
        setDisplayFormulaire(false);
    }

    useEffect(() => {
        if (dataToogle.wasteDetails.code) {
            setCurrentFiliere(getFiliere(dataToogle.wasteDetails.code, ced_table));
        }
    }, [dataToogle.wasteDetails.code, ced_table]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex flex-col items-center overflow-y-auto py-4 z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg mb-4 w-[80%] max-w-8xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-bold text-lg">Demande de collecte ♻</h3>
                <form className="my-2 p-6 border-[1px] border-gray-400 rounded-xl">
                    <div className="flex justify-between items-center gap-4 mr-5">
                        <div className='text-md font-bold'>Point de départ</div>
                        <button type="button" className="text-xs h-[25px] text-gray-500 font-thin hover:text-gray-700 active:font-bold" onClick={ResetData}>Réinitialiser</button>
                    </div>
                    
                    <div className='flex justify-start gap-4 ml-8'>
                        <div>
                            <InputDeroulant
                                titre="1. Site"
                                placeholder="Sélectionner un site"
                                options={getUniqueOptions(options, opt => opt.emitter.workSite.name)}
                                width={2}
                                name="workSiteName"
                                value={dataToogle.emitter.workSite.name}
                                onChange={handleChange}
                                onTextChange={handleChangeTexte}
                                enableText={true}
                                stade={stadeAvancement.workSiteName}
                            />
                            <InputDeroulant
                                titre="Adresse d'enlèvement"
                                placeholder="Adresse"
                                options={getUniqueOptions(options, opt => `${formatText(opt.emitter.workSite.fullAddress ?? "")}`)}
                                width={2}
                                name="pickupAddress"
                                value={`${formatText(dataToogle.emitter.workSite.fullAddress ?? "")}`}
                                onChange={handleChange}
                                onTextChange={handleChangeTexte}
                                enableText={true}
                                stade={stadeAvancement.pickupAddress}
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
                                options={getUniqueOptions(options, opt => opt.emitter.company.contact)}
                                width={2}
                                name="contactPerson"
                                value={dataToogle.emitter.company.contact}
                                onChange={handleChange}
                                onTextChange={handleChangeTexte}
                                enabled={true}
                                stade={stadeAvancement.contactPerson}
                            />
                        </div>
                    </div>
                    <div className='text-md font-bold mt-4'>Déchet</div>
                    <div className='flex justify-start gap-4 ml-8'>
                        <div>
                            <InputDeroulant
                                titre="2. Filière"
                                placeholder="Sélectionner une filière"
                                options={getUniqueOptions(options, opt => getFiliere(opt.wasteDetails.code, ced_table))}
                                width={2}
                                name="wasteStream"
                                value={currentFiliere}
                                onChange={handleChange}
                                onTextChange={handleChangeTexte}
                                enableText={false}
                                stade={stadeAvancement.wasteStream}
                            />
                            <InputDeroulant
                                titre="3. Déchet"
                                placeholder="Sélectionner un déchet"
                                options={getUniqueOptions(options, opt => 
                                    `${opt.wasteDetails.code} - ${opt.wasteDetails.name}`
                                )}
                                width={2}
                                name="wasteType"
                                value={dataToogle.wasteDetails.code}
                                onChange={handleChange}
                                onTextChange={handleChangeTexte}
                                stade={stadeAvancement.wasteType}
                            />
                        </div>
                        <div>
                            <InputDeroulant
                                titre="Contenant"
                                placeholder="Sélectionner un contenant"
                                options={getUniqueOptions(options, opt => `${opt.wasteDetails.packagingInfos[0].type}`)}
                                width={1}
                                name="packagingType"
                                value={`${dataToogle.wasteDetails.packagingInfos[0].type}`}
                                onChange={handleChange}
                                onTextChange={handleChangeTexte}
                                enableText={false}
                                stade={stadeAvancement.packagingType}
                            />
                            <InputDeroulant
                                titre="Nombre"
                                placeholder="Nombre"
                                options={getUniqueOptions(options, opt => String(opt.wasteDetails.packagingInfos[0].quantity))}
                                width={1}
                                name="packagingQuantity"
                                value={String(dataToogle.wasteDetails.packagingInfos[0].quantity)}
                                onChange={handleChange}
                                onTextChange={handleChangeTexte}
                                enableText={true}
                                stade={stadeAvancement.packagingQuantity}
                            />
                        </div>
                    </div>
                    <div className='text-md font-bold mt-4'>Prestataires</div>
                    <div className='flex justify-start gap-4 ml-8'>
                        <div>
                            <InputDeroulant
                                titre="Transporteur"
                                placeholder="Sélectionner un transporteur"
                                options={getUniqueOptions(options, opt => opt.transporter.company.name)}
                                width={1}
                                name="transporterName"
                                value={dataToogle.transporter.company.name}
                                onChange={handleChange}
                                onTextChange={handleChangeTexte}
                                stade={stadeAvancement.transporterName}
                            />
                            <InputDeroulant
                                titre="Destinataire"
                                placeholder="Sélectionner un destinataire"
                                options={getUniqueOptions(options, opt => opt.recipient.company.name)}
                                width={1}
                                name="recipientName"
                                value={dataToogle.recipient.company.name}
                                onChange={handleChange}
                                onTextChange={handleChangeTexte}
                                stade={stadeAvancement.recipientName}
                            />
                        </div>
                        <div>
                            <InputDeroulant
                                titre="Personne Transporteur"
                                placeholder="Prénom Nom"
                                options={getUniqueOptions(options, opt => opt.transporter.company.contact)}
                                width={1}
                                name="transporterContact"
                                value={dataToogle.transporter.company.contact}
                                onChange={handleChange}
                                onTextChange={handleChangeTexte}
                                stade={stadeAvancement.transporterContact}
                            />
                            <InputDeroulant
                                titre="Personne Destinataire"
                                placeholder="Prénom Nom"
                                options={getUniqueOptions(options, opt => opt.recipient.company.contact)}
                                width={1}
                                name="recipientContact"
                                value={dataToogle.recipient.company.contact}
                                onChange={handleChange}
                                onTextChange={handleChangeTexte}
                                stade={stadeAvancement.recipientContact}
                            />
                        </div>
                    </div>
                    <div ref={modifyCardRef}>
                        <ModifyCardInFormulaireNew 
                            onClose={handleClose}
                            dataText={dataText}
                            setDataText={setDataText}
                        />
                    </div>
                </form>
            </div>
        </div>
    );
}

export default FormulaireNew;