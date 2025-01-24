import { SelectInput } from './SelectInput';
import { FactureLine, DepartLine, Option } from '../types/interfaces';
import { ALL_OPERATIONS, UNITES, TYPES_CONTENANTS } from '../constants/formConstants';

import { getNestedValue, getMappingTableFiliere, getFiliere } from '../utils/helpers';
import { useState, useEffect } from 'react';

// Mise à jour des types
type CompanyValue = {
    name?: string;
    siret?: string;
    [key: string]: string | undefined;
};

type WasteDetailsValue = {
    name?: string;
    code?: string;
    filiere?: string;
    [key: string]: string | undefined;
};

// Mise à jour du type NestedValue pour gérer les valeurs undefined
type NestedValue = string | number | boolean | CompanyValue | WasteDetailsValue | Record<string, unknown> | undefined;

// Mise à jour des types pour plus de précision
type RawValue = {
    [key: string]: string | number | boolean | undefined | RawValue;
};

type BSDBsdValue = {
    formAPI: {
        createFormInput: {
            emitter: {
                company: CompanyValue;
            };
            wasteDetails: WasteDetailsValue;
            transporter: {
                company: CompanyValue;
            };
        };
    };
};

// Ajout d'un index signature à DepartLineBody
interface DepartLineBody {
    type_operation: string;
    quantite: number;
    unite: string;
    prix_unitaire: number;
    montant_ht: number;
    description_contenant?: string;
    type_contenant?: string;
    [key: string]: string | number | undefined;
}

interface DepartSectionProps {
    formData: FactureLine;
    sites: string[];
    wasteTypes: string[];
    wasteCodes: string[];
    filieres: string[];
    onUpdate: (formData: FactureLine, departIndex: number) => void;
    allOptions: FactureLine[];
    filteredOptionsByDepart: FactureLine[][];
    departFilters: Array<{
        departIndex: number;
        filters: {
            field: string;
            value: string;
        }[];
    }>;
    entrepriseId: string | null;
}

export const DepartSection = ({ 
    formData, 
    onUpdate,
    allOptions,
    filteredOptionsByDepart,
    departFilters,
    entrepriseId
}: DepartSectionProps) => {
    
    // Ajouter un état pour le mapping
    const [mappingTable, setMappingTable] = useState<{ ced: string, filiere: string }[]>([]);
    
    // Charger le mapping au montage du composant
    useEffect(() => {
        const loadMapping = async () => {
            const mapping = await getMappingTableFiliere(entrepriseId);
            setMappingTable(mapping);
        };
        loadMapping();
    }, [entrepriseId]);

    // Déplacer formatValue à l'intérieur du composant pour avoir accès à mappingTable
    const formatValue = (value: NestedValue, field: string): string => {
        if (!value) return '';
        
        // Si la valeur est une string directe, la retourner
        if (typeof value === 'string') return value;
        
        switch (field) {
            case 'formAPI.createFormInput.emitter.company':
                const companyValue = value as CompanyValue;
                return companyValue.name && companyValue.siret ? 
                    `${companyValue.name} - ${companyValue.siret}` : '';
            
            case 'formAPI.createFormInput.wasteDetails.name':
            case 'formAPI.createFormInput.wasteDetails.code':
                // Pour ces champs, la valeur est déjà extraite, pas besoin de cast
                return String(value);
            
            case 'formAPI.createFormInput.wasteDetails.filiere':
                const filiereValue = value as WasteDetailsValue;
                return getFiliere(filiereValue.code, mappingTable);
            
            case 'formAPI.createFormInput.transporter.company':
                const transporterValue = value as CompanyValue;
                return transporterValue.name || '';
            
            default:
                return typeof value === 'object' ? 
                    JSON.stringify(value) : String(value);
        }
    };

    // Helper pour extraire les options uniques des BSDs
    const extractUniqueValues = (field: string, departIndex: number, specificField?: string) => {
        const allValues = new Set<string>();
        const suggestedValues = new Set<string>();
        
        allOptions.forEach(bsd => {
            try {
                let value = getNestedValue(bsd, field);
                
                if (field === 'formAPI.createFormInput.wasteDetails') {
                    if (value && typeof value === 'object') {
                        const wasteDetails = value as WasteDetailsValue;
                        value = specificField ? wasteDetails?.[specificField as keyof WasteDetailsValue] : value;
                    }
                }
                
                const formattedValue = formatValue(value, specificField ? `${field}.${specificField}` : field);
                if (formattedValue) allValues.add(formattedValue);
            } catch (error) {
                console.warn(`Erreur lors de l'extraction de la valeur pour le champ ${field}:`, error);
            }
        });

        // Pour les valeurs suggérées
        const departFilteredOptions = filteredOptionsByDepart[departIndex] || [];
        departFilteredOptions.forEach(bsd => {
            try {
                let value = getNestedValue(bsd, field);
                
                if (field === 'formAPI.createFormInput.wasteDetails') {
                    if (value && typeof value === 'object') {
                        const wasteDetails = value as WasteDetailsValue;
                        value = specificField ? wasteDetails?.[specificField as keyof WasteDetailsValue] : value;
                    }
                }
                
                const formattedValue = formatValue(value, specificField ? `${field}.${specificField}` : field);
                if (formattedValue) suggestedValues.add(formattedValue);
            } catch (error) {
                console.warn(`Erreur lors de l'extraction de la valeur suggérée pour le champ ${field}:`, error);
            }
        });

        return Array.from(allValues)
            .filter(value => value && value.trim() !== '')
            .map(value => ({
                value,
                isSuggested: suggestedValues.has(value)
            }))
            .sort((a, b) => a.value.localeCompare(b.value));
    };

    // Créer les options pour chaque select avec l'index du départ
    const getOptionsForDepart = (departIndex: number) => {
        try {
            const baseWastePath = 'formAPI.createFormInput.wasteDetails';
            
            // Obtenir uniquement les filières uniques du mapping
            const filiereOptions = Array.from(new Set(
                mappingTable.map(item => item.filiere)
            )).map(filiere => ({
                value: filiere.charAt(0).toUpperCase() + filiere.slice(1).toLowerCase(),
                isSuggested: true
            }));

            return {
                siteOptions: extractUniqueValues('formAPI.createFormInput.emitter.company', departIndex),
                wasteTypeOptions: extractUniqueValues(baseWastePath, departIndex, 'name'),
                wasteCodeOptions: extractUniqueValues(baseWastePath, departIndex, 'code'),
                filiereOptions
            };
        } catch (error) {
            console.error('Erreur lors de la création des options:', error);
            return {
                siteOptions: [],
                wasteTypeOptions: [],
                wasteCodeOptions: [],
                filiereOptions: []
            };
        }
    };

    const handleDepartHeaderChange = (departIndex: number, field: string, value: string) => {
        const newFormData = { ...formData };
        console.log('newformData', newFormData);
        if (field === 'code_dechet') {
            // Si on change le code CED, mettre à jour la filière correspondante
            const filiere = getFiliere(value, mappingTable);
            newFormData.departs[departIndex].line_header = {
                ...newFormData.departs[departIndex].line_header,
                code_dechet: value,
                filiere: filiere
            };
        } else {
            newFormData.departs[departIndex].line_header = {
                ...newFormData.departs[departIndex].line_header,
                [field]: value
            };
        }
        
        onUpdate(newFormData, departIndex);
    };

    const calculateTotal = (formData: FactureLine) => {
        const total = formData.departs.reduce((acc, depart) => {
            return acc + depart.line_body.reduce((lineAcc, line) => {
                return lineAcc + (line.montant_ht || 0);
            }, 0);
        }, 0);
        return total;
    };

    const handleOperationChange = (departIndex: number, lineIndex: number, field: keyof DepartLineBody, value: string | number) => {
        const newFormData = { ...formData };
        const line = newFormData.departs[departIndex].line_body[lineIndex] as DepartLineBody;

        // Si on change le type d'opération et que ce n'est pas "Contenant", réinitialiser les champs liés
        if (field === 'type_operation' && value !== 'Contenant') {
            line.description_contenant = '';
            line.type_contenant = '';
        }

        // Mettre à jour le champ
        line[field] = value;

        // Recalculer le montant si nécessaire
        if (field === 'quantite' || field === 'prix_unitaire') {
            line.montant_ht = (line.quantite || 0) * (line.prix_unitaire || 0);
        }

        onUpdate(newFormData, departIndex);
    };

    const addPrestationLine = (departIndex: number) => {
        const newFormData = { ...formData };
        newFormData.departs[departIndex].line_body.push({
            type_operation: ALL_OPERATIONS[0],
            quantite: 0,
            unite: UNITES[0],
            prix_unitaire: 0,
            montant_ht: 0
        });
        onUpdate(newFormData, departIndex);
    };

    const removePrestationLine = (departIndex: number, bodyIndex: number) => {
        const newFormData = { ...formData };
        newFormData.departs[departIndex].line_body.splice(bodyIndex, 1);
        onUpdate(newFormData, departIndex);
    };

    const addNewDepart = () => {
        const newFormData = { ...formData };
        const lastDepart = newFormData.departs[newFormData.departs.length - 1];
        
        // Copier le dernier départ avec ses valeurs
        newFormData.departs.push({
            ...lastDepart,
            line_header: {
                ...lastDepart.line_header,
                date_depart: formData.header.date_facture || new Date().toISOString().split('T')[0],
            },
            line_body: [{
                type_operation: lastDepart.line_body[0].type_operation,
                quantite: 0,
                unite: lastDepart.line_body[0].unite,
                prix_unitaire: lastDepart.line_body[0].prix_unitaire,
                montant_ht: 0
            }]
        });
        
        onUpdate(newFormData, newFormData.departs.length - 1);
    };

    const removeDepart = (departIndex: number) => {
        if (departIndex === 0) return; // Ne pas supprimer le premier départ
        const newFormData = { ...formData };
        newFormData.departs.splice(departIndex, 1);
        onUpdate(newFormData, departIndex);
    };

    return (
        <div className="space-y-4">
            {formData.departs.map((depart, departIndex) => {
                const options = getOptionsForDepart(departIndex);
                
                return (
                <div key={departIndex} className="bg-white p-3 rounded shadow relative">
                    {/* Bouton de suppression du départ */}
                    {departIndex > 0 && (
                        <button
                            type="button"
                            onClick={() => removeDepart(departIndex)}
                            className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                    
                    <h4 className="font-semibold mb-3">Départ {departIndex + 1}</h4>
                    
                    {/* Section Site - 3 colonnes */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        <input
                            type="text"
                            placeholder="Description site"
                            value={depart.line_header.site_description || ''}
                            onChange={(e) => handleDepartHeaderChange(departIndex, 'site_description', e.target.value)}
                            className="w-full p-1 text-xs border rounded"
                        />
                        <input
                            type="text"
                            placeholder="N° affaire"
                            value={depart.line_header.site_num_affaire || ''}
                            onChange={(e) => handleDepartHeaderChange(departIndex, 'site_num_affaire', e.target.value)}
                            className="w-full p-1 text-xs border rounded"
                        />
                        <SelectInput
                            label="Site"
                            value={`${depart.line_header.site_nom} - ${depart.line_header.site_siret}`}
                            onChange={(value) => {
                                const [nom, siret] = value.split(' - ');
                                const newFormData = { ...formData };
                                newFormData.departs[departIndex].line_header = {
                                    ...newFormData.departs[departIndex].line_header,
                                    site_nom: nom || '',
                                    site_siret: siret || ''
                                };
                                onUpdate(newFormData, departIndex);
                            }}
                            options={options.siteOptions}
                            className="w-full"
                        />
                    </div>

                    {/* Section Déchets - 4 colonnes */}
                    <div className="grid grid-cols-4 gap-2 mb-4">
                        <input
                            type="text"
                            placeholder="Description déchet"
                            value={depart.line_header.dechet_description || ''}
                            onChange={(e) => handleDepartHeaderChange(departIndex, 'dechet_description', e.target.value)}
                            className="w-full p-1 text-xs border rounded"
                        />
                        <SelectInput
                            label="type de déchet"
                            value={depart.line_header.type_dechet}
                            onChange={(value) => handleDepartHeaderChange(departIndex, 'type_dechet', value)}
                            options={options.wasteTypeOptions}
                        />
                        <SelectInput
                            label="CED"
                            value={depart.line_header.code_dechet}
                            onChange={(value) => handleDepartHeaderChange(departIndex, 'code_dechet', value)}
                            options={options.wasteCodeOptions}
                        />
                        <SelectInput
                            label="Filière"
                            value={depart.line_header.filiere || ''}
                            onChange={(value) => handleDepartHeaderChange(departIndex, 'filiere', value)}
                            options={options.filiereOptions}
                        />
                    </div>

                    {/* Section Informations - 4 colonnes */}
                    <div className="grid grid-cols-4 gap-2 mb-4">
                        <input
                            type="date"
                            placeholder="Date de départ"
                            value={depart.line_header.date_depart || ''}
                            onChange={(e) => handleDepartHeaderChange(departIndex, 'date_depart', e.target.value)}
                            className="w-full p-1 text-xs border rounded"
                        />
                        <input
                            type="text"
                            placeholder="N° dossier"
                            value={depart.line_header.num_dossier || ''}
                            onChange={(e) => handleDepartHeaderChange(departIndex, 'num_dossier', e.target.value)}
                            className="w-full p-1 text-xs border rounded hidden"
                        />
                        <input
                            type="text"
                            placeholder="Bon d'intention"
                            value={depart.line_header.bon_intention || ''}
                            onChange={(e) => handleDepartHeaderChange(departIndex, 'bon_intention', e.target.value)}
                            className="w-full p-1 text-xs border rounded hidden"
                        />
                        <input
                            type="text"
                            placeholder="Bon de pesée"
                            value={depart.line_header.bon_pesee || ''}
                            onChange={(e) => handleDepartHeaderChange(departIndex, 'bon_pesee', e.target.value)}
                            className="w-full p-1 text-xs border rounded hidden"
                        />
                    </div>

                    {/* Section Prestations */}
                    <div className="space-y-2 mb-4">
                        {depart.line_body.map((body, bodyIndex) => (
                            <div key={bodyIndex} className="grid grid-cols-6 gap-2 items-center">
                                <SelectInput
                                    label="type d'opération"
                                    value={body.type_operation}
                                    onChange={(value) => handleOperationChange(departIndex, bodyIndex, 'type_operation', value)}
                                    options={ALL_OPERATIONS.map(op => ({ value: op }))}
                                    enableAutoComplete={false}
                                />

                                {/* Champs supplémentaires pour le type "Contenant" */}
                                {['Location', 'Maintenance', 'Mise à disposition', 'Autres : Contenant'].includes(body.type_operation) && (
                                    <>
                                        <div className="col-span-1">
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Description contenant
                                            </label>
                                            <input
                                                type="text"
                                                value={body.description_contenant || ''}
                                                onChange={(e) => handleOperationChange(departIndex, bodyIndex, 'description_contenant', e.target.value)}
                                                className="w-full p-1 text-xs border rounded"
                                                placeholder="Description"
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            <SelectInput
                                                label="Type contenant"
                                                value={body.type_contenant || ''}
                                                onChange={(value) => handleOperationChange(departIndex, bodyIndex, 'type_contenant', value)}
                                                options={TYPES_CONTENANTS.map(type => ({ value: type, isSuggested: true }))}
                                                enableAutoComplete={false}
                                            />
                                        </div>
                                    </>
                                )}

                                <SelectInput
                                    label="Unite"
                                    value={body.unite}
                                    onChange={(value) => handleOperationChange(departIndex, bodyIndex, 'unite', value)}
                                    options={UNITES.map(u => ({ value: u }))}
                                    enableAutoComplete={false}
                                />
                                <div className="col-span-1">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Quantité
                                    </label>
                                    <input
                                        type="number"
                                        value={body.quantite}
                                        onChange={(e) => {
                                            const quantite = parseFloat(e.target.value) || 0;
                                            handleOperationChange(departIndex, bodyIndex, 'quantite', quantite);
                                            const montant = quantite * (body.prix_unitaire || 0);
                                            handleOperationChange(departIndex, bodyIndex, 'montant_ht', montant);
                                        }}
                                        className="w-full p-1 text-xs border rounded"
                                        step="1"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Prix unitaire
                                    </label>
                                    <input
                                        type="number"
                                        value={body.prix_unitaire}
                                        onChange={(e) => {
                                            const pu = parseFloat(e.target.value) || 0;
                                            handleOperationChange(departIndex, bodyIndex, 'prix_unitaire', pu);
                                            const montant = pu * (body.quantite || 0);
                                            handleOperationChange(departIndex, bodyIndex, 'montant_ht', montant);
                                        }}
                                        className="w-full p-1 text-xs border rounded"
                                        step="1"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Montant HT
                                    </label>
                                    <input
                                        type="number"
                                        value={body.montant_ht}
                                        onChange={(e) => handleOperationChange(departIndex, bodyIndex, 'montant_ht', parseFloat(e.target.value) || 0)}
                                        className="w-full p-1 text-xs border rounded"
                                        step="1"
                                    />
                                </div>
                                <div className="col-span-1 flex items-end gap-1">
                                    <button
                                        type="button"
                                        onClick={() => addPrestationLine(departIndex)}
                                        className="h-[30px] px-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                    >
                                        +
                                    </button>
                                    {bodyIndex > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => removePrestationLine(departIndex, bodyIndex)}
                                            className="h-[30px] px-2 bg-red-500 text-white rounded hover:bg-red-600"
                                        >
                                            -
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                );
            })}

            {/* Bouton pour ajouter un nouveau départ */}
            <button
                type="button"
                onClick={addNewDepart}
                className="w-full p-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
                + Ajouter un départ
            </button>
        </div>
    );
}; 