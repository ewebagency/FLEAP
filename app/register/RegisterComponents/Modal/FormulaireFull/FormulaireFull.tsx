import { FormInput } from "@/app/register/interface/BSD_Interface";
import { useModalContextNew } from "../ContextModal";
import InputFull from "./InputFull";
import { formatText, getDataAutocompletion, getMappingTableFiliere, getFiliere } from "./utils_new";
import { useEffect, useState } from "react";
import { useSession } from "@/app/component/SessionProvider";
import MailComponent from "@/app/register/MailComponents/MailComponent";
import ModifyCardInFormulaireNew from "./ModifyCardInFormulaireNew";
import { supabase } from "@/app/database/supabaseClient";
import BoxIcon from "@/app/component/BoxIconWrapper";

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
      packagingInfos: [{ type: "FUT" as "FUT" | "GRV" | "CITERNE" | "BENNE" | "PIPELINE" | "AUTRE", quantity: 0, other: "" }],
      quantity: 0,
      quantityType: "REAL" as "REAL" | "ESTIMATED",
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

// Ajouter après la définition de initialToogleData
export interface OtherInfos {
  container: {
    description: {
      type: string;
      volume: string;
      volumeUnit: string;
    }
  }
}

const initialOtherInfos: OtherInfos = {
  container: {
    description: {
      type: "",
      volume: "",
      volumeUnit: ""
    }
  }
};

// Définition de la structure des dépendances
interface InputDependency {
  children: string[];
  filterFields?: string[]; // Rendre filterFields optionnel
}
interface InputDependencies {
    [key: string]: InputDependency;
}
const inputDependencies: InputDependencies = {
    'filiere': {
        children: ['wasteDetails.code'],
        filterFields: [] // Ajout d'un tableau vide pour satisfaire le type
    },
    'emitter.company.name': {
        children: ['emitter.company.siret', 'emitter.company.address'],
        filterFields: ['emitter.company.name']
    },
    'emitter.workSite.name': {
        children: ['emitter.workSite.fullAddress', 'emitter.workSite.infos']
    },
    'wasteDetails.code': {
        children: ['wasteDetails.name', 'wasteDetails.isSubjectToADR', 'wasteDetails.onuCode']
    },
    'wasteDetails.packagingInfos[0].type': {
        children: ['wasteDetails.packagingInfos[0].other', 'wasteDetails.packagingInfos[0].quantity', 'wasteDetails.quantity', 'wasteDetails.quantityType', 'wasteDetails.consistence', 'wasteDetails.pop', 'wasteDetails.isDangerous']
    },
    'emitter.company.contact': {
        children: ['emitter.company.mail', 'emitter.company.phone']
    },
    'transporter.company.name': {
        children: ['transporter.company.siret', 'transporter.company.address', 'transporter.company.contact', 'transporter.company.phone', 'transporter.company.mail', 'transporter.isExemptedOfReceipt', 'transporter.receipt', 'transporter.numberPlate', 'transporter.customInfo']
    },
    'recipient.company.name': {
        children: ['recipient.company.siret', 'recipient.company.address', 'recipient.company.contact', 'recipient.company.phone', 'recipient.company.mail', 'recipient.cap', 'recipient.processingOperation', 'recipient.isTempStorage']
    }
};

// Ajouter cette fonction helper
const shouldDisplayField = (currentField: string, changedField: string, parentDependencies=inputDependencies) => {
    // Si le champ est le même que celui qui a changé
    if (currentField === changedField) return true;
    
    // Vérifier si le champ changé est un ancêtre du champ actuel
    const condition = isAncestor(changedField, currentField, parentDependencies);
    if (condition) {
        return true;
    }
    return false;
};

interface NestedObject {
    [key: string]: string | number | boolean | NestedObject | NestedArray | undefined | null;
}

interface NestedArray extends Array<NestedObject> {
    [index: number]: NestedObject;
}

const updateNestedValue = (obj: NestedObject, path: string, value: string | number | boolean): void => {
    const pathSegments = path.split('.');
    let current: NestedObject = obj;
    
    for (let i = 0; i < pathSegments.length - 1; i++) {
        const segment = pathSegments[i];
        if (segment.includes('[')) {
            const [arrayName, indexStr] = segment.split(/[\[\]]/);
            const index = parseInt(indexStr);
            if (!current[arrayName]) {
                current[arrayName] = [] as NestedArray;
            }
            if (!(current[arrayName] as NestedArray)[index]) {
                (current[arrayName] as NestedArray)[index] = {};
            }
            current = (current[arrayName] as NestedArray)[index];
        } else {
            if (!current[segment]) {
                current[segment] = {};
            }
            current = current[segment] as NestedObject;
        }
    }
    
    const lastSegment = pathSegments[pathSegments.length - 1];
    let convertedValue: string | boolean | number = value;
    
    // Conversion des valeurs selon le type attendu
    if (value === 'true') convertedValue = true;
    else if (value === 'false') convertedValue = false;
    //else if (!isNaN(Number(value)) && value !== '') convertedValue = Number(value);
    
    current[lastSegment] = convertedValue;
};

type NestedValue = string | number | boolean | NestedObject | NestedArray | undefined | null;

const getNestedValue = (obj: FormInput | NestedObject, path: string): string => {
    try {
        const value = path.split('.').reduce((acc: Record<string, NestedValue>, part) => {
            if (part.includes('[')) {
                const [arrayName, indexStr] = part.split(/[\[\]]/);
                const index = parseInt(indexStr);
                const array = acc[arrayName] as NestedArray;
                return array?.[index] as Record<string, NestedValue>;
            }
            return acc[part] as Record<string, NestedValue>;
        }, obj as Record<string, NestedValue>);
        
        if (typeof value === 'boolean' || typeof value === 'number') {
            return String(value);
        }
        return value?.toString() || '';
    } catch (error) {
        console.error(`Erreur lors de l'accès au chemin ${path}:`, error);
        return '';
    }
};

const FormulaireFull = () => {

    const {             
        setDisplayFormulaire,
        dataToogle,
        setDataToogle,
        options,
        setOptions,
        modalType } = useModalContextNew();
    const [currentFiliere, setCurrentFiliere] = useState("");
    const session = useSession();
    const [ced_table, setCedTable] = useState<{ ced: string, filiere: string }[]>([]);
    const [displayAll, setDisplayAll] = useState(false);
    const [dataFilter, setDataFilter] = useState<{name: string, value: string}[]>([]);
    const [allOptions, setAllOptions] = useState<FormInput[]>([]);
    const [changedField, setChangedField] = useState<string>("");
    const [other_infos, setOtherInfos] = useState<OtherInfos>(initialOtherInfos);

//Initialisation des options
useEffect(() => {
    if(session?.entreprise_id) {
        getDataAutocompletion(session.entreprise_id).then(data => {
            setAllOptions(data || []);
            setOptions(data || []);
        });
    }
}, [session]);

//Initialisation de ced_table
useEffect(() => {
    //aller chercher la table mapping filiere
    if(session && session.entreprise_id) {
        getMappingTableFiliere(session.entreprise_id).then(data => setCedTable(data));
    }
}, [session]);

//HandleChange
const handleChange = async (e: React.ChangeEvent<HTMLSelectElement> | { target: { name: string; value: string } }) => {
    const { name, value } = e.target;
    let valueToUse = value;

    // Mettre à jour le champ qui a changé
    if(Object.keys(inputDependencies).includes(name)) {
        setChangedField(name);
    }
    /*setTimeout(() => {
        setChangedField("");
    }, 1000);*/

    
    console.log("handleChange", name, typeof value, value);

    // Mise à jour de dataFilter
    const newDataFilter = dataFilterUpdate(setCurrentFiliere, ced_table, name, value, dataFilter, setDataFilter, inputDependencies);
    
    // Mise à jour de la valeur choisie dans dataToogle
    const newData = JSON.parse(JSON.stringify(dataToogle)) as FormInput;
        if(name==="wasteDetails.code") {
            valueToUse = value.split(" - ")[1];
        }
        updateNestedValue(newData as unknown as NestedObject, name, valueToUse);
    setDataToogle(newData);

    // Mettre à jour les options avec les nouveaux filtres
    if (session?.entreprise_id) {
        try {
            // Récupérer les enfants du champ modifié
            const childFields = inputDependencies[name]?.children || [];
            
            // Aller chercher les options en filtrant sur newDataFilter, et prendre tout aussi les options sans filtre
            const [filteredOptions, allOptions] = await Promise.all([
                getDataAutocompletionFull(
                    newDataFilter,
                    session.entreprise_id,
                    ced_table
                ),
                getDataAutocompletionFull([], session.entreprise_id, ced_table)
            ]);

            // Pour chaque enfant, vérifier s'il n'y a qu'une seule option possible
            if (filteredOptions && filteredOptions.length > 0) {
                for (const childField of childFields) {
                    const uniqueChildValues = new Set(
                        filteredOptions
                            .map(opt => getNestedValue(opt, childField))
                            .filter(value => value !== '') // Filtrer les valeurs vides
                    );
                    //On prend le childField"site.address" par exemple sur toutes les options filtrées
                    //console.log("uniqueChildValues", uniqueChildValues);

                    //Si il n'y a qu'une seule option possible sur ce child (site.address), on la met dans dataToogle
                    if (uniqueChildValues.size === 1) {
                        const uniqueValue = Array.from(uniqueChildValues)[0];
                        if (uniqueValue) { // Vérifier que la valeur n'est pas vide
                        setDataToogle(prev => {
                            const newData = JSON.parse(JSON.stringify(prev));
                            updateNestedValue(newData as unknown as NestedObject, childField, uniqueValue);
                            return newData;
                        });
                            // Ajouter également au dataFilter -> surtout paaas
                            //newDataFilter.push({ name: childField, value: uniqueValue });
                        }
                    }
                }
            }            
            setOptions([...filteredOptions]);
        } catch (error) {
            console.error("Erreur lors de la mise à jour des options:", error);
        }
    }
};

//ResetData
const ResetData = () => {
    setDataToogle(initialToogleData);
    setDataFilter([]);
    setCurrentFiliere("");
    setChangedField("");
    setOtherInfos(initialOtherInfos);
    if(session?.entreprise_id) {
        getDataAutocompletion(session.entreprise_id).then(data => setOptions(data as FormInput[]));
    }
}

const toogleFunction = () => {
    if(changedField!=='') {
        setChangedField('');
    }
    else {
        setDisplayAll(!displayAll); 
    }
}

// Ajouter cette nouvelle fonction de mise à jour
const handleOtherInfosChange = (e: React.ChangeEvent<HTMLSelectElement> | { target: { name: string; value: string } }) => {
    const { name, value } = e.target;
    setOtherInfos(prev => {
        const newData = JSON.parse(JSON.stringify(prev));
        const path = name.split('.');
        let current: Record<string, unknown> = newData;
        
        for (let i = 0; i < path.length - 1; i++) {
            current = current[path[i]] as Record<string, unknown>;
        }
        current[path[path.length - 1]] = value;
        
        return newData;
    });
};

//Render
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex flex-col items-center overflow-y-auto py-4 z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg mb-2 w-[80%] max-w-8xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center gap-4 mb-6">
                    <h3 className="font-bold text-lg ml-8 flex items-center gap-2">
                        <BoxIcon className="mb-1" name='truck' type='solid' />
                        <span className="text-green-medium mt-1 font-bold">
                            {modalType === 'create_line' ? 'Créer une ligne' : 'Demande de collecte'}
                        </span>
                    </h3>
                    <div className="flex gap-2 mr-3">
                        <button type="button" className="text-xs h-[25px] bg-[var(--green-medium)] rounded-md px-2 text-white font-thin hover:bg-[var(--green-dark)] active:font-bold" onClick={() => toogleFunction()}>Afficher/Masquer</button>
                        <button type="button" className="text-xs h-[25px] bg-[var(--green-medium)] rounded-md px-2 text-white font-thin hover:bg-[var(--green-dark)] active:font-bold" onClick={ResetData}>Réinitialiser</button>
                    </div>
                </div>
                
                <form className="ml-2">
                    <div className="text-sm font-semibold ml-6 mt-2">Point de départ</div>
                    <div className="w-[95%] pb-2 border-b border-3 mt-0 mx-auto border-gray-300">
                        {/*1ère ligne*/}
                        <div className="mt-0 flex justify-between gap-4 w-1/2 ml-8">
                        {/*Site*/}
                        <div>
                            <InputFull
                                titre="Site"
                                placeholder="Sélectionner un site"
                                options={getUniqueOptions(options, allOptions, opt => opt.emitter.company.name)}
                                width={2}
                                name="emitter.company.name"
                                value={dataToogle.emitter.company.name}
                                onChange={handleChange}
                                enableText={true}
                                stylePrimary={true}
                            />
                            <InputFull
                                titre="Siret"
                                placeholder="Siret"
                                options={getUniqueOptions(options, allOptions, opt => opt.emitter.company.siret)}
                                width={2}
                                name="emitter.company.siret"
                                value={dataToogle.emitter.company.siret}
                                onChange={handleChange}
                                enableText={true}
                                display={displayAll || shouldDisplayField("emitter.company.siret", changedField)}
                            />
                            {/*<InputFull
                                titre="Adresse"
                                placeholder="Adresse"
                                options={getUniqueOptions(options, allOptions, opt => opt.emitter.company.address)}
                                width={2}
                                name="emitter.company.address"
                                value={dataToogle.emitter.company.address}
                                onChange={handleChange}
                                enableText={true}
                                display={displayAll || shouldDisplayField("emitter.company.address", changedField)}
                            />*/}
                        </div>

                        </div>
                        {/*2ème ligne*/}
                        <div className="mt-0 flex justify-between gap-4 w-1/2 ml-8">
                            {/*Point de Collecte*/}
                            <div>
                                <InputFull
                                    titre="Point de collecte"
                                    placeholder="Sélectionner un point de collecte"
                                    options={getUniqueOptions(options, allOptions, opt => opt.emitter.workSite.name)}
                                    width={2}
                                    name="emitter.workSite.name"
                                    value={dataToogle.emitter.workSite.name}
                                    onChange={handleChange}
                                    enableText={true}
                                    stylePrimary={true}
                                />
                                <InputFull
                                    titre="Adresse d'enlèvement"
                                    placeholder="Adresse"
                                    options={getUniqueOptions(options, allOptions, opt => `${formatText(opt.emitter.workSite.fullAddress ?? "")}`)}
                                    width={2}
                                    name="emitter.workSite.fullAddress"
                                    value={`${formatText(dataToogle.emitter.workSite.fullAddress ?? "")}`}
                                    onChange={handleChange}
                                    enableText={true}
                                    display={displayAll || shouldDisplayField("emitter.workSite.fullAddress", changedField)}
                                />
                                <InputFull
                                    titre="Infos"
                                    placeholder="Infos"
                                    options={getUniqueOptions(options, allOptions, opt => `${formatText(opt.emitter.workSite.infos ?? "")}`)}
                                    width={2}
                                    name="emitter.workSite.infos"
                                    value={`${formatText(dataToogle.emitter.workSite.infos ?? "")}`}
                                    onChange={handleChange}
                                    enableText={true}
                                    display={displayAll || shouldDisplayField("emitter.workSite.infos", changedField)}
                                />
                            </div>
                            {/*Personne */}
                            <div>
                                <InputFull
                                    titre="Personne"
                                    placeholder="Contact"
                                    options={getUniqueOptions(options, allOptions, opt => opt.emitter.company.contact)}
                                    width={2}
                                    name="emitter.company.contact"
                                    value={dataToogle.emitter.company.contact}
                                    onChange={handleChange}
                                    enableText={true}
                                    stylePrimary={true}
                                />
                                <InputFull
                                    titre="Téléphone"
                                    placeholder="Téléphone"
                                    options={getUniqueOptions(options, allOptions, opt => opt.emitter.company.phone)}
                                    width={2}
                                    name="emitter.company.phone"
                                    value={dataToogle.emitter.company.phone}
                                    onChange={handleChange}
                                    enableText={true}
                                    display={displayAll || shouldDisplayField("emitter.company.phone", changedField)}
                                />
                                <InputFull
                                    titre="Mail"
                                    placeholder="Mail"
                                    options={getUniqueOptions(options, allOptions, opt => opt.emitter.company.mail)}
                                    width={2}
                                    name="emitter.company.mail"
                                    value={dataToogle.emitter.company.mail}
                                    onChange={handleChange}
                                    enableText={true}
                                    display={displayAll || shouldDisplayField("emitter.company.mail", changedField)}
                                />

                            </div>
                        </div>
                    </div>

                    <div className="text-sm font-semibold ml-6 mt-2">Déchet</div>
                    <div className="w-[95%] pb-2 border-b border-3 mt-0 mx-auto border-gray-300">
                        {/*3ème ligne*/}
                        <div className="mt-0 flex justify-between gap-4 w-1/2 ml-8">
                            {/*Filière*/}
                            <div>
                                <InputFull
                                    titre="Filière"
                                    placeholder="Sélectionner une filière"
                                    options={getUniqueOptions(options, allOptions, opt => getFiliere(opt.wasteDetails.code, ced_table))}
                                    width={2}
                                    name="filiere"
                                    value={currentFiliere}
                                    onChange={handleChange}
                                    enableText={false}
                                    stylePrimary={true}
                                />
                            </div>
                        </div>
                        {/*4ème ligne*/}
                        <div className="mt-0 flex justify-between gap-4 w-1/2 ml-8">
                            {/*Déchet*/}
                            <div>
                                <InputFull
                                    titre="Déchet"
                                    placeholder="Sélectionner un déchet"
                                    options={getUniqueOptions(options, allOptions, opt => `${opt.wasteDetails.name} - ${opt.wasteDetails.code}`)}
                                    width={2}
                                    name="wasteDetails.code"
                                    value={dataToogle.wasteDetails.code}
                                    onChange={handleChange}
                                    enableText={false}
                                    stylePrimary={true}
                                />                            
                                <InputFull
                                    titre="Description du déchet"
                                    placeholder="Description - Appelation destinataire"
                                    options={getUniqueOptions(options, allOptions, opt => `${opt.wasteDetails.name}`)}
                                    width={2}
                                    name="wasteDetails.name"
                                    value={dataToogle.wasteDetails.name}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("wasteDetails.name", changedField)}
                                />
                                <InputFull
                                    titre="Sujet à l'ADR"
                                    placeholder="Sujet à l'ADR"
                                    options={getUniqueOptions(options, allOptions, opt => `${opt.wasteDetails.isSubjectToADR}`)}
                                    width={2}
                                    name="wasteDetails.isSubjectToADR"
                                    value={dataToogle.wasteDetails.isSubjectToADR}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("wasteDetails.isSubjectToADR", changedField)}
                                />
                                <InputFull
                                    titre="Code ONU"
                                    placeholder="Code ONU"
                                    options={getUniqueOptions(options, allOptions, opt => `${opt.wasteDetails.onuCode}`)}
                                    width={2}
                                    name="wasteDetails.onuCode"
                                    value={dataToogle.wasteDetails.onuCode}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("wasteDetails.onuCode", changedField)}
                                />
                            </div>
                            {/*Contenant*/}
                            <div>
                                <InputFull
                                    titre="Contenant"
                                    placeholder="Sélectionner un contenant"
                                    options={{
                                        filteredOptions: getUniqueOptions(options, allOptions, opt => `${opt.wasteDetails.packagingInfos[0].type}`).filteredOptions,
                                        allOptions: ['FUT', 'GRV', 'CITERNE', 'BENNE', 'PIPELINE', 'AUTRE']
                                    }}
                                    width={1}
                                    name="wasteDetails.packagingInfos[0].type"
                                    value={dataToogle.wasteDetails.packagingInfos[0].type}
                                    onChange={handleChange}
                                    enableText={false}
                                    stylePrimary={true}
                                />
                                {/* Nouveaux champs pour other_infos */}
                                <InputFull
                                    titre="Type de contenant"
                                    placeholder="Type de contenant"
                                    options={{
                                        filteredOptions: [],
                                        allOptions: ['Fût métallique', 'GRV plastique', 'Citerne', 'Benne', 'Pipeline', 'Autre']
                                    }}
                                    width={1}
                                    name="container.description.type"
                                    value={other_infos.container.description.type}
                                    onChange={handleOtherInfosChange}
                                    enableText={true}
                                    display={displayAll || shouldDisplayField("wasteDetails.packagingInfos[0].type", changedField)}
                                />
                                <InputFull
                                    titre="Volume"
                                    placeholder="Volume"
                                    options={{
                                        filteredOptions: [],
                                        allOptions: ['100', '200', '500', '1000']
                                    }}
                                    width={1}
                                    name="container.description.volume"
                                    value={other_infos.container.description.volume}
                                    onChange={handleOtherInfosChange}
                                    enableText={true}
                                    display={displayAll || shouldDisplayField("wasteDetails.packagingInfos[0].type", changedField)}
                                />
                                <InputFull
                                    titre="Unité de volume"
                                    placeholder="Unité de volume"
                                    options={{
                                        filteredOptions: [],
                                        allOptions: ['L', 'm³']
                                    }}
                                    width={1}
                                    name="container.description.volumeUnit"
                                    value={other_infos.container.description.volumeUnit}
                                    onChange={handleOtherInfosChange}
                                    enableText={true}
                                    display={displayAll || shouldDisplayField("wasteDetails.packagingInfos[0].type", changedField)}
                                />
                                <InputFull
                                    titre="Description"
                                    placeholder="Description - Volume L/m3"
                                    options={getUniqueOptions(options, allOptions, opt => `${opt.wasteDetails.packagingInfos[0].other}`)}
                                    width={1}
                                    name="wasteDetails.packagingInfos[0].other"
                                    value={`${dataToogle.wasteDetails.packagingInfos[0].other}`}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("wasteDetails.packagingInfos[0].other", changedField)}
                                />
                                <InputFull
                                    titre="Nombre"
                                    placeholder="Nombre"
                                    options={getUniqueOptions(options, allOptions, opt => `${opt.wasteDetails.packagingInfos[0].quantity}`)}
                                    width={1}
                                    name="wasteDetails.packagingInfos[0].quantity"
                                    value={String(dataToogle.wasteDetails.packagingInfos[0].quantity)}
                                    onChange={handleChange}
                                    enableText={true}
                                    display={displayAll || shouldDisplayField("wasteDetails.packagingInfos[0].quantity", changedField)}
                                />
                                <InputFull
                                    titre="Poids"
                                    placeholder="Poids en tonnes"
                                    options={{
                                        filteredOptions: [],
                                        allOptions: ['0.5', '1', '1.5', '2', '2.5', '3']
                                    }}
                                    width={1}
                                    name="wasteDetails.quantity"
                                    value={String(dataToogle.wasteDetails.quantity)}
                                    onChange={handleChange}
                                    enableText={true}
                                    display={displayAll || shouldDisplayField("wasteDetails.quantity", changedField)}
                                />
                                <InputFull
                                    titre="Type de quantité "
                                    placeholder="Type de quantité"
                                    options={{
                                        filteredOptions: ['ESTIMATED'],
                                        allOptions: ['REAL']
                                    }}
                                    width={1}
                                    name="wasteDetails.quantityType"
                                    value={String(dataToogle.wasteDetails.quantityType)}
                                    onChange={handleChange}
                                    enableText={true}
                                    display={displayAll || shouldDisplayField("wasteDetails.quantityType", changedField)}
                                />
                                <InputFull
                                    titre="Consistance"
                                    placeholder="Consistance"
                                    options={{
                                        filteredOptions: getUniqueOptions(options, allOptions, opt => `${opt.wasteDetails.consistence}`).filteredOptions,
                                        allOptions: ['SOLID', 'LIQUID', 'GASEOUS', 'DOUGHY']
                                    }}
                                    width={1}
                                    name="wasteDetails.consistence"
                                    value={String(dataToogle.wasteDetails.consistence)}
                                    onChange={handleChange}
                                    enableText={true}
                                    display={displayAll || shouldDisplayField("wasteDetails.consistence", changedField)}
                                />
                                <InputFull
                                    titre="Pop"
                                    placeholder="Pop"
                                    options={{
                                        filteredOptions: getUniqueOptions(options, allOptions, opt => `${opt.wasteDetails.pop}`).filteredOptions,
                                        allOptions: ['true', 'false']
                                    }}
                                    width={1}
                                    name="wasteDetails.pop"
                                    value={String(dataToogle.wasteDetails.pop)}
                                    onChange={handleChange}
                                    enableText={true}
                                    display={displayAll || shouldDisplayField("wasteDetails.pop", changedField)}
                                />
                                <InputFull
                                    titre="Dangereux"
                                    placeholder="Est dangereux"
                                    options={{
                                        filteredOptions: [dataToogle.wasteDetails.code.includes('*') ? 'true' : 'false'],
                                        allOptions: ['true', 'false']
                                    }}
                                    width={1}
                                    name="wasteDetails.isDangerous"
                                    value={String(dataToogle.wasteDetails.isDangerous)}
                                    onChange={handleChange}
                                    enableText={true}
                                    display={displayAll || shouldDisplayField("wasteDetails.isDangerous", changedField)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="text-sm font-semibold ml-6 mt-2">Prestataires</div>
                    <div className="w-[95%] pb-2 border-b border-3 mt-0 mx-auto border-gray-300">
                        {/*5ème ligne*/}
                        <div className="mt-0 flex justify-between gap-4 w-1/2 ml-8">


                        </div>
                        {/*6ème ligne*/}
                        <div className="mt-0 flex justify-between gap-4 w-1/2 ml-8">
                            {/*Transporteur*/}
                            <div>
                                <InputFull
                                    titre="Transporteur"
                                    placeholder="Sélectionner un transporteur"
                                    options={getUniqueOptions(options, allOptions, opt => opt.transporter.company.name)}
                                    width={1}
                                    name="transporter.company.name"
                                    value={dataToogle.transporter.company.name}
                                    onChange={handleChange}
                                    enableText={false}
                                    stylePrimary={true}
                                />
                                <InputFull
                                    titre="Siret"
                                    placeholder="Siret"
                                    options={getUniqueOptions(options, allOptions, opt => opt.transporter.company.siret)}
                                    width={1}
                                    name="transporter.company.siret"
                                    value={dataToogle.transporter.company.siret}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("transporter.company.siret", changedField)}
                                />
                                <InputFull
                                    titre="Contact"
                                    placeholder="Contact"
                                    options={getUniqueOptions(options, allOptions, opt => opt.transporter.company.contact)}
                                    width={1}
                                    name="transporter.company.contact"
                                    value={dataToogle.transporter.company.contact}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("transporter.company.contact", changedField)}
                                />
                                <InputFull
                                    titre="Adresse"
                                    placeholder="Adresse"
                                    options={getUniqueOptions(options, allOptions, opt => opt.transporter.company.address)}
                                    width={1}
                                    name="transporter.company.address"
                                    value={dataToogle.transporter.company.address}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("transporter.company.address", changedField)}
                                />
                                <InputFull
                                    titre="Téléphone"
                                    placeholder="Téléphone"
                                    options={getUniqueOptions(options, allOptions, opt => opt.transporter.company.phone)}
                                    width={1}
                                    name="transporter.company.phone"
                                    value={dataToogle.transporter.company.phone}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("transporter.company.phone", changedField)}
                                />
                                <InputFull
                                    titre="Mail"
                                    placeholder="Mail"
                                    options={getUniqueOptions(options, allOptions, opt => opt.transporter.company.mail)}
                                    width={1}
                                    name="transporter.company.mail"
                                    value={dataToogle.transporter.company.mail}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("transporter.company.mail", changedField)}
                                />
                                <InputFull
                                    titre="Exemption de récépissé"
                                    placeholder="Est exempté de récépissé"
                                    options={getUniqueOptions(options, allOptions, opt => opt.transporter.isExemptedOfReceipt===true ? 'true' : 'false')}
                                    width={1}
                                    name="transporter.isExemptedOfReceipt"
                                    value={dataToogle.transporter.isExemptedOfReceipt}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("transporter.isExemptedOfReceipt", changedField)}
                                />
                                <InputFull
                                    titre="Numéro de plaque"
                                    placeholder="Numéro de plaque"
                                    options={getUniqueOptions(options, allOptions, opt => opt.transporter.numberPlate || '')}
                                    width={1}
                                    name="transporter.numberPlate"
                                    value={dataToogle.transporter.numberPlate || ''}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("transporter.numberPlate", changedField)}
                                />
                                <InputFull
                                    titre="Informations complémentaires"
                                    placeholder="Informations complémentaires"
                                    options={getUniqueOptions(options, allOptions, opt => opt.transporter.customInfo || '')}
                                    width={1}
                                    name="transporter.customInfo"
                                    value={dataToogle.transporter.customInfo || ''}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("transporter.customInfo", changedField)}
                                />
                            </div>
                            {/*Destinataire*/}
                            <div>
                                <InputFull
                                    titre="Destinataire"
                                    placeholder="Sélectionner un destinataire"
                                    options={getUniqueOptions(options, allOptions, opt => opt.recipient.company.name)}
                                    width={1}
                                    name="recipient.company.name"
                                    value={dataToogle.recipient.company.name}
                                    onChange={handleChange}
                                    enableText={false}
                                    stylePrimary={true}
                                />
                                <InputFull
                                    titre="Siret"
                                    placeholder="Siret"
                                    options={getUniqueOptions(options, allOptions, opt => opt.recipient.company.siret)}
                                    width={1}
                                    name="recipient.company.siret"
                                    value={dataToogle.recipient.company.siret}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("recipient.company.siret", changedField)}
                                />
                                <InputFull
                                    titre="Adresse"
                                    placeholder="Adresse"
                                    options={getUniqueOptions(options, allOptions, opt => opt.recipient.company.address)}
                                    width={1}
                                    name="recipient.company.address"
                                    value={dataToogle.recipient.company.address}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("recipient.company.address", changedField)}
                                />
                                <InputFull
                                    titre="Contact"
                                    placeholder="Contact"
                                    options={getUniqueOptions(options, allOptions, opt => opt.recipient.company.contact)}
                                    width={1}
                                    name="recipient.company.contact"
                                    value={dataToogle.recipient.company.contact}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("recipient.company.contact", changedField)}
                                />
                                <InputFull
                                    titre="Téléphone"
                                    placeholder="Téléphone"
                                    options={getUniqueOptions(options, allOptions, opt => opt.recipient.company.phone)}
                                    width={1}
                                    name="recipient.company.phone"
                                    value={dataToogle.recipient.company.phone}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("recipient.company.phone", changedField)}
                                />
                                <InputFull
                                    titre="Mail"
                                    placeholder="Mail"
                                    options={getUniqueOptions(options, allOptions, opt => opt.recipient.company.mail)}
                                    width={1}
                                    name="recipient.company.mail"
                                    value={dataToogle.recipient.company.mail}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("recipient.company.mail", changedField)}
                                />
                                <InputFull
                                    titre="CAP"
                                    placeholder="CAP"
                                    options={getUniqueOptions(options, allOptions, opt => opt.recipient.cap || '')}
                                    width={1}
                                    name="recipient.cap"
                                    value={dataToogle.recipient.cap || ''}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("recipient.cap", changedField)}
                                />
                                <InputFull
                                    titre="Opération d'élimination"
                                    placeholder="Opération d'élimination"
                                    options={getUniqueOptions(options, allOptions, opt => opt.recipient.processingOperation || '')}
                                    width={1}
                                    name="recipient.processingOperation"
                                    value={dataToogle.recipient.processingOperation || ''}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("recipient.processingOperation", changedField)}
                                />
                                <InputFull
                                    titre="Stockage provisoire"
                                    placeholder="Est un stockage provisoire"
                                    options={{
                                        filteredOptions: ['false'],
                                        allOptions: ['true']
                                    }}
                                    width={1}
                                    name="recipient.isTempStorage"
                                    value={dataToogle.recipient.isTempStorage || ''}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("recipient.isTempStorage", changedField)}
                                />
                            </div>
                        </div>
                    </div>

                   
                    <div className="ml-[-10px]">
                        {(session?.entreprise_id && modalType !== 'create_line') && <MailComponent 
                            params={{
                                wasteCode: dataToogle.wasteDetails.code,
                                responsibleName: dataToogle.emitter.company.contact,
                                responsiblePhone: dataToogle.emitter.company.phone,
                                responsibleEmail: dataToogle.emitter.company.mail,
                                containerType: dataToogle.wasteDetails.packagingInfos[0].type,
                                collectionAddress: dataToogle.emitter.workSite.fullAddress,
                                destinataire: dataToogle.transporter.company.mail,
                                emetteur: dataToogle.emitter.company.mail,
                                entrepriseId: session.entreprise_id,
                                entrepriseName: dataToogle.emitter.company.name,
                                wasteDescription: dataToogle.wasteDetails.name,
                                containerCount: dataToogle.wasteDetails.packagingInfos[0].quantity,
                            }}
                        />}
                    </div>
                    <div>
                        <ModifyCardInFormulaireNew 
                            onClose={() => {setDisplayFormulaire(false); ResetData();}}
                            dataText={dataToogle}
                            setDataText={setDataToogle}
                            displayModifyCardInFormulaireNew={false}
                            modalType={modalType}
                            otherInfos={other_infos}
                        />
                    </div>
                    {/*<button type="button" className="text-md h-[25px] text-gray-500 bg-gray-200 px-2 rounded-md font-thin hover:text-gray-700 active:font-bold" onClick={() => setDisplayFormulaire(false)}>Fermer</button>*/}
                </form>
            </div>
        </div>
    );
}

export default FormulaireFull;


//Utils
interface Ced {
    ced: string;
    filiere: string;
}
const getDataAutocompletionFull = async (dataFilter: {name: string, value: string}[], entreprise_id: string, cedTable: Ced[]): Promise<FormInput[]> => { 
    
    let query = supabase
        .from('table_parametrage')
        .select('json_row')
        .eq('entreprise_id', entreprise_id);

    for (const {name, value} of dataFilter) {
        if(name === "filiere"){
            const table_ceds = cedTable.filter(ced => ced.filiere === value);
            const ceds = table_ceds.map(ced => ced.ced);
            const ceds_all_types = ceds.map(ced => [
                ced,
                ced.replace(/(\d{2})(?=\d)/g, '$1 ').trim(),
                ced.replace(/(\d{2})(?=\d)/g, '$1 ').trim() + '*'
            ]);
            const ced_all = ceds_all_types.flatMap(ced_types => ced_types);
            query = query.filter('json_row->wasteDetails->>code', 'in', `(${ced_all.join(',')})`);
        } else if (value && typeof value === 'string') {
            const name_prefilter = name.replaceAll('.', '->');
            const name_filter = replaceLastOccurrence(name_prefilter, '->', '->>');
            query = query.eq(`json_row->${name_filter}`, value);
        }
    }
    //console.log("query", query);
    const data = await query;
    return (data?.data?.map(row => row.json_row) || []) as FormInput[];
}

function replaceLastOccurrence(str: string, search: string, replacement: string) {
    const lastIndex = str.lastIndexOf(search);
    if (lastIndex === -1) return str;
    
    return str.substring(0, lastIndex) + replacement + str.substring(lastIndex + search.length);
}

const getUniqueOptions = (filteredOptions: FormInput[], allOptions: FormInput[], selector: (opt: FormInput) => string) => {
    const filteredValues = Array.from(new Set(filteredOptions.map(selector))).filter(Boolean) as string[];
    const allValues = Array.from(new Set(allOptions.map(selector))).filter(Boolean) as string[];
    
    return {
        filteredOptions: filteredValues,
        allOptions: allValues.filter(val => !filteredValues.includes(val))
    };
};

// Fonction pour vérifier si un champ est un ancêtre d'un autre
const isAncestor = (potentialAncestor: string, field: string, inputDependencies: {[key: string]: {children: string[], filterFields?: string[]}}) => {   
    return inputDependencies[potentialAncestor]?.children.includes(field);
};

const dataFilterUpdate = (setCurrentFiliere: (filiere: string) => void, ced_table: { ced: string; filiere: string; }[], name: string, value: string, dataFilter: {name: string, value: string}[], setDataFilter: (dataFilter: {name: string, value: string}[]) => void, inputDependencies: InputDependencies) => {
    if(name === "wasteDetails.packagingInfos[0].type") {
        return dataFilter;
    }
    const newDataFilter = dataFilter
    if (value && inputDependencies[name]!==undefined) { //empeche de mettre à jour le datafilter si ce n'est pas un champ parent de l'inputDependencies
            if (name === "filiere") {
            setCurrentFiliere(value);
            updateOrPush(newDataFilter, "filiere", value);
            //newDataFilter.push({ name, value });
        }
        else if(name === "wasteDetails.code") {
            const codeValue = value.split(' - ')[1];
            updateOrPush(newDataFilter, "wasteDetails.code", codeValue);
            // Mettre à jour la filière quand le code change
            const newFiliere = getFiliere(codeValue, ced_table);
            setCurrentFiliere(newFiliere);
            // Ajouter le filtre filière
            if (newFiliere) {
                for(const binome of newDataFilter) {
                    if(binome.name === "filiere") {
                        binome.value = newFiliere;
                    }
                }
            }
        }
        else if(name === "wasteDetails.name") {
            const value_split = value.split(" - ");
            updateOrPush(newDataFilter, "wasteDetails.name", value_split[0]);
        } else {
            updateOrPush(newDataFilter, name, value);
        }
    console.log("newDataFilter", newDataFilter);
    }
    
    setDataFilter(newDataFilter);
    return newDataFilter;
}

const updateOrPush = (newDataFilter: {name: string, value: string}[], name: string, value: string) => {
    const existingItem = newDataFilter.find(item => item.name === name);
    if (existingItem) {
        existingItem.value = value; // Met à jour la valeur
    } else {
        newDataFilter.push({ name, value }); // Ajoute un nouvel élément
    }
};
