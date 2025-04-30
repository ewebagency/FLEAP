import { FormInput } from "@/app/register/interface/BSD_Interface";
import { useModalContextNew } from "../ContextModal";
import InputFull from "./InputFull";
import { formatText, getDataAutocompletion, getMappingTableFiliere, getFiliere, filter_dependencies } from "./utils_new";
import { useEffect, useState, useRef } from "react";
import { useSession } from "@/app/component/SessionProvider";
import MailComponent from "@/app/register/MailComponents/MailComponent";
import ModifyCardInFormulaireNew from "./ModifyCardInFormulaireNew";
import { supabase } from "@/app/database/supabaseClient";
import BoxIcon from "@/app/component/BoxIconWrapper";
import { useFilterContext } from "@/app/FilterContext";
import { OtherInfos, CompleteFormInput } from "@/app/register/interface/BSD_Interface";
import { toast } from "react-hot-toast";
import { createRoot } from "react-dom/client";
import DatePicker from "react-datepicker";
import { invalidateCache } from "@/app/utils/invalidateCache";
import { typeTraitement } from "@/app/component/Analyse/Environnementale/codeTraitement";

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
      packagingInfos: [{ type: "AUTRE" as "FUT" | "GRV" | "CITERNE" | "BENNE" | "PIPELINE" | "AUTRE", quantity: 1, other: "" }],
      quantity: 0,
      quantityType: "ESTIMATED" as "REAL" | "ESTIMATED",
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


const initialOtherInfos: OtherInfos = {
  containerDescription: "",
  volume: "",
  volumeUnit: "",
  fillRate: "",
  inputMode: "volume",
  automaticMode: true
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
    'wasteDetails.name': {
        children: ['wasteDetails.code', 'wasteDetails.isSubjectToADR', 'wasteDetails.onuCode']
    },
    'wasteDetails.packagingInfos[0].type': {
        children: [
            'wasteDetails.packagingInfos[0].other',
            'wasteDetails.packagingInfos[0].quantity',
            'wasteDetails.quantity',
            'wasteDetails.quantityType',
            'wasteDetails.consistence',
            'wasteDetails.pop',
            'wasteDetails.isDangerous',
            'other_infos.volume',
            'other_infos.volumeUnit',
            'other_infos.containerDescription',
            'other_infos.fillRate'
        ]
    },
    'emitter.company.contact': {
        children: ['emitter.company.mail', 'emitter.company.phone']
    },
    'transporter.company.name': {
        children: ['transporter.company.siret', 'transporter.company.address', 'transporter.company.contact', 'transporter.company.phone', 'transporter.company.mail', 'transporter.isExemptedOfReceipt', 'transporter.receipt', 'transporter.numberPlate', 'transporter.customInfo']
    },
    'recipient.company.name': {
        children: ['recipient.company.siret', 'recipient.company.address', 'recipient.company.contact', 'recipient.company.phone', 'recipient.company.mail', 'recipient.cap', 'recipient.processingOperation', 'recipient.isTempStorage']
    },
    'other_infos.containerDescription': {
        children: ['other_infos.volume', 'other_infos.volumeUnit'],
        filterFields: ['other_infos.containerDescription']
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

    // Cas spécial pour les champs de other_infos
    const otherInfosFields = ['containerDescription', 'volume', 'volumeUnit'];
    if (otherInfosFields.includes(currentField)) {
        // Si le champ changé est le type de contenant, afficher tous les champs de other_infos
        if (changedField === 'wasteDetails.packagingInfos[0].type') {
            return true;
        }
        // Si le champ changé est un autre champ de other_infos, afficher les champs liés
        if (otherInfosFields.includes(changedField)) {
            return true;
        }
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
        const value = path.split('.').reduce<unknown>((obj, key) => 
            typeof obj === 'object' && obj ? (obj as Record<string, unknown>)[key] : undefined,
            obj as unknown as Record<string, unknown>
        );
        
        if (typeof value === 'boolean' || typeof value === 'number') {
            return String(value);
        }
        return value?.toString() || '';
    } catch (error) {
        console.error(`Erreur lors de l'accès au chemin ${path}:`, error);
        return '';
    }
};

// Définir une interface pour le type d'option
interface OptionType {
    json_row: FormInput;
    other_infos?: OtherInfos;
}

interface FormulaireFullProps {
    options: CompleteFormInput[];
    allOptions: CompleteFormInput[];
}

const FormulaireFull = () => {

    const {             
        setDisplayFormulaire,
        dataToogle,
        setDataToogle,
        options,
        setOptions,
        modalType } = useModalContextNew();
    const [currentFiliere, setCurrentFiliere] = useState("");
    const {entreprise_id, user_id, user_email, user_contact, user_phone} = useSession();
    const [ced_table, setCedTable] = useState<{ ced: string, filiere: string }[]>([]);
    const [displayAll, setDisplayAll] = useState(false);
    const [dataFilter, setDataFilter] = useState<{name: string, value: string}[]>([]);
    const [allOptions, setAllOptions] = useState<{json_row: FormInput, other_infos?: OtherInfos}[]>([]);
    const [changedField, setChangedField] = useState<string>("");
    const [other_infos, setOtherInfos] = useState<OtherInfos>(initialOtherInfos);
    const { sites } = useFilterContext();

    // Ajouter une ref pour tracker la dernière modification
    const lastChangedField = useRef<string>('');

    // Ajouter un état pour tracker si l'autocomplétion est désactivée
    const [disableAutocompletion, setDisableAutocompletion] = useState(false);

    // Définition des champs qui désactivent l'autocomplétion
    const disablingFields = [
        'wasteDetails.quantity',
        'wasteDetails.packagingInfos[0].quantity',
        'volume',
        'volumeUnit',
        'fillRate'
    ];

    useEffect(() => {
        if(user_email) {
            setDataToogle(prev => ({
                ...prev,
                emitter: {
                    ...prev.emitter,
                    company: {
                        ...prev.emitter.company,
                        mail: user_email,
                        contact: user_contact || '',
                        phone: user_phone || ''
                    }
                }
            }));
        }
    }, [user_email, user_contact, user_phone]);

//Initialisation des options
useEffect(() => {
    if(entreprise_id) {
        getDataAutocompletionFull([], entreprise_id, []).then(data => {
            setAllOptions(data);
            setOptions(data);
        });
    }
}, [entreprise_id]);

//Initialisation de ced_table
useEffect(() => {
    //aller chercher la table mapping filiere
    if(entreprise_id) {
        getMappingTableFiliere(entreprise_id).then(data => setCedTable(data));
    }
}, [entreprise_id]);

// Ajouter un useEffect pour initialiser les données avec le site sélectionné
/*useEffect(() => {
    // Trouver le premier site coché
    const checkedSite = sites.find(site => site.checked);
    if (checkedSite) {
        setDataToogle(prev => ({
            ...prev,
            emitter: {
                ...prev.emitter,
                company: {
                    ...prev.emitter.company,
                    name: checkedSite.name,
                    siret: checkedSite.orgId
                }
            }
        }));
    }
}, [sites]); // Se déclenche quand les sites changent*/

//HandleChange -> AUTOCOMPLETION
const handleChange = async (e: React.ChangeEvent<HTMLSelectElement> | { target: { name: string; value: string } }) => {
    const { name, value } = e.target;
    // Mettre à jour le champ qui a changé
    if(Object.keys(inputDependencies).includes(name)) {
        setChangedField(name);
    }

    // Liste des champs qui désactivent l'autocomplétion
    const disablingFields = [
        'wasteDetails.quantity',
        'wasteDetails.packagingInfos[0].quantity',
        'other_infos.volume',
        'other_infos.volumeUnit',
        'other_infos.fillRate'
    ];

    // Activer/désactiver l'autocomplétion selon le champ modifié
    if (disablingFields.includes(name)) {
        setDisableAutocompletion(true);
    } else {
        setDisableAutocompletion(false);
    }

    // Création de newData avant son utilisation
    const newData = JSON.parse(JSON.stringify(dataToogle)) as FormInput;
    
    // Mettre à jour la valeur dans newData
    let convertedValue: string | number | boolean = value;
    if (name === 'wasteDetails.quantity') {
        convertedValue = value ? parseFloat(value) : 0;
    }
    updateNestedValue(newData as unknown as NestedObject, name, convertedValue);
    
    // Mettre à jour dataToogle avec les nouvelles valeurs
    setDataToogle(newData);

    // Mise à jour de dataFilter seulement si ce n'est pas un champ désactivant l'autocomplétion
    if (!disablingFields.includes(name)) {
        const newDataFilter = dataFilterUpdate(
            setCurrentFiliere, 
            ced_table, 
            name, 
            value, 
            dataFilter, 
            setDataFilter, 
            inputDependencies
        );

        // Mise à jour des options si nécessaire
    if (entreprise_id) {
        try {
                const [filteredOptions, allOptionsData] = await Promise.all([
                    getDataAutocompletionFull(newDataFilter, entreprise_id, ced_table),
                getDataAutocompletionFull([], entreprise_id, ced_table)
            ]);
            
                setOptions(filteredOptions);
                setAllOptions(allOptionsData);
        } catch (error) {
            console.error("Erreur lors de la mise à jour des options:", error);
            }
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
    if(entreprise_id) {
        getDataAutocompletionFull([], entreprise_id, []).then(data => setOptions(data));
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
const handleOtherInfosChange = async (updates: Partial<{
    containerDescription: string;
    volume: string;
    volumeUnit: string;
    fillRate: string;
}>) => {
    // Mettre à jour other_infos
    setOtherInfos(prev => ({
        ...prev,
        ...updates
    }));

    // Mettre à jour le champ changé pour l'affichage
    const changedFieldName = Object.keys(updates)[0];
    setChangedField(changedFieldName);

    // Mise à jour de dataFilter pour l'autocomplétion
    if (!disablingFields.includes(changedFieldName)) {
        const newDataFilter = [...dataFilter];
        const fieldValue = updates[changedFieldName as keyof typeof updates] || '';
        
        // Mettre à jour ou ajouter le filtre pour le champ other_infos
        const filterName = `other_infos.${changedFieldName}`;
        const existingFilterIndex = newDataFilter.findIndex(f => f.name === filterName);
        
        if (existingFilterIndex !== -1) {
            newDataFilter[existingFilterIndex].value = fieldValue;
        } else {
            newDataFilter.push({ name: filterName, value: fieldValue });
        }

        setDataFilter(newDataFilter);

        // Mise à jour des options si nécessaire
        if (entreprise_id) {
            try {
                const [filteredOptions, allOptionsData] = await Promise.all([
                    getDataAutocompletionFull(newDataFilter, entreprise_id, ced_table),
                    getDataAutocompletionFull([], entreprise_id, ced_table)
                ]);
                
                setOptions(filteredOptions);
                setAllOptions(allOptionsData);

                // Si le champ changé est containerDescription, mettre à jour volume et volumeUnit
                if (changedFieldName === 'containerDescription') {
                    // Filtrer les options sur le containerDescription
                    const filteredByContainer = allOptionsData.filter(opt => 
                        opt.other_infos?.containerDescription === fieldValue
                    );

                    if (filteredByContainer.length > 0) {
                        // Calculer les valeurs les plus fréquentes pour volume et volumeUnit
                        const volumeCounts = filteredByContainer.reduce((acc, opt) => {
                            const volume = opt.other_infos?.volume;
                            if (volume) {
                                acc[volume] = (acc[volume] || 0) + 1;
                            }
                            return acc;
                        }, {} as Record<string, number>);

                        const volumeUnitCounts = filteredByContainer.reduce((acc, opt) => {
                            const unit = opt.other_infos?.volumeUnit;
                            if (unit) {
                                acc[unit] = (acc[unit] || 0) + 1;
                            }
                            return acc;
                        }, {} as Record<string, number>);

                        // Trouver les valeurs les plus fréquentes
                        const mostFrequentVolume = Object.entries(volumeCounts)
                            .sort(([,a], [,b]) => b - a)[0]?.[0];
                        const mostFrequentUnit = Object.entries(volumeUnitCounts)
                            .sort(([,a], [,b]) => b - a)[0]?.[0];

                        // Mettre à jour les valeurs si elles existent
                        if (mostFrequentVolume) {
                            setOtherInfos(prev => ({
                                ...prev,
                                volume: mostFrequentVolume
                            }));
                        }
                        if (mostFrequentUnit) {
                            setOtherInfos(prev => ({
                                ...prev,
                                volumeUnit: mostFrequentUnit
                            }));
                        }
                    }
                }
            } catch (error) {
                console.error("Erreur lors de la mise à jour des options:", error);
            }
        }
    }
};

// Modifier le useEffect pour prendre en compte l'état de désactivation
useEffect(() => {
    // Ne pas exécuter l'autocomplétion si elle est désactivée
    if (disableAutocompletion) {
        return;
    }

    Object.entries(filter_dependencies).forEach(([key, config]) => {
        const allParentsHaveValues = config.parent.every(parentField => {
            let parentValue;
            if (parentField.startsWith('other_infos.')) {
                const fieldName = parentField.replace('other_infos.', '');
                parentValue = other_infos[fieldName as keyof OtherInfos];
            } else {
                parentValue = parentField.split('.').reduce<unknown>((obj, key) => 
                    typeof obj === 'object' && obj ? (obj as Record<string, unknown>)[key] : undefined,
                    dataToogle as unknown as Record<string, unknown>
                );
            }
            return parentValue && parentValue !== '';
        });

        if (allParentsHaveValues) {
            const newData = { ...dataToogle };
            let hasUpdates = false;

            config.children.forEach(childField => {
                let currentValue;
                if (childField.startsWith('other_infos.')) {
                    const fieldName = childField.replace('other_infos.', '');
                    currentValue = other_infos[fieldName as keyof OtherInfos];
                } else {
                    currentValue = childField.split('.').reduce<unknown>((obj, key) => 
                        typeof obj === 'object' && obj ? (obj as Record<string, unknown>)[key] : undefined,
                        dataToogle as unknown as Record<string, unknown>
                    );
                }

                if (!currentValue || currentValue === '') {
                    const suggestedValue = preciseFilter(
                        allOptions,
                        newData,
                        config.parent,
                        childField
                    );
                    
                    if (suggestedValue) {
                        if (childField.startsWith('other_infos.')) {
                            const fieldName = childField.replace('other_infos.', '');
                            setOtherInfos(prev => ({
                                ...prev,
                                [fieldName]: suggestedValue
                            }));
                        } else {
                            updateNestedValue(newData as unknown as NestedObject, childField, suggestedValue);
                        }
                        hasUpdates = true;
                    }
                }
            });

            if (hasUpdates) {
                setDataToogle(newData);
            }
        }
    });
}, [dataToogle, allOptions, disableAutocompletion, other_infos]);

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
                                options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.name)}
                                width={40}
                                name="emitter.company.name"
                                value={dataToogle.emitter.company.name}
                                onChange={handleChange}
                                enableText={true}
                                stylePrimary={true}
                            />
                            <InputFull
                                titre="Siret"
                                placeholder="Siret"
                                options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.siret)}
                                width={40}
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
                            {/*Point de Collecte*/}
                            <div>
                                <InputFull
                                    titre="Point de collecte"
                                    placeholder="Sélectionner un point de collecte"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.workSite.name)}
                                    width={40}
                                    name="emitter.workSite.name"
                                    value={dataToogle.emitter.workSite.name}
                                    onChange={handleChange}
                                    enableText={true}
                                    stylePrimary={true}
                                />
                                <InputFull
                                    titre="Adresse d'enlèvement"
                                    placeholder="Adresse"
                                    options={getUniqueOptions(options, allOptions, opt => `${formatText(opt.json_row.emitter.workSite.fullAddress ?? "")}`)}
                                    width={40}
                                    name="emitter.workSite.fullAddress"
                                    value={`${formatText(dataToogle.emitter.workSite.fullAddress ?? "")}`}
                                    onChange={handleChange}
                                    enableText={true}
                                    display={displayAll || shouldDisplayField("emitter.workSite.fullAddress", changedField)}
                                />
                                <InputFull
                                    titre="Infos"
                                    placeholder="Infos"
                                    options={getUniqueOptions(options, allOptions, opt => `${formatText(opt.json_row.emitter.workSite.infos ?? "")}`)}
                                    width={40}
                                    name="emitter.workSite.infos"
                                    value={`${formatText(dataToogle.emitter.workSite.infos ?? "")}`}
                                    onChange={handleChange}
                                    enableText={true}
                                    display={displayAll || (shouldDisplayField("emitter.workSite.infos", changedField) && false)}
                                />
                            </div>
                        </div>
                        {/*2ème ligne*/}
                        <div className="mt-0 flex justify-between gap-4 w-1/2 ml-8 hidden">
                            {/*Personne */}
                            <div>
                                <InputFull
                                    titre="Personne"
                                    placeholder="Contact"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.contact)}
                                    width={40}
                                    name="emitter.company.contact"
                                    value={dataToogle.emitter.company.contact}
                                    onChange={handleChange}
                                    enableText={true}
                                    stylePrimary={true}
                                    display={displayAll || (shouldDisplayField("emitter.company.workSite.fullAddress", changedField) && false)}
                                />
                                <InputFull
                                    titre="Téléphone"
                                    placeholder="Téléphone"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.phone)}
                                    width={40}
                                    name="emitter.company.phone"
                                    value={dataToogle.emitter.company.phone}
                                    onChange={handleChange}
                                    enableText={true}
                                    display={displayAll || (shouldDisplayField("emitter.company.phone", changedField) && false)}
                                />
                                <InputFull
                                    titre="Mail"
                                    placeholder="Mail"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.mail)}
                                    width={40}
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
                            {/*Déchet*/}
                            <div>
                                <InputFull
                                    titre="Filière"
                                    placeholder="Sélectionner une filière"
                                    options={getUniqueOptions(options, allOptions, opt => getFiliere(opt.json_row.wasteDetails.code, ced_table))}
                                    width={40}
                                    name="filiere"
                                    value={currentFiliere}
                                    onChange={handleChange}
                                    enableText={false}
                                    stylePrimary={true}
                                    display={false}
                                />                                
                                <InputFull
                                    titre="Déchet"
                                    placeholder="Nom du déchet"
                                    options={getUniqueOptions(options, allOptions, opt => `${opt.json_row.wasteDetails.name}`)}
                                    width={40}
                                    name="wasteDetails.name"
                                    value={dataToogle.wasteDetails.name}
                                    onChange={handleChange}
                                    enableText={false}
                                    stylePrimary={true}
                                />
                                <InputFull
                                    titre="Code CED"
                                    placeholder="Sélectionner un code"
                                    options={getUniqueOptions(options, allOptions, opt => `${opt.json_row.wasteDetails.code}`)}
                                    width={40}
                                    name="wasteDetails.code"
                                    value={dataToogle.wasteDetails.code}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("wasteDetails.code", changedField)}
                                />      
                                <InputFull
                                    titre="Code ONU"
                                    placeholder="Code ONU"
                                    options={getUniqueOptions(options, allOptions, opt => `${opt.json_row.wasteDetails.onuCode}`)}
                                    width={40}
                                    name="wasteDetails.onuCode"
                                    value={dataToogle.wasteDetails.onuCode}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || (false && shouldDisplayField("wasteDetails.onuCode", changedField))}
                                />
                            </div>
                            <div>
                                <InputFull
                                        titre="Contenant"
                                        placeholder="Sélectionner un contenant"
                                        options={{
                                            filteredOptions: getUniqueOptions(options, allOptions, opt => `${opt.json_row.wasteDetails.packagingInfos[0].type}`).filteredOptions,
                                            allOptions: ['FUT', 'GRV', 'CITERNE', 'BENNE', 'PIPELINE', 'AUTRE']
                                        }}
                                        width={40}
                                        name="wasteDetails.packagingInfos[0].type"
                                        value={dataToogle.wasteDetails.packagingInfos[0].type}
                                        onChange={handleChange}
                                        enableText={false}
                                        stylePrimary={true}
                                        display={false && (displayAll || (false && shouldDisplayField("wasteDetails.packagingInfos[0].type", changedField)))}
                                    />
                                    {/* Nouveaux champs pour other_infos */}
                                    <InputFull
                                        titre="Contenant"
                                        placeholder="Nom du contenant"
                                        name="containerDescription"
                                        value={other_infos.containerDescription || ''}
                                        onChange={(e: string | { target: { name: string; value: string } }) => {
                                            const newValue = typeof e === 'object' && 'target' in e ? e.target.value : e
                                            handleOtherInfosChange({ containerDescription: String(newValue) })
                                        }}
                                        options={getUniqueOptions(options, allOptions, opt => opt.other_infos?.containerDescription || '')}
                                        enabled={true}
                                        stylePrimary={true}
                                        width={40}
                                    />
                                    <InputFull
                                        titre="Volume"
                                        placeholder="Volume"
                                        name="volume"
                                        value={other_infos.volume || ''}
                                        onChange={(e: string | { target: { name: string; value: string } }) => {
                                            const newValue = typeof e === 'object' && 'target' in e ? e.target.value : e
                                            handleOtherInfosChange({ volume: String(newValue) })
                                        }}
                                        options={getUniqueOptions(options, allOptions, opt => opt.other_infos?.volume || '')}
                                        enabled={true}
                                        display={displayAll || shouldDisplayField("volume", changedField)}
                                        width={40}
                                    />
                                    <InputFull
                                        titre="Unité"
                                        placeholder="m3 ou L"
                                        name="volumeUnit"
                                        value={other_infos.volumeUnit || ''}
                                        onChange={(e: string | { target: { name: string; value: string } }) => {
                                            const newValue = typeof e === 'object' && 'target' in e ? e.target.value : e
                                            handleOtherInfosChange({ volumeUnit: String(newValue) })
                                        }}
                                        options={{
                                            filteredOptions: [],
                                            allOptions: ['m3', 'L']
                                        }}
                                        enabled={true}
                                        display={displayAll || shouldDisplayField("volumeUnit", changedField)}
                                        width={40}
                                    />
                                    <InputFull
                                        titre="Quantité (t)"
                                        placeholder="Quantité (en tonnes)"
                                        name="wasteDetails.quantity"
                                        value={String(dataToogle.wasteDetails.quantity)}
                                        onChange={handleChange}
                                        options={{
                                            filteredOptions: [],
                                            allOptions: ['0.5', '1', '1.5', '2', '2.5', '3']
                                        }}
                                        enableText={true}
                                        display={displayAll || shouldDisplayField("wasteDetails.quantity", changedField)}
                                        width={40}
                                    />
                                    <InputFull
                                        titre="Remplissage"
                                        placeholder="Taux de remplissage"
                                        name="fillRate"
                                        value={other_infos.fillRate || ''}
                                        onChange={(e: string | { target: { name: string; value: string } }) => {
                                            const newValue = typeof e === 'object' && 'target' in e ? e.target.value : e
                                            handleOtherInfosChange({ fillRate: String(newValue) })
                                        }}
                                        options={{
                                            filteredOptions: [],
                                            allOptions: ['50', '75', '95']
                                        }}
                                        enabled={true}
                                        display={false && (displayAll || (false && shouldDisplayField("fillRate", changedField)))}
                                        width={40}
                                    />
                            </div>
                        </div>
                        {/*4ème ligne*/}
                        <div className="mt-0 flex justify-between gap-4 w-1/2 ml-8">

                            {/*Contenant*/}
                            <div>
                                <InputFull
                                    titre="Nombre"
                                    placeholder="Nombre"
                                    options={getUniqueOptions(options, allOptions, opt => `${opt.json_row.wasteDetails.packagingInfos[0].quantity}`)}
                                    width={40}
                                    name="wasteDetails.packagingInfos[0].quantity"
                                    value={String(dataToogle.wasteDetails.packagingInfos[0].quantity)}
                                    onChange={handleChange}
                                    enableText={true}
                                    display={false && (displayAll || (false && shouldDisplayField("wasteDetails.packagingInfos[0].quantity", changedField)))}
                                />
                                <InputFull
                                    titre="Poids"
                                    placeholder="Poids en tonnes"
                                    options={{
                                        filteredOptions: [],
                                        allOptions: ['0.5', '1', '1.5', '2', '2.5', '3']
                                    }}
                                    width={40}
                                    name="wasteDetails.quantity"
                                    value={String(dataToogle.wasteDetails.quantity)}
                                    onChange={handleChange}
                                    enableText={true}
                                    display={false && (displayAll || (false && shouldDisplayField("wasteDetails.quantity", changedField)))}
                                />
                                <InputFull
                                    titre="Consistance"
                                    placeholder="Consistance"
                                    options={{
                                        filteredOptions: getUniqueOptions(options, allOptions, opt => `${opt.json_row.wasteDetails.consistence}`).filteredOptions,
                                        allOptions: ['SOLID', 'LIQUID', 'GASEOUS', 'DOUGHY']
                                    }}
                                    width={40}
                                    name="wasteDetails.consistence"
                                    value={String(dataToogle.wasteDetails.consistence)}
                                    onChange={handleChange}
                                    enableText={true}
                                    display={displayAll || (false && shouldDisplayField("wasteDetails.consistence", changedField))}
                                />                                
                                <InputFull
                                    titre="Type de quantité "
                                    placeholder="Type de quantité"
                                    options={{
                                        filteredOptions: ['ESTIMATED'],
                                        allOptions: ['REAL']
                                    }}
                                    width={40}
                                    name="wasteDetails.quantityType"
                                    value={String(dataToogle.wasteDetails.quantityType)}
                                    onChange={handleChange}
                                    enableText={true}
                                    display={displayAll || (false && shouldDisplayField("wasteDetails.quantityType", changedField))}
                                />
                                <div className="flex justify-start gap-[-10px]">
                                    <InputFull
                                        titre="Sujet à l'ADR"
                                        placeholder="Sujet à l'ADR"
                                        options={getUniqueOptions(options, allOptions, opt => `${opt.json_row.wasteDetails.isSubjectToADR}`)}
                                        width={2}
                                        name="wasteDetails.isSubjectToADR"
                                        value={dataToogle.wasteDetails.isSubjectToADR}
                                        onChange={handleChange}
                                        enableText={false}
                                        isCheckbox={true}
                                        display={displayAll || (shouldDisplayField("wasteDetails.isSubjectToADR", changedField) && false)}
                                    />                                
                                    <InputFull
                                        titre="Pop"
                                        placeholder="Pop"
                                        options={{
                                            filteredOptions: getUniqueOptions(options, allOptions, opt => `${opt.json_row.wasteDetails.pop}`).filteredOptions,
                                            allOptions: ['true', 'false']
                                        }}
                                        width={2}
                                        name="wasteDetails.pop"
                                        value={String(dataToogle.wasteDetails.pop)}
                                        onChange={handleChange}
                                        enableText={true}
                                        isCheckbox={true}
                                        display={displayAll || (false && shouldDisplayField("wasteDetails.pop", changedField))}
                                    />
                                    <InputFull
                                        titre="Dangereux"
                                        placeholder="Est dangereux"
                                        options={{
                                            filteredOptions: [dataToogle.wasteDetails.code?.includes('*') ? 'true' : 'false'],
                                            allOptions: ['true', 'false']
                                        }}
                                        width={2}
                                        name="wasteDetails.isDangerous"
                                        value={String(dataToogle.wasteDetails.isDangerous)}
                                        onChange={handleChange}
                                        enableText={true}
                                        isCheckbox={true}
                                        display={displayAll || (false && shouldDisplayField("wasteDetails.isDangerous", changedField))}
                                    />
                                </div>
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
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.transporter.company.name)}
                                    width={40}
                                    name="transporter.company.name"
                                    value={dataToogle.transporter.company.name}
                                    onChange={handleChange}
                                    enableText={false}
                                    stylePrimary={true}
                                />
                                <InputFull
                                    titre="Siret"
                                    placeholder="Siret"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.transporter.company.siret)}
                                    width={40}
                                    name="transporter.company.siret"
                                    value={dataToogle.transporter.company.siret}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("transporter.company.siret", changedField)}
                                />
                                <InputFull
                                    titre="Contact"
                                    placeholder="Contact"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.transporter.company.contact)}
                                    width={40}
                                    name="transporter.company.contact"
                                    value={dataToogle.transporter.company.contact}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || (false && shouldDisplayField("transporter.company.contact", changedField))}
                                />
                                <InputFull
                                    titre="Adresse"
                                    placeholder="Adresse"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.transporter.company.address)}
                                    width={40}
                                    name="transporter.company.address"
                                    value={dataToogle.transporter.company.address}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || (false && shouldDisplayField("transporter.company.address", changedField))}
                                />
                                <InputFull
                                    titre="Téléphone"
                                    placeholder="Téléphone"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.transporter.company.phone)}
                                    width={40}
                                    name="transporter.company.phone"
                                    value={dataToogle.transporter.company.phone}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || (false && shouldDisplayField("transporter.company.phone", changedField))}
                                />
                                <InputFull
                                    titre="Mail"
                                    placeholder="Mail"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.transporter.company.mail)}
                                    width={40}
                                    name="transporter.company.mail"
                                    value={dataToogle.transporter.company.mail}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("transporter.company.mail", changedField)}
                                />
                                <InputFull
                                    titre="Exemption"
                                    placeholder="Est exempté de récépissé"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.transporter.isExemptedOfReceipt===true ? 'true' : 'false')}
                                    width={40}
                                    name="transporter.isExemptedOfReceipt"
                                    value={dataToogle.transporter.isExemptedOfReceipt}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || (false && shouldDisplayField("transporter.isExemptedOfReceipt", changedField))}
                                />
                                <InputFull
                                    titre="Numéro de plaque"
                                    placeholder="Numéro de plaque"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.transporter.numberPlate || '')}
                                    width={40}
                                    name="transporter.numberPlate"
                                    value={dataToogle.transporter.numberPlate || ''}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("transporter.numberPlate", changedField)}
                                />
                                <InputFull
                                    titre="Informations complémentaires"
                                    placeholder="Informations complémentaires"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.transporter.customInfo || '')}
                                    width={40}
                                    name="transporter.customInfo"
                                    value={dataToogle.transporter.customInfo || ''}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || (false && shouldDisplayField("transporter.customInfo", changedField))}
                                />
                            </div>
                            {/*Destinataire*/}
                            <div>
                                <InputFull
                                    titre="Destinataire"
                                    placeholder="Sélectionner un destinataire"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.recipient.company.name)}
                                    width={40}
                                    name="recipient.company.name"
                                    value={dataToogle.recipient.company.name}
                                    onChange={handleChange}
                                    enableText={false}
                                    stylePrimary={true}
                                />
                                <InputFull
                                    titre="Siret"
                                    placeholder="Siret"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.recipient.company.siret)}
                                    width={40}
                                    name="recipient.company.siret"
                                    value={dataToogle.recipient.company.siret}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("recipient.company.siret", changedField)}
                                />
                                <InputFull
                                    titre="Adresse"
                                    placeholder="Adresse"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.recipient.company.address)}
                                    width={40}
                                    name="recipient.company.address"
                                    value={dataToogle.recipient.company.address}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || (false && shouldDisplayField("recipient.company.address", changedField))}
                                />
                                <InputFull
                                    titre="Contact"
                                    placeholder="Contact"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.recipient.company.contact)}
                                    width={40}
                                    name="recipient.company.contact"
                                    value={dataToogle.recipient.company.contact}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || (false && shouldDisplayField("recipient.company.contact", changedField))}
                                />
                                <InputFull
                                    titre="Téléphone"
                                    placeholder="Téléphone"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.recipient.company.phone)}
                                    width={40}
                                    name="recipient.company.phone"
                                    value={dataToogle.recipient.company.phone}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || (false && shouldDisplayField("recipient.company.phone", changedField))}
                                />
                                <InputFull
                                    titre="Mail"
                                    placeholder="Mail"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.recipient.company.mail)}
                                    width={40}
                                    name="recipient.company.mail"
                                    value={dataToogle.recipient.company.mail}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("recipient.company.mail", changedField)}
                                />
                                <InputFull
                                    titre="CAP"
                                    placeholder="CAP"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.recipient.cap || '')}
                                    width={40}
                                    name="recipient.cap"
                                    value={dataToogle.recipient.cap || ''}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("recipient.cap", changedField)}
                                />
                                <InputFull
                                    titre="Opération d'élimination"
                                    placeholder="Opération d'élimination"
                                    options={{
                                        filteredOptions: [],
                                        allOptions: Object.entries(typeTraitement).flatMap(([group, codes]) => 
                                            codes.map(code => `${group} - ${code}`)
                                        )
                                    }}
                                    width={40}
                                    name="recipient.processingOperation"
                                    value={dataToogle.recipient.processingOperation || ''}
                                    onChange={(e) => {
                                        const value = typeof e === 'object' && 'target' in e ? e.target.value : e;
                                        const code = value.split(' - ')[1] || '';
                                        handleChange({ target: { name: 'recipient.processingOperation', value: code } });
                                    }}
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
                                    width={40}
                                    name="recipient.isTempStorage"
                                    value={dataToogle.recipient.isTempStorage || ''}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || (false && shouldDisplayField("recipient.isTempStorage", changedField))}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="text-sm font-semibold ml-6 mt-2">Date de collecte</div>
                    <div className="w-[95%] pb-2 border-b border-3 mt-0 mx-auto border-gray-300">
                        <div className="mt-0 flex justify-between gap-4 w-1/2 ml-8">
                            <div className="flex items-center justify-between mr-4 mt-2 gap-2">
                                <label className="block text-sm text-gray-500 font-medium mb-1 md:w-[90px] text-right ml-8">
                                    Collecté le
                                </label>
                                <div className="flex-1 mr-2 w-[130px]">
                                    <DatePicker
                                        selected={dataToogle.takenOverAt ? new Date(dataToogle.takenOverAt + 'T00:00:00') : null}
                                        onChange={(date) => {
                                            if (date) {
                                                const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
                                                setDataToogle(prev => ({
                                                    ...prev,
                                                    takenOverAt: localDate.toISOString().split('T')[0]
                                                }));
                                            } else {
                                                setDataToogle(prev => ({
                                                    ...prev,
                                                    takenOverAt: ''
                                                }));
                                            }
                                        }}
                                        dateFormat="dd/MM/yyyy"
                                        placeholderText="Remplir la date"
                                        className="w-[120%] mb-1 min-h-[28px] text-sm px-3 py-0 border border-green-600 rounded-md tracking-wide"
                                        isClearable
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="ml-[-10px]">
                        {(entreprise_id && modalType !== 'create_line') && <MailComponent 
                            params={{
                                wasteCode: dataToogle.wasteDetails.code,
                                responsibleName: dataToogle.emitter.company.contact,
                                responsiblePhone: dataToogle.emitter.company.phone,
                                responsibleEmail: dataToogle.emitter.company.mail,
                                containerType: dataToogle.wasteDetails.packagingInfos[0].type,
                                collectionAddress: dataToogle.emitter.workSite.fullAddress,
                                destinataire: dataToogle.transporter.company.mail,
                                emetteur: dataToogle.emitter.company.mail,
                                entrepriseId: entreprise_id,
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
                            setOtherInfos={setOtherInfos}
                            options={options}
                            allOptions={allOptions}
                            handleChange={handleChange}
                            ced_table={ced_table}
                        />
                    </div>
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
const getDataAutocompletionFull = async (dataFilter: {name: string, value: string}[], entreprise_id: string, cedTable: Ced[]): Promise<CompleteFormInput[]> => { 
    
    let query = supabase
        .from('table_parametrage')
        .select('json_row, other_infos')
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
        } else if (name.startsWith('other_infos.')) {
            // Gestion spéciale pour les champs other_infos
            const fieldName = name.replace('other_infos.', '');
            query = query.eq(`other_infos->>${fieldName}`, value);
        } else if (value && typeof value === 'string') {
            const name_prefilter = name.replaceAll('.', '->');
            const name_filter = replaceLastOccurrence(name_prefilter, '->', '->>')
            query = query.eq(`json_row->${name_filter}`, value);
        }
    }

    const data = await query;
    return data?.data || [];
}

function replaceLastOccurrence(str: string, search: string, replacement: string) {
    const lastIndex = str.lastIndexOf(search);
    if (lastIndex === -1) return str;
    
    return str.substring(0, lastIndex) + replacement + str.substring(lastIndex + search.length);
}

export const getUniqueOptions = (
    filteredOptions: CompleteFormInput[], 
    allOptions: CompleteFormInput[],
    selector: (opt: CompleteFormInput) => string
) => {
    const filtered = Array.from(new Set(filteredOptions.map(selector))).filter(Boolean);
    const all = Array.from(new Set(allOptions.map(selector))).filter(Boolean);
    
    // Si le sélecteur est pour un champ other_infos, on filtre différemment
    if (selector.toString().includes('other_infos')) {
        return {
            filteredOptions: filtered,
            allOptions: all.filter(opt => !filtered.includes(opt))
        };
    }
    
    return {
        filteredOptions: filtered,
        allOptions: all.filter(opt => !filtered.includes(opt))
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

// Modifier la fonction preciseFilter pour utiliser la nouvelle structure
const preciseFilter = (
    allOptions: {json_row: FormInput, other_infos?: OtherInfos}[], 
    alreadyChosenData: FormInput, 
    fieldsForFilter: string[], 
    interestField: string
): string => {
    try {
        // 1. Filtrer les options qui correspondent aux champs déjà remplis
        const filteredOptions = allOptions.filter(option => {
            return fieldsForFilter.every(field => {
                let value, chosenValue;
                
                if (field.startsWith('other_infos.')) {
                    // Gestion spéciale pour les champs other_infos
                    const fieldName = field.replace('other_infos.', '');
                    value = option.other_infos?.[fieldName as keyof OtherInfos];
                    chosenValue = (alreadyChosenData as FormInput & { other_infos?: OtherInfos }).other_infos?.[fieldName as keyof OtherInfos];
                } else {
                    // Gestion normale pour les champs json_row
                    value = field.split('.').reduce<unknown>((obj, key) => 
                        typeof obj === 'object' && obj ? (obj as Record<string, unknown>)[key] : undefined,
                        option.json_row as unknown as Record<string, unknown>
                    );
                    chosenValue = field.split('.').reduce<unknown>((obj, key) => 
                        typeof obj === 'object' && obj ? (obj as Record<string, unknown>)[key] : undefined,
                        alreadyChosenData as unknown as Record<string, unknown>
                    );
                }
                
                if (!chosenValue) return true;
                return value === chosenValue;
            });
        });

        // 2. Si aucune option ne correspond, retourner une chaîne vide
        if (filteredOptions.length === 0) return '';

        // 3. Extraire les valeurs du champ d'intérêt
        const interestValues = filteredOptions.map(option => {
            if (interestField === 'emitter.workSite.fullAddress') {
                const workSite = option.json_row.emitter.workSite;
                return workSite.fullAddress || 
                    `${workSite.address || ''} ${workSite.postalCode || ''} ${workSite.city || ''}`.trim();
            } else if (interestField.startsWith('other_infos.')) {
                // Gestion spéciale pour les champs other_infos
                const fieldName = interestField.replace('other_infos.', '');
                return option.other_infos?.[fieldName as keyof OtherInfos];
            }
            return interestField.split('.').reduce<unknown>((obj, key) => 
                typeof obj === 'object' && obj ? (obj as Record<string, unknown>)[key] : undefined,
                option.json_row as unknown as Record<string, unknown>
            );
        }).filter(Boolean);

        // 4. Compter les occurrences de chaque valeur
        const valueCounts = interestValues.reduce((acc: {[key: string]: number}, value) => {
            const key = String(value);
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        // 5. Trouver la valeur la plus fréquente
        let mostFrequentValue = '';
        let maxCount = 0;

        Object.entries(valueCounts).forEach(([value, count]) => {
            if (count > maxCount) {
                maxCount = count;
                mostFrequentValue = value;
            }
        });

        return mostFrequentValue;
    } catch (error) {
        console.warn('Error in preciseFilter:', error);
        return '';
    }
};



