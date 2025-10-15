"use client";

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { useSession } from '@/app/component/SessionProvider';
import CreatableSelect from 'react-select/creatable';
import useSWR from 'swr';
import { REFERENCE_ENTITY_CLASS, ENTITY_CATEGORY_CLASS } from '../MetaClusterParams/fieldStyles';

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
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const session = useSession();
    const [selectedGroup, setSelectedGroup] = useState<OptionType | null>(null);
    
    // Nouveaux états pour la sélection multiple
    const [searchSiret, setSearchSiret] = useState('');
    const [selectedSirets, setSelectedSirets] = useState<Set<string>>(new Set());

    // Récupérer les groupes uniques
    const groupOptions: OptionType[] = Object.keys(mappings).map(group => ({
        label: group,
        value: group,
    }));

    useEffect(() => {
        fetchMappings();
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

    // Fonction pour récupérer tous les SIRET avec pagination
    const fetchAllSiretDetails = async (entrepriseId: string): Promise<SiretDetail[]> => {
        const allSiretDetails: SiretDetail[] = [];
        let from = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('bsd')
                .select('infos_json->formAPI->createFormInput->emitter')
                .eq('entreprise_id', entrepriseId)
                .range(from, from + limit - 1);

            if (error) throw error;

            if (data && data.length > 0) {
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

                allSiretDetails.push(...siretDetailsArray);
                from += limit;
                hasMore = data.length === limit;
            } else {
                hasMore = false;
            }
        }

        return allSiretDetails;
    };

    // Utilisation de SWR pour la mise en cache des données SIRET
    const { data: siretDetails = [], error: siretError, isLoading: siretLoading } = useSWR(
        session.entreprise_id ? `siret-details-${session.entreprise_id}` : null,
        () => fetchAllSiretDetails(session.entreprise_id!),
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            dedupingInterval: 10*60*1000, // 10 minutes
        }
    );

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

    // Obtenir tous les SIRET déjà associés
    const associatedSirets = useMemo(() => {
        const allAssociated = new Set<string>();
        Object.values(mappings).forEach(sirets => {
            sirets.forEach(siret => allAssociated.add(siret));
        });
        return allAssociated;
    }, [mappings]);

    // Filtrer les SIRET selon la recherche et exclure ceux déjà associés
    const availableSirets = useMemo(() => {
        return Object.entries(siretToNameMapping)
            .filter(([siret, name]) => {
                const matchesSearch = searchSiret === '' || 
                    siret.toLowerCase().includes(searchSiret.toLowerCase()) ||
                    name.toLowerCase().includes(searchSiret.toLowerCase());
                const notAssociated = !associatedSirets.has(siret);
                return matchesSearch && notAssociated;
            })
            .map(([siret, name]) => ({ siret, name }));
    }, [siretToNameMapping, searchSiret, associatedSirets]);

    // Gérer la sélection/désélection de tous les SIRET
    const handleSelectAllSirets = (checked: boolean) => {
        if (checked) {
            setSelectedSirets(new Set(availableSirets.map(item => item.siret)));
        } else {
            setSelectedSirets(new Set());
        }
    };

    // Gérer la sélection d'un SIRET individuel
    const handleSelectSiret = (siret: string, checked: boolean) => {
        const newSelected = new Set(selectedSirets);
        if (checked) {
            newSelected.add(siret);
        } else {
            newSelected.delete(siret);
        }
        setSelectedSirets(newSelected);
    };





    // Nouvelle fonction pour ajouter plusieurs SIRET en masse
    const handleAddMultipleSirets = async () => {
        if (!selectedGroup || selectedSirets.size === 0) return;

        try {
            const updatedMappings = { ...mappings };
            
            if (!updatedMappings[selectedGroup.value]) {
                updatedMappings[selectedGroup.value] = [];
            }
            
            // Ajouter tous les SIRET sélectionnés
            const newSirets = Array.from(selectedSirets);
            updatedMappings[selectedGroup.value] = [
                ...updatedMappings[selectedGroup.value],
                ...newSirets
            ];

            const { error } = await supabase
                .from('entreprise')
                .update({ mapping_site: updatedMappings })
                .eq('id', session.entreprise_id);

            if (error) throw error;
            
            setMappings(updatedMappings);
            setSelectedSirets(new Set());
            setSelectedGroup(null);
            setSearchSiret('');
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

    if (isLoading || siretLoading) return <div>Chargement...</div>;
    if (error || siretError) return <div className="text-red-500">{error || 'Erreur lors du chargement des données SIRET'}</div>;

    return (
        <div className="w-full">
                {/* Légende: Entité de référence -> Catégorie */}
                <div className="mb-4 px-10 hidden">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span className={REFERENCE_ENTITY_CLASS}>Entité de référence</span>
                        <span>→</span>
                        <span className={ENTITY_CATEGORY_CLASS}>Catégorie</span>
                    </div>
                </div>
                
                {/* Section de sélection multiple */}
                <div className="mb-8 px-10">
                    
                    <div className="grid grid-cols-2 gap-6">
                        {/* Colonne gauche - Sélection des SIRET */}
                        <div className="space-y-4">
                            {/* Titre retiré - géré par le toggle parent */}
                            
                            {/* Barre de recherche */}
                            <input
                                type="text"
                                placeholder="Rechercher dans les sites..."
                                value={searchSiret}
                                onChange={(e) => setSearchSiret(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />

                            {/* Checkbox "Sélectionner tout" */}
                            {availableSirets.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedSirets.size === availableSirets.length}
                                        onChange={(e) => handleSelectAllSirets(e.target.checked)}
                                        className="form-checkbox h-4 w-4 text-blue-600"
                                    />
                                    <label className="text-sm text-gray-700">
                                        Sélectionner tout ({availableSirets.length})
                                    </label>
                                </div>
                            )}

                            {/* Liste des SIRET disponibles */}
                            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md">
                                {availableSirets.length === 0 ? (
                                    <div className="p-4 text-gray-500 text-center">
                                        {searchSiret ? 'Aucun site trouvé' : 'Aucun site disponible'}
                                    </div>
                                ) : (
                                    <div className="space-y-1 p-2">
                                        {availableSirets.map(({ siret, name }) => (
                                            <div key={siret} className="flex items-center gap-1 p-1 hover:bg-gray-50 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedSirets.has(siret)}
                                                    onChange={(e) => handleSelectSiret(siret, e.target.checked)}
                                                    className="form-checkbox h-4 w-4 text-blue-600"
                                                />
                                                <div className="flex-1">
                                                    <div className={`${REFERENCE_ENTITY_CLASS}`}>
                                                        {name} <span className="font-normal text-xs">({siret})</span>
                                                    </div>                                                    
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Colonne droite - Sélection du groupe et action */}
                        <div className="space-y-4">
                            {/* Titre retiré - géré par le toggle parent */}
                            
                            <CreatableSelect
                                isClearable
                                value={selectedGroup}
                                onChange={(newValue) => setSelectedGroup(newValue)}
                                options={groupOptions}
                                placeholder="Sélectionner ou créer un groupe"
                                className="flex-1"
                                classNamePrefix="select"
                                formatCreateLabel={(inputValue) => `Créer "${inputValue}"`}
                                noOptionsMessage={() => "Aucun groupe trouvé"}
                            />
                            
                            <div className="flex justify-end">
                                <button
                                    onClick={handleAddMultipleSirets}
                                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                                    disabled={!selectedGroup || selectedSirets.size === 0}
                                >
                                    Ajouter {selectedSirets.size} site(s){selectedGroup ? ` à "${selectedGroup.label}"` : ''}
                                </button>
                            </div>

                            {/* Regroupements affichés dans la colonne de droite */}
                            <div className="space-y-3">
                                {Object.entries(mappings)
                                    .filter(([group]) => !selectedGroup || group === selectedGroup.value)
                                    .map(([group, sirets]) => (
                                    <div key={group} className="border rounded-lg p-4">
                                        <div className="flex">
                                            <h3 className="text-lg font-semibold text-gray-800 w-48 shrink-0">
                                                <span className={ENTITY_CATEGORY_CLASS}>{group}</span>
                                            </h3>
                                            <div className="flex-1">
                                                <div className="flex flex-wrap gap-2 -ml-2">
                                                    {sirets.map((siret) => (
                                                        <div key={siret} className="flex flex-col bg-gray-100 rounded-lg px-3 py-1">
                                                            <div className="flex items-center">
                                                                <span className={`${REFERENCE_ENTITY_CLASS} mr-2`}>{siretToNameMapping[siret] || ''} <span className="font-normal text-xs">({siret})</span></span>
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
                </div>
                
        </div>
    );
} 