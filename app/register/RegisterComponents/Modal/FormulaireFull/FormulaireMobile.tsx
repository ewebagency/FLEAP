import { FormInput } from "@/app/register/interface/BSD_Interface";
import { useModalContextNew } from "../ContextModal";
import InputMobile from "./InputMobile";
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
import { codeTraitementDefinitions } from "@/app/component/Analyse/Environnementale/codeTraitement";

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

// Définition des types et interfaces
interface NestedObject {
    [key: string]: string | number | boolean | NestedObject | NestedArray | undefined | null;
}

interface NestedArray extends Array<NestedObject> {
    [index: number]: NestedObject;
}

type NestedValue = string | number | boolean | NestedObject | NestedArray | undefined | null;

interface FieldMapping {
    entity: keyof AutocompletionData;
    field: string;
}

// Définition des dépendances
interface InputDependency {
    children: string[];
    filterFields?: string[];
}

interface InputDependencies {
    [key: string]: InputDependency;
}

const inputDependencies: InputDependencies = {
    'filiere': {
        children: ['wasteDetails.code'],
        filterFields: []
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

// Fonction pour vérifier si un champ est un ancêtre d'un autre
const shouldDisplayField = (currentField: string, changedField: string, parentDependencies=inputDependencies) => {
    if (currentField === changedField) return true;
    
    const condition = isAncestor(changedField, currentField, parentDependencies);
    if (condition) {
        return true;
    }

    const parentField = Object.entries(parentDependencies).find(([_, config]) => 
        config.children.includes(currentField)
    )?.[0];

    if (parentField && parentField === changedField) {
        return true;
    }

    if (currentField.startsWith('transporter.company.') && changedField === 'transporter.company.name') {
        return true;
    }

    const otherInfosFields = ['containerDescription', 'volume', 'volumeUnit'];
    if (otherInfosFields.includes(currentField)) {
        if (changedField === 'wasteDetails.packagingInfos[0].type') {
            return true;
        }
        if (otherInfosFields.includes(changedField)) {
            return true;
        }
    }

    return false;
};

// Fonction pour vérifier si un champ est un ancêtre d'un autre
const isAncestor = (potentialAncestor: string, field: string, inputDependencies: InputDependencies) => {   
    return inputDependencies[potentialAncestor]?.children.includes(field);
};

// Fonction pour mettre à jour une valeur imbriquée
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
            const array = current[arrayName] as NestedArray;
            if (!array[index]) {
                array[index] = {};
            }
            current = array[index];
        } else {
            if (!current[segment]) {
                current[segment] = {};
            }
            current = current[segment] as NestedObject;
        }
    }
    
    const lastSegment = pathSegments[pathSegments.length - 1];
    let convertedValue: string | boolean | number = value;
    
    if (value === 'true') convertedValue = true;
    else if (value === 'false') convertedValue = false;
    
    current[lastSegment] = convertedValue;
};

// Table de mapping entre les champs du dataToogle et la structure Supabase
const fieldMapping: Record<string, FieldMapping> = {
    // Site
    'emitter.company.name': { entity: 'site', field: 'nom' },
    'emitter.company.siret': { entity: 'site', field: 'siret' },
    'emitter.company.address': { entity: 'site', field: 'adresseSiege' },
    'emitter.company.contact': { entity: 'site', field: 'contacts[0].nom' },
    'emitter.company.phone': { entity: 'site', field: 'contacts[0].telephone' },
    'emitter.company.mail': { entity: 'site', field: 'contacts[0].email' },
    
    // Point de collecte (WorkSite)
    'emitter.workSite.name': { entity: 'site', field: 'pointsCollecte[0].nom' },
    'emitter.workSite.fullAddress': { entity: 'site', field: 'pointsCollecte[0].adresse' },

    // Transporteur
    'transporter.company.name': { entity: 'transporteur', field: 'nomBoite' },
    'transporter.company.siret': { entity: 'transporteur', field: 'siret' },
    'transporter.company.address': { entity: 'transporteur', field: 'adresse' },
    'transporter.company.contact': { entity: 'transporteur', field: 'nomPrenom' },
    'transporter.company.phone': { entity: 'transporteur', field: 'telephone' },
    'transporter.company.mail': { entity: 'transporteur', field: 'email' },
    'transporter.receipt': { entity: 'transporteur', field: 'recépissé' },

    // Destinataire
    'recipient.company.name': { entity: 'destinataire', field: 'nomBoite' },
    'recipient.company.siret': { entity: 'destinataire', field: 'siret' },
    'recipient.company.address': { entity: 'destinataire', field: 'adresse' },
    'recipient.company.contact': { entity: 'destinataire', field: 'nomPrenom' },
    'recipient.company.phone': { entity: 'destinataire', field: 'telephone' },
    'recipient.company.mail': { entity: 'destinataire', field: 'email' },

    // Déchet
    'wasteDetails.name': { entity: 'dechet', field: 'nom' },
    'wasteDetails.code': { entity: 'dechet', field: 'codeCED' },
    'wasteDetails.onuCode': { entity: 'dechet', field: 'onu' },

    // Contenant
    'other_infos.containerDescription': { entity: 'contenant', field: 'nom' },
    'other_infos.volume': { entity: 'contenant', field: 'volume' },
    'other_infos.volumeUnit': { entity: 'contenant', field: 'uniteVolume' }
};

// Interface pour les données d'autocomplétion
interface AutocompletionData {
    site?: {
        nom: string;
        siret: string;
        contacts: Array<{
            nom: string;
            email: string;
            telephone: string;
        }>;
        adresseSiege: string;
        pointsCollecte: Array<{
            nom: string;
            adresse: string;
            codePostal?: string;
            ville?: string;
        }>;
    };
    transporteur?: {
        nomBoite: string;
        siret: string;
        adresse: string;
        nomPrenom: string;
        telephone: string;
        email: string;
        recépissé?: string;
    };
    destinataire?: {
        nomBoite: string;
        siret: string;
        adresse: string;
        nomPrenom: string;
        telephone: string;
        email: string;
        cap?: string;
        operation?: string;
    };
    dechet?: {
        nom: string;
        codeCED: string;
        onu: string;
        isADR: boolean;
        isDangerous: boolean;
        isPOP: boolean;
    };
    contenant?: {
        nom: string;
        quantite: number;
        volume: string;
        uniteVolume: string;
    };
}

// Fonction pour mettre à jour le dataToogle avec les données d'autocomplétion
const updateDataToogleWithAutocompletion = (dataToogle: FormInput, autocompletionData: AutocompletionData[], changedField: string) => {
    const newDataToogle = { ...dataToogle };
    const mapping = fieldMapping[changedField];

    if (!mapping) return newDataToogle;

    // Trouver toutes les entrées correspondantes
    const matchingEntries = autocompletionData.filter(entry => {
        const value = getNestedValue(entry[mapping.entity], mapping.field);
        const currentValue = getNestedValue(newDataToogle as unknown as Record<string, unknown>, changedField);
        return value === currentValue;
    });

    if (matchingEntries.length === 0) return newDataToogle;

    // Pour chaque champ lié à l'entité
    Object.entries(fieldMapping).forEach(([field, config]) => {
        if (config.entity === mapping.entity && field !== changedField) {
            // Trouver la valeur la plus fréquente
            const values = matchingEntries.map(entry => getNestedValue(entry[config.entity], config.field));
            const valueCounts = values.reduce<Record<string, number>>((acc, val) => {
                if (val !== undefined && val !== null) {
                    acc[String(val)] = (acc[String(val)] || 0) + 1;
                }
                return acc;
            }, {});

            const mostFrequentValue = Object.entries(valueCounts)
                .sort(([,a], [,b]) => b - a)[0]?.[0];

            if (mostFrequentValue) {
                setNestedValue(newDataToogle, field, mostFrequentValue);
            }
        }
    });

    return newDataToogle;
};

// Fonction pour obtenir une valeur imbriquée
const getNestedValue = (obj: unknown, path: string): unknown => {
    return path.split('.').reduce<unknown>((current, key) => {
        if (!current || typeof current !== 'object') return undefined;
        if (key.includes('[')) {
            const [arrayKey, indexStr] = key.split(/[\[\]]/);
            const index = parseInt(indexStr);
            const array = (current as Record<string, unknown>)[arrayKey] as unknown[];
            return array?.[index];
        }
        return (current as Record<string, unknown>)[key];
    }, obj);
};

// Fonction pour définir une valeur imbriquée
const setNestedValue = (obj: FormInput, path: string, value: string | number | boolean) => {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce<Record<string, unknown>>((current, key) => {
        if (key.includes('[')) {
            const [arrayKey, indexStr] = key.split(/[\[\]]/);
            const index = parseInt(indexStr);
            if (!current[arrayKey]) {
                current[arrayKey] = [];
            }
            const array = current[arrayKey] as unknown[];
            if (!array[index]) {
                array[index] = {};
            }
            return array[index] as Record<string, unknown>;
        }
        if (!current[key]) {
            current[key] = {};
        }
        return current[key] as Record<string, unknown>;
    }, obj as unknown as Record<string, unknown>);
    (target as Record<string, unknown>)[lastKey] = value;
};

const FormulaireMobile = () => {

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

    const getDisplayConditions = () => ({
        site: true,
        workSite: true,
        waste: true,
        transporter: true,
        recipient: true
    });

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
    
    // Si l'autocomplétion n'est pas désactivée, mettre à jour les champs liés
    if (!disableAutocompletion && entreprise_id) {
        const autocompletionData = await getAutocompletionData(entreprise_id);
        const updatedData = updateDataToogleWithAutocompletion(newData, autocompletionData, name);
        setDataToogle(updatedData);
    } else {
    setDataToogle(newData);
    }

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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex flex-col items-center z-50">
            <div className="bg-white w-full min-h-screen flex flex-col">
                {/* Header */}
                <div className="sticky top-0 bg-white p-3 border-b border-gray-200 z-10">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <h3 className="font-bold text-base flex items-center gap-2">
                            <BoxIcon className="mb-1 w-4 h-4" name='truck' type='solid' />
                            <span className="text-green-medium mt-1">
                                {modalType === 'create_line' ? 'Créer une ligne nouvelle' : 'Demande de collecte mobile'}
                        </span>
                    </h3>
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                            <button 
                                type="button" 
                                className="flex-1 sm:flex-none text-xs h-8 bg-[var(--green-medium)] rounded-md px-3 text-white font-thin hover:bg-[var(--green-dark)] active:font-bold" 
                                onClick={() => toogleFunction()}
                            >
                                Afficher/Masquer
                            </button>
                            <button 
                                type="button" 
                                className="flex-1 sm:flex-none text-xs h-8 bg-[var(--green-medium)] rounded-md px-3 text-white font-thin hover:bg-[var(--green-dark)] active:font-bold" 
                                onClick={ResetData}
                            >
                                Réinitialiser
                            </button>
                        </div>
                    </div>
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-3">
                    <form className="space-y-4 pb-32 pr-6">
                        {/* Section Point de départ */}
                        <div className="border-b border-gray-200 pb-4">
                            <div className="text-sm font-semibold mb-2 text-gray-700">Point de départ</div>
                            <div className="space-y-2">
                                {/* Site */}
                                {getDisplayConditions().site && (
                                    <div className="flex flex-col gap-0">
                                        <InputMobile
                                titre="Site"
                                            placeholder="Nom du Site"
                                name="emitter.company.name"
                                            options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.name)}
                                            width={1}
                                value={dataToogle.emitter.company.name}
                                onChange={handleChange}
                                enableText={true}
                                stylePrimary={true}
                                            onMobile={true}
                            />
                                        <InputMobile
                                titre="Siret"
                                            placeholder="SIRET"
                                name="emitter.company.siret"
                                            options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.siret)}
                                            width={1}
                                value={dataToogle.emitter.company.siret}
                                onChange={handleChange}
                                enableText={true}
                                            display={displayAll}
                                            onMobile={true}
                                        />
                        </div>
                                )}
                                
                                {/* Point de Collecte */}
                                {getDisplayConditions().workSite && (
                                    <div className="flex flex-col gap-0">
                                        <InputMobile
                                            titre="Collecte"
                                            placeholder="Point de collecte"
                                    name="emitter.workSite.name"
                                            options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.workSite.name)}
                                            width={1}
                                    value={dataToogle.emitter.workSite.name}
                                    onChange={handleChange}
                                    enableText={true}
                                    stylePrimary={true}
                                            onMobile={true}
                                />
                                        <InputMobile
                                            titre="Adresse"
                                            placeholder="d'enlèvement"
                                    options={getUniqueOptions(options, allOptions, opt => `${formatText(opt.json_row.emitter.workSite.fullAddress ?? "")}`)}
                                            width={1}
                                    name="emitter.workSite.fullAddress"
                                    value={`${formatText(dataToogle.emitter.workSite.fullAddress ?? "")}`}
                                    onChange={handleChange}
                                    enableText={true}
                                            display={displayAll}
                                            onMobile={true}
                                />
                            </div>
                                )}
                                
                                {/* Contact */}
                                <div className="flex flex-col gap-0">
                                    <InputMobile
                                        titre="Contact"
                                    placeholder="Contact"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.contact)}
                                        width={1}
                                    name="emitter.company.contact"
                                    value={dataToogle.emitter.company.contact}
                                    onChange={handleChange}
                                        enableText={false}
                                        display={false}
                                        onMobile={true}
                                />
                                    <InputMobile
                                    titre="Téléphone"
                                    placeholder="Téléphone"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.phone)}
                                        width={1}
                                    name="emitter.company.phone"
                                    value={dataToogle.emitter.company.phone}
                                    onChange={handleChange}
                                        enableText={false}
                                        display={false}
                                        onMobile={true}
                                />
                                </div>
                                <div className="flex flex-col gap-0">
                                    <InputMobile
                                    titre="Mail"
                                    placeholder="Mail"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.mail)}
                                        width={1}
                                    name="emitter.company.mail"
                                    value={dataToogle.emitter.company.mail}
                                    onChange={handleChange}
                                        enableText={false}
                                        display={false}
                                        onMobile={true}
                                />
                            </div>
                        </div>
                    </div>

                        {/* Section Déchet */}
                        <div className="border-b border-gray-200 pb-4">
                            <div className="text-sm font-semibold mb-2 text-gray-700">Déchet</div>
                            <div className="space-y-1">
                                {/* Filière */}
                                <div className="flex flex-col gap-0">
                                    <InputMobile
                                    titre="Filière"
                                    placeholder="Sélectionner une filière"
                                    options={getUniqueOptions(options, allOptions, opt => getFiliere(opt.json_row.wasteDetails.code, ced_table))}
                                        width={1}
                                    name="filiere"
                                    value={currentFiliere}
                                    onChange={handleChange}
                                    enableText={false}
                                    stylePrimary={true}
                                        onMobile={true}
                                    display={false}
                                />                                
                                </div>
                                
                                {/* Déchet */}
                                <div className="flex flex-col gap-0">
                                    <InputMobile
                                    titre="Déchet"
                                    placeholder="Nom du déchet"
                                    options={getUniqueOptions(options, allOptions, opt => `${opt.json_row.wasteDetails.name}`)}
                                        width={1}
                                    name="wasteDetails.name"
                                    value={dataToogle.wasteDetails.name}
                                    onChange={handleChange}
                                    enableText={false}
                                    stylePrimary={true}
                                        onMobile={true}
                                />
                                    {displayAll && (
                                        <InputMobile
                                            titre="CED"
                                    placeholder="Sélectionner un code"
                                    options={getUniqueOptions(options, allOptions, opt => `${opt.json_row.wasteDetails.code}`)}
                                            width={1}
                                    name="wasteDetails.code"
                                    value={dataToogle.wasteDetails.code}
                                    onChange={handleChange}
                                    enableText={false}
                                    display={displayAll || shouldDisplayField("wasteDetails.code", changedField)}
                                            onMobile={true}
                                        />
                                    )}
                                </div>

                                {/* Sujet à l'ADR */}
                                {displayAll && (
                                    <div className="flex flex-col gap-0">
                                        <InputMobile
                                            titre="ADR"
                                            placeholder="Sujet à l'ADR"
                                            options={getUniqueOptions(options, allOptions, opt => `${opt.json_row.wasteDetails.isSubjectToADR}`)}
                                            width={1}
                                            name="wasteDetails.isSubjectToADR"
                                            value={dataToogle.wasteDetails.isSubjectToADR}
                                            onChange={handleChange}
                                            enableText={false}
                                            display={true}
                                            onMobile={true}
                                />      
                                        <InputMobile
                                            titre="ONU"
                                    placeholder="Code ONU"
                                    options={getUniqueOptions(options, allOptions, opt => `${opt.json_row.wasteDetails.onuCode}`)}
                                            width={1}
                                    name="wasteDetails.onuCode"
                                    value={dataToogle.wasteDetails.onuCode}
                                    onChange={handleChange}
                                    enableText={false}
                                        display={true}
                                            onMobile={true}
                                    />
                                    </div>
                                )}

                                {/* Remplissage et Nombre */}
                                <div className="flex flex-col gap-0">
                                    <InputMobile
                                        titre="Rempli."
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
                                        display={false}
                                        width={1}
                                        onMobile={true}
                                    />
                                    <InputMobile
                                    titre="Nombre"
                                    placeholder="Nombre"
                                    options={getUniqueOptions(options, allOptions, opt => `${opt.json_row.wasteDetails.packagingInfos[0].quantity}`)}
                                        width={1}
                                    name="wasteDetails.packagingInfos[0].quantity"
                                    value={String(dataToogle.wasteDetails.packagingInfos[0].quantity)}
                                    onChange={handleChange}
                                    enableText={true}
                                        display={false}
                                        onMobile={true}
                                    />
                                </div>

                                {/* Poids et Type */}
                                <div className="flex flex-col gap-0">
                                    <InputMobile
                                    titre="Poids (t)"
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
                                        display={true}
                                        onMobile={true}
                                />
                                    <InputMobile
                                        titre="Consist."
                                    placeholder="Consistance"
                                    options={{
                                        filteredOptions: getUniqueOptions(options, allOptions, opt => `${opt.json_row.wasteDetails.consistence}`).filteredOptions,
                                        allOptions: ['SOLID', 'LIQUID', 'GASEOUS', 'DOUGHY']
                                    }}
                                        width={1}
                                    name="wasteDetails.consistence"
                                    value={String(dataToogle.wasteDetails.consistence)}
                                    onChange={handleChange}
                                    enableText={true}
                                        display={displayAll}
                                        onMobile={true}
                                />                                
                                    <InputMobile
                                        titre="Type"
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
                                        display={displayAll}
                                        onMobile={true}
                                />
                                </div>

                                {/* Consistance et Pop */}
                                <div className="flex flex-col gap-0">
                                    <InputMobile
                                        titre="Pop"
                                        placeholder="Pop"
                                        options={{
                                            filteredOptions: getUniqueOptions(options, allOptions, opt => `${opt.json_row.wasteDetails.pop}`).filteredOptions,
                                            allOptions: ['true', 'false']
                                        }}
                                        width={1}
                                        name="wasteDetails.pop"
                                        value={String(dataToogle.wasteDetails.pop)}
                                        onChange={handleChange}
                                        enableText={true}
                                        display={displayAll}
                                        onMobile={true}
                                    />
                                </div>
                            </div>
                            
                            {/* Contenant */}
                            <div className="flex flex-col gap-0 mt-2">
                                <InputMobile
                                    titre="Contenant"
                                    placeholder="Sélectionner un contenant"
                                        options={{
                                        filteredOptions: getUniqueOptions(options, allOptions, opt => `${opt.json_row.wasteDetails.packagingInfos[0].type}`).filteredOptions,
                                        allOptions: ['FUT', 'GRV', 'CITERNE', 'BENNE', 'PIPELINE', 'AUTRE']
                                        }}
                                    width={1}
                                    name="wasteDetails.packagingInfos[0].type"
                                    value={dataToogle.wasteDetails.packagingInfos[0].type}
                                        onChange={handleChange}
                                    enableText={false}
                                    stylePrimary={true}
                                    display={false}
                                    onMobile={true}
                                />
                                {/* Nouveaux champs pour other_infos */}
                                <InputMobile
                                    titre="Contenant"
                                    placeholder="Description du contenant"
                                    name="containerDescription"
                                    value={other_infos.containerDescription || ''}
                                    onChange={(e: string | { target: { name: string; value: string } }) => {
                                        const newValue = typeof e === 'object' && 'target' in e ? e.target.value : e
                                        handleOtherInfosChange({ containerDescription: String(newValue) })
                                    }}
                                    options={getUniqueOptions(options, allOptions, opt => opt.other_infos?.containerDescription || '')}
                                    enabled={true}
                                    width={1}
                                    onMobile={true}
                                    stylePrimary={true}
                                />                        
                                <InputMobile
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
                                    display={displayAll}
                                    width={1}
                                    onMobile={true}
                                    />
                                </div>

                            {/* Unité et Description */}
                            <div className="flex flex-col gap-0">
                                <InputMobile
                                    titre="Unité"
                                    placeholder="Unité de volume"
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
                                    display={displayAll}
                                    width={1}
                                    onMobile={true}
                                />
                        </div>
                    </div>

                        {/* Section Prestataires */}
                        <div className="border-b border-gray-200 pb-4">
                            <div className="text-sm font-semibold mb-2 text-gray-700">Prestataires</div>
                            <div className="space-y-2">
                                {/* Transporteur */}
                                <div className="flex flex-col gap-0">
                                    <InputMobile
                                        titre="Transport"
                                        placeholder="Transporteur"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.transporter.company.name)}
                                        width={1}
                                    name="transporter.company.name"
                                    value={dataToogle.transporter.company.name}
                                    onChange={handleChange}
                                    enableText={false}
                                    stylePrimary={true}
                                        onMobile={true}
                                />
                                    <InputMobile
                                    titre="Siret"
                                        placeholder="SIRET"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.transporter.company.siret)}
                                        width={1}
                                    name="transporter.company.siret"
                                    value={dataToogle.transporter.company.siret}
                                    onChange={handleChange}
                                    enableText={false}
                                        display={displayAll}
                                        onMobile={true}
                                />
                                    <InputMobile
                                    titre="Contact"
                                    placeholder="Contact"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.transporter.company.contact)}
                                        width={1}
                                    name="transporter.company.contact"
                                    value={dataToogle.transporter.company.contact}
                                    onChange={handleChange}
                                    enableText={false}
                                        display={displayAll}
                                        onMobile={true}
                                />
                                    <InputMobile
                                    titre="Téléphone"
                                    placeholder="Téléphone"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.transporter.company.phone)}
                                        width={1}
                                    name="transporter.company.phone"
                                    value={dataToogle.transporter.company.phone}
                                    onChange={handleChange}
                                    enableText={false}
                                        display={displayAll}
                                        onMobile={true}
                                />
                                    <InputMobile
                                    titre="Mail"
                                    placeholder="Mail"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.transporter.company.mail)}
                                        width={1}
                                    name="transporter.company.mail"
                                    value={dataToogle.transporter.company.mail}
                                    onChange={handleChange}
                                    enableText={false}
                                        display={displayAll}
                                        onMobile={true}
                                />
                                    <InputMobile
                                    titre="Exemption"
                                        placeholder="de récépissé"
                                        options={getUniqueOptions(options, allOptions, opt => opt.json_row.transporter.isExemptedOfReceipt ? 'true' : 'false')}
                                        width={1}
                                    name="transporter.isExemptedOfReceipt"
                                        value={dataToogle.transporter.isExemptedOfReceipt ? 'true' : 'false'}
                                    onChange={handleChange}
                                    enableText={false}
                                        display={displayAll}
                                        onMobile={true}
                                />
                                    <InputMobile
                                        titre="Plaque"
                                        placeholder="d'immatriculation"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.transporter.numberPlate || '')}
                                        width={1}
                                    name="transporter.numberPlate"
                                        value={dataToogle.transporter.numberPlate || '' }
                                    onChange={handleChange}
                                    enableText={false}
                                        display={displayAll}
                                        onMobile={true}
                                />
                                    <InputMobile
                                        titre="Infos"
                                        placeholder="Complémentaires"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.transporter.customInfo || '')}
                                        width={1}
                                    name="transporter.customInfo"
                                    value={dataToogle.transporter.customInfo || ''}
                                    onChange={handleChange}
                                    enableText={false}
                                        display={displayAll}
                                        onMobile={true}
                                />
                            </div>

                                {/* Destinataire */}
                                <div className="flex flex-col gap-0">
                                    <InputMobile
                                        titre="Dest."
                                        placeholder="Destinataire"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.recipient.company.name)}
                                        width={1}
                                    name="recipient.company.name"
                                    value={dataToogle.recipient.company.name}
                                    onChange={handleChange}
                                    enableText={false}
                                    stylePrimary={true}
                                        onMobile={true}
                                />
                                    <InputMobile
                                    titre="Siret"
                                        placeholder="SIRET"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.recipient.company.siret)}
                                        width={1}
                                    name="recipient.company.siret"
                                    value={dataToogle.recipient.company.siret}
                                    onChange={handleChange}
                                    enableText={false}
                                        display={displayAll}
                                        onMobile={true}
                                />
                                </div>

                                {/* Contact Destinataire */}
                                <div className="flex flex-col gap-0">
                                    <InputMobile
                                    titre="Contact"
                                    placeholder="Contact"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.recipient.company.contact)}
                                        width={1}
                                    name="recipient.company.contact"
                                    value={dataToogle.recipient.company.contact}
                                    onChange={handleChange}
                                    enableText={false}
                                        display={displayAll}
                                        onMobile={true}
                                />
                                    <InputMobile
                                    titre="Téléphone"
                                    placeholder="Téléphone"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.recipient.company.phone)}
                                        width={1}
                                    name="recipient.company.phone"
                                    value={dataToogle.recipient.company.phone}
                                    onChange={handleChange}
                                    enableText={false}
                                        display={displayAll}
                                        onMobile={true}
                                />
                                    <InputMobile
                                    titre="Mail"
                                    placeholder="Mail"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.recipient.company.mail)}
                                        width={1}
                                    name="recipient.company.mail"
                                    value={dataToogle.recipient.company.mail}
                                    onChange={handleChange}
                                    enableText={false}
                                        display={displayAll}
                                        onMobile={true}
                                    />
                                </div>

                                {/* Adresse Destinataire */}
                                <div className="flex flex-col gap-0">
                                    <InputMobile
                                        titre="Adresse"
                                        placeholder="Adresse"
                                        options={getUniqueOptions(options, allOptions, opt => opt.json_row.recipient.company.address)}
                                        width={1}
                                        name="recipient.company.address"
                                        value={dataToogle.recipient.company.address}
                                        onChange={handleChange}
                                        enableText={false}
                                        display={displayAll}
                                        onMobile={true}
                                />
                                    <InputMobile
                                    titre="CAP"
                                    placeholder="CAP"
                                    options={getUniqueOptions(options, allOptions, opt => opt.json_row.recipient.cap || '')}
                                        width={1}
                                    name="recipient.cap"
                                    value={dataToogle.recipient.cap || ''}
                                    onChange={handleChange}
                                    enableText={false}
                                        display={displayAll}
                                        onMobile={true}
                                />
                                </div>

                                {/* Opération d'élimination */}
                                <div className="flex flex-col gap-0">
                                    <InputMobile
                                        titre="Traitement"
                                        placeholder="Code de Traitement"
                                    options={{
                                        filteredOptions: [],
                                            allOptions: codeTraitementDefinitions.map(item => `${item.groupe} : ${item.code} - ${item.nom}`)
                                    }}
                                        width={1}
                                    name="recipient.processingOperation"
                                    value={dataToogle.recipient.processingOperation || ''}
                                    onChange={(e) => {
                                        const value = typeof e === 'object' && 'target' in e ? e.target.value : e;
                                            const code = value.split(' : ')[1].split(' - ')[0] || '';
                                        handleChange({ target: { name: 'recipient.processingOperation', value: code } });
                                    }}
                                    enableText={false}
                                        display={true}
                                        onMobile={true}
                                />
                                    <InputMobile
                                        titre="Stockage"
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
                                        display={displayAll}
                                        onMobile={true}
                                />
                            </div>
                        </div>
                    </div>

                        {/* Section Date de collecte */}
                        <div>
                            <div className="text-sm font-semibold mb-2 text-gray-700">Date de collecte</div>
                            <div className="flex flex-col gap-0">
                                <div className="flex items-center justify-between gap-2">
                                    <label className="block text-md text-gray-500 font-medium mb-1 md:w-[90px] text-right">
                                    Collecté le
                                </label>
                                    <div className="flex-1">
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
                                            className="w-[100%] mb-1 min-h-[32px] text-sm px-3 py-2 border border-green-600 rounded-md tracking-wide"
                                        isClearable
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                        {/* Composants de bas de page */}
                        <div className="space-y-4 mt-6">
                            {(entreprise_id && modalType !== 'create_line') && (
                                <div className="border-t border-gray-200 pt-4">
                                    <MailComponent 
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
                                        onMobile={true}
                                    />
                    </div>
                            )}
                            <div className="border-t border-gray-200 pt-4">
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
                                    onMobile={true}
                        />
                            </div>
                    </div>
                </form>
                </div>
            </div>
        </div>
    );
}

export default FormulaireMobile;


//Utils
interface Ced {
    ced: string;
    filiere: string;
}
const getDataAutocompletionFull = async (dataFilter: {name: string, value: string}[], entreprise_id: string, cedTable: Ced[]): Promise<CompleteFormInput[]> => { 
    // Récupérer toutes les données d'autocomplétion
    const { data: autocompletionData, error } = await supabase
        .from('table_autocompletion')
        .select('*')
        .eq('entreprise_id', entreprise_id);

    if (error) {
        console.error('Error fetching autocompletion data:', error);
        return [];
    }

    if (!autocompletionData) return [];

    // Convertir les données d'autocomplétion en format CompleteFormInput
    const result: CompleteFormInput[] = [];

    // Pour chaque entrée dans table_autocompletion
    autocompletionData.forEach(item => {
        // Créer un objet CompleteFormInput avec les données de l'entrée
        const formInput: CompleteFormInput = {
            json_row: {
                emitter: {
                    type: "PRODUCER",
                    workSite: { 
                        name: item.site?.pointsCollecte?.[0]?.nom || "", 
                        fullAddress: item.site?.pointsCollecte?.[0]?.adresse || "", 
                        address: item.site?.pointsCollecte?.[0]?.adresse || "", 
                        postalCode: item.site?.pointsCollecte?.[0]?.codePostal || "", 
                        city: item.site?.pointsCollecte?.[0]?.ville || "", 
                        infos: "" 
                    },
                    company: { 
                        name: item.site?.nom || "", 
                        siret: item.site?.siret || "", 
                        address: item.site?.adresseSiege || "", 
                        country: "", 
                        contact: item.site?.contacts?.[0]?.nom || "", 
                        phone: item.site?.contacts?.[0]?.telephone || "", 
                        mail: item.site?.contacts?.[0]?.email || "" 
                    },
                    isPrivateIndividual: false,
                    isForeignShip: false,
                },
                recipient: {
                    company: { 
                        name: item.destinataire?.nomBoite || "", 
                        siret: item.destinataire?.siret || "", 
                        address: item.destinataire?.adresse || "", 
                        country: "", 
                        contact: item.destinataire?.nomPrenom || "", 
                        phone: item.destinataire?.telephone || "", 
                        mail: item.destinataire?.email || "" 
                    },
                    cap: "",
                    processingOperation: "",
                    isTempStorage: false,
                },
                transporter: {
                    company: { 
                        name: item.transporteur?.nomBoite || "", 
                        siret: item.transporteur?.siret || "", 
                        address: item.transporteur?.adresse || "", 
                        country: "", 
                        contact: item.transporteur?.nomPrenom || "", 
                        phone: item.transporteur?.telephone || "", 
                        mail: item.transporteur?.email || "" 
                    },
                    isExemptedOfReceipt: false,
                    receipt: item.transporteur?.recépissé || "",
                    numberPlate: "",
                    customInfo: "",
                },
                wasteDetails: {
                    code: item.dechet?.codeCED || "",
                    name: item.dechet?.nom || "",
                    isSubjectToADR: false,
                    onuCode: item.dechet?.onu || "",
                    packagingInfos: [{ type: "AUTRE", quantity: 1, other: "" }],
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
                    company: { 
                        name: item.negociant?.nomBoite || "", 
                        siret: item.negociant?.siret || "", 
                        address: item.negociant?.adresse || "", 
                        country: "", 
                        contact: item.negociant?.nomPrenom || "", 
                        phone: item.negociant?.telephone || "", 
                        mail: item.negociant?.email || "" 
                    },
                },
                broker: {
                    receipt: "",
                    department: "",
                    //validityLimit: "",
                    company: { 
                        name: item.courtier?.nomBoite || "", 
                        siret: item.courtier?.siret || "", 
                        address: item.courtier?.adresse || "", 
                        country: "", 
                        contact: item.courtier?.nomPrenom || "", 
                        phone: item.courtier?.telephone || "", 
                        mail: item.courtier?.email || "" 
                    },
                },
                ecoOrganisme: { 
                    name: item.eco_organisme?.nomBoite || "", 
                    siret: item.eco_organisme?.siret || "" 
                },
                temporaryStorageDetail: {
                    company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
                    cap: "",
                    processingOperation: "",
                },
            },
            other_infos: {
                containerDescription: item.contenant?.nom || "",
                volume: item.contenant?.volume || "",
                volumeUnit: item.contenant?.uniteVolume || "",
                fillRate: "",
                inputMode: "volume",
                automaticMode: true
            }
        };

        // Ajouter l'entrée au résultat
        result.push(formInput);
    });

    return result;
};

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
    // Extraire les valeurs uniques
    const filtered = filteredOptions
        .map(selector)
        .filter(Boolean);
    
    const all = allOptions
        .map(selector)
        .filter(Boolean);
    
    return {
        filteredOptions: filtered,
        allOptions: []
    };
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

// Fonction pour récupérer les données d'autocomplétion depuis Supabase
const getAutocompletionData = async (entreprise_id: string): Promise<AutocompletionData[]> => {
    const { data, error } = await supabase
        .from('table_autocompletion')
        .select('*')
        .eq('entreprise_id', entreprise_id);

    if (error) {
        console.error('Error fetching autocompletion data:', error);
        return [];
    }

    if (!data) return [];

    // Convertir les données en format AutocompletionData
    return data.map(item => ({
        site: item.site,
        transporteur: item.transporteur,
        destinataire: item.destinataire,
        dechet: item.dechet,
        contenant: item.contenant
    }));
};



