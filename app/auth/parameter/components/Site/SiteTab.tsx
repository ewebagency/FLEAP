"use client";

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { useSession } from '@/app/component/SessionProvider';
import CreatableSelect from 'react-select/creatable';

interface MappingSite {
    [key: string]: string[];
}

interface OptionType {
    label: string;
    value: string;
}

interface SiretDetail {
    siret: string;
    name: string;
}

export default function SiteTab() {
    const [mappings, setMappings] = useState<MappingSite>({});
    const [newSiret, setNewSiret] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const session = useSession();
    const [selectedGroup, setSelectedGroup] = useState<OptionType | null>(null);
    const [siretDetails, setSiretDetails] = useState<SiretDetail[]>([]);

    // Récupérer les groupes uniques
    const groupOptions: OptionType[] = Object.keys(mappings).map(group => ({
        label: group,
        value: group,
    }));

    useEffect(() => {
        fetchMappings();
        fetchSiretDetails();
    }, []);

    const fetchMappings = async () => {
        try {
            if (!session.entreprise_id) {
                throw new Error('ID de l\'entreprise non trouvé');
            }
            const { data, error } = await supabase
                .from('entreprise')
                .select('mapping_site')
                .eq('id', session.entreprise_id)
                .single();

            if (error) throw error;
            if (data?.mapping_site) {
                setMappings(data.mapping_site);
            }
        } catch (err) {
            setError('Erreur lors du chargement des données');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSiretDetails = async () => {
        try {
            if (!session.entreprise_id) {
                throw new Error('ID de l\'entreprise non trouvé');
            }
            const { data, error } = await supabase
                .from('bsd')
                .select('infos_json->formAPI->createFormInput->emitter')
                .eq('entreprise_id', session.entreprise_id);

            if (error) throw error;
            if (data) {
                const siretDetailsArray = data
                    .map(item => {
                        const emitter = item.emitter as { 
                            company: { siret: string, name: string } 
                        };
                        return emitter?.company ? {
                            siret: emitter.company.siret,
                            name: emitter.company.name
                        } : null;
                    })
                    .filter((detail): detail is SiretDetail => detail !== null);

                setSiretDetails(siretDetailsArray);
            }
        } catch (err) {
            console.error('Erreur lors du chargement des détails SIRET:', err);
        }
    };

    // Créer un mapping SIRET -> nom prépondérant
    const siretToNameMapping = useMemo(() => {
        return Array.from(new Set(siretDetails.map(s => s.siret))).reduce((acc, siret) => {
            const names = siretDetails
                .filter(detail => detail.siret === siret)
                .map(detail => detail.name);
            
            if (names.length === 0) {
                acc[siret] = '';
                return acc;
            }
            
            const nameCount = names.reduce((acc2, name) => {
                acc2[name] = (acc2[name] || 0) + 1;
                return acc2;
            }, {} as Record<string, number>);
            
            acc[siret] = Object.entries(nameCount)
                .sort((a, b) => b[1] - a[1])[0][0];
            
            return acc;
        }, {} as Record<string, string>);
    }, [siretDetails]);

    // Options pour le CreatableSelect des SIRET
    const siretOptions: OptionType[] = useMemo(() => {
        return Object.entries(siretToNameMapping).map(([siret, name]) => ({
            label: `${siret} - ${name}`,
            value: siret,
        }));
    }, [siretToNameMapping]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGroup || !newSiret) return;

        const cleanedSiret = newSiret.replace(/\s/g, '');
        const updatedMappings = { ...mappings };
        
        if (!updatedMappings[selectedGroup.value]) {
            updatedMappings[selectedGroup.value] = [];
        }
        
        updatedMappings[selectedGroup.value].push(cleanedSiret);

        try {
            const { error } = await supabase
                .from('entreprise')
                .update({ mapping_site: updatedMappings })
                .eq('id', session.entreprise_id);

            if (error) throw error;
            
            setMappings(updatedMappings);
            setNewSiret('');
            setSelectedGroup(null);
        } catch (err) {
            setError('Erreur lors de la mise à jour');
            console.error(err);
        }
    };

    const handleDelete = async (group: string, siretToDelete: string) => {
        const updatedMappings = { ...mappings };
        updatedMappings[group] = updatedMappings[group].filter(siret => siret !== siretToDelete);
        
        // Si le groupe est vide, on le supprime
        if (updatedMappings[group].length === 0) {
            delete updatedMappings[group];
        }

        try {
            const { error } = await supabase
                .from('entreprise')
                .update({ mapping_site: updatedMappings })
                .eq('id', session.entreprise_id);

            if (error) throw error;
            
            setMappings(updatedMappings);
        } catch (err) {
            setError('Erreur lors de la suppression');
            console.error(err);
        }
    };

    if (isLoading) return <div>Chargement...</div>;
    if (error) return <div className="text-red-500">{error}</div>;

    return (
        <div className="flex justify-center">
            <div className="bg-white rounded-lg shadow-lg p-8 w-[80%]">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Paramètres de site</h2>
                
                {/* Formulaire d'ajout */}
                <form onSubmit={handleSubmit} className="mb-6 space-y-4 px-10">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <CreatableSelect
                                isClearable
                                value={selectedGroup}
                                onChange={(newValue) => setSelectedGroup(newValue)}
                                options={groupOptions}
                                placeholder="Sélectionner ou créer"
                                className="flex-1"
                                classNamePrefix="select"
                                formatCreateLabel={(inputValue) => `Créer "${inputValue}"`}
                                noOptionsMessage={() => "Aucun groupe trouvé"}
                            />
                        </div>
                        <div className="flex-1">
                            <CreatableSelect
                                isClearable
                                value={newSiret ? { label: `${newSiret} - ${siretToNameMapping[newSiret] || ''}`, value: newSiret } : null}
                                onChange={(newValue) => setNewSiret(newValue ? newValue.value : '')}
                                options={siretOptions}
                                placeholder="Sélectionner ou saisir un SIRET"
                                className="flex-1"
                                classNamePrefix="select"
                                formatCreateLabel={(inputValue) => `Ajouter le SIRET "${inputValue}"`}
                                noOptionsMessage={() => "Aucun SIRET trouvé"}
                            />
                        </div>
                        <button
                            type="submit"
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                            disabled={!selectedGroup || !newSiret}
                        >
                            Ajouter
                        </button>
                    </div>
                </form>

                {/* Liste groupée par type de site */}
                <div className="space-y-3 px-10">
                    {Object.entries(mappings).map(([group, sirets]) => (
                        <div key={group} className="border rounded-lg p-4">
                            <div className="flex">
                                <h3 className="text-lg font-semibold text-gray-800 w-48 shrink-0">
                                    {group}
                                </h3>
                                <div className="flex-1">
                                    <div className="flex flex-wrap gap-2 -ml-2">
                                        {sirets.map((siret) => (
                                            <div key={siret} className="flex flex-col bg-gray-100 rounded-lg px-3 py-1">
                                                <div className="flex items-center">
                                                    <span className="font-medium mr-2">{siret}</span>
                                                    <button
                                                        onClick={() => handleDelete(group, siret)}
                                                        className="text-red-500 hover:text-red-700"
                                                        title="Supprimer"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                        </svg>
                                                    </button>
                                                </div>
                                                <span className="text-xs text-gray-500">
                                                    {siretToNameMapping[siret] || 'Nom inconnu'}
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