/*import { FormInput, OtherInfos, CompleteFormInput } from "@/app/register/interface/BSD_Interface";
import { useModalContextNew } from "../RegisterComponents/Modal/ContextModal";
import InputFull from "../RegisterComponents/Modal/FormulaireFull/InputFull";
import { formatText, getDataAutocompletion, getMappingTableFiliere, getFiliere, filter_dependencies, parseAddress } from "../RegisterComponents/Modal/FormulaireFull/utils_new";
import { useEffect, useState, useRef } from "react";
import { useSession } from "@/app/component/SessionProvider";
import { supabase } from "@/app/database/supabaseClient";
import BoxIcon from "@/app/component/BoxIconWrapper";
import { useFilterContext } from "@/app/FilterContext";
import { toast } from "react-hot-toast";
import { createRoot } from "react-dom/client";
import Swal from 'sweetalert2';
import { createCollectRequest } from './DemandeFonctions';
import NewDemandeMailComponent from "./NewDemandeMailComponent";
import { useMailContext } from '../MailComponents/MailContext';

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
    
    current[lastSegment] = convertedValue;
};

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
    'emitter.company.name': {
        children: ['emitter.company.siret', 'emitter.company.address', 'emitter.company.contact']
    },
    'emitter.company.contact': {
        children: ['emitter.company.mail', 'emitter.company.phone']
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
    'transporter.company.name': {
        children: ['transporter.company.siret', 'transporter.company.address', 'transporter.company.contact', 'transporter.company.phone', 'transporter.company.mail', 'transporter.isExemptedOfReceipt', 'transporter.receipt', 'transporter.numberPlate', 'transporter.customInfo']
    },
    'recipient.company.name': {
        children: ['recipient.company.siret', 'recipient.company.address', 'recipient.company.contact', 'recipient.company.phone', 'recipient.company.mail', 'recipient.cap', 'recipient.processingOperation', 'recipient.isTempStorage']
    }
};


const NewFormulaireDemande = ({setDisplayThis}: {setDisplayThis: (display: boolean) => void}) => {
    // Fonction pour générer les dépendances d'une ligne
    const generateWasteLineDependencies = (index: number) => ({
        [`wasteLine.${index}.name`]: {
            children: [
                `wasteLine.${index}.code`,
                `wasteLine.${index}.filiere`
            ],
            filterFields: [`wasteLine.${index}.name`]
        },
        [`wasteLine.${index}.code`]: {
            children: [`wasteLine.${index}.filiere`],
            filterFields: [`wasteLine.${index}.code`]
        },
        [`wasteLine.${index}.other_infos.containerDescription`]: {
            children: [
                `wasteLine.${index}.other_infos.volume`,
                `wasteLine.${index}.other_infos.volumeUnit`
            ],
            filterFields: [`wasteLine.${index}.other_infos.containerDescription`]
        }
    });

    const {
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
    const [provider, setProvider] = useState<'transporter' | 'recipient'>('transporter');


    // Ajouter une ref pour tracker la dernière modification
    const lastChangedField = useRef<string>('');

    // Ajouter un état pour tracker si l'autocomplétion est désactivée
    const [disableAutocompletion, setDisableAutocompletion] = useState(false);

    // Initialisation des lignes de déchets
    const [wasteLines, setWasteLines] = useState<WasteLine[]>([{
        filiere: "",
        wasteDetails: {
            code: "",
            name: "",
            packagingInfos: [{
                type: "AUTRE",
                quantity: 1
            }],
            quantity: 0
        },
        collectDate: "",
        other_infos: {
            containerDescription: "",
            volume: "",
            volumeUnit: ""
        }
    }]);

    // État pour stocker les dépendances
    const [dynamicDependencies, setDynamicDependencies] = useState({
        ...inputDependencies,
        ...generateWasteLineDependencies(0)
    });

    // Ajouter un état pour stocker les dataFilters de chaque ligne
    const [lineDataFilters, setLineDataFilters] = useState<{[key: number]: {name: string, value: string}[]}>({
        0: [] // Initialiser avec la première ligne
    });

    // Fonction pour ajouter une nouvelle ligne
    const addWasteLine = () => {
        const newIndex = wasteLines.length;
        setWasteLines(prev => [...prev, {
            filiere: "",
            wasteDetails: {
                code: "",
                name: "",
                packagingInfos: [{
                    type: "AUTRE",
                    quantity: 1
                }],
                quantity: 0
            },
            collectDate: "",
            other_infos: {
                containerDescription: "",
                volume: "",
                volumeUnit: ""
            }
        }]);

        // Initialiser les filtres pour la nouvelle ligne
        setLineDataFilters(prev => ({
            ...prev,
            [newIndex]: []
        }));

        // Ajouter les dépendances pour la nouvelle ligne
        setDynamicDependencies(prev => ({
            ...prev,
            ...generateWasteLineDependencies(newIndex)
        }));
    };

    // Modifier shouldDisplayField pour mieux gérer les champs de ligne
    const shouldDisplayField = (currentField: string, changedField: string) => {
        // Si aucun champ n'a été modifié, ne montrer que les champs initiaux
        if (!changedField) {
            const initialFields = [
                'emitter.company.name',
                ...wasteLines.map((_, index) => `wasteLine.${index}.name`)
            ];
            return initialFields.includes(currentField);
        }

        if (currentField === changedField) return true;
        
        // Pour les champs de ligne de déchet
        if (currentField.startsWith('wasteLine.') && changedField.startsWith('wasteLine.')) {
            const [_, currentIndexStr, ...currentRest] = currentField.split('.');
            const [__, changedIndexStr, ...changedRest] = changedField.split('.');
            const currentIndex = parseInt(currentIndexStr);
            const changedIndex = parseInt(changedIndexStr);
            
            // Ne vérifier les dépendances que si les champs sont de la même ligne
            if (currentIndex === changedIndex) {
                const lineDependencies = generateWasteLineDependencies(currentIndex);
                
                // Reconstruire les chemins pour la vérification
                const changedPath = `wasteLine.${changedIndex}.${changedRest.join('.')}`;
                
                // Vérifier si le champ courant est un enfant du champ modifié
                return Object.entries(lineDependencies).some(([parent, { children }]) => {
                    if (parent === changedPath) {
                        return children.includes(currentField);
                    }
                    return false;
                });
            }
            return false;
        }
        
        return isAncestor(changedField, currentField, dynamicDependencies);
    };

    // Modifier handleReset pour s'assurer que tous les champs sont cachés
    const handleReset = () => {
        // Réinitialiser les données principales
        setDataToogle(initialToogleData);
        setOtherInfos(initialOtherInfos);
        
        // Réinitialiser les filtres et le champ modifié
        setDataFilter([]);
        setCurrentFiliere("");
        
        // Important : réinitialiser changedField avant de réappliquer le site
        setChangedField("");
        setDisplayAll(false);
        
        // Réinitialiser le provider
        setProvider('transporter');
        
        // Réinitialiser les lignes de déchets
        setWasteLines([{
            filiere: "",
            wasteDetails: {
                code: "",
                name: "",
                packagingInfos: [{
                    type: "AUTRE",
                    quantity: 1
                }],
                quantity: 0
            },
            collectDate: "",
            other_infos: {
                containerDescription: "",
                volume: "",
                volumeUnit: ""
            }
        }]);
        
        // Réinitialiser les dépendances
        setDynamicDependencies({
            ...inputDependencies,
            ...generateWasteLineDependencies(0)
        });

        // Réinitialiser les options
        if(session?.entreprise_id) {
            getDataAutocompletionFull([], session.entreprise_id, ced_table)
                .then(data => {
                    setOptions(data);
                    setAllOptions(data);
                });
        }

        // Réinitialiser l'autocomplétion
        setDisableAutocompletion(false);

        // Réappliquer le site sélectionné sans déclencher l'autocomplétion
        const checkedSite = sites.find(site => site.checked);
        if (checkedSite) {
            setDataToogle(prev => ({
                ...initialToogleData,
                emitter: {
                    ...initialToogleData.emitter,
                    company: {
                        ...initialToogleData.emitter.company,
                        name: checkedSite.name,
                        siret: checkedSite.orgId
                    }
                }
            }));
        }
    };

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

    // Modifier l'effet qui initialise les données du site
useEffect(() => {
    // Trouver le premier site coché
    const checkedSite = sites.find(site => site.checked);
    if (checkedSite) {
            // Mise à jour silencieuse sans déclencher l'autocomplétion
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
            // Ne pas mettre à jour changedField ici
    }
    }, [sites]);

    //Modifier handleChange pour gérer l'autocomplétion automatique
const handleChange = async (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement> | { target: { name: string; value: string } }) => {
    const { name, value } = e.target;
    
    // Gestion des champs de la ligne de déchets
    if (name.startsWith('wasteLine.')) {
        const [_, indexStr, field, subField] = name.split('.');
        const index = parseInt(indexStr);
        const newLines = [...wasteLines];

        // Mettre à jour changedField pour les champs de ligne
        setChangedField(name);

        if (field === 'name') {
            newLines[index].wasteDetails.name = value;
            // Chercher le code CED correspondant
            const matchingOption = options.find(opt => 
                opt.json_row?.wasteDetails?.name === value
            );
            if (matchingOption?.json_row?.wasteDetails?.code) {
                newLines[index].wasteDetails.code = matchingOption.json_row.wasteDetails.code;
                // Mettre à jour la filière aussi
                const newFiliere = getFiliere(matchingOption.json_row.wasteDetails.code, ced_table);
                if (newFiliere) {
                    newLines[index].filiere = newFiliere;
                }
            }
        } else if (field === 'code') {
            newLines[index].wasteDetails.code = value;
            // Mettre à jour la filière
            const newFiliere = getFiliere(value, ced_table);
            if (newFiliere) {
                newLines[index].filiere = newFiliere;
            }
        } else if (field === 'filiere') {
            newLines[index].filiere = value;
        } else if (field === 'other_infos') {
            if (subField === 'containerDescription') {
                // Chercher les valeurs correspondantes dans les options
                const matchingOption = options.find(opt => 
                    opt.other_infos?.containerDescription === value
                );
                
                // Mettre à jour le volume et l'unité si disponibles
                if (matchingOption?.other_infos) {
                    newLines[index].other_infos = {
                        containerDescription: value,
                        volume: matchingOption.other_infos.volume || '',
                        volumeUnit: matchingOption.other_infos.volumeUnit || ''
                    };
                } else {
                    newLines[index].other_infos = {
                        ...newLines[index].other_infos,
                        containerDescription: value
                    };
                }
            } else {
                // Pour les autres champs de other_infos
                newLines[index].other_infos = {
                    ...newLines[index].other_infos,
                    [subField]: value
                };
            }
        } else if (field === 'collectDate') {
            newLines[index].collectDate = value;
        }

        setWasteLines(newLines);
    }

    // Ne pas mettre à jour changedField pour les champs non-wasteLine ici
    // car c'est déjà géré par la condition suivante
    if(Object.keys(inputDependencies).includes(name)) {
        setChangedField(name);
    }

    const disablingFields = [
        'wasteDetails.quantity',
        'wasteDetails.packagingInfos[0].quantity',
        'other_infos.volume',
        'other_infos.volumeUnit',
        'other_infos.fillRate'
    ];

    if (disablingFields.includes(name)) {
        setDisableAutocompletion(true);
    } else {
        setDisableAutocompletion(false);
    }

    const newData = JSON.parse(JSON.stringify(dataToogle)) as FormInput;
    updateNestedValue(newData as unknown as NestedObject, name, value);
    setDataToogle(newData);

    if (!disablingFields.includes(name)) {
        const newDataFilter = dataFilterUpdate(
            setLineDataFilters,
            lineDataFilters,
            setCurrentFiliere, 
            ced_table, 
            name, 
            value, 
            dataFilter, 
            setDataFilter, 
            inputDependencies
        );

    if (session?.entreprise_id) {
        try {
                const [filteredOptions, allOptionsData] = await Promise.all([
                    getDataAutocompletionFull(newDataFilter, session.entreprise_id, ced_table),
                getDataAutocompletionFull([], session.entreprise_id, ced_table)
            ]);
            
                setOptions(filteredOptions);
                setAllOptions(allOptionsData);

                    // Mettre à jour automatiquement les champs dépendants
                    if (name.startsWith('wasteLine.')) {
                        const [_, indexStr, field] = name.split('.');
                        const index = parseInt(indexStr);
                        const newLines = [...wasteLines];
                        
                        if (filteredOptions.length === 1) {
                            const option = filteredOptions[0];
                            if (field === 'name' && option.json_row?.wasteDetails?.code) {
                                newLines[index].wasteDetails.code = option.json_row.wasteDetails.code;
                                const newFiliere = getFiliere(option.json_row.wasteDetails.code, ced_table);
                                if (newFiliere) {
                                    newLines[index].filiere = newFiliere;
                                }
                            } else if (field === 'other_infos' && subField === 'containerDescription' && option.other_infos) {
                                // Autocomplétion pour le contenant
                                newLines[index].other_infos = {
                                    containerDescription: value,
                                    volume: option.other_infos.volume || newLines[index].other_infos.volume,
                                    volumeUnit: option.other_infos.volumeUnit || newLines[index].other_infos.volumeUnit
                                };
                            }
                            setWasteLines(newLines);
                        }
                    }
        } catch (error) {
            console.error("Erreur lors de la mise à jour des options:", error);
            }
        }
    }
};

const toogleFunction = () => {
    if(changedField!=='') {
        setChangedField('');
    }
    else {
        setDisplayAll(!displayAll); 
    }
}

// Ajouter cette nouvelle fonction de mise à jour
const handleOtherInfosChange = (updates: Partial<{
    containerDescription: string;
    volume: string;
    volumeUnit: string;
    fillRate: string;
}>) => {
    setOtherInfos(prev => ({
        ...prev,
        ...updates
    }));
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
    const { sendMail, isValidMail } = useMailContext();

    // Déplacer handleSendAndCreate à l'intérieur du composant
    const handleSendAndCreate = async () => {
        if (!sendMail) {
            toast.error('Impossible d\'envoyer le mail');
            return;
        }

        try {
            await sendMail(); // Envoyer le mail
            await createWasteLines(); // Créer les lignes
            setDisplayThis(false); // Fermer la fenêtre
            handleReset(); // Reset le formulaire
        } catch (error) {
            console.error('Erreur:', error);
            toast.error('Une erreur est survenue');
        }
    };

    // Déplacer createWasteLines à l'intérieur du composant
    const createWasteLines = async () => {
        if (!session?.entreprise_id || !session?.user_id) return;

        try {
            const linesToCreate = await Promise.all(wasteLines.map(async (line) => {
                // Créer l'objet formAPI pour chaque ligne
                const formInput = {
                    wasteDetails: {
                        ...line.wasteDetails,
                        code: line.wasteDetails.code.replaceAll(' ', ''),
                        isSubjectToADR: false,
                        isDangerous: false,
                        pop: false,
                        quantity: Number(line.wasteDetails.quantity || 0),
                        packagingInfos: [{
                            type: "AUTRE",
                            quantity: 1
                        }]
                    },
                    emitter: dataToogle.emitter,
                    recipient: {
                        ...dataToogle.recipient,
                        isTempStorage: false
                    },
                    transporter: {
                        ...dataToogle.transporter,
                        isExemptedOfReceipt: !dataToogle.transporter.receipt
                    }
                };

                // Nettoyer les données
                if (formInput.emitter.workSite.fullAddress) {
                    const {street, postalCode, city} = parseAddress(formInput.emitter.workSite.fullAddress);
                    formInput.emitter.workSite.address = street;
                    formInput.emitter.workSite.postalCode = postalCode;
                    formInput.emitter.workSite.city = city;
                    delete formInput.emitter.workSite.fullAddress;
                }

                return {
                    user_id: session.user_id,
                    created_on_fleap: true,
                    infos_json: {
                        formAPI: { createFormInput: formInput }
                    },
                    other_infos: {
                        ...line.other_infos,
                        filiere: line.filiere
                    },
                    on_track_dechets: false,
                    status_track_dechets: 'Ligne demandée',
                    id_track_dechets: 'Ligne demandée',
                    readable_id_track_dechets: 'Ligne demandée',
                    entreprise_id: session.entreprise_id,
                    created_at: line.collectDate || new Date().toISOString()
                };
            }));

            const { error } = await supabase
                .from('bsd')
                .insert(linesToCreate);

            if (error) throw error;
            toast.success('Lignes créées avec succès');
        } catch (error) {
            console.error('Erreur lors de la création des lignes:', error);
            toast.error('Erreur lors de la création des lignes');
            throw error;
        }
    };

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
                        <button type="button" className="text-xs h-[25px] bg-[var(--green-medium)] rounded-md px-2 text-white font-thin hover:bg-[var(--green-dark)] active:font-bold" onClick={handleReset}>Réinitialiser</button>
                    </div>
                </div>
                
                <form className="ml-2">
                    <div className="text-sm font-semibold ml-6 mt-2">Point de départ</div>
                    <div className="w-[95%] pb-2 border-b border-3 mt-0 mx-auto border-gray-300">
                        {/*1ère ligne
                        <div className="mt-0 flex justify-between gap-4 w-1/2 ml-8">
                        {/*Site
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
                            />---> fermer le commentaire pour l'instant on ne prend pas adresse ça bug
                        </div>
                            {/*Point de Collecte
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
                        {/*2ème ligne
                        <div className="mt-0 flex justify-between gap-4 w-1/2 ml-8">
                            {/*Personne
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


                    <div className="text-sm font-semibold ml-6 mt-2">Destinataire du mail</div>
                    <div className="w-[95%] pb-2 border-b border-3 mt-0 mx-auto border-gray-300">
                        <div className="p-4 rounded-md pr-[230px] ml-4">
                            <div className="flex justify-between items-start">
                                <div className="flex-grow">
                                    <div className="grid grid-cols-2 gap-0">
                                {/* Section Transporteur
                                {provider === 'transporter' && (
                                            <div className="space-y-0">
                                                {/* Informations principales
                                            <div>
                                                <InputFull
                                                    titre="Transporteur"
                                                    placeholder="Sélectionner un transporteur"
                                                    options={getUniqueOptions(options, allOptions, 
                                                        opt => opt.json_row.transporter.company.name
                                                    )}
                                                    width={40}
                                                    name="transporter.company.name"
                                                    value={dataToogle.transporter.company.name}
                                                    onChange={handleChange}
                                                    enableText={true}
                                                    stylePrimary={true}
                                                />
                                                    
                                                {(displayAll || shouldDisplayField('transporter.company.siret', changedField)) && (
                                                        <div className="flex justify-between gap-4">
                                                        <InputFull
                                                            titre="SIRET"
                                                            placeholder="SIRET"
                                                            options={getUniqueOptions(options, allOptions, 
                                                                opt => opt.json_row.transporter.company.siret
                                                            )}
                                                            width={40}
                                                            name="transporter.company.siret"
                                                            value={dataToogle.transporter.company.siret}
                                                            onChange={handleChange}
                                                            enableText={true}
                                                        />
                                                        <InputFull
                                                            titre="Contact"
                                                            placeholder="Nom du contact"
                                                            options={getUniqueOptions(options, allOptions,
                                                                opt => opt.json_row.transporter.company.contact
                                                            )}
                                                            width={40}
                                                            name="transporter.company.contact"
                                                            value={dataToogle.transporter.company.contact}
                                                            onChange={handleChange}
                                                            enableText={true}
                                                        />
                                                        </div>
                                                    )}

                                                    {(displayAll || shouldDisplayField('transporter.company.contact', changedField)) && (
                                                        <div className="flex justify-between gap-4">
                                                        <InputFull
                                                            titre="Téléphone"
                                                            placeholder="Téléphone"
                                                            options={getUniqueOptions(options, allOptions,
                                                                opt => opt.json_row.transporter.company.phone
                                                            )}
                                                            width={40}
                                                            name="transporter.company.phone"
                                                            value={dataToogle.transporter.company.phone}
                                                            onChange={handleChange}
                                                            enableText={true}
                                                        />
                                                        <InputFull
                                                            titre="Email"
                                                            placeholder="Email"
                                                            options={getUniqueOptions(options, allOptions,
                                                                opt => opt.json_row.transporter.company.mail
                                                            )}
                                                            width={40}
                                                            name="transporter.company.mail"
                                                            value={dataToogle.transporter.company.mail}
                                                            onChange={handleChange}
                                                            enableText={true}
                                                        />
                                                        </div>
                                                )}
                                            </div>

                                                {/* Section des champs supplémentaires
                                        {(displayAll || shouldDisplayField('transporter.receipt', changedField)) && (
                                                    <div className="flex justify-between gap-4">
                                                <InputFull
                                                    titre="Récépissé"
                                                    placeholder="Numéro de récépissé"
                                                    options={getUniqueOptions(options, allOptions,
                                                        opt => opt.json_row.transporter.receipt
                                                    )}
                                                    width={40}
                                                    name="transporter.receipt"
                                                    value={dataToogle.transporter.receipt}
                                                    onChange={handleChange}
                                                    enableText={true}
                                                />
                                                <InputFull
                                                    titre="Plaque"
                                                    placeholder="Plaque d'immatriculation"
                                                    options={getUniqueOptions(options, allOptions,
                                                        opt => opt.json_row.transporter.numberPlate
                                                    )}
                                                    width={40}
                                                    name="transporter.numberPlate"
                                                    value={dataToogle.transporter.numberPlate}
                                                    onChange={handleChange}
                                                    enableText={true}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Section Destinataire
                                {provider === 'recipient' && (
                                            <div className="space-y-0">
                                                {/* Informations principales
                                            <div>
                                                <InputFull
                                                    titre="Destinataire"
                                                    placeholder="Sélectionner un destinataire"
                                                    options={getUniqueOptions(options, allOptions,
                                                        opt => opt.json_row.recipient.company.name
                                                    )}
                                                    width={40}
                                                    name="recipient.company.name"
                                                    value={dataToogle.recipient.company.name}
                                                    onChange={handleChange}
                                                    enableText={true}
                                                    stylePrimary={true}
                                                />
                                                    
                                                {(displayAll || shouldDisplayField('recipient.company.siret', changedField)) && (
                                                        <div className="flex justify-between gap-4">
                                                        <InputFull
                                                            titre="SIRET"
                                                            placeholder="SIRET"
                                                            options={getUniqueOptions(options, allOptions,
                                                                opt => opt.json_row.recipient.company.siret
                                                            )}
                                                            width={40}
                                                            name="recipient.company.siret"
                                                            value={dataToogle.recipient.company.siret}
                                                            onChange={handleChange}
                                                            enableText={true}
                                                        />
                                                        <InputFull
                                                            titre="Contact"
                                                            placeholder="Nom du contact"
                                                            options={getUniqueOptions(options, allOptions,
                                                                opt => opt.json_row.recipient.company.contact
                                                            )}
                                                            width={40}
                                                            name="recipient.company.contact"
                                                            value={dataToogle.recipient.company.contact}
                                                            onChange={handleChange}
                                                            enableText={true}
                                                        />
                                                        </div>
                                                    )}

                                                    {(displayAll || shouldDisplayField('recipient.company.contact', changedField)) && (
                                                        <div className="flex justify-between gap-4">
                                                        <InputFull
                                                            titre="Téléphone"
                                                            placeholder="Téléphone"
                                                            options={getUniqueOptions(options, allOptions,
                                                                opt => opt.json_row.recipient.company.phone
                                                            )}
                                                            width={40}
                                                            name="recipient.company.phone"
                                                            value={dataToogle.recipient.company.phone}
                                                            onChange={handleChange}
                                                            enableText={true}
                                                        />
                                                        <InputFull
                                                            titre="Email"
                                                            placeholder="Email"
                                                            options={getUniqueOptions(options, allOptions,
                                                                opt => opt.json_row.recipient.company.mail
                                                            )}
                                                            width={40}
                                                            name="recipient.company.mail"
                                                            value={dataToogle.recipient.company.mail}
                                                            onChange={handleChange}
                                                            enableText={true}
                                                        />
                                                        </div>
                                                )}
                                            </div>

                                                {/* Section des champs supplémentaires
                                        {(displayAll || shouldDisplayField('recipient.cap', changedField)) && (
                                                    <div className="flex justify-between gap-4">
                                                <InputFull
                                                    titre="CAP"
                                                    placeholder="Numéro de CAP"
                                                    options={getUniqueOptions(options, allOptions,
                                                        opt => opt.json_row.recipient.cap
                                                    )}
                                                    width={40}
                                                    name="recipient.cap"
                                                    value={dataToogle.recipient.cap}
                                                    onChange={handleChange}
                                                    enableText={true}
                                                />
                                                <InputFull
                                                    titre="Opération"
                                                    placeholder="Code opération"
                                                    options={getUniqueOptions(options, allOptions,
                                                        opt => opt.json_row.recipient.processingOperation
                                                    )}
                                                    width={40}
                                                    name="recipient.processingOperation"
                                                    value={dataToogle.recipient.processingOperation}
                                                    onChange={handleChange}
                                                    enableText={true}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                                    </div>
                                </div>

                                {/* Boutons de sélection
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setProvider('transporter')}
                                        className={`px-3 py-1 rounded text-sm ${
                                            provider === 'transporter' 
                                            ? 'bg-[var(--green-medium)] text-white' 
                                            : 'bg-gray-200 text-gray-700'
                                        }`}
                                    >
                                        Transporteur
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setProvider('recipient')}
                                        className={`px-3 py-1 rounded text-sm ${
                                            provider === 'recipient' 
                                            ? 'bg-[var(--green-medium)] text-white' 
                                            : 'bg-gray-200 text-gray-700'
                                        }`}
                                    >
                                        Destinataire
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-sm font-semibold ml-6 mt-2 flex justify-between items-center">
                        <span>Lignes de déchets</span>
                        <button
                            type="button"
                            onClick={() => setWasteLines([...wasteLines, {
                                filiere: "",
                                wasteDetails: {
                                    code: "",
                                    name: "",
                                    packagingInfos: [{
                                        type: "AUTRE",
                                        quantity: 1
                                    }],
                                    quantity: 0
                                },
                                collectDate: "",
                                other_infos: {
                                    containerDescription: "",
                                    volume: "",
                                    volumeUnit: ""
                                }
                            }])}
                            className="text-xs h-[25px] bg-[var(--green-medium)] rounded-md px-2 text-white font-thin hover:bg-[var(--green-dark)]"
                        >
                            Ajouter une ligne
                        </button>
                    </div>
                    <div className="w-[95%] pb-2 border-b border-3 mt-0 mx-auto border-gray-300">
                        {wasteLines.map((line, index) => (
                            <div key={index} className="flex flex-col space-y-2">
                                <div className="flex items-center gap-x-2">
                                    <div className="my-1">
                                        <InputFull
                                            titre="Déchet"
                                            placeholder="Nom du déchet"
                                            options={getUniqueOptions(options, allOptions, 
                                                opt => opt.json_row?.wasteDetails?.name || undefined
                                            )}
                                            width={30}
                                            name={`wasteLine.${index}.name`}
                                            value={line.wasteDetails.name}
                                            onChange={handleChange}
                                            enableText={false}
                                            stylePrimary={true}
                                        />
                                        {(displayAll || shouldDisplayField(`wasteLine.${index}.code`, changedField)) && (
                                            <InputFull
                                                titre="Code CED"
                                                placeholder="Code CED"
                                                options={getUniqueOptions(options, allOptions, 
                                                    opt => opt.json_row?.wasteDetails?.code || undefined
                                                )}
                                                width={30}
                                                name={`wasteLine.${index}.code`}
                                                value={line.wasteDetails.code}
                                                onChange={handleChange}
                                                enableText={false}
                                            />
                                        )}
                                        {(displayAll || shouldDisplayField(`wasteLine.${index}.filiere`, changedField)) && (
                                            <InputFull
                                                titre="Filière"
                                                placeholder="Sélectionner une filière"
                                                options={getUniqueOptions(options, allOptions, 
                                                    opt => getFiliere(opt.json_row.wasteDetails.code, ced_table)
                                                )}
                                                width={30}
                                                name={`wasteLine.${index}.filiere`}
                                                value={line.filiere}
                                                onChange={handleChange}
                                                enableText={false}
                                            />
                                        )}
                                    </div>

                                    <div className="mr-8">
                                        <InputFull
                                            titre="Contenant"
                                            placeholder="Type de contenant"
                                            options={getUniqueOptions(options, allOptions,
                                                opt => opt.other_infos?.containerDescription || undefined
                                            )}
                                            width={30}
                                            name={`wasteLine.${index}.other_infos.containerDescription`}
                                            value={line.other_infos.containerDescription}
                                            onChange={handleChange}
                                            enableText={true}
                                            stylePrimary={true}
                                        />
                                        
                                        {(displayAll || shouldDisplayField(`wasteLine.${index}.other_infos.containerDescription`, changedField)) && (
                                            <>
                                                <InputFull
                                                    titre="Volume"
                                                    placeholder="Volume"
                                                    width={30}
                                                    name={`wasteLine.${index}.other_infos.volume`}
                                                    value={line.other_infos.volume}
                                                    onChange={handleChange}
                                                    enableText={true}
                                                    options={getUniqueOptions(options, allOptions,
                                                        opt => opt.other_infos?.volume
                                                    )}
                                                />
                                                <InputFull
                                                    titre="Unité"
                                                    placeholder="Unité"
                                                    width={30}
                                                    name={`wasteLine.${index}.other_infos.volumeUnit`}
                                                    value={line.other_infos.volumeUnit}
                                                    onChange={handleChange}
                                                    enableText={true}
                                                    options={{
                                                        filteredOptions: ['L', 'm³'],
                                                        allOptions: []
                                                    }}
                                                />
                                            </>
                                        )}
                                    </div>

                                    <div className="ml-6 flex items-center justify-start gap-x-4">
                                        <div className="flex-grow">
                                            <input
                                                type="date"
                                                className="w-[150px] px-3 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--green-medium)] text-sm"
                                                name={`wasteLine.${index}.collectDate`}
                                                value={line.collectDate}
                                                onChange={handleChange}
                                            />
                                        </div>

                                        {index > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newLines = wasteLines.filter((_, i) => i !== index);
                                                    setWasteLines(newLines);
                                                }}
                                                className="text-white bg-red-500 rounded-3xl px-3 font-bold text-xl hover:text-red-700 focus:outline-none"
                                            >
                                                -
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>



                   
                    <div className="ml-[-10px]">
                        {(session?.entreprise_id && modalType !== 'create_line') && 
                            <NewDemandeMailComponent 
                                params={{
                                    emitter: {
                                        name: dataToogle.emitter.company.name || '',
                                        contact: dataToogle.emitter.company.contact || '',
                                        phone: dataToogle.emitter.company.phone || '',
                                        email: dataToogle.emitter.company.mail || '',
                                        address: dataToogle.emitter.workSite.fullAddress || dataToogle.emitter.workSite.address || ''
                                    },
                                    destinataire: provider === 'transporter' 
                                        ? (dataToogle.transporter.company.mail || '')
                                        : (dataToogle.recipient.company.mail || ''),
                                    entrepriseId: session.entreprise_id,
                                    entrepriseName: dataToogle.emitter.company.name || '',
                                    wasteLines: wasteLines.map(line => ({
                                        code: line.wasteDetails.code || '',
                                        description: line.wasteDetails.name || '',
                                        container: line.other_infos.containerDescription || '',
                                        volume: line.other_infos.volume || '',
                                        volumeUnit: line.other_infos.volumeUnit || '',
                                        collectDate: line.collectDate || ''
                                    }))
                                }}
                            />
                        }
                    </div>

                    <div className="flex justify-end gap-4 mt-6 mb-4 mr-4">
                        <button
                            type="button"
                            onClick={() => {
                                setDisplayThis(false);
                                handleReset();
                            }}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                        >
                            Annuler
                        </button>
                        <button
                            type="button"
                            onClick={handleSendAndCreate}
                            disabled={!isValidMail || wasteLines.some(line => !line.wasteDetails.name)}
                            className="px-4 py-2 text-sm font-medium text-white bg-[var(--green-medium)] rounded-md hover:bg-[var(--green-dark)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--green-medium)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Envoyer et créer les lignes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default NewFormulaireDemande;


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
        if(name.startsWith('wasteLine.')) {
            const [_, __, field, subField] = name.split('.');
            if(field === "filiere") {
            const table_ceds = cedTable.filter(ced => ced.filiere === value);
            const ceds = table_ceds.map(ced => ced.ced);
            const ceds_all_types = ceds.map(ced => [
                ced,
                ced.replace(/(\d{2})(?=\d)/g, '$1 ').trim(),
                ced.replace(/(\d{2})(?=\d)/g, '$1 ').trim() + '*'
            ]);
            const ced_all = ceds_all_types.flatMap(ced_types => ced_types);
            query = query.filter('json_row->wasteDetails->>code', 'in', `(${ced_all.join(',')})`);
            } else if(field === "other_infos") {
                query = query.eq(`other_infos->>${subField}`, value);
            } else if(field === "name") {
                query = query.eq('json_row->wasteDetails->>name', value);
            } else if(field === "code") {
                // Gérer le code CED avec ses différents formats possibles
                const formattedCode = value.replace(/\s/g, '');
                const alternateCode = value.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
                query = query.or(`json_row->wasteDetails->>code.eq.${formattedCode},json_row->wasteDetails->>code.eq.${alternateCode}`);
            }
        } else if (value && typeof value === 'string') {
            const name_prefilter = name.replaceAll('.', '->');
            const name_filter = replaceLastOccurrence(name_prefilter, '->', '->>');
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
    selector: (opt: CompleteFormInput) => string | undefined
) => {

    // S'assurer que les valeurs undefined sont filtrées
    const filtered = Array.from(new Set(
        filteredOptions.map(selector).filter((value): value is string => 
            value !== undefined && value !== null && value !== ''
        )
    ));
    
    const all = Array.from(new Set(
        allOptions.map(selector).filter((value): value is string => 
            value !== undefined && value !== null && value !== ''
        )
    )); 
    

    return {
        filteredOptions: filtered,
        allOptions: all.filter(opt => !filtered.includes(opt))
    };
};

// Fonction pour vérifier si un champ est un ancêtre d'un autre
const isAncestor = (potentialAncestor: string, field: string, inputDependencies: InputDependencies) => {
    // Gérer le cas des champs de ligne
    if (field.startsWith('wasteLine.')) {
        const [_, indexStr] = field.split('.');
        const ancestorPattern = `wasteLine.${indexStr}`;
        if (potentialAncestor.startsWith(ancestorPattern)) {
            return inputDependencies[potentialAncestor]?.children.includes(field);
        }
    }
    return inputDependencies[potentialAncestor]?.children.includes(field);
};

// Déplacer dataFilterUpdate à l'intérieur du composant
const dataFilterUpdate = (setLineDataFilters: (lineDataFilters: {[key: number]: {name: string, value: string}[]}) => void, lineDataFilters: {[key: number]: {name: string, value: string}[]}, setCurrentFiliere: (filiere: string) => void, ced_table: { ced: string; filiere: string; }[], name: string, value: string, dataFilter: {name: string, value: string}[], setDataFilter: (dataFilter: {name: string, value: string}[]) => void, inputDependencies: InputDependencies) => {
    // Récupérer les filtres fixes (non-wasteLine)
    const fixedFilters = dataFilter.filter(filter => !filter.name.startsWith('wasteLine.'));

    if(name.startsWith('wasteLine.')) {
        const [_, indexStr, field, subField] = name.split('.');
        const index = parseInt(indexStr);
        
        // Récupérer ou créer les filtres pour cette ligne spécifique
        const currentLineFilters = lineDataFilters[index] || [];

        // Mettre à jour les filtres de la ligne courante
        let updatedLineFilters = [...currentLineFilters];

        if (field === "name") {
            const value_split = value.split(" - ");
            updatedLineFilters = updateLineFilter(updatedLineFilters, {
                name: `wasteLine.${index}.name`,
                value: value_split[0]
            });
        }
        else if(field === "code") {
            const codeValue = value.split(' - ')[1];
            updatedLineFilters = updateLineFilter(updatedLineFilters, {
                name: `wasteLine.${index}.code`,
                value: codeValue
            });
            
            const newFiliere = getFiliere(codeValue, ced_table);
            if (newFiliere) {
                updatedLineFilters = updateLineFilter(updatedLineFilters, {
                    name: `wasteLine.${index}.filiere`,
                    value: newFiliere
                });
            }
        }
        else if(field === "filiere") {
            updatedLineFilters = updateLineFilter(updatedLineFilters, {
                name: `wasteLine.${index}.filiere`,
                value
            });
        }
        else if(field === "other_infos") {
            updatedLineFilters = updateLineFilter(updatedLineFilters, {
                name: `wasteLine.${index}.other_infos.${subField}`,
                value
            });
        }

        // Mettre à jour les filtres de la ligne
        setLineDataFilters(prev => ({
            ...prev,
            [index]: updatedLineFilters
        }));

        // Combiner les filtres fixes avec les filtres de la ligne courante
        const combinedFilters = [...fixedFilters, ...updatedLineFilters];
        setDataFilter(combinedFilters);
        return combinedFilters;
    }
    
    // Gestion des champs fixes (non-wasteLine)
    if (value) {
        const newFixedFilters = updateLineFilter(fixedFilters, { name, value });
        
        // Mettre à jour tous les filtres de ligne avec les nouveaux filtres fixes
        Object.keys(lineDataFilters).forEach(index => {
            const lineIndex = parseInt(index);
            const lineFilters = lineDataFilters[lineIndex];
            const combinedFilters = [...newFixedFilters, ...lineFilters];
            setDataFilter(combinedFilters);
        });

        return [...newFixedFilters];
    }
    
    return dataFilter;
};

// Déplacer updateLineFilter à l'intérieur du composant aussi
const updateLineFilter = (filters: {name: string, value: string}[], newFilter: {name: string, value: string}) => {
    const existingIndex = filters.findIndex(filter => filter.name === newFilter.name);
    if (existingIndex !== -1) {
        return [
            ...filters.slice(0, existingIndex),
            newFilter,
            ...filters.slice(existingIndex + 1)
        ];
    }
    return [...filters, newFilter];
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

// Ajouter la fonction de changement de provider
const handleProviderChange = (newProvider: 'transporter' | 'recipient') => {
    setProvider(newProvider);
};





*/


