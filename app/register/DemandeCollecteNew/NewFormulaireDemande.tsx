import { FormInput, OtherInfos, CompleteFormInput } from "@/app/register/interface/BSD_Interface";
import { useModalContextNew } from "../RegisterComponents/Modal/ContextModal";
import InputFull from "../RegisterComponents/Modal/FormulaireFull/InputFull";
import InputMobile from "../RegisterComponents/Modal/FormulaireFull/InputMobile";
import { formatText, getDataAutocompletion, getMappingTableFiliere, getFiliere, filter_dependencies, parseAddress } from "../RegisterComponents/Modal/FormulaireFull/utils_new";
import { useEffect, useState, useRef, use } from "react";
import { useSession } from "@/app/component/SessionProvider";
import { supabase } from "@/app/database/supabaseClient";
import BoxIcon from "@/app/component/BoxIconWrapper";
import { useFilterContext } from "@/app/FilterContext";
import { toast } from "react-hot-toast";
import { createRoot } from "react-dom/client";
import Swal from 'sweetalert2';
import NewDemandeMailComponent from "./NewDemandeMailComponent";
import { useMailContext } from '../MailComponents/MailContext';
import { dataFilterUpdate, getDataAutocompletionFull, getUniqueOptions, initialOtherInfos, initialToogleData, inputDependencies, isAncestor, NestedObject, preciseFilter, updateNestedValue, WasteLine } from "./NewFormulaireDemandefunctionnal";


const NewFormulaireDemande = ({setDisplayThis}: {setDisplayThis: (display: boolean) => void}) => {
    const {modalReload, setModalReload} = useModalContextNew();
    const [submitLoading, setSubmitLoading] = useState(false);
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
    const {entreprise_id, user_id, user_email, user_contact, user_phone} = useSession();
    const [ced_table, setCedTable] = useState<{ ced: string, filiere: string }[]>([]);
    const [displayAll, setDisplayAll] = useState(false);
    const [dataFilter, setDataFilter] = useState<{name: string, value: string}[]>([]);
    const [allOptions, setAllOptions] = useState<{json_row: FormInput, other_infos?: OtherInfos}[]>([]);
    const [changedField, setChangedField] = useState<string>("");
    const [other_infos, setOtherInfos] = useState<OtherInfos>(initialOtherInfos);
    const { sites } = useFilterContext();
    const [provider, setProvider] = useState<'transporter' | 'recipient'>('transporter');
    const [entreprise_global_name, setEntrepriseGlobalName] = useState<string>("");

    useEffect(() => {
        if(entreprise_id) {
            const getEntrepriseGlobalName = async () => {
                const {data, error} = await supabase.from('entreprise').select('name').eq('id', entreprise_id);
                if(error) {
                    console.error(error);
            } else {
                    setEntrepriseGlobalName(data[0].name);
                }
            }
            getEntrepriseGlobalName();
        }
    }, [entreprise_id]);


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
            volumeUnit: "",
            inputMode: "volume",
            automaticMode: true
        }
    }]);

    // Remplacer l'état detailedLines par un seul booléen
    const [showAllDetails, setShowAllDetails] = useState(false);

    // État pour stocker les dépendances
    const [dynamicDependencies, setDynamicDependencies] = useState({
        ...inputDependencies,
        ...generateWasteLineDependencies(0)
    });

    // Ajouter un état pour stocker les dataFilters de chaque ligne
    const [lineDataFilters, setLineDataFilters] = useState<{[key: number]: {name: string, value: string}[]}>({
        0: [] // Initialiser avec la première ligne
    });

    // Ajouter l'état pour l'email du destinataire
    const [recipientEmail, setRecipientEmail] = useState<string>('');

    // Ajouter après les autres états
    const [isMobile, setIsMobile] = useState(false);

    const [emitter, setEmitter] = useState(false);

    
    useEffect(() => {
        if(user_email && user_contact && user_phone) {
            setDataToogle(prev => ({
                ...prev,
                emitter: {
                ...prev.emitter,
                company: { ...prev.emitter.company, mail: user_email,  contact: user_contact, phone: user_phone }
                }
            }));
        }
        console.log(dataToogle, user_email, user_contact, user_phone);
    }, [user_email, user_contact, user_phone, emitter]);
    
    
    
    // Ajouter après les autres useEffect
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768); // 768px est le breakpoint md de Tailwind
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

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
                volumeUnit: "",
                inputMode: "volume",
                automaticMode: true
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

    // Modify shouldDisplayField to handle groups of fields
    const shouldDisplayField = (currentField: string, changedField: string) => {
        // If no field has been changed, show only initial fields
        if (!changedField) {
            const initialFields = [
                'emitter.company.name',
                ...wasteLines.map((_, index) => `wasteLine.${index}.name`)
            ];
            return initialFields.includes(currentField);
        }

        if (currentField === changedField) return true;
        
        // For waste line fields, handle by groups
        if (currentField.startsWith('wasteLine.') && changedField.startsWith('wasteLine.')) {
            const [_, currentIndexStr, currentGroup] = currentField.split('.');
            const [__, changedIndexStr, changedGroup] = changedField.split('.');
            const currentIndex = parseInt(currentIndexStr);
            const changedIndex = parseInt(changedIndexStr);
            
            // Only check dependencies if fields are from the same line
            if (currentIndex === changedIndex) {
                // Group fields by their category
                const wasteDetailsGroup = ['name', 'code', 'filiere'];
                const containerGroup = ['other_infos.containerDescription', 'other_infos.volume', 'other_infos.volumeUnit'];
                
                // If changed field is in waste details group, show all waste details fields
                if (wasteDetailsGroup.includes(changedGroup) && wasteDetailsGroup.includes(currentGroup)) {
                    return true;
                }
                
                // If changed field is in container group, show all container fields
                if (changedGroup === 'other_infos' || currentGroup === 'other_infos') {
                    const changedSubField = changedField.split('.')[3] || '';
                    const currentSubField = currentField.split('.')[3] || '';
                    
                    // Otherwise, if any field in the container group was changed, show all container fields
                    if (containerGroup.includes(`other_infos.${changedSubField}`) && 
                        containerGroup.includes(`other_infos.${currentSubField}`)) {
                        return true;
                    }
                }
            }
            return false;
        }
        
        // For other fields, use the original ancestor check
        // But only if the changed field is not a wasteLine field
        if (!changedField.startsWith('wasteLine.')) {
            return isAncestor(changedField, currentField, dynamicDependencies);
        }
        return false;
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

        setEmitter(!emitter)
        
        // Réinitialiser les dépendances
        setDynamicDependencies({
            ...inputDependencies,
            ...generateWasteLineDependencies(0)
        });

        // Réinitialiser les options
        if(entreprise_id) {
            getDataAutocompletionFull([], entreprise_id, ced_table)
                .then(data => {
                    setOptions(data);
                    setAllOptions(data);
                });
        }

        // Réinitialiser l'autocomplétion
        setDisableAutocompletion(false);

        // Réappliquer le site sélectionné sans déclencher l'autocomplétion
        /*const checkedSite = sites.find(site => site.checked);
        /*if (checkedSite) {
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
        }*/
    };

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

    // Modifier l'effet qui initialise les données du site
    /*useEffect(() => {
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
        }, [sites]);*/

    //Modifier handleChange pour gérer l'autocomplétion automatique
const handleChange = async (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement> | { target: { name: string; value: string } }) => {
    const { name, value } = e.target;
    
    // Gestion des champs de la ligne de déchets
    if (name.startsWith('wasteLine.')) {
        const parts = name.split('.');
        const indexStr = parts[1];
        const field = parts[2];
        const index = parseInt(indexStr);
        const newLines = [...wasteLines];

        // Ne pas mettre à jour changedField pour les dates de collecte
        if (!name.endsWith('collectDate')) {
            setChangedField(name);
        }

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
            const subField = parts[3]; // Utiliser parts[3] au lieu de subField
            
            if (subField === 'containerDescription') {
                // Chercher les valeurs correspondantes dans les options
                const matchingOption = options.find(opt => 
                    opt.other_infos?.containerDescription === value
                );
                
                // Mettre à jour le volume et l'unité si disponibles
                if (matchingOption?.other_infos) {
                    newLines[index].other_infos = {
                        ...newLines[index].other_infos,
                        containerDescription: value,
                        volume: matchingOption.other_infos.volume || newLines[index].other_infos.volume || '',
                        volumeUnit: matchingOption.other_infos.volumeUnit || newLines[index].other_infos.volumeUnit || ''
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
            // Reset changedField to hide previously displayed fields
            setChangedField("");
        }

        setWasteLines(newLines);
    }

    // Ne pas mettre à jour changedField pour les champs non-wasteLine ici
    // car c'est déjà géré par la condition suivante
    if(Object.keys(inputDependencies).includes(name) && !name.startsWith('wasteLine.')) {
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

        if (entreprise_id) {
            try {
                const [filteredOptions, allOptionsData] = await Promise.all([
                    getDataAutocompletionFull(newDataFilter, entreprise_id, ced_table),
                    getDataAutocompletionFull([], entreprise_id, ced_table)
                ]);
            
                setOptions(filteredOptions);
                setAllOptions(allOptionsData);

                // Mettre à jour automatiquement les champs dépendants
                if (name.startsWith('wasteLine.')) {
                    const parts = name.split('.');
                    const indexStr = parts[1];
                    const field = parts[2];
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
                        } else if (field === 'other_infos' && parts[3] === 'containerDescription' && option.other_infos) {
                            // Autocomplétion pour le contenant
                            newLines[index].other_infos = {
                                ...newLines[index].other_infos,
                                containerDescription: value,
                                volume: option.other_infos.volume || newLines[index].other_infos.volume || '',
                                volumeUnit: option.other_infos.volumeUnit || newLines[index].other_infos.volumeUnit || ''
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

        setSubmitLoading(true);
        try {
            await sendMail(); // Envoyer le mail
            await createWasteLines(); // Créer les lignes
            setModalReload(!modalReload)
            setDisplayThis(false); // Fermer la fenêtre
            handleReset(); // Reset le formulaire
        } catch (error) {
            console.error('Erreur:', error);
            toast.error('Une erreur est survenue');
        } finally {
            setSubmitLoading(false);
        }
    };

    // Déplacer createWasteLines à l'intérieur du composant
    const createWasteLines = async () => {
        if (!entreprise_id || !user_id) return;

        try {
            const linesToCreate = await Promise.all(wasteLines.map(async (line) => {
                // Créer l'objet formAPI pour chaque ligne
                const formInput = {
                    wasteDetails: {
                        ...line.wasteDetails,
                        code: line.wasteDetails.code,
                        isSubjectToADR: false,
                        isDangerous: false,
                        pop: false,
                        quantity: Number(line.wasteDetails.quantity || 0),
                        quantityType: "ESTIMATED",
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
                    user_id: user_id,
                    created_on_fleap: true,
                    infos_json: {
                        formAPI: { createFormInput: formInput }
                    },
                    other_infos: {
                        ...line.other_infos,
                        filiere: line.filiere,
                        inputMode: "volume",
                        automaticMode: true,
                        recipientEmail: recipientEmail
                    },
                    on_track_dechets: false,
                    status_track_dechets: 'Ligne demandée',
                    id_track_dechets: 'Ligne demandée',
                    readable_id_track_dechets: 'Ligne demandée',
                    entreprise_id: entreprise_id,
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

    // Remplacer la fonction toggleLineDetails par
    const toggleAllDetails = () => {
        setShowAllDetails(!showAllDetails);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-lg shadow-lg w-[95%] md:w-[80%] max-w-8xl h-[90vh] flex flex-col touch-none overflow-x-hidden">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4 border-b">
                    <h3 className="font-bold text-lg ml-0 md:ml-8 flex items-center gap-2">
                        <BoxIcon className="mb-1" name='truck' type='solid' />
                        <span className="text-green-medium mt-1 font-bold">
                            Nouvelle demande de collecte
                        </span>
                    </h3>
                    <div className="flex gap-2 mr-0 md:mr-3">
                        <button type="button" className="text-xs h-[25px] bg-[var(--green-medium)] rounded-md px-2 text-white font-thin hover:bg-[var(--green-dark)] active:font-bold" onClick={() => toogleFunction()}>Afficher/Masquer</button>
                        <button type="button" className="text-xs h-[25px] bg-[var(--green-medium)] rounded-md px-2 text-white font-thin hover:bg-[var(--green-dark)] active:font-bold" onClick={handleReset}>Réinitialiser</button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4">
                    <form className="ml-0 md:ml-2 w-full max-w-full">
                        <div className="text-sm font-semibold ml-2 md:ml-6 mt-2 mb-2">Point de départ</div>
                        <div className="w-[98%] md:w-[95%] pb-2 border-b border-3 mt-0 mx-auto border-gray-300">
                            
                            {isMobile ? (                            
                            //Version Mobile
                            <div className="mt-0 flex flex-col justify-between gap-1 ml-2">
                                {/*Site*/}
                                <div className="space-y-1">
                                    <InputMobile
                                        titre="Site"
                                        placeholder="Sélectionner un site"
                                        options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.name)}
                                        width={30}
                                        name="emitter.company.name"
                                        value={dataToogle.emitter.company.name}
                                        onChange={handleChange}
                                        enableText={true}
                                        stylePrimary={true}
                                        onMobile={true}
                                        hideIndicators={true}
                                    />
                                    <InputMobile
                                        titre="Siret"
                                        placeholder="Siret"
                                        options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.siret)}
                                        width={30}
                                        name="emitter.company.siret"
                                        value={dataToogle.emitter.company.siret}
                                        onChange={handleChange}
                                        enableText={true}
                                        display={displayAll || shouldDisplayField("emitter.company.siret", changedField)}
                                        onMobile={true}
                                        hideIndicators={true}
                                    />
                                </div>
                                {/*Point de Collecte*/}
                                <div className="space-y-1">
                                        <InputMobile
                                            titre="Collecte"
                                            placeholder="Point de collecte"
                                            options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.workSite.name)}
                                            width={30}
                                            name="emitter.workSite.name"
                                            value={dataToogle.emitter.workSite.name}
                                            onChange={handleChange}
                                            enableText={true}
                                            stylePrimary={true}
                                            onMobile={true}
                                            hideIndicators={true}
                                        />
                                        <InputMobile
                                            titre="Adresse"
                                            placeholder="d'enlèvement"
                                            options={getUniqueOptions(options, allOptions, opt => `${formatText(opt.json_row.emitter.workSite.fullAddress ?? "")}`)}
                                            width={30}
                                            name="emitter.workSite.fullAddress"
                                            value={`${formatText(dataToogle.emitter.workSite.fullAddress ?? "")}`}
                                            onChange={handleChange}
                                            enableText={true}
                                            display={displayAll || shouldDisplayField("emitter.workSite.fullAddress", changedField)}
                                            onMobile={true}
                                            hideIndicators={true}
                                        />
                                        <InputMobile
                                            titre="Infos"
                                            placeholder="Infos"
                                            options={getUniqueOptions(options, allOptions, opt => `${formatText(opt.json_row.emitter.workSite.infos ?? "")}`)}
                                            width={30}
                                            name="emitter.workSite.infos"
                                            value={`${formatText(dataToogle.emitter.workSite.infos ?? "")}`}
                                            onChange={handleChange}
                                            enableText={true}
                                            display={displayAll || (shouldDisplayField("emitter.workSite.infos", changedField) && false)}
                                            onMobile={true}
                                            hideIndicators={true}
                                        />
                                </div>
                            </div>
                            ) : (
                            //Version Desktop
                            <div className="mt-0 flex flex-row justify-between gap-4 w-1/2 ml-8">
                                {/*Site*/}
                                <div className="space-y-1 sm:space-y-2">
                                    {isMobile ? (
                                        <InputMobile
                                            titre="Site"
                                            placeholder="Sélectionner un site"
                                            options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.name)}
                                            width={30}
                                            name="emitter.company.name"
                                            value={dataToogle.emitter.company.name}
                                            onChange={handleChange}
                                            enableText={true}
                                            stylePrimary={true}
                                            onMobile={true}
                                            hideIndicators={true}
                                        />
                                    ) : (
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
                                    )}
                                    {isMobile ? (
                                        <InputMobile
                                            titre="Siret"
                                            placeholder="Siret"
                                            options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.siret)}
                                            width={30}
                                            name="emitter.company.siret"
                                            value={dataToogle.emitter.company.siret}
                                            onChange={handleChange}
                                            enableText={true}
                                            display={displayAll || shouldDisplayField("emitter.company.siret", changedField)}
                                            onMobile={true}
                                            hideIndicators={true}
                                        />
                                    ) : (
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
                                    )}
                                </div>
                                {/*Point de Collecte*/}
                                <div className="space-y-1 sm:space-y-2">
                                    <InputFull
                                        titre="Point de collecte"
                                        placeholder="Point de collecte"
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
                            )}

                            {/*2ème ligne*/}
                            <div className="mt-0 flex flex-col md:flex-row justify-between gap-4 md:w-1/2 ml-2 md:ml-8">
                                {/*Personne*/}
                                <div className="space-y-1 mt-1 sm:space-y-2">
                                    {isMobile ? (
                                        <InputMobile
                                            titre="Contact"
                                            placeholder="Contact"
                                            options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.contact)}
                                            width={30}
                                            name="emitter.company.contact"
                                            value={dataToogle.emitter.company.contact}
                                            onChange={handleChange}
                                            enableText={true}
                                            stylePrimary={true}
                                            display={false && (displayAll || (shouldDisplayField("emitter.company.workSite.fullAddress", changedField) && false))}
                                            onMobile={true}
                                            hideIndicators={true}
                                        />
                                    ) : (
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
                                            display={false && (displayAll || (shouldDisplayField("emitter.company.workSite.fullAddress", changedField) && false))}
                                        />
                                    )}
                                    {isMobile ? (
                                        <InputMobile
                                            titre="Tel"
                                            placeholder="Téléphone"
                                            options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.phone)}
                                            width={30}
                                            name="emitter.company.phone"
                                            value={dataToogle.emitter.company.phone}
                                            onChange={handleChange}
                                            enableText={true}
                                            display={false && (displayAll || (shouldDisplayField("emitter.company.phone", changedField) && false))}
                                            onMobile={true}
                                            hideIndicators={true}
                                        />
                                    ) : (
                                        <InputFull
                                            titre="Téléphone"
                                            placeholder="Téléphone"
                                            options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.phone)}
                                            width={40}
                                            name="emitter.company.phone"
                                            value={dataToogle.emitter.company.phone}
                                            onChange={handleChange}
                                            enableText={true}
                                            display={false && (displayAll || (shouldDisplayField("emitter.company.phone", changedField) && false))}
                                        />
                                    )}
                                    {isMobile ? (
                                        <InputMobile
                                            titre="Mail"
                                            placeholder="Mail"
                                            options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.mail)}
                                            width={30}
                                            name="emitter.company.mail"
                                            value={dataToogle.emitter.company.mail}
                                            onChange={handleChange}
                                            enableText={true}
                                            display={false && (displayAll || (shouldDisplayField("emitter.company.mail", changedField) && false))}
                                            onMobile={true}
                                            hideIndicators={true}
                                        />
                                    ) : (
                                        <InputFull
                                            titre="Mail"
                                            placeholder="Mail"
                                            options={getUniqueOptions(options, allOptions, opt => opt.json_row.emitter.company.mail)}
                                            width={40}
                                            name="emitter.company.mail"
                                            value={dataToogle.emitter.company.mail}
                                            onChange={handleChange}
                                            enableText={true}
                                            display={false && (displayAll || (shouldDisplayField("emitter.company.mail", changedField) && false))}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>


                        <div className="text-sm font-semibold ml-2 md:ml-6 mt-2">Destinataire du mail</div>
                        <div className="w-[98%] md:w-[95%] pb-2 border-b border-3 mt-0 mx-auto border-gray-300">
                            <div className="p-2 md:p-4 rounded-md md:pr-[230px] ml-2 md:ml-4">
                                <div className="flex flex-col md:flex-row justify-between items-start">
                                    <div className="flex-grow w-full md:w-auto">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-0">
                                    {/* Section Transporteur*/}
                                    {provider === 'transporter' && (
                                                <div className="space-y-1">
                                                    {/* Desktop view */}
                                                    <div className="hidden md:block">
                                                        <div className="ml-[52px]">
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
                                                        </div>
                                                        
                                                        {(displayAll || shouldDisplayField('transporter.company.siret', changedField)) && (
                                                            <div>
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
                                                                        display={displayAll || shouldDisplayField('transporter.company.mail', changedField)}
                                                                    />                                                                    
                                                                </div>
                                                                <div className="flex justify-between gap-4">
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
                                                                        display={false && (displayAll || (shouldDisplayField('transporter.company.contact', changedField) && false))}
                                                                    />
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
                                                                        display={false && (displayAll || (shouldDisplayField('transporter.company.phone', changedField) && false))}
                                                                    />   
                                                                </div>
                                                                <div className="flex justify-between gap-4">
                                                                    <InputFull
                                                                        titre="Récépissé"
                                                                        placeholder="Récépissé"
                                                                        options={getUniqueOptions(options, allOptions,
                                                                            opt => opt.json_row.transporter.receipt
                                                                        )}
                                                                        width={40}
                                                                        name="transporter.receipt"
                                                                        value={dataToogle.transporter.receipt || ''}
                                                                        onChange={handleChange}
                                                                        enableText={true}
                                                                        display={false && (displayAll || (shouldDisplayField('transporter.receipt', changedField) && false))}
                                                                    />
                                                                    <InputFull
                                                                        titre="Plaque"
                                                                        placeholder="Plaque"
                                                                        options={getUniqueOptions(options, allOptions,
                                                                            opt => opt.json_row.transporter.numberPlate
                                                                        )}
                                                                        width={40}
                                                                        name="transporter.numberPlate"
                                                                        value={dataToogle.transporter.numberPlate || ''}
                                                                        onChange={handleChange}
                                                                        enableText={true}
                                                                        display={false && (displayAll || (shouldDisplayField('transporter.numberPlate', changedField) && false))}
                                                                    />
                                                                </div>                                                                
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Mobile view - 2 columns */}
                                                    <div className="md:hidden space-y-1">
                                                        <div>
                                                            <InputMobile
                                                                titre=""
                                                                placeholder="Transporteur"
                                                                options={getUniqueOptions(options, allOptions,
                                                                    opt => opt.json_row.transporter.company.name
                                                                )}
                                                                width={41}
                                                                name="transporter.company.name"
                                                                value={dataToogle.transporter.company.name}
                                                                onChange={handleChange}
                                                                enableText={true}
                                                                stylePrimary={true}
                                                                onMobile={true}
                                                                hideIndicators={false}
                                                            />
                                                        </div>
                                                        
                                                        <div className="space-y-1">
                                                            <InputMobile
                                                                titre=""
                                                                placeholder="SIRET"
                                                                options={getUniqueOptions(options, allOptions,
                                                                    opt => opt.json_row.transporter.company.siret
                                                                )}
                                                                width={41}
                                                                name="transporter.company.siret"
                                                                value={dataToogle.transporter.company.siret}
                                                                onChange={handleChange}
                                                                enableText={true}
                                                                display={displayAll || shouldDisplayField('transporter.company.siret', changedField)}
                                                                onMobile={true}
                                                                hideIndicators={false}
                                                            />             
                                                            <InputMobile
                                                                titre=""
                                                                placeholder="Email"
                                                                options={getUniqueOptions(options, allOptions,
                                                                    opt => opt.json_row.transporter.company.mail
                                                                )}
                                                                width={41}
                                                                name="transporter.company.mail"
                                                                value={dataToogle.transporter.company.mail}
                                                                onChange={handleChange}
                                                                enableText={true}
                                                                display={displayAll || shouldDisplayField('transporter.company.mail', changedField)}
                                                                onMobile={true}
                                                                hideIndicators={false}
                                                            />                                                                                                  
                                                        </div>
                                                        
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <InputMobile
                                                                titre=""
                                                                placeholder="Contact"
                                                                options={getUniqueOptions(options, allOptions,
                                                                    opt => opt.json_row.transporter.company.contact
                                                                )}
                                                                width={26}
                                                                name="transporter.company.contact"
                                                                value={dataToogle.transporter.company.contact}
                                                                onChange={handleChange}
                                                                enableText={true}
                                                                display={false && (displayAll || (shouldDisplayField('transporter.company.contact', changedField) && false))}
                                                                onMobile={true}
                                                                hideIndicators={true}
                                                            />                                                                 
                                                            <InputMobile
                                                                titre=""
                                                                placeholder="Téléphone"
                                                                options={getUniqueOptions(options, allOptions,
                                                                    opt => opt.json_row.transporter.company.phone
                                                                )}
                                                                width={26}
                                                                name="transporter.company.phone"
                                                                value={dataToogle.transporter.company.phone}
                                                                onChange={handleChange}
                                                                enableText={true}
                                                                display={false && (displayAll || (shouldDisplayField('transporter.company.phone', changedField) && false))}
                                                                onMobile={true}
                                                                hideIndicators={true}
                                                            />                                                        
                                                        </div>
                                                        
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <InputMobile
                                                                titre=""
                                                                placeholder="Récépissé"
                                                                options={getUniqueOptions(options, allOptions,
                                                                    opt => opt.json_row.transporter.receipt
                                                                )}
                                                                width={26}
                                                                name="transporter.receipt"
                                                                value={dataToogle.transporter.receipt || ''}
                                                                onChange={handleChange}
                                                                enableText={true}
                                                                display={false && (displayAll || (shouldDisplayField('transporter.receipt', changedField) && false))}
                                                                onMobile={true}
                                                                hideIndicators={true}
                                                            />
                                                            <InputMobile
                                                                titre=""
                                                                placeholder="Plaque"
                                                                options={getUniqueOptions(options, allOptions,
                                                                    opt => opt.json_row.transporter.numberPlate
                                                                )}
                                                                width={26}
                                                                name="transporter.numberPlate"
                                                                value={dataToogle.transporter.numberPlate || ''}
                                                                onChange={handleChange}
                                                                enableText={true}
                                                                display={false && (displayAll || (shouldDisplayField('transporter.numberPlate', changedField) && false))}
                                                                onMobile={true}
                                                                hideIndicators={true}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                    {/* Section Destinataire*/}
                                    {provider === 'recipient' && (
                                                <div className="space-y-1">
                                                    {/* Desktop view */}
                                                    <div className="hidden md:block">
                                                        <div className="ml-[52px]">
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
                                                        </div>
                                                        {(displayAll || shouldDisplayField('recipient.company.siret', changedField)) && (
                                                            <>
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
                                                                <div className="flex justify-between gap-4">
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
                                                                        display={false && (displayAll || (shouldDisplayField('recipient.company.contact', changedField) && false))}
                                                                    />                                                                    
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
                                                                        display={false && (displayAll || (shouldDisplayField('recipient.company.phone', changedField) && false))}
                                                                    />
                                                                </div>     
                                                                <div className="flex justify-between gap-4">
                                                                    <InputFull
                                                                        titre="Code opération"
                                                                        placeholder="Code opération"
                                                                        options={getUniqueOptions(options, allOptions,
                                                                            opt => opt.json_row.recipient.processingOperation
                                                                        )}
                                                                        width={40}
                                                                        name="recipient.processingOperation"
                                                                        value={dataToogle.recipient.processingOperation || ''}
                                                                        onChange={handleChange}
                                                                        enableText={true}
                                                                        display={false && (displayAll || (shouldDisplayField('recipient.processingOperation', changedField) && false))}
                                                                    />                                                                    
                                                                    <InputFull
                                                                        titre="CAP"
                                                                        placeholder="CAP"
                                                                        options={getUniqueOptions(options, allOptions,
                                                                            opt => opt.json_row.recipient.cap
                                                                        )}
                                                                        width={40}
                                                                        name="recipient.cap"
                                                                        value={dataToogle.recipient.cap || ''}
                                                                        onChange={handleChange}
                                                                        enableText={true}
                                                                        display={false && (displayAll || (shouldDisplayField('recipient.cap', changedField) && false))}
                                                                    />
                                                                </div>                                                                                                                             
                                                            </>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Mobile view - 2 columns */}
                                                    <div className="md:hidden space-y-1">
                                                        <div>
                                                            <InputMobile
                                                                titre=""
                                                                placeholder="Destinataire"
                                                                options={getUniqueOptions(options, allOptions,
                                                                    opt => opt.json_row.recipient.company.name
                                                                )}
                                                                width={41}
                                                                name="recipient.company.name"
                                                                value={dataToogle.recipient.company.name}
                                                                onChange={handleChange}
                                                                enableText={true}
                                                                stylePrimary={true}
                                                                onMobile={true}
                                                                hideIndicators={false}
                                                            />
                                                        </div>
                                                        
                                                        <div className="space-y-1">                                                
                                                            <InputMobile
                                                                titre=""
                                                                placeholder="SIRET"
                                                                options={getUniqueOptions(options, allOptions,
                                                                    opt => opt.json_row.recipient.company.siret
                                                                )}
                                                                width={41}
                                                                name="recipient.company.siret"
                                                                value={dataToogle.recipient.company.siret}
                                                                onChange={handleChange}
                                                                enableText={true}
                                                                display={displayAll || shouldDisplayField('recipient.company.siret', changedField)}
                                                                onMobile={true}
                                                                hideIndicators={false}
                                                            />    
                                                            <InputMobile
                                                                titre=""
                                                                placeholder="Email"
                                                                options={getUniqueOptions(options, allOptions,
                                                                    opt => opt.json_row.recipient.company.mail
                                                                )}
                                                                width={41}
                                                                name="recipient.company.mail"
                                                                value={dataToogle.recipient.company.mail}
                                                                onChange={handleChange}
                                                                enableText={true}
                                                                display={displayAll || shouldDisplayField('recipient.company.mail', changedField)}
                                                                onMobile={true}
                                                                hideIndicators={false}
                                                            />                                                                                                                        
                                                        </div>
                                                        
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <InputMobile
                                                                titre=""
                                                                placeholder="Contact"
                                                                options={getUniqueOptions(options, allOptions,
                                                                    opt => opt.json_row.recipient.company.contact
                                                                )}
                                                                width={26}
                                                                name="recipient.company.contact"
                                                                value={dataToogle.recipient.company.contact}
                                                                onChange={handleChange}
                                                                enableText={true}
                                                                display={false && (displayAll || (shouldDisplayField('recipient.company.contact', changedField) && false))}
                                                                onMobile={true}
                                                                hideIndicators={true}
                                                            />                                                            
                                                            <InputMobile
                                                                titre=""
                                                                placeholder="Téléphone"
                                                                options={getUniqueOptions(options, allOptions,
                                                                    opt => opt.json_row.recipient.company.phone
                                                                )}
                                                                width={26}
                                                                name="recipient.company.phone"
                                                                value={dataToogle.recipient.company.phone}
                                                                onChange={handleChange}
                                                                enableText={true}
                                                                display={false && (displayAll || (shouldDisplayField('recipient.company.phone', changedField) && false))}
                                                                onMobile={true}
                                                                hideIndicators={true}
                                                            />                                                        
                                                        </div>
                                                        
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <InputMobile
                                                                titre=""
                                                                placeholder="Code opération"
                                                                options={getUniqueOptions(options, allOptions,
                                                                    opt => opt.json_row.recipient.processingOperation
                                                                )}
                                                                width={26}
                                                                name="recipient.processingOperation"
                                                                value={dataToogle.recipient.processingOperation || ''}
                                                                onChange={handleChange}
                                                                enableText={true}
                                                                display={false && (displayAll || (shouldDisplayField('recipient.processingOperation', changedField) && false))}
                                                                onMobile={true}
                                                                hideIndicators={true}
                                                            />
                                                            <InputMobile
                                                                titre=""
                                                                placeholder="CAP"
                                                                options={getUniqueOptions(options, allOptions,
                                                                    opt => opt.json_row.recipient.cap
                                                                )}
                                                                width={26}
                                                                name="recipient.cap"
                                                                value={dataToogle.recipient.cap || ''}
                                                                onChange={handleChange}
                                                                enableText={true}
                                                                display={false && (displayAll || (shouldDisplayField('recipient.cap', changedField) && false))}
                                                                onMobile={true}
                                                                hideIndicators={true}
                                                            />                                                        
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Boutons de sélection*/}
                                    <div className={`flex space-x-4 mb-4 ${isMobile ? 'mt-3 ml-4' : ''}`}>
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                className="form-radio h-4 w-4 text-blue-600"
                                                checked={provider === 'transporter'}
                                                onChange={() => setProvider('transporter')}
                                            />
                                            <span className="ml-2 text-sm">Transporteur</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                className="form-radio h-4 w-4 text-blue-600"
                                                checked={provider === 'recipient'}
                                                onChange={() => setProvider('recipient')}
                                            />
                                            <span className="ml-2 text-sm">Destinataire</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="text-sm font-semibold ml-2 md:ml-6 mt-2">
                            <div className="flex justify-between items-center">
                                <span>Lignes de déchets</span>
                                <button
                                    type="button"
                                    onClick={toggleAllDetails}
                                    className="text-xs h-[25px] bg-[var(--green-medium)] rounded-md px-2 text-white font-thin hover:bg-[var(--green-dark)] active:font-bold"
                                >
                                    {showAllDetails ? 'Masquer les détails' : 'Afficher les détails'}
                                </button>
                            </div>
                        </div>
                        <div className="w-[98%] md:w-[95%] pb-2 border-b border-3 mt-2 mx-auto border-gray-300">
                            {wasteLines.map((line, index) => (
                                <div key={index} className="mb-4 p-3 bg-gray-50 rounded-md shadow-sm w-full max-w-full">
                                    <h3 className="text-sm font-medium text-gray-700 mb-2">Ligne de déchet {index + 1}</h3>

                                    {/* Desktop layout - 3 columns */}
                                    <div className="hidden md:grid md:grid-cols-3 gap-3 space-y-1">
                                        {/* Column 1: Waste details */}
                                        <div className="space-y-1">
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
                                                enableText={true}
                                                stylePrimary={true}
                                            />
                                            {(showAllDetails || displayAll || shouldDisplayField(`wasteLine.${index}.code`, changedField)) && (
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
                                                    enableText={true}
                                                />
                                            )}
                                            <InputFull
                                                titre="Filière"
                                                placeholder="Filière"
                                                options={getUniqueOptions(options, allOptions, 
                                                    opt => {
                                                        const code = opt.json_row?.wasteDetails?.code;
                                                        return code ? getFiliere(code, ced_table) : undefined;
                                                    }
                                                )}
                                                width={30}
                                                name={`wasteLine.${index}.filiere`}
                                                value={line.filiere}
                                                onChange={handleChange}
                                                enableText={true}
                                                display={false && (showAllDetails || displayAll || shouldDisplayField(`wasteLine.${index}.filiere`, changedField))}
                                            />
                                        </div>

                                        {/* Column 2: Container details */}
                                        <div className="space-y-1">
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
                                        
                                            <div className="flex justify-start gap-1">
                                                <InputFull
                                                    titre="Volume"
                                                    placeholder="Volume"
                                                    width={21}
                                                    name={`wasteLine.${index}.other_infos.volume`}
                                                    value={line.other_infos.volume}
                                                    onChange={handleChange}
                                                    enableText={true}
                                                    options={getUniqueOptions(options, allOptions,
                                                        opt => opt.other_infos?.volume
                                                    )}
                                                    display={showAllDetails || displayAll || shouldDisplayField(`wasteLine.${index}.other_infos.volume`, changedField)}
                                                />
                                                <InputFull
                                                    titre=""
                                                    placeholder="Unité"
                                                    width={20}
                                                    name={`wasteLine.${index}.other_infos.volumeUnit`}
                                                    value={line.other_infos.volumeUnit}
                                                    onChange={handleChange}
                                                    enableText={true}
                                                    options={{
                                                        filteredOptions: ['L', 'm³'],
                                                        allOptions: []
                                                    }}
                                                    display={showAllDetails || displayAll || shouldDisplayField(`wasteLine.${index}.other_infos.volumeUnit`, changedField)}
                                                />
                                            </div>
                                        </div>

                                        {/* Column 3: Date and remove button */}
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between mr-4">
                                                <div className="w-3/4 flex justify-start items-center gap-2">
                                                    <label className="block text-xs text-gray-500 font-medium mb-1 md:w-[180px] w-full text-right">
                                                        Collecte
                                                    </label>
                                                    <div className="flex-1 mr-2">
                                                        <input
                                                            type="date"
                                                            className="w-full px-3 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--green-medium)] text-sm"
                                                            name={`wasteLine.${index}.collectDate`}
                                                            value={line.collectDate}
                                                            onChange={handleChange}
                                                            placeholder="Date de collecte demandée"
                                                        />
                                                    </div>
                                                </div>
                                                {index > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newLines = wasteLines.filter((_, i) => i !== index);
                                                            setWasteLines(newLines);
                                                        }}
                                                        className="text-white bg-red-500 rounded-full w-6 h-6 flex items-center justify-center font-bold text-sm hover:bg-red-600 transition-colors"
                                                    >
                                                        ×
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Mobile layout - no automatic wrapping */}
                                    <div className="md:hidden w-full">
                                        {/* First row: Déchet and Contenant */}
                                        <div className="w-full max-w-full">
                                            <div className="space-y-1">
                                                <InputMobile
                                                    titre=""
                                                    placeholder="Déchet"
                                                    options={getUniqueOptions(options, allOptions, 
                                                        opt => opt.json_row?.wasteDetails?.name || undefined
                                                    )}
                                                    width={25}
                                                    name={`wasteLine.${index}.name`}
                                                    value={line.wasteDetails.name}
                                                    onChange={handleChange}
                                                    enableText={true}
                                                    stylePrimary={true}
                                                    onMobile={true}
                                                    //hideIndicators={true}
                                                />
                                                {(showAllDetails || displayAll || shouldDisplayField(`wasteLine.${index}.code`, changedField)) && (
                                                    <InputMobile
                                                        titre=""
                                                        placeholder="Code CED"
                                                        options={getUniqueOptions(options, allOptions, 
                                                            opt => opt.json_row?.wasteDetails?.code || undefined
                                                        )}
                                                        width={25}
                                                        name={`wasteLine.${index}.code`}
                                                        value={line.wasteDetails.code}
                                                        onChange={handleChange}
                                                        enableText={true}
                                                        onMobile={true}
                                                        //hideIndicators={true}
                                                    />
                                                )}
                                                
                                                <InputMobile
                                                    titre=""
                                                    placeholder="Filière"
                                                    options={getUniqueOptions(options, allOptions, 
                                                        opt => {
                                                            const code = opt.json_row?.wasteDetails?.code;
                                                            return code ? getFiliere(code, ced_table) : undefined;
                                                        }
                                                    )}
                                                    width={25}
                                                    name={`wasteLine.${index}.filiere`}
                                                    value={line.filiere}
                                                    onChange={handleChange}
                                                    enableText={true}
                                                    display={false && (showAllDetails || displayAll || shouldDisplayField(`wasteLine.${index}.filiere`, changedField))}
                                                    onMobile={true}
                                                    //hideIndicators={true}
                                                />                                            
                                            </div>
                                            <div className="space-y-1">
                                                <InputMobile
                                                    titre=""
                                                    placeholder="Contenant"
                                                    options={getUniqueOptions(options, allOptions,
                                                        opt => opt.other_infos?.containerDescription || undefined
                                                    )}
                                                    width={25}
                                                    name={`wasteLine.${index}.other_infos.containerDescription`}
                                                    value={line.other_infos.containerDescription}
                                                    onChange={handleChange}
                                                    enableText={true}
                                                    stylePrimary={true}
                                                    onMobile={true}
                                                    //hideIndicators={true}
                                                />
                                                <div className="flex justify-start gap-1 w-[102%]">
                                                    <InputMobile
                                                        titre=""
                                                        placeholder="Volume"
                                                        width={25}
                                                        name={`wasteLine.${index}.other_infos.volume`}
                                                        value={line.other_infos.volume}
                                                        onChange={handleChange}
                                                        enableText={true}
                                                        options={getUniqueOptions(options, allOptions,
                                                            opt => opt.other_infos?.volume
                                                        )}
                                                        display={showAllDetails || displayAll || shouldDisplayField(`wasteLine.${index}.other_infos.volume`, changedField)}
                                                        onMobile={true}
                                                        //hideIndicators={true}
                                                    />
                                                    <InputMobile
                                                        titre=""
                                                        placeholder="Unité"
                                                        width={25}
                                                        name={`wasteLine.${index}.other_infos.volumeUnit`}
                                                        value={line.other_infos.volumeUnit}
                                                        onChange={handleChange}
                                                        enableText={true}
                                                        options={{
                                                            filteredOptions: ['L', 'm³'],
                                                            allOptions: []
                                                        }}
                                                        display={showAllDetails || displayAll || shouldDisplayField(`wasteLine.${index}.other_infos.volumeUnit`, changedField)}
                                                        onMobile={true}
                                                        //hideIndicators={true}
                                                    />  
                                                </div>                                          
                                            </div>
                                        </div>
                                        
                                        {/* Fourth row: Date and Remove button */}
                                        <div className="flex justify-between items-center mt-4">
                                            <div className="flex-1 mr-2">
                                                <input
                                                    type="date"
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--green-medium)] text-base bg-white appearance-none"
                                                    name={`wasteLine.${index}.collectDate`}
                                                    value={line.collectDate}
                                                    onChange={handleChange}
                                                    style={{
                                                        minHeight: '44px',
                                                        fontSize: '16px',
                                                        maxWidth: '100%'
                                                    }}
                                                />
                                            </div>
                                            {index > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newLines = wasteLines.filter((_, i) => i !== index);
                                                        setWasteLines(newLines);
                                                    }}
                                                    className="flex items-center justify-center px-3 py-2 text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors text-sm"
                                                >
                                                    <span className="mr-1">×</span>
                                                    <span>Supprimer</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            
                            {/* Add line button moved below the waste lines */}
                            <div className="flex justify-center md:justify-end mb-2">
                                <button
                                    type="button"
                                    onClick={addWasteLine}
                                    className="text-xs h-[30px] bg-[var(--green-medium)] rounded-md px-3 text-white font-medium hover:bg-[var(--green-dark)] transition-colors"
                                >
                                    Ajouter une ligne
                                </button>
                            </div>
                        </div>



                       
                        <div className="ml-[-20px]">
                            {entreprise_id && 
                                <NewDemandeMailComponent 
                                    params={{
                                        emitter: {
                                            name: dataToogle.emitter.company.name || '',
                                            contact: dataToogle.emitter.company.contact || '',
                                            phone: dataToogle.emitter.company.phone || '',
                                            email: dataToogle.emitter.company.mail || '',
                                            address: dataToogle.emitter.company.address || '',
                                            workSite: {
                                                name: dataToogle.emitter.workSite.name || '',
                                                fullAddress: dataToogle.emitter.workSite.fullAddress || '',
                                                address: dataToogle.emitter.workSite.address || '',
                                                postalCode: dataToogle.emitter.workSite.postalCode || '',
                                                city: dataToogle.emitter.workSite.city || ''
                                            }
                                        },
                                        destinataire: provider === 'transporter' 
                                            ? dataToogle.transporter?.company?.mail || ''
                                            : dataToogle.recipient?.company?.mail || '',
                                        entrepriseId: entreprise_id,
                                        entrepriseName: dataToogle.emitter.company.name || '',
                                        entrepriseGlobalName : entreprise_global_name || '',
                                        wasteLines: wasteLines.map(line => ({
                                            code: line.wasteDetails.code || '',
                                            description: line.wasteDetails.name || '',
                                            container: line.other_infos.containerDescription || '',
                                            volume: line.other_infos.volume || '',
                                            volumeUnit: line.other_infos.volumeUnit || '',
                                            collectDate: line.collectDate || ''
                                        }))
                                    }}
                                    onUpdateRecipientEmail={setRecipientEmail}
                                />
                            }
                        </div>

                        <div className="flex flex-col md:flex-row justify-end gap-4 mt-6 mb-4 mx-2 md:mr-4">
                            <button
                                type="button"
                                onClick={() => {
                                    setDisplayThis(false);
                                    handleReset();
                                }}
                                className="w-full md:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleSendAndCreate}
                                disabled={!isValidMail || submitLoading}
                                className="w-full md:w-auto px-4 py-2 text-sm font-medium text-white bg-[var(--green-medium)] rounded-md hover:bg-[var(--green-dark)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--green-medium)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative group"
                            >
                                {submitLoading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>En cours...</span>
                                    </>
                                ) : (
                                    'Envoyer et créer les lignes'
                                )}
                                {(!isValidMail && !submitLoading) && (
                                    <div className="absolute bottom-full left-1/2 transform sm:-translate-x-3/4 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                                        N&apos;oubliez pas d&apos;indiquer un email de destinataire/transporteur
                                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                                    </div>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default NewFormulaireDemande;
