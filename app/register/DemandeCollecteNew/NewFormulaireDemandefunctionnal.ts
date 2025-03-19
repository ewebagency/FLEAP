import { supabase } from "@/app/database/supabaseClient";
import { getFiliere } from "@/app/interface_admin_2/InterfaceAdmin2/utils/helpers";
import { FormInput, OtherInfos, CompleteFormInput } from "@/app/register/interface/BSD_Interface";
import React from 'react';

export interface NestedObject {
    [key: string]: string | number | boolean | NestedObject | NestedArray | undefined | null;
}

export interface NestedArray extends Array<NestedObject> {
    [index: number]: NestedObject;
}

export const updateNestedValue = (obj: NestedObject, path: string, value: string | number | boolean): void => {
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

export const initialToogleData: FormInput = {
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


export const initialOtherInfos: OtherInfos = {
  containerDescription: "",
  volume: "",
  volumeUnit: "",
  fillRate: "",
  inputMode: "volume",
  automaticMode: true
};

// Définition de la structure des dépendances
export interface InputDependency {
  children: string[];
  filterFields?: string[]; // Rendre filterFields optionnel
}
export interface InputDependencies {
    [key: string]: InputDependency;
}
export const inputDependencies: InputDependencies = {
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

// Add WasteLine interface definition
export interface WasteLine {
    filiere: string;
    wasteDetails: {
        code: string;
        name: string;
        packagingInfos: {
            type: string;
            quantity: number;
        }[];
        quantity: number;
    };
    collectDate: string;
    other_infos: {
        containerDescription: string;
        volume: string;
        volumeUnit: string;
        inputMode?: string;
        automaticMode?: boolean;
        fillRate?: string;
    };
}









//Utils
export interface Ced {
    ced: string;
    filiere: string;
}
export const getDataAutocompletionFull = async (dataFilter: {name: string, value: string}[], entreprise_id: string, cedTable: Ced[]): Promise<CompleteFormInput[]> => { 
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

export function replaceLastOccurrence(str: string, search: string, replacement: string) {
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
export const isAncestor = (potentialAncestor: string, field: string, inputDependencies: InputDependencies) => {
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
export const dataFilterUpdate = (
    setLineDataFilters: React.Dispatch<React.SetStateAction<{[key: number]: {name: string, value: string}[]}>>,
    lineDataFilters: {[key: number]: {name: string, value: string}[]},
    setCurrentFiliere: (filiere: string) => void,
    ced_table: { ced: string; filiere: string; }[],
    name: string,
    value: string,
    dataFilter: {name: string, value: string}[],
    setDataFilter: (dataFilter: {name: string, value: string}[]) => void,
    inputDependencies: InputDependencies
) => {
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
        setLineDataFilters((prev: {[key: number]: {name: string, value: string}[]}) => {
            const newState: {[key: number]: {name: string, value: string}[]} = {
                ...prev,
                [index]: updatedLineFilters
            };
            return newState;
        });

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
export const updateLineFilter = (filters: {name: string, value: string}[], newFilter: {name: string, value: string}) => {
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
export const preciseFilter = (
    allOptions: {json_row: FormInput, other_infos?: OtherInfos}[], 
    alreadyChosenData: FormInput, 
    fieldsForFilter: string[], 
    interestField: string,
    doNotUseDataFilter?: boolean
): string => {
    try {
        // 1. Filtrer les options selon les champs déjà remplis
        const filteredOptions = doNotUseDataFilter 
            ? allOptions.filter(option => {
                // Ne filtrer que sur le champ parent direct de filter_dependencies
                const parentField = fieldsForFilter[0]; // Le premier champ parent est celui qui déclenche l'autocomplétion
                const value = parentField.split('.').reduce<unknown>((obj, key) => 
                    typeof obj === 'object' && obj ? (obj as Record<string, unknown>)[key] : undefined,
                    option.json_row as unknown as Record<string, unknown>
                );
                const chosenValue = parentField.split('.').reduce<unknown>((obj, key) => 
                    typeof obj === 'object' && obj ? (obj as Record<string, unknown>)[key] : undefined,
                    alreadyChosenData as unknown as Record<string, unknown>
                );
                
                if (!chosenValue) return true;
                return value === chosenValue;
            })
            : allOptions.filter(option => {
                // Comportement actuel : filtrer sur tous les champs parents
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





