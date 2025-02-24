"use client";

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { useSession } from '@/app/component/SessionProvider';
import CreatableSelect from 'react-select/creatable';

interface MappingCedFiliere {
    ced: string;
    filiere: string;
}

interface OptionType {
    label: string;
    value: string;
}

interface WasteDetail {
    code: string;
    name: string;
}

// Fonction utilitaire pour nettoyer et formater les codes CED
const cleanCedCode = (code: string) => code.replace(/[^\d]/g,'');
const formatCedCode = (code: string) => {
    const cleaned = cleanCedCode(code);
    return cleaned.replace(/(\d{2})(\d{2})(\d{2})/, '$1 $2 $3');
};

export default function FiliereTab() {
    const [mappings, setMappings] = useState<MappingCedFiliere[]>([]);
    const [wasteDetails, setWasteDetails] = useState<WasteDetail[]>([]);
    const [newCed, setNewCed] = useState('');
    const [newFiliere, setNewFiliere] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const session = useSession();
    const [selectedFiliere, setSelectedFiliere] = useState<OptionType | null>(null);
    const [selectedCed, setSelectedCed] = useState<OptionType | null>(null);

    // Récupérer les filières uniques
    const uniqueFilieres = Array.from(new Set(mappings.map(m => m.filiere))).sort();

    // Convertir les filières uniques en options pour react-select
    const filiereOptions: OptionType[] = uniqueFilieres.map(filiere => ({
        label: filiere,
        value: filiere,
    }));

    useEffect(() => {
        fetchMappings();
        fetchWasteDetails();
    }, []);

    const fetchMappings = async () => {
        try {
            if (!session.entreprise_id) {
                throw new Error('ID de l\'entreprise non trouvé');
            }
            const { data, error } = await supabase
                .from('entreprise')
                .select('mapping_ced_filiere')
                .eq('id', session.entreprise_id)
                .single();

            if (error) throw error;
            if (data?.mapping_ced_filiere) {
                setMappings(data.mapping_ced_filiere);
            }
        } catch (err) {
            setError('Erreur lors du chargement des données');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchWasteDetails = async () => {
        try {
            if (!session.entreprise_id) {
                throw new Error('ID de l\'entreprise non trouvé');
            }
            const { data, error } = await supabase
                .from('bsd')
                .select('infos_json->formAPI->createFormInput->wasteDetails')
                .eq('entreprise_id', session.entreprise_id);

            if (error) throw error;
            if (data) {
                const wasteDetailsArray = data
                    .map(item => item.wasteDetails as { code: string, name: string })
                    .filter(detail => detail?.code && detail?.name);

                setWasteDetails(wasteDetailsArray);
            }
        } catch (err) {
            console.error('Erreur lors du chargement des waste details:', err);
        }
    };

    // Créer un mapping CED -> nom prépondérant
    const cedToNameMapping = useMemo(() => {
        return Array.from(new Set(wasteDetails.map(w => cleanCedCode(w.code)))).reduce((acc, code) => {
            const names = wasteDetails
                .filter(detail => cleanCedCode(detail.code) === code)
                .map(detail => detail.name);
            
            if (names.length === 0) {
                acc[code] = '';
                return acc;
            }
            
            const nameCount = names.reduce((acc2, name) => {
                acc2[name] = (acc2[name] || 0) + 1;
                return acc2;
            }, {} as Record<string, number>);
            
            acc[code] = Object.entries(nameCount)
                .sort((a, b) => b[1] - a[1])[0][0];
            
            return acc;
        }, {} as Record<string, string>);
    }, [wasteDetails]);

    console.log('cedToNameMapping', cedToNameMapping);

    // Options pour le CreatableSelect
    const cedOptions: OptionType[] = useMemo(() => {
        return Object.entries(cedToNameMapping).map(([code, name]) => ({
            label: `${formatCedCode(code)} - ${name}`,
            value: code,
        }));
    }, [cedToNameMapping]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFiliere || !selectedCed) return;
        
        // On ne garde que le code CED sans le nom
        const cleanedCed = selectedCed.value;
        const updatedMappings = [...mappings, { ced: cleanedCed, filiere: selectedFiliere.value }];
        
        try {
            const { error } = await supabase
                .from('entreprise')
                .update({ mapping_ced_filiere: updatedMappings })
                .eq('id', session.entreprise_id);

            if (error) throw error;
            
            setMappings(updatedMappings);
            setSelectedCed(null);
            setSelectedFiliere(null);
        } catch (err) {
            setError('Erreur lors de la mise à jour');
            console.error(err);
        }
    };

    const handleDelete = async (cedToDelete: string) => {
        const updatedMappings = mappings.filter(m => m.ced !== cedToDelete);
        
        try {
            const { error } = await supabase
                .from('entreprise')
                .update({ mapping_ced_filiere: updatedMappings })
                .eq('id', session.entreprise_id);

            if (error) throw error;
            
            setMappings(updatedMappings);
        } catch (err) {
            setError('Erreur lors de la suppression');
            console.error(err);
        }
    };

    // Fonction pour grouper les mappings par filière
    const groupedMappings = uniqueFilieres.reduce((acc, filiere) => {
        acc[filiere] = mappings.filter(m => m.filiere === filiere).map(m => m.ced);
        return acc;
    }, {} as Record<string, string[]>);

    if (isLoading) return <div>Chargement...</div>;
    if (error) return <div className="text-red-500">{error}</div>;

    return (
    <div className="flex justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 w-[80%]">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Paramètres de filière</h2>
            
            {/* Formulaire d'ajout */}
            <form onSubmit={handleSubmit} className="mb-6 space-y-4 px-10">
                <div className="flex gap-4">
                    <div className="flex-1">
                        <CreatableSelect
                            isClearable
                            value={selectedFiliere}
                            onChange={(newValue) => setSelectedFiliere(newValue)}
                            options={filiereOptions}
                            placeholder="Sélectionner/créer une filière"
                            className="flex-1"
                            classNamePrefix="select"
                            formatCreateLabel={(inputValue) => `Créer "${inputValue}"`}
                            noOptionsMessage={() => "Aucune filière trouvée"}
                        />
                    </div>
                    <div className="flex-1">
                        <CreatableSelect
                            isClearable
                            value={selectedCed}
                            onChange={(newValue) => setSelectedCed(newValue)}
                            options={cedOptions}
                            placeholder="Sélectionner/créer un CED"
                            className="flex-1"
                            classNamePrefix="select"
                            formatCreateLabel={(inputValue) => `Créer "${inputValue}"`}
                            noOptionsMessage={() => "Aucun code CED trouvé"}
                        />
                    </div>
                    <button
                        type="submit"
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        disabled={!selectedFiliere || !selectedCed}
                    >
                        Ajouter
                    </button>
                </div>
            </form>

            {/* Liste groupée par filière */}
            <div className="space-y-3 px-10">
                {Object.entries(groupedMappings).map(([filiere, codes]) => (
                    <div key={filiere} className="border rounded-lg p-4">
                        <div className="flex">
                            <h3 className="text-lg font-semibold text-gray-800 w-48 shrink-0">
                                {filiere}
                            </h3>
                            <div className="flex-1">
                                <div className="flex flex-wrap gap-2 -ml-2">
                                    {codes.map((code) => (
                                        <div key={code} className="flex flex-col bg-gray-100 rounded-lg px-3 py-1">
                                            <div className="flex items-center">
                                                <span className="font-medium mr-2">{code}</span>
                                                <button
                                                    onClick={() => handleDelete(code)}
                                                    className="text-red-500 hover:text-red-700"
                                                    title="Supprimer"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </div>
                                            <span className="text-xs text-gray-500">
                                                {cedToNameMapping[code] || 'Nom inconnu'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
    );
} 