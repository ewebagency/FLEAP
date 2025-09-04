"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { useSession } from '@/app/component/SessionProvider';
import CreatableSelect from 'react-select/creatable';

interface MappingCedFiliere {
    ced: string;
    filiere: string;
    multiflux?: boolean;
    tri?: boolean;
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
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const session = useSession();
    const [selectedFiliere, setSelectedFiliere] = useState<OptionType | null>(null);
    const [selectedCed, setSelectedCed] = useState<OptionType | null>(null);
    const [isMultiflux, setIsMultiflux] = useState<boolean>(false);
    const [isTri, setIsTri] = useState<boolean>(false);

    // Récupérer les filières uniques
    const uniqueFilieres = Array.from(new Set(mappings.map(m => m.filiere))).sort();

    // Convertir les filières uniques en options pour react-select
    const filiereOptions: OptionType[] = uniqueFilieres.map(filiere => ({
        label: filiere,
        value: filiere,
    }));

    const fetchMappings = useCallback(async () => {
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
    }, [session.entreprise_id]);

    const fetchWasteDetails = useCallback(async () => {
        try {
            if (!session.entreprise_id) {
                throw new Error('ID de l\'entreprise non trouvé');
            }

            const allWasteDetails: { code: string; name: string }[] = [];
            let hasMore = true;
            let lastId: string | null = null;

            while (hasMore) {
                let query = supabase
                    .from('bsd')
                    .select('id, infos_json->formAPI->createFormInput->wasteDetails')
                    .eq('entreprise_id', session.entreprise_id)
                    .order('id', { ascending: false })
                    .limit(1000);

                if (lastId) {
                    query = query.lt('id', lastId);
                }

                const { data, error } = await query;
                if (error) throw error;

                if (!data || data.length === 0) {
                    hasMore = false;
                    break;
                }

                const batch = (data as Array<{ id: string; wasteDetails: { code: string; name: string } | null }>)
                    .map((item) => item.wasteDetails as { code: string; name: string })
                    .filter((detail): detail is { code: string; name: string } => Boolean(detail?.code && detail?.name));

                allWasteDetails.push(...batch);
                lastId = data[data.length - 1].id as string;

                const { count } = await supabase
                    .from('bsd')
                    .select('*', { count: 'exact', head: true })
                    .eq('entreprise_id', session.entreprise_id)
                    .lt('id', lastId);

                hasMore = count ? count > 0 : false;
            }

            setWasteDetails(allWasteDetails);
        } catch (err) {
            console.error('Erreur lors du chargement des waste details:', err);
        }
    }, [session.entreprise_id]);

    useEffect(() => {
        fetchMappings();
        fetchWasteDetails();
    }, [fetchMappings, fetchWasteDetails]);

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

    // Options pour le CreatableSelect (exclure les CED déjà mappés)
    const cedOptions: OptionType[] = useMemo(() => {
        const mappedCeds = new Set(mappings.map(m => m.ced));
        return Object.entries(cedToNameMapping)
            .filter(([code]) => !mappedCeds.has(code))
            .map(([code, name]) => ({
                label: `${formatCedCode(code)} - ${name}`,
                value: code,
            }));
    }, [cedToNameMapping, mappings]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFiliere || !selectedCed) return;
        
        // On ne garde que le code CED sans le nom
        const cleanedCed = selectedCed.value;
        const updatedMappings = [...mappings, { ced: cleanedCed, filiere: selectedFiliere.value, multiflux: isMultiflux, tri: isTri }];
        
        try {
            const { error } = await supabase
                .from('entreprise')
                .update({ mapping_ced_filiere: updatedMappings })
                .eq('id', session.entreprise_id);

            if (error) throw error;
            
            setMappings(updatedMappings);
            setSelectedCed(null);
            setSelectedFiliere(null);
            setIsMultiflux(false);
            setIsTri(false);
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
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsMultiflux(v => !v)}
                            className={`px-3 py-2 rounded border ${isMultiflux ? 'bg-green-600 text-white border-green-700' : 'bg-gray-100 text-gray-700 border-gray-300'}`}
                            title="Basculer multi/mono flux"
                        >
                            {isMultiflux ? 'Multi-flux' : 'Mono-flux'}
                        </button>
                        <label className="inline-flex items-center gap-2">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-sm"
                                checked={isTri}
                                onChange={(e) => setIsTri(e.target.checked)}
                            />
                            <span>Tri</span>
                        </label>
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
                                            {(() => {
                                                const mappingObj = mappings.find(m => m.ced === code && m.filiere === filiere);
                                                const mf = mappingObj?.multiflux;
                                                const tr = mappingObj?.tri;
                                                const chips: { key: string; label: string; style: string }[] = [];
                                                if (mf === true) chips.push({ key: 'mf-true', label: 'multiflux', style: 'bg-green-100 text-green-700 border-green-200' });
                                                else if (mf === false) chips.push({ key: 'mf-false', label: 'monoflux', style: 'bg-gray-100 text-gray-700 border-gray-200' });
                                                if (tr === true) chips.push({ key: 'tr-true', label: 'trié', style: 'bg-green-100 text-green-700 border-green-200' });
                                                else if (tr === false) chips.push({ key: 'tr-false', label: 'non trié', style: 'bg-gray-100 text-gray-700 border-gray-200' });
                                                if (chips.length === 0) return null;
                                                return (
                                                    <div className="mt-1 flex gap-2 text-xs flex-wrap">
                                                        {chips.map(c => (
                                                            <span key={c.key} className={`px-2 py-0.5 rounded border ${c.style}`}>{c.label}</span>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
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