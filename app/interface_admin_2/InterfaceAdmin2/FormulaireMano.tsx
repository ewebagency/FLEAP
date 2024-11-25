// components/FormulaireMano.tsx

import { useState } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { jsonDefaultData } from './placeholders';

interface FormulaireManoProps { 
    currentPdfId: string | null;
    onNextPdf: () => void;
}

interface DepartLine {
    type_operation: string;
    type_dechet: string;
    code_dechet: string;
    date_collecte: string;
    lieu_collecte: string;
    montant_ht: number;
}

interface FactureFormData {
    header: {
        prestataire_nom: string;
    };
    footer: {
        total_ht: number;
    };
    departs: DepartLine[];
}

export default function FormulaireMano({ currentPdfId, onNextPdf }: FormulaireManoProps) {
    const [formData, setFormData] = useState<FactureFormData>(jsonDefaultData.facture_form);
    const [loading, setLoading] = useState(false);
    const [typeForm, setTypeForm] = useState('facture_form');

    const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            header: { ...prev.header, [e.target.name]: e.target.value }
        }));
    };

    const handleDepartChange = (index: number, field: keyof DepartLine, value: string | number) => {
        const newDeparts = [...formData.departs];
        newDeparts[index] = {
            ...newDeparts[index],
            [field]: field === 'montant_ht' ? Number(value) : value
        };

        // Calculer le nouveau total
        const newTotal = newDeparts.reduce((sum, depart) => sum + depart.montant_ht, 0);

        setFormData(prev => ({
            ...prev,
            departs: newDeparts,
            footer: { ...prev.footer, total_ht: newTotal }
        }));
    };

    const addDepartLine = () => {
        setFormData(prev => {
            // Récupère les valeurs du dernier départ
            const lastDepart = prev.departs[prev.departs.length - 1];
            
            // Crée un nouveau départ avec les mêmes valeurs que le dernier
            const newDepart = {
                type_operation: lastDepart.type_operation,
                type_dechet: lastDepart.type_dechet,
                code_dechet: lastDepart.code_dechet,
                date_collecte: lastDepart.date_collecte,
                lieu_collecte: lastDepart.lieu_collecte,
                montant_ht: lastDepart.montant_ht
            };

            return {
                ...prev,
                departs: [...prev.departs, newDepart]
            };
        });
    };

    const removeDepartLine = (index: number) => {
        if (formData.departs.length > 1) {
            const newDeparts = formData.departs.filter((_, i) => i !== index);
            const newTotal = newDeparts.reduce((sum, depart) => sum + depart.montant_ht, 0);
            
            setFormData(prev => ({
                ...prev,
                departs: newDeparts,
                footer: { ...prev.footer, total_ht: newTotal }
            }));
        }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoading(true);
        
        try {
            const { data, error: pdfError } = await supabase
                .from('pdf_infos')
                .select('user_id')
                .eq('id', currentPdfId)
                .single();

            if (pdfError) {
                throw new Error("Erreur dans la récolte du user_id du pdf");
            }

            const user_id = data.user_id;

            // Créer une copie profonde de formData et ajouter linked_to_bsd
            const dataToSend = {
                ...formData,
                departs: formData.departs.map(depart => ({
                    ...depart,
                    linked_to_bsd: false
                }))
            };

            if (typeForm === 'facture_form') {
                const { error } = await supabase
                    .from('facture')
                    .insert([{
                        user_id: user_id,
                        pdf_infos_id: currentPdfId,
                        infos_json: dataToSend
                    }]);

                if (error) throw error;
                console.log("Facture insérée avec succès");
                onNextPdf();
            }
        } catch (error) {
            console.error("Erreur lors de la soumission:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full p-2">
            <h2 className="text-lg font-bold mb-3">Formulaire de facture</h2>

            <form onSubmit={handleSubmit} className="space-y-3">
                {/* En-tête */}
                <div className="bg-white p-3 rounded shadow text-sm">
                    <h3 className="text-base font-semibold mb-2">Informations générales</h3>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                            Nom du prestataire
                        </label>
                        <input
                            type="text"
                            name="prestataire_nom"
                            value={formData.header.prestataire_nom}
                            onChange={handleHeaderChange}
                            className="w-full p-1 text-sm border rounded"
                        />
                    </div>
                </div>

                {/* Lignes de départ */}
                <div className="bg-white p-3 rounded shadow text-sm">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-base font-semibold">Lignes de départ</h3>
                        <button
                            type="button"
                            onClick={addDepartLine}
                            className="bg-blue-500 text-white px-2 py-1 text-xs rounded hover:bg-blue-600"
                        >
                            Ajouter une ligne
                        </button>
                    </div>

                    {formData.departs.map((depart, index) => (
                        <div key={index} className="border p-2 rounded mb-2">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Type d&apos;opération
                                    </label>
                                    <input
                                        type="text"
                                        value={depart.type_operation}
                                        onChange={(e) => handleDepartChange(index, 'type_operation', e.target.value)}
                                        className="w-full p-1 text-xs border rounded"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Type de déchet
                                    </label>
                                    <input
                                        type="text"
                                        value={depart.type_dechet}
                                        onChange={(e) => handleDepartChange(index, 'type_dechet', e.target.value)}
                                        className="w-full p-1 text-xs border rounded"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Code CED
                                    </label>
                                    <input
                                        type="text"
                                        value={depart.code_dechet}
                                        onChange={(e) => handleDepartChange(index, 'code_dechet', e.target.value)}
                                        className="w-full p-1 text-xs border rounded"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Date de collecte
                                    </label>
                                    <input
                                        type="date"
                                        value={depart.date_collecte}
                                        onChange={(e) => handleDepartChange(index, 'date_collecte', e.target.value)}
                                        className="w-full p-1 text-xs border rounded"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Lieu de collecte
                                    </label>
                                    <input
                                        type="text"
                                        value={depart.lieu_collecte}
                                        onChange={(e) => handleDepartChange(index, 'lieu_collecte', e.target.value)}
                                        className="w-full p-1 text-xs border rounded"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Montant HT
                                    </label>
                                    <input
                                        type="number"
                                        value={depart.montant_ht}
                                        onChange={(e) => handleDepartChange(index, 'montant_ht', e.target.value)}
                                        className="w-full p-1 text-xs border rounded"
                                    />
                                </div>
                            </div>
                            {formData.departs.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeDepartLine(index)}
                                    className="mt-1 text-xs text-red-600 hover:text-red-800"
                                >
                                    Supprimer
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {/* Pied de page */}
                <div className="bg-white p-2 rounded shadow text-sm">
                    <div className="flex justify-end items-center">
                        <span className="text-sm font-semibold">
                            Total HT: {formData.footer.total_ht.toFixed(2)} €
                        </span>
                    </div>
                </div>

                {/* Bouton de soumission */}
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-green-500 text-white px-3 py-1 text-xs rounded hover:bg-green-600 disabled:bg-gray-400"
                    >
                        {loading ? "Chargement..." : "Suivant"}
                    </button>
                </div>
            </form>
        </div>
    );
}
