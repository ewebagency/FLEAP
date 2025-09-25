"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { useSession } from '@/app/component/SessionProvider';
import CreatableSelect from 'react-select/creatable';
import Select from 'react-select';
import { MultiValue } from 'react-select';
import { useSWRConfig } from 'swr';

interface MappingNomFiliere {
    nom: string;
    filiere: string;
    trie?: boolean; // legacy read-only
    multiflux?: boolean;
    tri?: boolean;
}

interface OptionType {
    label: string;
    value: string;
}

export default function FiliereNomTab() {
    const [mappings, setMappings] = useState<MappingNomFiliere[]>([]);
    const [wasteNames, setWasteNames] = useState<string[]>([]);
    const [factureNamesSet, setFactureNamesSet] = useState<Set<string>>(new Set());
    const [factureNameToFirstId, setFactureNameToFirstId] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const session = useSession();
    const [selectedFiliere, setSelectedFiliere] = useState<OptionType | null>(null);
    const [selectedNoms, setSelectedNoms] = useState<OptionType[]>([]);
    // Mapping mode UX: single choice defines multiflux and tri flags
    // 'mono' => multiflux=false; 'multi_tri' => multiflux=true, tri=true; 'multi_non_tri' => multiflux=true, tri=false
    const [mappingMode, setMappingMode] = useState<'mono' | 'multi_tri' | 'multi_non_tri'>('mono');
    const { mutate } = useSWRConfig();
    const [searchNom, setSearchNom] = useState<string>('');

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
    
    // Filtrer sur la recherche texte
    const filteredAvailableWasteNames = useMemo(() => {
        if (!searchNom) return availableWasteNames;
        const lower = searchNom.toLowerCase();
        return availableWasteNames.filter(n => n.toLowerCase().includes(lower));
    }, [availableWasteNames, searchNom]);

    // Convertir les noms de déchets disponibles (filtrés) en options pour react-select
    const nomOptions: OptionType[] = filteredAvailableWasteNames.map(nom => ({
        label: factureNamesSet.has(nom) ? `${nom} (facture ${factureNameToFirstId[nom] ?? ''})` : nom,
        value: nom,
    }));

    const handleSelectAllNoms = (checked: boolean) => {
        if (checked) {
            setSelectedNoms(nomOptions);
        } else {
            setSelectedNoms([]);
        }
    };

    

    const fetchMappings = useCallback(async () => {
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
    }, [session.entreprise_id]);

    const fetchWasteNames = useCallback(async () => {
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

            // Ajouter aussi les noms provenant des factures (type_dechet uniquement)
            let f_from = 0;
            const f_limit = 1000;
            let f_hasMore = true;

            const firstIdByName: Record<string, string> = {};
            while (f_hasMore) {
                const { data: f_data, error: f_error } = await supabase
                    .from('facture')
                    .select('id, infos_json')
                    .eq('entreprise_id', session.entreprise_id)
                    .range(f_from, f_from + f_limit - 1);

                if (f_error) throw f_error;

                if (f_data && f_data.length > 0) {
                    type FactureHeader = { type_dechet?: string };
                    type FactureDepart = { line_header?: FactureHeader };
                    type FactureRow = { id: string; infos_json?: { departs?: FactureDepart[] } };

                    const fRows = f_data as unknown as FactureRow[];
                    const factureNames: string[] = [];
                    fRows.forEach(row => {
                        const namesInRow = (row.infos_json?.departs ?? [])
                            .map(depart => depart?.line_header)
                            .filter((header): header is FactureHeader => !!header)
                            .flatMap(header => [header.type_dechet])
                            .filter((v): v is string => typeof v === 'string')
                            .map(v => v.trim())
                            .filter(v => v.length > 0);
                        namesInRow.forEach(n => {
                            factureNames.push(n);
                            if (!(n in firstIdByName)) {
                                firstIdByName[n] = row.id;
                            }
                        });
                    });

                    allWasteNames.push(...factureNames);
                    // Mémoriser les noms provenant des factures pour affichage du flag
                    setFactureNamesSet(prev => {
                        const next = new Set(prev);
                        factureNames.forEach(n => next.add(n));
                        return next;
                    });
                    f_from += f_limit;
                    f_hasMore = f_data.length === f_limit;
                } else {
                    f_hasMore = false;
                }
            }

            // Dédupliquer et trier les noms
            const uniqueNames = Array.from(new Set(allWasteNames)).sort();
            setWasteNames(uniqueNames);
            setFactureNameToFirstId(firstIdByName);
        } catch (err) {
            console.error('Erreur lors du chargement des noms de déchets:', err);
        }
    }, [session.entreprise_id]);

    useEffect(() => {
        fetchMappings();
        fetchWasteNames();
    }, [fetchMappings, fetchWasteNames]);

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
        const flags = (() => {
            if (mappingMode === 'mono') return { multiflux: false, tri: true };
            if (mappingMode === 'multi_tri') return { multiflux: true, tri: true };
            return { multiflux: true, tri: false };
        })();

        const newMappings = selectedNoms.map(selectedNom => ({
            nom: selectedNom.value,
            filiere: selectedFiliere.value,
            tri: flags.tri,
            multiflux: flags.multiflux,
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
            setMappingMode('mono');
            // no-op
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

    const handleDeleteFiliere = async (filiereToDelete: string) => {
        const updatedMappings = mappings.filter(m => m.filiere !== filiereToDelete);
        try {
            const { error } = await supabase
                .from('entreprise')
                .update({ mapping_nom_filiere: updatedMappings })
                .eq('id', session.entreprise_id);

            if (error) throw error;

            setMappings(updatedMappings);
            if (session.entreprise_id) {
                await fetch(`/api/get_mapping_nom_filiere?entreprise_id=${session.entreprise_id}&clearCache=true`);
                mutate(`/api/get_mapping_nom_filiere?entreprise_id=${session.entreprise_id}`, undefined, { revalidate: true });
            }
        } catch (err) {
            setError('Erreur lors de la suppression de la filière');
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
                        <div className="w-1/3">
                            <CreatableSelect
                                isClearable
                                value={selectedFiliere}
                                onChange={(newValue) => setSelectedFiliere(newValue)}
                                options={filiereOptions}
                                placeholder="Sélectionner une filière"
                                className="flex-1"
                                classNamePrefix="select"
                                formatCreateLabel={(inputValue) => `Créer \"${inputValue}\"`}
                                noOptionsMessage={() => "Aucune filière trouvée"}
                            />
                        </div>
                        <div className="w-2/3">
                            <div className="flex items-center gap-2">
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
                                        inputValue={searchNom}
                                        onInputChange={(val, meta) => {
                                            if (meta.action === 'input-change') {
                                                setSearchNom(val);
                                            }
                                        }}
                                        styles={{
                                            valueContainer: (base) => ({
                                                ...base,
                                                maxHeight: 128,
                                                overflowY: 'auto',
                                            }),
                                            menuList: (base) => ({
                                                ...base,
                                                maxHeight: 240,
                                            }),
                                        }}
                                        noOptionsMessage={() => "Aucun nom de déchet disponible"}
                                    />
                                </div>
                                <div className="flex-6">
                                    <button
                                        type="button"
                                        onClick={() => handleSelectAllNoms(true)}
                                        disabled={nomOptions.length === 0}
                                        className="text-xs shrink-0 bg-gray-100 text-gray-800 px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-50"
                                        title={nomOptions.length ? `Sélectionner tout (${nomOptions.length})` : 'Aucun élément'}
                                    >
                                        Sélectionner tout
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSelectAllNoms(false)}
                                        disabled={selectedNoms.length === 0}
                                        className="hidden shrink-0 bg-gray-100 text-gray-800 px-3 py-2 rounded hover:bg-gray-200 disabled:opacity-50"
                                        title={selectedNoms.length ? 'Effacer la sélection' : 'Rien à effacer'}
                                    >
                                        X
                                    </button>
                                    <div className="shrink-0 text-sm text-gray-600 ml-1">
                                        {nomOptions.length} filtrés
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="inline-flex rounded border border-gray-300 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => { setMappingMode('mono'); }}
                                    className={`px-3 py-2 text-sm ${mappingMode==='mono' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}
                                    title="Monoflux (tri sur site)"
                                >
                                    Monoflux
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setMappingMode('multi_tri'); }}
                                    className={`px-3 py-2 text-sm border-l border-gray-300 ${mappingMode==='multi_tri' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}
                                    title="Multiflux trié (prestataire)"
                                >
                                    Multiflux trié
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setMappingMode('multi_non_tri'); }}
                                    className={`px-3 py-2 text-sm border-l border-gray-300 ${mappingMode==='multi_non_tri' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}
                                    title="Multiflux non trié"
                                >
                                    Multiflux non trié
                                </button>
                            </div>
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
                                <div className="flex items-center gap-3 w-48 shrink-0">
                                    <h3 className="text-lg font-semibold text-gray-800">
                                        {filiere}
                                    </h3>
                                    <button
                                        onClick={() => handleDeleteFiliere(filiere)}
                                        className="text-red-500 hover:text-red-700"
                                        title="Supprimer tous les noms de cette filière"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 100 2h.278l.84 9.243A2 2 0 007.11 17h5.78a2 2 0 001.992-1.757L15.722 6H16a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0010 2H9zM8 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="flex-1">
                                    <div className="flex flex-wrap gap-2 -ml-2">
                                        {noms.map((mapping) => (
                                            <div key={mapping.nom} className="flex flex-col bg-gray-100 rounded-lg px-3 py-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium mr-2">{mapping.nom}</span>
                                                    <span className={`text-xs px-2 py-0.5 rounded ${mapping.tri ?? mapping.trie ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>{(mapping.tri ?? mapping.trie) ? 'Trié' : 'Non trié'}</span>
                                                    {(() => {
                                                        const mf = mapping.multiflux;
                                                        const tr = mapping.tri ?? mapping.trie;
                                                        const chips: { key: string; label: string; style: string }[] = [];
                                                        if (mf === true && tr === true) chips.push({ key: 'mf-true', label: 'multiflux + trié (prestataire)', style: 'bg-green-100 text-green-700 border-green-200' });
                                                        else if (mf === true && tr === false) chips.push({ key: 'mf-false', label: 'multiflux + non trié', style: 'bg-yellow-100 text-yellow-700 border-yellow-200' });
                                                        else if (mf === false) chips.push({ key: 'mf-mono', label: 'monoflux', style: 'bg-gray-100 text-gray-700 border-gray-200' });
                                                        if (chips.length === 0) return null;
                                                        return (
                                                            <div className="mt-1 flex gap-2 text-xs flex-wrap">
                                                                {chips.map(c => (
                                                                    <span key={c.key} className={`px-2 py-0.5 rounded border ${c.style}`}>{c.label}</span>
                                                                ))}
                                                            </div>
                                                        );
                                                    })()}
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