import { FormInput, OtherInfos } from "@/app/register/interface/BSD_Interface";
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
import PopUp from "./PopUp";
import { toast } from "react-hot-toast";
import { createRoot } from "react-dom/client";
import InputMobile from "./InputMobile";

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
    automaticMode: true,
    inputMode: "volume",
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
            'volume',
            'volumeUnit',
            'containerDescription',
            'fillRate'
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

// Définir une interface pour le type d'option
interface OptionType {
    json_row: FormInput;
    other_infos?: OtherInfos;
}

const FormulaireMobile = () => {

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
    const [allOptions, setAllOptions] = useState<{json_row: FormInput, other_infos?: OtherInfos}[]>([]);
    const [changedField, setChangedField] = useState<string>("");
    const [other_infos, setOtherInfos] = useState<OtherInfos>(initialOtherInfos);
    const { sites } = useFilterContext();

    // Ajouter une ref pour tracker la dernière modification
    const lastChangedField = useRef<string>('');

    // Ajouter un état pour tracker si l'autocomplétion est désactivée
    const [disableAutocompletion, setDisableAutocompletion] = useState(false);

    // Référence des valeurs initiales
    const initialValues = useRef({
        emitter: {
            company: { 
                name: dataToogle.emitter.company.name,
                siret: dataToogle.emitter.company.siret 
            },
            workSite: { 
                name: dataToogle.emitter.workSite.name,
                fullAddress: dataToogle.emitter.workSite.fullAddress
            }
        },
        wasteDetails: { 
            name: dataToogle.wasteDetails.name,
            code: dataToogle.wasteDetails.code 
        },
        transporter: {
            company: { 
                name: dataToogle.transporter.company.name,
                siret: dataToogle.transporter.company.siret 
            }
        },
        recipient: {
            company: { 
                name: dataToogle.recipient.company.name,
                siret: dataToogle.recipient.company.siret 
            }
        }
    });

    // Fonction pour déterminer quels champs afficher
    const getDisplayConditions = () => ({
        site: !initialValues.current.emitter.company.name || !initialValues.current.emitter.company.siret,
        workSite: !initialValues.current.emitter.workSite.name || !initialValues.current.emitter.workSite.fullAddress,
        waste: !initialValues.current.wasteDetails.name || !initialValues.current.wasteDetails.code,
        transporter: !initialValues.current.transporter.company.name || !initialValues.current.transporter.company.siret,
        recipient: !initialValues.current.recipient.company.name || !initialValues.current.recipient.company.siret
    });

//Initialisation des options
useEffect(() => {
    if(session?.entreprise_id) {
        getDataAutocompletionFull([], session.entreprise_id, []).then(data => {
            setAllOptions(data);
            setOptions(data);
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

// Ajouter un useEffect pour initialiser les données avec le site sélectionné
useEffect(() => {
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
}, [sites]); // Se déclenche quand les sites changent

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
    updateNestedValue(newData as unknown as NestedObject, name, value);
    
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
    if (session?.entreprise_id) {
        try {
                const [filteredOptions, allOptionsData] = await Promise.all([
                    getDataAutocompletionFull(newDataFilter, session.entreprise_id, ced_table),
                getDataAutocompletionFull([], session.entreprise_id, ced_table)
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
    if(session?.entreprise_id) {
        getDataAutocompletionFull([], session.entreprise_id, []).then(data => setOptions(data));
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
    // Mettre à jour l'état local
    setOtherInfos(prev => ({
        ...prev,
        ...updates
    }));

    // Si nous avons des options et que nous sommes dans le mode d'autocomplétion
    if (!disableAutocompletion && allOptions.length > 0) {
        // Filtrer les options en fonction des champs déjà remplis
        const filteredOptions = allOptions.filter(option => {
            return Object.entries(updates).every(([key, value]) => {
                return option.other_infos?.[key as keyof OtherInfos] === value;
            });
        });

        // Si nous avons des options filtrées, utiliser la première pour l'autocomplétion
        if (filteredOptions.length > 0) {
            const firstOption = filteredOptions[0];
            const newUpdates: Partial<OtherInfos> = {};
            
            // Pour chaque champ dans other_infos qui n'a pas été mis à jour
            Object.keys(firstOption.other_infos || {}).forEach(key => {
                if (!(key in updates)) {
                    const value = firstOption.other_infos?.[key as keyof OtherInfos];
                    if (value !== undefined) {
                        if (key === 'melange' && Array.isArray(value)) {
                            newUpdates.melange = value;
                        } else if (key === 'inputMode' && (value === 'volume' || value === 'tonnage')) {
                            newUpdates.inputMode = value;
                        } else if (key === 'automaticMode' && typeof value === 'boolean') {
                            newUpdates.automaticMode = value;
                        } else if (typeof value === 'string') {
                            if (key === 'volume') newUpdates.volume = value;
                            else if (key === 'volumeUnit') newUpdates.volumeUnit = value;
                            else if (key === 'fillRate') newUpdates.fillRate = value;
                            else if (key === 'containerDescription') newUpdates.containerDescription = value;
                        }
                    }
                }
            });

            // Mettre à jour les champs non modifiés
            if (Object.keys(newUpdates).length > 0) {
                setOtherInfos(prev => ({
                    ...prev,
                    ...newUpdates
                }));
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
            const parentValue = parentField.split('.').reduce<unknown>((obj, key) => 
                typeof obj === 'object' && obj ? (obj as Record<string, unknown>)[key] : undefined,
                dataToogle as unknown as Record<string, unknown>
            );
            return parentValue && parentValue !== '';
        });

        if (allParentsHaveValues) {
            const newData = { ...dataToogle };
            let hasUpdates = false;

            config.children.forEach(childField => {
                const currentValue = childField.split('.').reduce<unknown>((obj, key) => 
                    typeof obj === 'object' && obj ? (obj as Record<string, unknown>)[key] : undefined,
                    dataToogle as unknown as Record<string, unknown>
                );
                if (!currentValue || currentValue === '') {
                    const suggestedValue = preciseFilter(
                        allOptions,
                        newData,
                        config.parent,
                        childField
                    );
                    
                    if (suggestedValue) {
                        updateNestedValue(newData as unknown as NestedObject, childField, suggestedValue);
                        hasUpdates = true;
                    }
                }
            });

            if (hasUpdates) {
                setDataToogle(newData);
            }
        }
    });
}, [dataToogle, allOptions, disableAutocompletion]);

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
                            {modalType === 'create_line' ? 'Créer une ligne' : 'Demande de collecte mobile'}
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
                            display={false}
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
                            options={getUniqueOptions(options, allOptions, opt => opt.json_row.recipient.processingOperation || '')}
                            width={1}
                            name="recipient.processingOperation"
                            value={dataToogle.recipient.processingOperation || ''}
                            onChange={handleChange}
                            enableText={false}
                                        display={displayAll}
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

                    {/* Composants de bas de page */}
                    <div className="space-y-4 mt-6">
                        {(session?.entreprise_id && modalType !== 'create_line') && (
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
                                entrepriseId: session.entreprise_id,
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
const getDataAutocompletionFull = async (dataFilter: {name: string, value: string}[], entreprise_id: string, cedTable: Ced[]): Promise<{json_row: FormInput, other_infos?: OtherInfos}[]> => { 
    
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
    filteredOptions: OptionType[] = [], 
    allOptions: OptionType[] = [], 
    selector: (opt: OptionType) => string
) => {
    // Vérification et initialisation des paramètres
    const safeFilteredOptions = Array.isArray(filteredOptions) ? filteredOptions : [];
    const safeAllOptions = Array.isArray(allOptions) ? allOptions : [];

    try {
        // Gestion sécurisée des valeurs filtrées
        const filteredValues = Array.from(new Set(
            safeFilteredOptions
                .filter(opt => opt && opt.json_row && typeof selector(opt) === 'string')
                .map(selector)
        )).filter(Boolean) as string[];

        // Gestion sécurisée des valeurs totales - ne plus filtrer les doublons
        const allValues = Array.from(new Set(
            safeAllOptions
                .filter(opt => opt && opt.json_row && typeof selector(opt) === 'string')
                .map(selector)
        )).filter(Boolean) as string[];
    return {
        filteredOptions: filteredValues,
        allOptions: allValues.filter(val => !filteredValues.includes(val))
    };
    } catch (error) {
        console.warn('Error in getUniqueOptions:', error);
        return {
            filteredOptions: [],
            allOptions: []
        };
    }
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
                const value = field.split('.').reduce<unknown>((obj, key) => 
                    typeof obj === 'object' && obj ? (obj as Record<string, unknown>)[key] : undefined,
                    option.json_row as unknown as Record<string, unknown>
                );
                const chosenValue = field.split('.').reduce<unknown>((obj, key) => 
                    typeof obj === 'object' && obj ? (obj as Record<string, unknown>)[key] : undefined,
                    alreadyChosenData as unknown as Record<string, unknown>
                );
                
                if (!chosenValue) return true;
                return value === chosenValue;
            });
        });

        // 2. Si aucune option ne correspond, retourner une chaîne vide
        if (filteredOptions.length === 0) return '';

        // 3. Extraire les valeurs du champ d'intérêt avec gestion spéciale pour fullAddress
        const interestValues = filteredOptions.map(option => {
            if (interestField === 'emitter.workSite.fullAddress') {
                const workSite = option.json_row.emitter.workSite;
                return workSite.fullAddress || 
                    `${workSite.address || ''} ${workSite.postalCode || ''} ${workSite.city || ''}`.trim();
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




