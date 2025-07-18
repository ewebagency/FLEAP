"use client";

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { useSession } from '@/app/component/SessionProvider';
import CreatableSelect from 'react-select/creatable';
import Select from 'react-select';
import { MultiValue } from 'react-select';
import { useSWRConfig } from 'swr';

interface MappingNomFiliere {
    nom: string;
    filiere: string;
    trie: boolean;
}

interface OptionType {
    label: string;
    value: string;
}

export default function FiliereNomTab() {
    const [mappings, setMappings] = useState<MappingNomFiliere[]>([]);
    const [wasteNames, setWasteNames] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const session = useSession();
    const [selectedFiliere, setSelectedFiliere] = useState<OptionType | null>(null);
    const [selectedNoms, setSelectedNoms] = useState<OptionType[]>([]);
    const [isTrie, setIsTrie] = useState<boolean>(true);
    const { mutate } = useSWRConfig();

    // Récupérer les filières uniques
    const uniqueFilieres = Array.from(new Set(mappings.map(m => m.filiere))).sort();

    // Convertir les filières uniques en options pour react-select
    const filiereOptions: OptionType[] = uniqueFilieres.map(filiere => ({
        label: filiere,
        value: filiere,
    }));

    // Filtrer les noms de déchets pour ne montrer que ceux qui ne sont pas encore utilisés
    const usedWasteNames = new Set(mappings.map(m => m.nom));
    const availableWasteNames = wasteNames.filter(nom => !usedWasteNames.has(nom));
    
    // Convertir les noms de déchets disponibles en options pour react-select
    const nomOptions: OptionType[] = availableWasteNames.map(nom => ({
        label: nom,
        value: nom,
    }));

    useEffect(() => {
        fetchMappings();
        fetchWasteNames();
    }, []);

    const fetchMappings = async () => {
        try {
            if (!session.entreprise_id) {
                throw new Error('ID de l\'entreprise non trouvé');
            }
            const { data, error } = await supabase
                .from('entreprise')
                .select('mapping_nom_filiere')
                .eq('id', session.entreprise_id)
                .single();

            if (error) throw error;
            if (data?.mapping_nom_filiere) {
                setMappings(data.mapping_nom_filiere);
            }
        } catch (err) {
            setError('Erreur lors du chargement des données');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchWasteNames = async () => {
        try {
            if (!session.entreprise_id) {
                throw new Error('ID de l\'entreprise non trouvé');
            }

            const allWasteNames: string[] = [];
            let from = 0;
            const limit = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('bsd')
                    .select('infos_json->formAPI->createFormInput->wasteDetails')
                    .eq('entreprise_id', session.entreprise_id)
                    .range(from, from + limit - 1);

                if (error) throw error;

                if (data && data.length > 0) {
                    const names = data
                        .map(item => item.wasteDetails as { code: string, name: string }[])
                        .flat()
                        .filter(detail => detail?.name)
                        .map(detail => detail.name.trim())
                        .filter(name => name.length > 0);

                    allWasteNames.push(...names);
                    from += limit;
                    hasMore = data.length === limit;
                } else {
                    hasMore = false;
                }
            }

            // Dédupliquer et trier les noms
            const uniqueNames = Array.from(new Set(allWasteNames)).sort();
            setWasteNames(uniqueNames);
        } catch (err) {
            console.error('Erreur lors du chargement des noms de déchets:', err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFiliere || selectedNoms.length === 0) return;
        
        // Vérifier si un des noms est déjà utilisé dans une autre filière
        const existingMappings = selectedNoms.filter(selectedNom => 
            mappings.find(m => m.nom === selectedNom.value)
        );
        
        if (existingMappings.length > 0) {
            const existingNames = existingMappings.map(m => m.value).join(', ');
            setError(`Les noms suivants sont déjà utilisés : ${existingNames}`);
            return;
        }
        
        // Créer les nouveaux mappings pour tous les noms sélectionnés
        const newMappings = selectedNoms.map(selectedNom => ({
            nom: selectedNom.value,
            filiere: selectedFiliere.value,
            trie: isTrie
        }));
        
        const updatedMappings = [...mappings, ...newMappings];
        
        try {
            const { error } = await supabase
                .from('entreprise')
                .update({ mapping_nom_filiere: updatedMappings })
                .eq('id', session.entreprise_id);

            if (error) throw error;
            
            setMappings(updatedMappings);
            setSelectedNoms([]);
            setSelectedFiliere(null);
            setIsTrie(true);
            setError(null); // Effacer les erreurs précédentes
            // Invalider le cache SWR du mapping_nom_filiere
            if (session.entreprise_id) {
                // Vider le cache côté serveur
                await fetch(`/api/get_mapping_nom_filiere?entreprise_id=${session.entreprise_id}&clearCache=true`);
                // Invalider le cache SWR
                mutate(`/api/get_mapping_nom_filiere?entreprise_id=${session.entreprise_id}`, undefined, { revalidate: true });
            }
        } catch (err) {
            setError('Erreur lors de la mise à jour');
            console.error(err);
        }
    };

    const handleDelete = async (nomToDelete: string) => {
        const updatedMappings = mappings.filter(m => m.nom !== nomToDelete);
        
        try {
            const { error } = await supabase
                .from('entreprise')
                .update({ mapping_nom_filiere: updatedMappings })
                .eq('id', session.entreprise_id);

            if (error) throw error;
            
            setMappings(updatedMappings);
            // Invalider le cache SWR du mapping_nom_filiere
            if (session.entreprise_id) {
                // Vider le cache côté serveur
                await fetch(`/api/get_mapping_nom_filiere?entreprise_id=${session.entreprise_id}&clearCache=true`);
                // Invalider le cache SWR
                mutate(`/api/get_mapping_nom_filiere?entreprise_id=${session.entreprise_id}`, undefined, { revalidate: true });
            }
        } catch (err) {
            setError('Erreur lors de la suppression');
            console.error(err);
        }
    };

    // Fonction pour grouper les mappings par filière
    const groupedMappings = uniqueFilieres.reduce((acc, filiere) => {
        acc[filiere] = mappings.filter(m => m.filiere === filiere);
        return acc;
    }, {} as Record<string, MappingNomFiliere[]>);

    if (isLoading) return <div>Chargement...</div>;
    if (error) return <div className="text-red-500">{error}</div>;

    return (
        <div className="flex justify-center">
            <div className="bg-white rounded-lg shadow-lg p-8 w-[80%]">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Paramètres de filière par nom</h2>
                <p className="text-gray-600 mb-6 px-10">
                    Un nom de déchet ne peut être utilisé que dans une seule filière. Vous pouvez sélectionner plusieurs noms de déchets en même temps pour les assigner à une filière. Seuls les noms de déchets non encore utilisés sont affichés dans la liste.
                </p>
                
                {/* Formulaire d'ajout */}
                <form onSubmit={handleSubmit} className="mb-6 space-y-4 px-10">
                    <div className="flex gap-4 items-center">
                        <div className="flex-1">
                            <CreatableSelect
                                isClearable
                                value={selectedFiliere}
                                onChange={(newValue) => setSelectedFiliere(newValue)}
                                options={filiereOptions}
                                placeholder="Sélectionner/créer une filière"
                                className="flex-1"
                                classNamePrefix="select"
                                formatCreateLabel={(inputValue) => `Créer \"${inputValue}\"`}
                                noOptionsMessage={() => "Aucune filière trouvée"}
                            />
                        </div>
                        <div className="flex-1">
                            <Select
                                isMulti
                                isClearable
                                value={selectedNoms}
                                onChange={(newValue: MultiValue<OptionType>) => setSelectedNoms(Array.from(newValue))}
                                options={nomOptions}
                                placeholder="Sélectionner des noms de déchets"
                                className="flex-1"
                                classNamePrefix="select"
                                noOptionsMessage={() => "Aucun nom de déchet disponible"}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="isTrie"
                                checked={isTrie}
                                onChange={e => setIsTrie(e.target.checked)}
                                className="form-checkbox h-5 w-5 text-green-600"
                            />
                            <label htmlFor="isTrie" className="text-sm text-gray-700 select-none">
                                Trié ?
                            </label>
                        </div>
                        <button
                            type="submit"
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                            disabled={!selectedFiliere || selectedNoms.length === 0}
                        >
                            Ajouter ({selectedNoms.length})
                        </button>
                    </div>
                </form>

                {/* Liste groupée par filière */}
                <div className="space-y-3 px-10">
                    {Object.entries(groupedMappings).map(([filiere, noms]) => (
                        <div key={filiere} className="border rounded-lg p-4">
                            <div className="flex">
                                <h3 className="text-lg font-semibold text-gray-800 w-48 shrink-0">
                                    {filiere}
                                </h3>
                                <div className="flex-1">
                                    <div className="flex flex-wrap gap-2 -ml-2">
                                        {noms.map((mapping) => (
                                            <div key={mapping.nom} className="flex flex-col bg-gray-100 rounded-lg px-3 py-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium mr-2">{mapping.nom}</span>
                                                    <span className={`text-xs px-2 py-0.5 rounded ${mapping.trie ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>{mapping.trie ? 'Trié' : 'Non trié'}</span>
                                                    <button
                                                        onClick={() => handleDelete(mapping.nom)}
                                                        className="text-red-500 hover:text-red-700"
                                                        title="Supprimer"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                        </svg>
                                                    </button>
                                                </div>
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