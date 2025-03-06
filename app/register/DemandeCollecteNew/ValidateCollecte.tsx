import { FormInput } from "@/app/register/interface/BSD_Interface";
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
import Image from "next/image";
import { isAncestor, getDataAutocompletionFull, getUniqueOptions, updateNestedValue, NestedObject, NestedArray, initialToogleData, initialOtherInfos } from "./NewFormulaireDemandefunctionnal";
import { useMediaQuery } from 'react-responsive';
import dynamic from 'next/dynamic';

// Charger dynamiquement le composant mobile
const ValidateCollecteMobile = dynamic(() => import('./ValidateCollecteMobile'), { ssr: false });

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
    },
    'other_infos.containerDescription': {
        children: ['other_infos.volume', 'other_infos.volumeUnit']
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


// Définir l'interface des props
interface ValidateCollecteProps {
    bsd: BSD;
    onClose: () => void;
    onValidate: () => void;
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
    volumeUnit: string = 'm3',
    numberOfContainers: number = 1
): number | null => {
    if (!volume) return null;

    const volumeInM3 = volumeUnit === 'L' ? parseFloat(volume) / 1000 : parseFloat(volume);
    
    const wasteInfo = wasteCode ? 
        dic_json_ced_masse_volumique.find(
            item => item.code_CED.replace(/\s/g, '') === wasteCode.replace(/\s/g, '')
        ) : null;
    
    const masseVolumique = wasteInfo?.masse_volumique || 1000;
    const fillRateMultiplier = fillRate ? parseInt(fillRate) / 100 : 1;
    
    const weight = (volumeInM3 * masseVolumique * fillRateMultiplier * numberOfContainers) / 1000;
    /*console.log('calculateEstimatedWeight:', {
        volume,
        volumeInM3,
        fillRate,
        fillRateMultiplier,
        wasteCode,
        masseVolumique,
        numberOfContainers,
        weight
    });*/
    return weight;
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

// Ajouter cette fonction de compression d'image avant le composant ValidateCollecte
const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = document.createElement('img');
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200;
                const MAX_HEIGHT = 1200;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        resolve(compressedFile);
                    } else {
                        reject(new Error('Compression failed'));
                    }
                }, 'image/jpeg', 0.7);
            };
        };
        reader.onerror = (error) => reject(error);
    });
};

// Ajouter cette fonction après les autres fonctions utilitaires
const updateWeight = (
    volume: string | undefined,
    fillRate: string | undefined,
    wasteCode: string | undefined,
    volumeUnit: string | undefined,
    numberOfContainers: number,
    setDataToogle: (data: FormInput) => void,
    dataToogle: FormInput
) => {
    const weight = calculateEstimatedWeight(
        volume,
        fillRate,
        wasteCode,
        volumeUnit,
        numberOfContainers
    );
    
    if (weight !== null) {
        const newData = { ...dataToogle };
        updateNestedValue(newData as unknown as NestedObject, 'wasteDetails.quantity', weight.toFixed(3));
        setDataToogle(newData);
    }
};

const ValidateCollecte = ({ onClose, bsd }: ValidateCollecteProps) => {
    const {             
        setDisplayFormulaire,
        options,
        setOptions,
        modalType,
        modalReload,
        setModalReload
    } = useModalContextNew();
    
    // Initialiser dataToogle avec les données du BSD
    const [dataToogle, setDataToogle] = useState<FormInput>(
        bsd.infos_json.formAPI.createFormInput as unknown as FormInput
    );
    const [submitLoading, setSubmitLoading] = useState(false);

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

    // Ajouter cet état après les autres useState
    const [photoUrl, setPhotoUrl] = useState<string | null>(
        typeof bsd.photo === 'string' ? bsd.photo : null
    );

    // Ajouter cet état pour stocker le fichier compressé
    const [compressedPhoto, setCompressedPhoto] = useState<File | null>(null);

    // Ajouter cette ligne pour détecter les appareils mobiles
    const isMobile = useMediaQuery({ maxWidth: 767 });

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
        'other_infos.containerDescription',
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

    // Gérer les champs other_infos séparément
    if (name.startsWith('other_infos.')) {
        const fieldName = name.replace('other_infos.', '');
        const updatedOtherInfos = {
            ...other_infos,
            [fieldName]: value
        };
        setOtherInfos(updatedOtherInfos);
        
        // Si le mode automatique est activé et qu'on est en mode volume, mettre à jour la quantité
        if (updatedOtherInfos.automaticMode && updatedOtherInfos.inputMode === 'volume' && 
            (fieldName === 'fillRate' || fieldName === 'volume' || fieldName === 'volumeUnit')) {
            updateWeight(
                fieldName === 'volume' ? value : updatedOtherInfos.volume,
                fieldName === 'fillRate' ? value : updatedOtherInfos.fillRate,
                dataToogle.wasteDetails.code,
                fieldName === 'volumeUnit' ? value : updatedOtherInfos.volumeUnit,
                Number(dataToogle.wasteDetails.packagingInfos[0].quantity),
                setDataToogle,
                dataToogle
            );
        }
        
        return;
    }

    // Création de newData avant son utilisation
    const newData = JSON.parse(JSON.stringify(dataToogle)) as FormInput;
    
    // Mettre à jour la valeur dans newData
    updateNestedValue(newData as unknown as NestedObject, name, value);
    
    // Si le mode automatique est activé et qu'on est en mode volume, et que le nombre de contenants change
    if (other_infos.automaticMode && other_infos.inputMode === 'volume' && name === 'wasteDetails.packagingInfos[0].quantity') {
        console.log('Number of containers changed:', {
            name,
            value,
            currentOtherInfos: other_infos,
            currentDataToogle: dataToogle
        });
        
        updateWeight(
            other_infos.volume,
            other_infos.fillRate,
            newData.wasteDetails.code,
            other_infos.volumeUnit,
            Number(value),
            setDataToogle,
            newData
        );
    } else {
        // Mettre à jour dataToogle avec les nouvelles valeurs seulement si on n'a pas déjà mis à jour le poids
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
        updateWeight(
            updatedOtherInfos.volume,
            updatedOtherInfos.fillRate,
            dataToogle.wasteDetails.code,
            updatedOtherInfos.volumeUnit,
            Number(dataToogle.wasteDetails.packagingInfos[0].quantity),
            setDataToogle,
            dataToogle
        );
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

// Modifier le handleTakePhoto pour stocker la photo localement
const handleTakePhoto = async () => {
    try {
        if (!session) {
            throw new Error('Vous devez être connecté pour prendre une photo');
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.click();

        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            // Compresser l'image
            const compressedFile = await compressImage(file);
            
            // Stocker le fichier compressé
            setCompressedPhoto(compressedFile);
            
            // Créer une URL temporaire pour l'aperçu
            const tempUrl = URL.createObjectURL(compressedFile);
            setPhotoUrl(tempUrl);
            
            toast.success('Photo ajoutée');
        };
    } catch (error) {
        console.error('Erreur lors de la prise de photo:', error);
        toast.error(error instanceof Error ? error.message : 'Une erreur est survenue');
    }
};

// Modifier onValidate pour uploader la photo si elle existe
const onValidate = async () => {
    try {
        setSubmitLoading(true);
        // Vérifier que les champs obligatoires sont remplis
        if (!dataToogle.wasteDetails.quantity) {
            toast.error("La quantité est obligatoire");
            setSubmitLoading(false);
            return;
        }

        if (!other_infos.containerDescription) {
            toast.error("La description du contenant est obligatoire");
            setSubmitLoading(false);
            return;
        }

        if (!dataToogle.wasteDetails.packagingInfos[0].quantity) {
            toast.error("Le nombre de contenants est obligatoire");
            setSubmitLoading(false);
            return;
        }

        let photoPublicUrl = null;

        // Upload de la photo si elle existe
        if (compressedPhoto) {
            const timestamp = Date.now();
            const fileExtension = compressedPhoto.name.split('.').pop();
            const fileName = `${bsd.id}_${timestamp}.${fileExtension}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('photos')
                .upload(fileName, compressedPhoto, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                throw new Error(`Erreur lors de l'upload: ${uploadError.message}`);
            }

            const { data: { publicUrl } } = supabase.storage
                .from('photos')
                .getPublicUrl(fileName);

            photoPublicUrl = publicUrl;
        }

        bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity = parseFloat(String(dataToogle.wasteDetails.quantity));
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
            ...(photoPublicUrl && { photo: photoPublicUrl }) // Ajouter la photo seulement si elle existe
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
        setModalReload(!modalReload);
        onClose();

        // Nettoyer l'URL temporaire à la fermeture
        if (photoUrl && !photoUrl.startsWith('http')) {
            URL.revokeObjectURL(photoUrl);
        }
    } catch (error) {
        console.error('Erreur:', error);
        toast.error('Une erreur est survenue lors de la validation');
    } finally {
        setSubmitLoading(false);
    }
};

// Ajouter un useEffect pour nettoyer l'URL temporaire
useEffect(() => {
    return () => {
        if (photoUrl && !photoUrl.startsWith('http')) {
            URL.revokeObjectURL(photoUrl);
        }
    };
}, [photoUrl]);

//Render
    if (isMobile) {
        return (
            <ValidateCollecteMobile
                bsd={bsd}
                onClose={onClose}
                onValidate={onValidate}
            />
        );
    }
    
    return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex flex-col items-center overflow-y-auto py-0 sm:py-4 z-50">
        <div className="bg-white p-3 sm:p-6 rounded-lg shadow-lg mb-0 sm:mb-2 w-full sm:w-[80%] max-w-8xl min-h-screen sm:min-h-0 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
                <h3 className="font-bold text-base sm:text-lg ml-2 sm:ml-8 flex items-center gap-2">
                        <BoxIcon className="mb-1" name='truck' type='solid' />
                        <span className="text-green-medium mt-1 font-bold">
                            Valider la collecte
                        </span>
                    </h3>
                <div className="flex gap-2 mr-1 sm:mr-3">
                        <button type="button" className="text-xs h-[25px] bg-[var(--green-medium)] rounded-md px-2 text-white font-thin hover:bg-[var(--green-dark)] active:font-bold" onClick={() => toogleFunction()}>Afficher/Masquer</button>
                        <button type="button" className="text-xs h-[25px] bg-[var(--green-medium)] rounded-md px-2 text-white font-thin hover:bg-[var(--green-dark)] active:font-bold" onClick={ResetData}>Réinitialiser</button>
                    </div>
                </div>
                
            <form className="ml-0 sm:ml-[10%] pb-4">
                    {/* Première ligne : Site, Point de collecte, Contact émetteur*/}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-0 mb-1 w-full sm:w-[75%] bg-gray-50 rounded-md p-2">
                        {/* Colonne 1: Site*/}
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
                                titre="Siret émetteur"
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

                        {/* Colonne 2: Point de collecte*/}
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
                                titre="Adresse"
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

                        {/* Colonne 3: Contact émetteur*/}
                        <div className='hidden'>
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

                    {/* Deuxième ligne : Transporteur, Destinataire, Autres*/}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-0 mb-1 w-full sm:w-[75%] bg-gray-50 rounded-md p-2">
                        {/* Colonne 1: Transporteur*/}
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
                                titre="Siret transporteur"
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

                        {/* Colonne 2: Destinataire*/}
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
                                titre="Siret destinataire"
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

                        {/* Colonne 3: Autres*/}
                        <div className='hidden'>
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

                    {/* Troisième ligne : Filière, Déchet, Contenant*/}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-0 mb-1 w-full sm:w-[75%] bg-gray-50 rounded-md p-2">
                        {/* Colonne 1: Filière*/}
                        <div className='hidden'>
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

                        {/* Colonne 2: Déchet*/}
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
                                titre="Code CED"
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

                        {/* Colonne 3: Contenant*/}
                        <div>
                            <InputFull
                                titre="Contenant"
                                placeholder="Description du contenant"
                                options={getUniqueOptions(options, allOptions, opt => opt.other_infos?.containerDescription || '')}
                                width={30}
                                name="other_infos.containerDescription"
                                value={other_infos.containerDescription}
                                onChange={handleChange}
                                enableText={true}
                            />
                            <div className='flex justify-start gap-0'>
                                <InputFull
                                    titre="Volume"
                                    placeholder="Volume"
                                    name="other_infos.volume"
                                    value={other_infos.volume}
                                    onChange={handleChange}
                                    width={21}
                                    enableText={true}
                                    options={getUniqueOptions(options, allOptions, opt => opt.other_infos?.volume || '')}
                                    display={displayAll || shouldDisplayField("other_infos.volume", changedField)}
                                />
                                <InputFull
                                    titre=""
                                    placeholder="Unité"
                                    name="other_infos.volumeUnit"
                                    value={other_infos.volumeUnit}
                                    onChange={handleChange}
                                    width={21}
                                    enableText={true}
                                    options={{
                                        filteredOptions: [],
                                        allOptions: ['L', 'm³']
                                    }}
                                    display={displayAll || shouldDisplayField("other_infos.volumeUnit", changedField)}
                                />
                            </div>
                        </div>
                    </div>

                {/* Section Validation de la collecte */}
                <div className="text-md font-semibold ml-2 sm:ml-6 mt-4 sm:mt-6 mb-1 sm:mb-2">Validation de la collecte</div>
                <div className="w-full md:w-[75%] bg-gray-50 rounded-md p-2 sm:p-4 mx-auto ml-[-0.5%]">
                                {/* Header avec radio buttons et checkbox */}
                    <div className="flex flex-wrap gap-2 sm:gap-4 mb-2 sm:mb-6">
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
                            <span className={`text-xs sm:text-sm font-medium ${!other_infos.automaticMode ? 'text-gray-400' : 'text-gray-700'}`}>
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
                            <span className={`text-xs sm:text-sm font-medium ${!other_infos.automaticMode ? 'text-gray-400' : 'text-gray-700'}`}>
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
                            <label className="text-xs sm:text-sm font-medium text-gray-700">
                                            Calcul automatique
                                        </label>
                                    </div>
                                </div>

                    {/* Contenu réorganisé */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-8">
                        {/* Colonne A */}
                        <div className="flex flex-col space-y-3">
                            {/* Sous-colonnes avec alignement vertical */}
                            <div className="grid grid-cols-2 gap-3 items-center">
                                {/* Jauge - Agrandie */}
                                <div className="flex justify-center items-center h-full">
                                    <div className="relative w-24 sm:w-40 h-[150px] sm:h-[220px] bg-gray-300 rounded-lg overflow-hidden border border-gray-200">
                                            <div className="text-xs text-center text-black mt-2 mx-2">
                                                {dataToogle.wasteDetails.packagingInfos[0].quantity <= 1 ? 
                                                    `Estimez le remplissage de la ${other_infos.containerDescription}` :
                                                    `Estimez le remplissage moyen des ${dataToogle.wasteDetails.packagingInfos[0].quantity} ${other_infos.containerDescription}s`
                                                }
                                            </div>
                                            {/* Logo poubelle en filigrane */}
                                            <div className="absolute inset-0 flex items-end justify-center opacity-20 overflow-visible">
                                            <div className="transform scale-[4] sm:scale-[6] mb-[25px] sm:mb-[52px]">
                                                    <BoxIcon 
                                                        name="trash" 
                                                        type="solid"
                                                    className="w-5 sm:w-8 h-10 sm:h-16 text-gray-800"
                                                    />
                                                </div>
                                            </div>
                                            
                                            {/* Barre de remplissage */}
                                            <div 
                                                className="absolute bottom-0 left-0 w-full bg-[var(--green-medium)] opacity-85"
                                                style={{ 
                                                    height: `${other_infos.fillRate || 0}%`
                                                }}
                                            />
                                            
                                            {/* Pourcentage */}
                                            <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-sm sm:text-lg font-bold text-white">
                                                    {other_infos.fillRate || 0}%
                                                </span>
                                            </div>

                                            {/* Input range vertical superposé */}
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
                                                className={`absolute inset-0 w-full h-full opacity-0 cursor-pointer ${
                                                    other_infos.automaticMode && other_infos.inputMode === 'tonnage'
                                                        ? 'cursor-not-allowed'
                                                        : ''
                                                }`}
                                                style={{
                                                    WebkitAppearance: 'slider-vertical'
                                                }}
                                                disabled={other_infos.automaticMode && other_infos.inputMode === 'tonnage'}
                                            />
                                        </div>
                                    </div>

                                    {/* Inputs */}
                                <div className="flex flex-col space-y-2 self-center h-full justify-center">
                                        {/* Input quantité */}
                                    <div>
                                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                                            Quantité totale (T)
                                        </label>
                                        <input
                                            type="number"
                                            className={`w-full text-base sm:text-2xl px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
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
                                    </div>

                                        {/* Checkbox quantité estimée */}
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                            className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 rounded"
                                                checked={dataToogle.wasteDetails.quantityType === 'ESTIMATED'}
                                                onChange={(e) => {
                                                    const newData = { ...dataToogle };
                                                    updateNestedValue(newData as unknown as NestedObject, 'wasteDetails.quantityType', e.target.checked ? 'ESTIMATED' : 'REAL');
                                                    setDataToogle(newData);
                                                }}
                                            />
                                        <label className="text-xs sm:text-sm text-gray-600">
                                                Quantité estimée
                                            </label>
                                        </div>

                                        {/* Input nombre de contenants */}
                                    <div className="mt-1">
                                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                                            Nombre de contenants
                                            </label>
                                        <div className="flex items-center space-x-1 sm:space-x-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const currentQty = Number(dataToogle.wasteDetails.packagingInfos[0].quantity) || 0;
                                                        if (currentQty > 1) {
                                                            const newValue = (currentQty - 1).toString();
                                                            const newData = JSON.parse(JSON.stringify(dataToogle)) as FormInput;
                                                            updateNestedValue(newData as unknown as NestedObject, 'wasteDetails.packagingInfos[0].quantity', newValue);
                                                            
                                                            if (other_infos.automaticMode && other_infos.inputMode === 'volume') {
                                                                updateWeight(
                                                                    other_infos.volume,
                                                                    other_infos.fillRate,
                                                                    newData.wasteDetails.code,
                                                                    other_infos.volumeUnit,
                                                                    Number(newValue),
                                                                    setDataToogle,
                                                                    newData
                                                                );
                                                            } else {
                                                                setDataToogle(newData);
                                                            }
                                                        }
                                                    }}
                                                className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300"
                                                >
                                                    <span className="sr-only">Diminuer</span>
                                                    -
                                                </button>
                                                <input
                                                    type="number"
                                                    className="w-12 sm:w-20 h-[32px] sm:h-[42px] text-center px-1 sm:px-2 border border-gray-300 rounded-md"
                                                    value={dataToogle.wasteDetails.packagingInfos[0].quantity || 1}
                                                    onChange={(e) => {
                                                        const value = Math.max(Number(e.target.value) || 1, 1);
                                                        const newData = JSON.parse(JSON.stringify(dataToogle)) as FormInput;
                                                        updateNestedValue(newData as unknown as NestedObject, 'wasteDetails.packagingInfos[0].quantity', value.toString());
                                                        
                                                        if (other_infos.automaticMode && other_infos.inputMode === 'volume') {
                                                            updateWeight(
                                                                other_infos.volume,
                                                                other_infos.fillRate,
                                                                newData.wasteDetails.code,
                                                                other_infos.volumeUnit,
                                                                value,
                                                                setDataToogle,
                                                                newData
                                                            );
                                                        } else {
                                                            setDataToogle(newData);
                                                        }
                                                    }}
                                                    min="1"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const currentQty = Number(dataToogle.wasteDetails.packagingInfos[0].quantity) || 0;
                                                        const newValue = (currentQty + 1).toString();
                                                        const newData = JSON.parse(JSON.stringify(dataToogle)) as FormInput;
                                                        updateNestedValue(newData as unknown as NestedObject, 'wasteDetails.packagingInfos[0].quantity', newValue);
                                                        
                                                        if (other_infos.automaticMode && other_infos.inputMode === 'volume') {
                                                            updateWeight(
                                                                other_infos.volume,
                                                                other_infos.fillRate,
                                                                newData.wasteDetails.code,
                                                                other_infos.volumeUnit,
                                                                Number(newValue),
                                                                setDataToogle,
                                                                newData
                                                            );
                                                        } else {
                                                            setDataToogle(newData);
                                                        }
                                                    }}
                                                className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Colonne B - Photo */}
                        <div className="flex flex-col items-center justify-center mt-1 md:mt-0">
                                {photoUrl ? (
                                    <>
                                    <div className="w-full max-w-md mb-1 sm:mb-4">
                                        <div className="relative w-full h-32 sm:h-48 md:h-64 rounded-lg overflow-hidden border border-gray-200">
                                                <Image
                                                    src={photoUrl}
                                                    alt="Photo du déchet"
                                                    fill
                                                    className="object-contain"
                                                />
                                            </div>
                                        <div className="flex flex-row justify-between items-center mt-1 sm:mt-2 space-x-2">
                                                <a 
                                                    href={photoUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                className="text-xs sm:text-sm text-blue-600 hover:text-blue-800"
                                                >
                                                Voir
                                                </a>
                                                <button
                                                    type="button"
                                                className="text-xs sm:text-sm bg-gray-100 text-gray-600 px-2 sm:px-3 py-1 rounded hover:bg-gray-200"
                                                    onClick={handleTakePhoto}
                                                >
                                                Changer
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                    className="w-full sm:w-auto bg-[var(--green-medium)] text-white px-3 sm:px-6 py-2 sm:py-3 rounded-md hover:bg-[var(--green-dark)] flex items-center justify-center gap-2"
                                        onClick={handleTakePhoto}
                                    >
                                    <BoxIcon name="camera" type="solid" className="w-4 h-4 sm:w-6 sm:h-6" color="white" />
                                    <span className="text-xs sm:text-base">Prendre une photo</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                {/* Boutons de validation */}
                <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-4 mt-4 sm:mt-6 px-2 sm:px-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                        >
                            Annuler
                        </button>
                        <button
                            type="button"
                            onClick={onValidate}
                            disabled={submitLoading || dataToogle.wasteDetails.quantity < 0.00001}
                            className="relative w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-[var(--green-medium)] rounded-md hover:bg-[var(--green-dark)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                        >
                            {submitLoading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>En cours...</span>
                                </>
                            ) : (
                                'Valider'
                            )}
                            {dataToogle.wasteDetails.quantity < 0.00001 && (
                                <div className="absolute bottom-full left-1/2 transform -translate-x-2/3 mb-2 px-3 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                    Veuillez saisir un tonnage
                                </div>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ValidateCollecte;



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


const updateOrPush = (newDataFilter: {name: string, value: string}[], name: string, value: string) => {
    const existingItem = newDataFilter.find(item => item.name === name);
    if (existingItem) {
        existingItem.value = value; // Met à jour la valeur
    } else {
        newDataFilter.push({ name, value }); // Ajoute un nouvel élément
    }
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
