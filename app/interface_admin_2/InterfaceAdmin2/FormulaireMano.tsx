// components/FormulaireMano.tsx

import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';

import { jsonDefaultData } from './placeholders';
import { supabase } from '@/app/database/supabaseClient';
import { DataOnSupabase_infos_json } from '@/app/register/interface/BSD_Interface';
import { useSession } from '@/app/component/SessionProvider';
import FactureLine, { DepartLine, DepartLineBody, DepartLineHeader } from '@/app/lien/interface/facture_line';

interface FormulaireManoProps { 
    currentPdfId: string | null;
    onNextPdf: () => void;
}

interface SelectInputProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: string[];
    className?: string;
}

const SelectInput = ({ label, value, onChange, options, className = "" }: SelectInputProps) => (
    <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
            {label}
        </label>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full p-1 text-xs border rounded ${className}`}
        >
            {options.map((option) => (
                <option key={option} value={option}>
                    {option}
                </option>
            ))}
        </select>
    </div>
);

// Constantes pour les types d'opérations
const MAIN_OPERATIONS = [
    'Préparation',
    'Transport',
    'Traitement',
    'Gestion global',
    'TGAP',
    'Déclassement'
];

const EXPANDED_OPERATIONS = [
    'Rachat',
    'Contenant',
    'Non expliqués'
];

export default function FormulaireMano({ currentPdfId, onNextPdf }: FormulaireManoProps) {
    const [formData, setFormData] = useState<FactureLine>(jsonDefaultData.facture_form);
    const [loading, setLoading] = useState(false);
    const [typeForm, setTypeForm] = useState('facture_form');
    const [myOptions, setMyOptions] = useState<(string | number)[][]>([[], [], [], [], []]);
    const session = useSession();

    useEffect(() => {
        if(session && session.user && session.user.id){
            getMyOptions(session.user.id).then(setMyOptions);
            //console.log('options', myOptions);
        }
    }, [session]);

    // prestataire_final, transporteur_final, lieu_collecte, nom_dechet, code_dechet
    const PRESTATAIRE_FINAL_NOM = myOptions[0].map(String);
    const TRANSPORTEUR_FINAL_NOM = myOptions[1].map(String);
    const PRESTATAIRE = Array.from(new Set([...PRESTATAIRE_FINAL_NOM, ...TRANSPORTEUR_FINAL_NOM]));
    const TYPE_OPERATIONS = ['Traitement', 'Transport', 'Rachat'];
    const LIEU_COLLECTE = myOptions[2].map(String);
    const NOM_DECHET = myOptions[3].map(String);
    const CODE_CED = myOptions[4].map(String);
    

    const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            header: { ...prev.header, [e.target.name]: e.target.value }
        }));
    };

    /*const handleDepartChange = (index: number, field: keyof DepartLine, value: string | number) => {
        const newDeparts = [...formData.departs];
        
        // Si c'est le champ type_operation, vérifier que la valeur est valide
        if (field === 'type_operation' && !TYPE_OPERATIONS.includes(value as string)) {
            // Si la valeur n'est pas valide, utiliser 'Traitement' par défaut
            value = 'Traitement';
        }

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
    };*/

    const addDepartLine = () => {
        setFormData(prev => {
            const lastDepart = prev.departs[prev.departs.length - 1];
            
            // Créer tous les line_body avec les valeurs par défaut
            const defaultLineBody = [...MAIN_OPERATIONS, ...EXPANDED_OPERATIONS].map(operation => ({
                type_operation: operation,
                montant_ht: 0,
                is_expanded: EXPANDED_OPERATIONS.includes(operation)
            }));

            const newDepart: DepartLine = {
                line_header: {
                    type_dechet: lastDepart.line_header.type_dechet,
                    code_dechet: lastDepart.line_header.code_dechet,
                    date_collecte: lastDepart.line_header.date_collecte,
                    lieu_collecte: lastDepart.line_header.lieu_collecte
                },
                line_body: defaultLineBody
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
            const newTotal = newDeparts.reduce((sum, depart) => 
                sum + depart.line_body.reduce((lineSum, body) => lineSum + body.montant_ht, 0)
            , 0);
            
            setFormData(prev => ({
                ...prev,
                departs: newDeparts,
                footer: { ...prev.footer, total_ht: newTotal }
            }));
        }
    };

    const handleDepartHeaderChange = (departIndex: number, field: keyof DepartLineHeader, value: string) => {
        setFormData(prev => {
            const newDeparts = [...prev.departs];
            newDeparts[departIndex] = {
                ...newDeparts[departIndex],
                line_header: {
                    ...newDeparts[departIndex].line_header,
                    [field]: value
                }
            };
            return { ...prev, departs: newDeparts };
        });
    };

    const handleDepartBodyChange = (departIndex: number, bodyIndex: number, field: keyof DepartLineBody, value: string | number) => {
        setFormData(prev => {
            const newDeparts = [...prev.departs];
            const newLineBody = [...newDeparts[departIndex].line_body];
            newLineBody[bodyIndex] = {
                ...newLineBody[bodyIndex],
                [field]: field === 'montant_ht' ? Number(value) : value
            };
            
            newDeparts[departIndex] = {
                ...newDeparts[departIndex],
                line_body: newLineBody
            };

            // Recalculer le total
            const newTotal = newDeparts.reduce((sum, depart) => 
                sum + depart.line_body.reduce((lineSum, body) => lineSum + body.montant_ht, 0)
            , 0);

            return {
                ...prev,
                departs: newDeparts,
                footer: { ...prev.footer, total_ht: newTotal }
            };
        });
    };

    const handleDepartCommentaireChange = (index: number, value: string) => {
        setFormData(prev => {
            const newDeparts = [...prev.departs];
            newDeparts[index] = {
                ...newDeparts[index],
                commentaire: value
            };
            return {
                ...prev,
                departs: newDeparts
            };
        });
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        
        const result = await Swal.fire({
            title: 'Valider le formulaire',
            html: 'Êtes-vous sûr de vouloir valider ce formulaire ?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#22c55e',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Confirmer',
            cancelButtonText: 'Annuler',
            customClass: {
                popup: 'rounded-lg',
                confirmButton: 'rounded-lg',
                cancelButton: 'rounded-lg'
            }
        });

        if (!result.isConfirmed) return;

        setLoading(true);
        try {
            // Récupérer le user_id du pdf
            const { data, error: pdfError } = await supabase
                .from('pdf_infos')
                .select('user_id')
                .eq('id', currentPdfId)
                .single();

            if (pdfError) {
                throw new Error("Erreur dans la récolte du user_id du pdf");
            }

            const user_id = data.user_id;

            // Pour chaque ligne de départ, créer et insérer une facture
            for(let i = 0; i < formData.departs.length; i++) {
                formData.departs[i].line_body.forEach(body => {
                    if ('is_expanded' in body) {
                        delete body.is_expanded;
                    }
                });
                const dataToSend = {
                    header: formData.header,
                    depart: { ...formData.departs[i], linked_to_bsd: false },
                    footer: formData.footer,
                };

                const { error } = await supabase
                    .from('facture')
                    .insert([{
                        user_id: user_id,
                        pdf_infos_id: currentPdfId,
                        infos_json: dataToSend
                    }]);

                if (error) throw error;
            }

            // Mettre à jour le statut du PDF à 'read'
            const { error: updateError } = await supabase
                .from('pdf_infos')
                .update({ status: 'read' })
                .eq('id', currentPdfId);

            if (updateError) throw updateError;

            console.log("Factures insérées avec succès");
            onNextPdf();
        } catch (error) {
            console.error("Erreur lors de la soumission:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleResetSkipped = async () => {
        const result = await Swal.fire({
            title: 'Réinitialisation des PDFs passés',
            html: `
                <p>Êtes-vous sûr de vouloir réinitialiser tous les PDFs passés ?</p>
                <p style="color: #dc2626; font-size: 0.875rem; margin-top: 0.5rem;">
                    Cette action est irréversible.
                </p>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#22c55e',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Confirmer',
            cancelButtonText: 'Annuler',
            customClass: {
                popup: 'rounded-lg',
                confirmButton: 'rounded-lg',
                cancelButton: 'rounded-lg'
            }
        });

        if (!result.isConfirmed) return;

        if(session && session.user?.id){
            try {
                setLoading(true);
                const response = await fetch('/api/interface_admin_2/reset_skipped_pdf', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ user_id: session.user.id }),
                });
                
                if (!response.ok) throw new Error('Erreur lors de la réinitialisation');
                onNextPdf();
            } catch (error) {
                console.error('Erreur lors de la réinitialisation des PDFs skipped:', error);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSkip = async () => {
        const result = await Swal.fire({
            title: 'Passer ce PDF',
            html: 'Êtes-vous sûr de vouloir passer ce PDF ?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#22c55e',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Confirmer',
            cancelButtonText: 'Annuler',
            customClass: {
                popup: 'rounded-lg',
                confirmButton: 'rounded-lg',
                cancelButton: 'rounded-lg'
            }
        });

        if (!result.isConfirmed) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('pdf_infos')
                .update({ status: 'skipped' })
                .eq('id', currentPdfId);
            
            if (error) throw error;
            onNextPdf();
        } catch (error) {
            console.error("Erreur lors du skip:", error);
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
                    <SelectInput
                        label="Prestataire"
                        value={formData.header.prestataire_nom}
                        onChange={(value) => handleHeaderChange({ 
                            target: { 
                                name: 'prestataire_nom', 
                                value: value 
                            }
                        } as React.ChangeEvent<HTMLInputElement>)}
                        options={PRESTATAIRE}
                    />
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
                            {/* Header */}
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                <SelectInput
                                    label="Type de déchet"
                                    value={depart.line_header.type_dechet}
                                    onChange={(value) => handleDepartHeaderChange(index, 'type_dechet', value)}
                                    options={NOM_DECHET}
                                />
                                <SelectInput
                                    label="Code CED"
                                    value={depart.line_header.code_dechet}
                                    onChange={(value) => handleDepartHeaderChange(index, 'code_dechet', value)}
                                    options={CODE_CED}
                                />
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Date de collecte
                                    </label>
                                    <input
                                        type="date"
                                        value={depart.line_header.date_collecte}
                                        onChange={(e) => handleDepartHeaderChange(index, 'date_collecte', e.target.value)}
                                        className="w-full p-1 text-xs border rounded"
                                    />
                                </div>
                                <SelectInput
                                    label="Lieu de collecte"
                                    value={depart.line_header.lieu_collecte}
                                    onChange={(value) => handleDepartHeaderChange(index, 'lieu_collecte', value)}
                                    options={LIEU_COLLECTE}
                                />
                            </div>

                            {/* Body */}
                            <div className="space-y-2">
                                {/* Toutes les opérations dans une grille */}
                                <div className="grid grid-cols-2 gap-2">
                                    {depart.line_body.map((body, bodyIndex) => (
                                        <div key={bodyIndex} className="flex justify-between items-center">
                                            <div className="text-sm font-medium">{body.type_operation}</div>
                                            <input
                                                type="number"
                                                value={body.montant_ht || ''}
                                                onChange={(e) => handleDepartBodyChange(index, bodyIndex, 'montant_ht', e.target.value)}
                                                className="w-[60px] p-1 text-xs border rounded"
                                                onFocus={(e) => e.target.value === '0' && e.target.select()}
                                            />
                                        </div>
                                    ))}
                                </div>

                                {/* Champ de commentaires */}
                                <div className="mt-3">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Commentaires
                                    </label>
                                    <textarea
                                        value={depart.commentaire || ''}
                                        onChange={(e) => handleDepartCommentaireChange(index, e.target.value)}
                                        className="w-full p-2 text-xs border rounded"
                                        rows={2}
                                        placeholder="Ajoutez vos commentaires ici..."
                                    />
                                </div>
                            </div>

                            {/* Button to remove the depart line */}
                            <button
                                type="button"
                                onClick={() => removeDepartLine(index)}
                                className="mt-2 bg-red-500 text-white px-2 py-1 text-xs rounded hover:bg-red-600"
                            >
                                Supprimer la ligne
                            </button>
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

                {/* Boutons en bas */}
                <div className="flex justify-between items-center gap-2">
                    <button
                        type="button"
                        onClick={handleResetSkipped}
                        disabled={loading}
                        className="bg-blue-500 text-white px-3 py-1 text-xs rounded hover:bg-blue-600 disabled:bg-gray-400"
                    >
                        Réinitialiser les PDFs passés
                    </button>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleSkip}
                            disabled={loading}
                            className="bg-gray-500 text-white px-3 py-1 text-xs rounded hover:bg-gray-600 disabled:bg-gray-400"
                        >
                            {loading ? "Chargement..." : "Passer"}
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-green-500 text-white px-3 py-1 text-xs rounded hover:bg-green-600 disabled:bg-gray-400"
                        >
                            {loading ? "Chargement..." : "Suivant"}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}


const getMyOptions = async (user_id: string): Promise<(string | number)[][]> => {
    // prestataire_final, transporteur_final, lieu_collecte, nom_dechet, code_dechet
    const myOptions = ["formAPI.createFormInput.recipient.company.name", "formAPI.createFormInput.recipient.company.name", "formAPI.createFormInput.emitter.workSite", "formAPI.createFormInput.wasteDetails.name", "formAPI.createFormInput.wasteDetails.code"];
    return await getSelectOptions(myOptions, user_id);
};

const getSelectOptions = async (champ_options: string[], user_id:string) => {
    if(user_id!=null){
        const BSDs = await getAllBSDs(user_id);
        let liste_options = getUniqueListeOptions(BSDs, champ_options)
        liste_options = linearizeOptions(liste_options);
        liste_options = cleanOptions(liste_options);
        liste_options = addInconnuChamp(liste_options)
        return liste_options;
    }
    return [];
};

const getAllBSDs = async (user_id:string) => {
    const {data, error} = await supabase
        .from('bsd')
        .select('infos_json')
        .eq('user_id', user_id);
    if (error) return null
    return data;
};


const getUniqueListeOptions = (BSDs: { infos_json: DataOnSupabase_infos_json }[] | null, champ_options: string[]) => {
    if (BSDs == null) return [];
    const liste_options = champ_options.map(champ => {
        const values = BSDs.map(bsd => {
            return champ.split('.').reduce((obj: unknown, key: string) => {
                if (obj && typeof obj === 'object' && key in obj) {
                    return (obj as Record<string, unknown>)[key];
                }
                return undefined;
            }, bsd.infos_json as unknown);
        }).filter((value): value is string | number => 
            typeof value === 'string' || typeof value === 'number'
        );
        return Array.from(new Set(values));
    });
    return liste_options;
};

const linearizeOptions = (liste_options: (string | number | object | null | undefined)[][]) => {
    return liste_options.map(optionList => 
        optionList.map(option => {
            if (option === null || option === undefined) return "Non défini";
            if (typeof option === 'string' || typeof option === 'number') return option.toString();
            if (typeof option === 'object') {
                return Object.values(option).join(' - ');
            }
            return "Format inconnu";
        })
    );
};

const cleanOptions = (liste_options: (string | number)[][]) => {
    return liste_options.map(option => 
        option.filter(opt => 
            opt !== "Inconnu" && 
            opt !== undefined && 
            opt !== "undefined" && 
            opt !== "Non défini"
        )
    );
};

const addInconnuChamp = (liste_options: (string | number)[][]) => {
    return liste_options.map(option => [...option, "Inconnu"]);
};
