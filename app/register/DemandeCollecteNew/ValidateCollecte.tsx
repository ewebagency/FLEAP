/*import { FormInput } from "@/app/register/interface/BSD_Interface";
import { useModalContextNew } from "../RegisterComponents/Modal/ContextModal";
import InputFull from "../RegisterComponents/Modal/FormulaireFull/InputFull";
import { getDataAutocompletion, getMappingTableFiliere, getFiliere, filter_dependencies, formatText } from "../RegisterComponents/Modal/FormulaireFull/utils_new";
import { useEffect, useState, useRef } from "react";
import { useSession } from "@/app/component/SessionProvider";
import { supabase } from "@/app/database/supabaseClient";
import BoxIcon from "@/app/component/BoxIconWrapper";
import { useFilterContext } from "@/app/FilterContext";
import { OtherInfos, CompleteFormInput } from "@/app/register/interface/BSD_Interface";
import { toast } from "react-hot-toast";
import { createRoot } from "react-dom/client";
import { BSD } from "@/app/analysis/AnalysisProvider";

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

// Définir l'interface des props
interface ValidateCollecteProps {
    onClose: () => void;
    bsd: BSD;
}

// Ajouter ces constantes au début du fichier, après les imports
const dic_json_ced_masse_volumique = [
    { "code_CED": "17 01 01", "masse_volumique": 2300 },
    { "code_CED": "17 01 02", "masse_volumique": 1900 },
    { "code_CED": "17 01 07", "masse_volumique": 2000 },
    { "code_CED": "20 01 01", "masse_volumique": 150 },
    { "code_CED": "20 01 39", "masse_volumique": 100 },
    { "code_CED": "20 03 01", "masse_volumique": 250 },
    { "code_CED": "15 01 01", "masse_volumique": 100 },
    { "code_CED": "15 01 07", "masse_volumique": 35 },
    { "code_CED": "20 02 01", "masse_volumique": 500 },
    { "code_CED": "17 09 04", "masse_volumique": 1500 }
];

// Ajouter ces fonctions de calcul avant le composant ValidateCollecte
const calculateEstimatedWeight = (
    volume: string | undefined, 
    fillRate: string | undefined, 
    wasteCode: string | undefined,
    volumeUnit: string = 'm3'
): number | null => {
    if (!volume) return null;

    const volumeInM3 = volumeUnit === 'L' ? parseFloat(volume) / 1000 : parseFloat(volume);
    
    const wasteInfo = wasteCode ? 
        dic_json_ced_masse_volumique.find(
            item => item.code_CED.replace(/\s/g, '') === wasteCode.replace(/\s/g, '')
        ) : null;
    
    const masseVolumique = wasteInfo?.masse_volumique || 1000;
    const fillRateMultiplier = fillRate ? parseInt(fillRate) / 100 : 1;
    
    return (volumeInM3 * masseVolumique * fillRateMultiplier) / 1000;
};

const calculateFillRate = (
    volume: string | undefined,
    weight: string | undefined,
    wasteCode: string | undefined,
    volumeUnit: string = 'm3'
): number | null => {
    if (!volume || !weight) return null;

    const volumeInM3 = volumeUnit === 'L' ? parseFloat(volume) / 1000 : parseFloat(volume);
    const weightInKg = parseFloat(weight) * 1000;

    const wasteInfo = wasteCode ? 
        dic_json_ced_masse_volumique.find(
            item => item.code_CED.replace(/\s/g, '') === wasteCode.replace(/\s/g, '')
        ) : null;
    
    const masseVolumique = wasteInfo?.masse_volumique || 1000;
    const fillRate = (weightInKg / (volumeInM3 * masseVolumique)) * 100;
    
    return Math.min(Math.max(fillRate, 0), 100);
};

const ValidateCollecte = ({ onClose, bsd }: ValidateCollecteProps) => {
    const {             
        setDisplayFormulaire,
        options,
        setOptions,
        modalType } = useModalContextNew();
    
    // Initialiser dataToogle avec les données du BSD
    const [dataToogle, setDataToogle] = useState<FormInput>(
        bsd.infos_json.formAPI.createFormInput
    );

    // Initialiser other_infos avec les données du BSD
    const [other_infos, setOtherInfos] = useState<OtherInfos>(
        bsd.other_infos || {
            containerDescription: "",
            volume: "",
            volumeUnit: "",
            fillRate: "",
            inputMode: "volume",
            automaticMode: true
        }
    );

    const [currentFiliere, setCurrentFiliere] = useState("");
    const session = useSession();
    const [ced_table, setCedTable] = useState<{ ced: string, filiere: string }[]>([]);
    const [displayAll, setDisplayAll] = useState(false);
    
    // Initialiser dataFilter avec les données du BSD
    const [dataFilter, setDataFilter] = useState<{name: string, value: string}[]>(() => {
        const filters: {name: string, value: string}[] = [];
        
        // Ajouter le filtre pour la filière si le code déchet existe
        if (bsd.infos_json.formAPI.createFormInput.wasteDetails.code) {
            filters.push({
                name: "wasteDetails.code",
                value: bsd.infos_json.formAPI.createFormInput.wasteDetails.code
            });
        }

        // Ajouter le filtre pour l'émetteur si le nom existe
        if (bsd.infos_json.formAPI.createFormInput.emitter?.company?.name) {
            filters.push({
                name: "emitter.company.name",
                value: bsd.infos_json.formAPI.createFormInput.emitter.company.name
            });
        }

        // Ajouter le filtre pour le point de collecte si le nom existe
        if (bsd.infos_json.formAPI.createFormInput.emitter?.workSite?.name) {
            filters.push({
                name: "emitter.workSite.name",
                value: bsd.infos_json.formAPI.createFormInput.emitter.workSite.name
            });
        }

        // Ajouter le filtre pour le transporteur si le nom existe
        if (bsd.infos_json.formAPI.createFormInput.transporter?.company?.name) {
            filters.push({
                name: "transporter.company.name",
                value: bsd.infos_json.formAPI.createFormInput.transporter.company.name
            });
        }

        // Ajouter le filtre pour le destinataire si le nom existe
        if (bsd.infos_json.formAPI.createFormInput.recipient?.company?.name) {
            filters.push({
                name: "recipient.company.name",
                value: bsd.infos_json.formAPI.createFormInput.recipient.company.name
            });
        }

        return filters;
    });

    const [allOptions, setAllOptions] = useState<{json_row: FormInput, other_infos?: OtherInfos}[]>([]);
    const [changedField, setChangedField] = useState<string>("");
    const { sites } = useFilterContext();

    // Ajouter une ref pour tracker la dernière modification
    const lastChangedField = useRef<string>('');

    // Ajouter un état pour tracker si l'autocomplétion est désactivée
    const [disableAutocompletion, setDisableAutocompletion] = useState(false);

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

// Dans le composant ValidateCollecte, modifier les gestionnaires d'événements
const handleOtherInfosChange = (updates: Partial<OtherInfos>) => {
    const updatedOtherInfos: OtherInfos = {
        ...other_infos,
        ...updates
    };
    
    // Si le mode automatique est activé et qu'on est en mode volume
    if (updatedOtherInfos.automaticMode && updatedOtherInfos.inputMode === 'volume' && 
        (updates.fillRate || updates.volume || updates.volumeUnit)) {
        const weight = calculateEstimatedWeight(
            updatedOtherInfos.volume,
            updatedOtherInfos.fillRate,
            dataToogle.wasteDetails.code,
            updatedOtherInfos.volumeUnit
        );
        if (weight !== null) {
            const newData = { ...dataToogle };
            updateNestedValue(newData as unknown as NestedObject, 'wasteDetails.quantity', weight.toFixed(3));
            setDataToogle(newData);
        }
    }
    
    setOtherInfos(updatedOtherInfos);
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

// Ajouter la fonction onValidate
const onValidate = async () => {
    try {
        // Vérifier que les champs obligatoires sont remplis
        if (!dataToogle.wasteDetails.quantity) {
            toast.error("La quantité est obligatoire");
            return;
        }

        if (!other_infos.containerDescription) {
            toast.error("La description du contenant est obligatoire");
            return;
        }

        if (!dataToogle.wasteDetails.packagingInfos[0].quantity) {
            toast.error("Le nombre de contenants est obligatoire");
            return;
        }

        // Préparer les données à mettre à jour
        const updateData = {
            infos_json: {
                ...bsd.infos_json,
                formAPI: {
                    ...bsd.infos_json.formAPI,
                    createFormInput: {
                        ...dataToogle,
                        takenOverAt: new Date().toISOString()
                    }
                }
            },
            other_infos: other_infos,
            status_track_dechets: 'Ligne validée',
            id_track_dechets: 'Ligne validée',
            readable_id_track_dechets: 'Ligne validée',
        };

        // Mettre à jour le BSD dans la base de données
        const { error } = await supabase
            .from('bsd')
            .update(updateData)
            .eq('id', bsd.id);

        if (error) {
            console.error('Erreur lors de la mise à jour:', error);
            toast.error('Erreur lors de la validation du BSD');
            throw error;
        }

        toast.success('BSD validé avec succès');
        onClose();

    } catch (error) {
        console.error('Erreur:', error);
        toast.error('Une erreur est survenue lors de la validation');
    }
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
                    {/* Première ligne : Site, Point de collecte, Contact émetteur
                    <div className="grid grid-cols-3 gap-0 mb-1 w-[85%] bg-gray-50 rounded-md p-2">
                        {/* Colonne 1: Site
                        <div>
                            <InputFull
                                titre="Site"
                                placeholder="Sélectionner un site"
                                options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.name)}
                                width={30}
                                name="emitter.company.name"
                                value={dataToogle.emitter.company.name}
                                onChange={handleChange}
                                enableText={true}
                            />
                            <InputFull
                                titre=" "
                                placeholder="Siret"
                                options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.siret)}
                                width={30}
                                name="emitter.company.siret"
                                value={dataToogle.emitter.company.siret}
                                onChange={handleChange}
                                enableText={true}
                                display={displayAll || shouldDisplayField("emitter.company.siret", changedField)}
                            />
                        </div>

                        {/* Colonne 2: Point de collecte
                        <div>
                            <InputFull
                                titre="Point de collecte"
                                placeholder="Sélectionner un point de collecte"
                                options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.workSite.name)}
                                width={30}
                                name="emitter.workSite.name"
                                value={dataToogle.emitter.workSite.name}
                                onChange={handleChange}
                                enableText={true}
                            />
                            <InputFull
                                titre=" "
                                placeholder="Adresse d'enlèvement"
                                options={getUniqueOptions(options, allOptions, opt => `${opt.json_row.emitter.workSite.fullAddress ?? ""}`)}
                                width={30}
                                name="emitter.workSite.fullAddress"
                                value={`${dataToogle.emitter.workSite.fullAddress ?? ""}`}
                                onChange={handleChange}
                                enableText={true}
                                display={displayAll || shouldDisplayField("emitter.workSite.fullAddress", changedField)}
                            />
                        </div>

                        {/* Colonne 3: Contact émetteur
                        <div>
                            <InputFull
                                titre="Contact"
                                placeholder="Contact"
                                options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.contact)}
                                width={30}
                                name="emitter.company.contact"
                                value={dataToogle.emitter.company.contact}
                                onChange={handleChange}
                                enableText={true}
                            />
                            <InputFull
                                titre=" "
                                placeholder="Téléphone"
                                options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.phone)}
                                width={30}
                                name="emitter.company.phone"
                                value={dataToogle.emitter.company.phone}
                                onChange={handleChange}
                                enableText={true}
                                display={displayAll || shouldDisplayField("emitter.company.phone", changedField)}
                            />
                            <InputFull
                                titre=" "
                                placeholder="Mail"
                                options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.mail)}
                                width={30}
                                name="emitter.company.mail"
                                value={dataToogle.emitter.company.mail}
                                onChange={handleChange}
                                enableText={true}
                                display={displayAll || shouldDisplayField("emitter.company.mail", changedField)}
                            />
                        </div>
                    </div>



                    {/* Deuxième ligne : Transporteur, Destinataire, Autres
                    <div className="grid grid-cols-3 gap-0 mb-1 w-[85%] bg-gray-50 rounded-md p-2">
                        {/* Colonne 1: Transporteur
                        <div>
                            <InputFull
                                titre="Transporteur"
                                placeholder="Sélectionner un transporteur"
                                options={getUniqueOptions(options, allOptions, opt => opt.json_row.transporter.company.name)}
                                width={30}
                                name="transporter.company.name"
                                value={dataToogle.transporter.company.name}
                                onChange={handleChange}
                                enableText={false}
                            />
                            <InputFull
                                titre=" "
                                placeholder="Siret transporteur"
                                options={getUniqueOptions(options, allOptions, opt => opt.json_row.transporter.company.siret)}
                                width={30}
                                name="transporter.company.siret"
                                value={dataToogle.transporter.company.siret}
                                onChange={handleChange}
                                enableText={false}
                                display={displayAll || shouldDisplayField("transporter.company.siret", changedField)}
                            />
                        </div>

                        {/* Colonne 2: Destinataire
                        <div>
                            <InputFull
                                titre="Destinataire"
                                placeholder="Sélectionner un destinataire"
                                options={getUniqueOptions(options, allOptions, opt => opt.json_row.recipient.company.name)}
                                width={30}
                                name="recipient.company.name"
                                value={dataToogle.recipient.company.name}
                                onChange={handleChange}
                                enableText={false}
                            />
                            <InputFull
                                titre=" "
                                placeholder="Siret destinataire"
                                options={getUniqueOptions(options, allOptions, opt => opt.json_row.recipient.company.siret)}
                                width={30}
                                name="recipient.company.siret"
                                value={dataToogle.recipient.company.siret}
                                onChange={handleChange}
                                enableText={false}
                                display={displayAll || shouldDisplayField("recipient.company.siret", changedField)}
                            />
                        </div>

                        {/* Colonne 3: Autres 
                        <div>
                            <InputFull
                                titre=" "
                                placeholder="CAP"
                                options={getUniqueOptions(options, allOptions, opt => opt.json_row.recipient.cap || '')}
                                width={30}
                                name="recipient.cap"
                                value={dataToogle.recipient.cap || ''}
                                onChange={handleChange}
                                enableText={false}
                                display={displayAll || shouldDisplayField("recipient.cap", changedField)}
                            />
                            <InputFull
                                titre=" "
                                placeholder="Code traitement"
                                options={getUniqueOptions(options, allOptions, opt => opt.json_row.recipient.processingOperation || '')}
                                width={30}
                                name="recipient.processingOperation"
                                value={dataToogle.recipient.processingOperation || ''}
                                onChange={handleChange}
                                enableText={false}
                                display={displayAll || shouldDisplayField("recipient.processingOperation", changedField)}
                            />
                        </div>
                    </div>

                    {/* Troisième ligne : Filière, Déchet, Contenant 
                    <div className="grid grid-cols-3 gap-0 mb-1 w-[85%] bg-gray-50 rounded-md p-2">
                        {/* Colonne 1: Filière 
                        <div>
                            <InputFull
                                titre="Filière"
                                placeholder="Sélectionner une filière"
                                options={getUniqueOptions(options, allOptions, opt => getFiliere(opt.json_row.wasteDetails.code, ced_table))}
                                width={30}
                                name="filiere"
                                value={currentFiliere}
                                onChange={handleChange}
                                enableText={false}
                            />
                        </div>

                        {/* Colonne 2: Déchet
                        <div>
                            <InputFull
                                titre="Déchet"
                                placeholder="Nom du déchet"
                                options={getUniqueOptions(options, allOptions, opt => `${opt.json_row.wasteDetails.name}`)}
                                width={30}
                                name="wasteDetails.name"
                                value={dataToogle.wasteDetails.name}
                                onChange={handleChange}
                                enableText={false}
                            />
                            <InputFull
                                titre=" "
                                placeholder="Code CED"
                                options={getUniqueOptions(options, allOptions, opt => `${opt.json_row.wasteDetails.code}`)}
                                width={30}
                                name="wasteDetails.code"
                                value={dataToogle.wasteDetails.code}
                                onChange={handleChange}
                                enableText={false}
                                display={displayAll || shouldDisplayField("wasteDetails.code", changedField)}
                            />
                        </div>

                        {/* Colonne 3: Contenant 
                        <div>
                            <InputFull
                                titre="Description"
                                placeholder="Description du contenant"
                                options={getUniqueOptions(options, allOptions, opt => opt.other_infos?.containerDescription || '')}
                                width={30}
                                name="other_infos.containerDescription"
                                value={other_infos.containerDescription}
                                onChange={handleChange}
                                enableText={true}
                            />
                            <InputFull
                                titre="Volume"
                                placeholder="Volume"
                                name="other_infos.volume"
                                value={other_infos.volume}
                                onChange={handleChange}
                                width={30}
                                enableText={true}
                                options={{
                                    filteredOptions: [],
                                    allOptions: ['20', '30', '100', '200', '500', '1000']
                                }}
                                display={displayAll || shouldDisplayField("other_infos.volume", changedField)}
                            />
                            <InputFull
                                titre="Unité"
                                placeholder="Unité"
                                name="other_infos.volumeUnit"
                                value={other_infos.volumeUnit}
                                onChange={handleChange}
                                width={30}
                                enableText={true}
                                options={{
                                    filteredOptions: [],
                                    allOptions: ['L', 'm³']
                                }}
                                display={displayAll || shouldDisplayField("other_infos.volumeUnit", changedField)}
                            />
                        </div>
                    </div>

                    {/* Section Validation de la collecte 
                    <div className="text-sm font-semibold ml-6 mt-6">Validation de la collecte</div>
                    <div className="w-[85%] bg-gray-50 rounded-md p-4 mx-auto">
                        <div className="flex justify-between">
                            {/* Colonne gauche - Remplissage et tonnage 
                            <div className="flex-1">
                                {/* Première ligne - Radio buttons et checkbox 
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex space-x-4">
                                        <label className="flex items-center space-x-2">
                                            <input
                                                type="radio"
                                                name="inputMode"
                                                value="volume"
                                                checked={other_infos.inputMode === 'volume'}
                                                onChange={(e) => setOtherInfos(prev => ({ ...prev, inputMode: 'volume' }))}
                                                className="h-4 w-4 text-blue-600"
                                                disabled={!other_infos.automaticMode}
                                            />
                                            <span className={`text-sm font-medium ${!other_infos.automaticMode ? 'text-gray-400' : 'text-gray-700'}`}>
                                                Remplissage
                                            </span>
                                        </label>
                                        <label className="flex items-center space-x-2">
                                            <input
                                                type="radio"
                                                name="inputMode"
                                                value="tonnage"
                                                checked={other_infos.inputMode === 'tonnage'}
                                                onChange={(e) => setOtherInfos(prev => ({ ...prev, inputMode: 'tonnage' }))}
                                                className="h-4 w-4 text-blue-600"
                                                disabled={!other_infos.automaticMode}
                                            />
                                            <span className={`text-sm font-medium ${!other_infos.automaticMode ? 'text-gray-400' : 'text-gray-700'}`}>
                                                Tonnage
                                            </span>
                                        </label>
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                checked={other_infos.automaticMode}
                                                onChange={(e) => setOtherInfos(prev => ({
                                                    ...prev,
                                                    automaticMode: e.target.checked,
                                                    inputMode: e.target.checked ? 'volume' : prev.inputMode
                                                }))}
                                                className="h-4 w-4 text-blue-600 rounded"
                                            />
                                            <label className="text-sm font-medium text-gray-700">
                                                Calcul automatique
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Deuxième ligne - Remplissage et poids
                                <div className="flex items-center gap-8">
                                    {/* Remplissage avec slider vertical 
                                    <div className="flex items-center gap-0">
                                        <div className="h-40 flex items-center">
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                step="5"
                                                value={other_infos.fillRate || 0}
                                                onChange={(e) => {
                                                    if (!other_infos.automaticMode || other_infos.inputMode !== 'tonnage') {
                                                        handleOtherInfosChange({ fillRate: e.target.value });
                                                    }
                                                }}
                                                className={`h-32 -rotate-90 ${
                                                    other_infos.automaticMode && other_infos.inputMode === 'tonnage'
                                                        ? 'opacity-50 cursor-not-allowed'
                                                        : 'accent-[var(--green-medium)]'
                                                }`}
                                                style={{
                                                    width: '8rem',
                                                    marginLeft: '-2rem',
                                                    marginRight: '-2rem'
                                                }}
                                                disabled={other_infos.automaticMode && other_infos.inputMode === 'tonnage'}
                                            />
                                        </div>
                                        <div className="flex flex-col justify-between h-32 text-xs text-gray-500">
                                            <span>100%</span>
                                            
                                            <span>0%</span>
                                        </div>
                                        <div className="flex items-start gap-4 ml-[-30px]">
                                            <span className="text-md font-medium text-gray-600">
                                                {other_infos.fillRate || 0}%
                                            </span>
                                            <BoxIcon 
                                                name="trash" 
                                                type="solid" 
                                                className="w-12 h-12 text-gray-400 mb-2"
                                            />                                            
                                        </div>
                                    </div>

                                    {/* Poids 
                                    <div className="flex flex-col">
                                        <input
                                            type="number"
                                            className={`w-32 text-2xl px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                                other_infos.automaticMode && other_infos.inputMode === 'volume' ? 'bg-gray-100' : ''
                                            }`}
                                            value={dataToogle.wasteDetails.quantity || ''}
                                            onChange={(e) => {
                                                const newData = { ...dataToogle };
                                                updateNestedValue(newData as unknown as NestedObject, 'wasteDetails.quantity', e.target.value);
                                                setDataToogle(newData);

                                                if (other_infos.automaticMode && other_infos.inputMode === 'tonnage') {
                                                    const fillRate = calculateFillRate(
                                                        other_infos.volume,
                                                        e.target.value,
                                                        dataToogle.wasteDetails.code,
                                                        other_infos.volumeUnit
                                                    );
                                                    if (fillRate !== null) {
                                                        setOtherInfos(prev => ({ ...prev, fillRate: fillRate.toFixed(0) }));
                                                    }
                                                }
                                            }}
                                            disabled={other_infos.automaticMode && other_infos.inputMode === 'volume'}
                                            placeholder="0.00"
                                        />
                                        <div className="flex items-center space-x-2 mt-2">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 text-blue-600 rounded"
                                                checked={dataToogle.wasteDetails.quantityType === 'ESTIMATED'}
                                                onChange={(e) => {
                                                    const newData = { ...dataToogle };
                                                    updateNestedValue(newData as unknown as NestedObject, 'wasteDetails.quantityType', e.target.checked ? 'ESTIMATED' : 'REAL');
                                                    setDataToogle(newData);
                                                }}
                                            />
                                            <label className="text-sm text-gray-600">
                                                Quantité estimée
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Colonne droite - Contenants et photo 
                            <div className="flex flex-col justify-between ml-8">
                                {/* Nombre de contenants 
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Nombre de contenants
                                    </label>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const currentQty = Number(dataToogle.wasteDetails.packagingInfos[0].quantity) || 0;
                                                if (currentQty > 0) {
                                                    const newData = { ...dataToogle };
                                                    updateNestedValue(newData as unknown as NestedObject, 'wasteDetails.packagingInfos[0].quantity', (currentQty - 1).toString());
                                                    setDataToogle(newData);
                                                }
                                            }}
                                            className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300"
                                        >
                                            -
                                        </button>
                                        <input
                                            type="number"
                                            className="w-20 h-[42px] text-center px-2 border border-gray-300 rounded-md"
                                            value={dataToogle.wasteDetails.packagingInfos[0].quantity || 0}
                                            onChange={(e) => {
                                                const value = Math.max(Number(e.target.value) || 0, 0);
                                                const newData = { ...dataToogle };
                                                updateNestedValue(newData as unknown as NestedObject, 'wasteDetails.packagingInfos[0].quantity', value.toString());
                                                setDataToogle(newData);
                                            }}
                                            min="0"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const currentQty = Number(dataToogle.wasteDetails.packagingInfos[0].quantity) || 0;
                                                const newData = { ...dataToogle };
                                                updateNestedValue(newData as unknown as NestedObject, 'wasteDetails.packagingInfos[0].quantity', (currentQty + 1).toString());
                                                setDataToogle(newData);
                                            }}
                                            className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>

                                {/* Bouton photo 
                                <button
                                    type="button"
                                    className="bg-[var(--green-medium)] text-white px-6 py-3 rounded-md hover:bg-[var(--green-dark)] flex items-center gap-2"
                                >
                                    <BoxIcon name="camera" type="solid" className="w-6 h-6" color="white" />
                                    Prendre une photo
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Boutons de validation 
                    <div className="flex justify-end gap-4 mt-6 mr-8">
                        <button
                            type="button"
                            className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
                            onClick={onClose}
                        >
                            Annuler
                        </button>
                        <button
                            type="button"
                            className="px-4 py-2 bg-[var(--green-medium)] text-white rounded-md hover:bg-[var(--green-dark)]"
                            onClick={onValidate}
                        >
                            Valider
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ValidateCollecte;


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




*/