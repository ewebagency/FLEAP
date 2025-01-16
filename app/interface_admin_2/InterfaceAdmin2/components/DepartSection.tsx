import { SelectInput } from './SelectInput';
import { FactureLine, DepartLine } from '../types/interfaces';
import { ALL_OPERATIONS, UNITES, TYPES_CONTENANTS } from '../constants/formConstants';
import { useWasteData } from '../hooks/useWasteData';

type DepartLineBody = {
    type_operation: string;
    quantite: number;
    unite: string;
    prix_unitaire: number;
    montant_ht: number;
    description_contenant?: string;
    type_contenant?: string;
    [key: string]: string | number | undefined;
};

interface DepartSectionProps {
    formData: FactureLine;
    sites: string[];
    wasteTypes: string[];
    wasteCodes: string[];
    filieres: string[];
    onUpdate: (formData: FactureLine) => void;
}

export const DepartSection = ({ 
    formData, 
    sites, 
    wasteTypes,
    wasteCodes,
    filieres,
    onUpdate 
}: DepartSectionProps) => {
    //const { wasteTypes, wasteCodes, filieres } = useWasteData();

    const handleDepartHeaderChange = (departIndex: number, field: string, value: string) => {
        const newFormData = { ...formData };
        newFormData.departs[departIndex].line_header = {
            ...newFormData.departs[departIndex].line_header,
            [field]: value
        };
        onUpdate(newFormData);
    };

    const calculateTotal = (formData: FactureLine) => {
        const total = formData.departs.reduce((acc, depart) => {
            return acc + depart.line_body.reduce((lineAcc, line) => {
                return lineAcc + (line.montant_ht || 0);
            }, 0);
        }, 0);
        return total;
    };

    const handleOperationChange = (departIndex: number, bodyIndex: number, field: string, value: number | string) => {
        const newFormData = { ...formData };
        const lineBody = newFormData.departs[departIndex].line_body[bodyIndex] as DepartLineBody;
        
        // Mettre à jour le champ
        lineBody[field] = value;

        // Si on modifie la quantité ou le prix unitaire, recalculer le montant HT
        if (field === 'quantite' || field === 'prix_unitaire') {
            lineBody.montant_ht = (lineBody.quantite || 0) * (lineBody.prix_unitaire || 0);
        }

        // Calculer le nouveau total
        const newTotal = calculateTotal(newFormData);
        newFormData.footer.total_ht = newTotal;

        onUpdate(newFormData);
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
        onUpdate(newFormData);
    };

    const removePrestationLine = (departIndex: number, bodyIndex: number) => {
        const newFormData = { ...formData };
        newFormData.departs[departIndex].line_body.splice(bodyIndex, 1);
        onUpdate(newFormData);
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
        
        onUpdate(newFormData);
    };

    const removeDepart = (departIndex: number) => {
        if (departIndex === 0) return; // Ne pas supprimer le premier départ
        const newFormData = { ...formData };
        newFormData.departs.splice(departIndex, 1);
        onUpdate(newFormData);
    };

    return (
        <div className="space-y-4">
            {formData.departs.map((depart, departIndex) => (
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
                            label=""
                            value={depart.line_header.site_nom || ''}
                            onChange={(value) => handleDepartHeaderChange(departIndex, 'site_nom', value)}
                            options={['', ...sites]}
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
                            label=""
                            value={depart.line_header.type_dechet}
                            onChange={(value) => handleDepartHeaderChange(departIndex, 'type_dechet', value)}
                            options={['', ...wasteTypes]}
                        />
                        <SelectInput
                            label=""
                            value={depart.line_header.code_dechet}
                            onChange={(value) => handleDepartHeaderChange(departIndex, 'code_dechet', value)}
                            options={['', ...wasteCodes]}
                        />
                        <SelectInput
                            label=""
                            value={depart.line_header.filiere || ''}
                            onChange={(value) => handleDepartHeaderChange(departIndex, 'filiere', value)}
                            options={['', ...filieres]}
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
                            className="w-full p-1 text-xs border rounded"
                        />
                        <input
                            type="text"
                            placeholder="Bon d'intention"
                            value={depart.line_header.bon_intention || ''}
                            onChange={(e) => handleDepartHeaderChange(departIndex, 'bon_intention', e.target.value)}
                            className="w-full p-1 text-xs border rounded"
                        />
                        <input
                            type="text"
                            placeholder="Bon de pesée"
                            value={depart.line_header.bon_pesee || ''}
                            onChange={(e) => handleDepartHeaderChange(departIndex, 'bon_pesee', e.target.value)}
                            className="w-full p-1 text-xs border rounded"
                        />
                    </div>

                    {/* Section Prestations */}
                    <div className="space-y-2 mb-4">
                        {depart.line_body.map((body, bodyIndex) => (
                            <div key={bodyIndex} className="grid grid-cols-7 gap-2 items-end">
                                <div className="col-span-1">
                                    <SelectInput
                                        label="Type de prestation"
                                        value={body.type_operation}
                                        onChange={(value) => handleOperationChange(departIndex, bodyIndex, 'type_operation', value)}
                                        options={ALL_OPERATIONS}
                                    />
                                </div>

                                {/* Champs supplémentaires pour le type "Contenant" */}
                                {body.type_operation === 'Contenant' && (
                                    <>
                                        <div className="col-span-1">
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Description
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
                                                label="Type"
                                                value={body.type_contenant || ''}
                                                onChange={(value) => handleOperationChange(departIndex, bodyIndex, 'type_contenant', value)}
                                                options={TYPES_CONTENANTS}
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="col-span-1">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Quantité
                                    </label>
                                    <input
                                        type="number"
                                        value={body.quantite}
                                        onChange={(e) => {
                                            const quantite = parseInt(e.target.value) || 0;
                                            handleOperationChange(departIndex, bodyIndex, 'quantite', quantite);
                                            const montant = quantite * (body.prix_unitaire || 0);
                                            handleOperationChange(departIndex, bodyIndex, 'montant_ht', montant);
                                        }}
                                        className="w-full p-1 text-xs border rounded"
                                        step="1"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <SelectInput
                                        label="Unité"
                                        value={body.unite}
                                        onChange={(value) => handleOperationChange(departIndex, bodyIndex, 'unite', value)}
                                        options={UNITES}
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
                                            const pu = parseInt(e.target.value) || 0;
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
                                        onChange={(e) => handleOperationChange(departIndex, bodyIndex, 'montant_ht', parseInt(e.target.value) || 0)}
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
            ))}

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