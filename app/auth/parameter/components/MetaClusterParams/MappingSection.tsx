import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Select from 'react-select';
import { MappingTypeConfig, MetaValue, RawValue, Mapping } from './mappingConfig';
import ExtractDoc from '@/app/import_page/ImportComponents/ExtractMetaDoc/components/ExtractDoc';
import { RAW_FIELD_CLASS, REFERENCE_ENTITY_CLASS } from './fieldStyles';

// Fonction utilitaire pour déterminer le flag selon le type de document
const getDocumentFlag = (typeDoc: string) => {
    switch (typeDoc.toLowerCase()) {
        case 'bon':
            return { label: 'Bon', className: 'bg-green-100 text-green-700' };
        case 'facture':
            return { label: 'Facture', className: 'bg-blue-100 text-blue-700' };
        case 'bsd':
            return { label: 'BSD', className: 'bg-purple-100 text-purple-700' };
        default:
            return { label: 'Inconnu', className: 'bg-gray-100 text-gray-700' };
    }
};

interface OptionType {
    label: string;
    value: string;
}

interface MappingSectionProps {
    config: MappingTypeConfig;
    rawValues: RawValue[];
    metaValues: MetaValue[];
    mappings: Mapping;
    onMappingChange: (config: MappingTypeConfig, mapping: Mapping) => void;
    onOpenPdf: (rawValue: RawValue) => void;
}

export default function MappingSection({
    config,
    rawValues,
    metaValues,
    mappings,
    onMappingChange,
    onOpenPdf
}: MappingSectionProps) {
    // États locaux pour l'interface
    const [searchRaw, setSearchRaw] = useState('');
    const [searchMeta, setSearchMeta] = useState('');
    const [selectedMeta, setSelectedMeta] = useState<OptionType | null>(null);
    const [selectedRaw, setSelectedRaw] = useState<Set<string>>(new Set());
    const [isOpen, setIsOpen] = useState<boolean>(false);
    
    // États pour les modifications locales
    const [localMappings, setLocalMappings] = useState<Mapping>(mappings);

    // Filtrer les valeurs brutes selon la recherche
    const filteredRawValues = useMemo(() => {
        return rawValues.filter(item => 
            item.nom.toLowerCase().includes(searchRaw.toLowerCase())
        );
    }, [rawValues, searchRaw]);

    // Filtrer les valeurs métas selon la recherche
    const filteredMetaValues = useMemo(() => {
        const q = searchMeta.trim().toLowerCase();
        if (!q) return metaValues;
        return metaValues.filter(item => {
            const nomMatch = item.nom?.toLowerCase().includes(q);
            const codeMatch = item.code?.toLowerCase().includes(q);
            const siretMatch = item.siret?.toLowerCase().includes(q);
            return Boolean(nomMatch || codeMatch || siretMatch);
        });
    }, [metaValues, searchMeta]);

    // Fonction utilitaire pour générer la clé du meta
    const getMetaKey = (meta: MetaValue): string => {
        if (config.displayFormat === 'withCode' && (meta.siret || meta.code)) {
            return `${meta.nom}|${meta.siret || meta.code}`;
        }
        return meta.nom;
    };

    // Fonction utilitaire pour parser la clé du meta
    const parseMetaKey = (key: string): { nom: string; code?: string; siret?: string } => {
        if (key.includes('|')) {
            const [nom, codeOrSiret] = key.split('|');
            return { nom: nom || '', code: codeOrSiret || '', siret: codeOrSiret || '' };
        }
        return { nom: key };
    };

    // Convertir les valeurs métas en options pour react-select
    const metaOptions: OptionType[] = filteredMetaValues.map(meta => {
        let label = meta.nom;
        if (config.displayFormat === 'withCode') {
            if (meta.siret) {
                label += ` (${meta.siret})`;
            } else if (meta.code) {
                label += ` (${meta.code})`;
            }
        }
        return {
            label,
            value: getMetaKey(meta)
        };
    });

    // Ajouter l'option "Créer nouveau..." pour les mappings de type 'dynamic'
    if (config.metaSource === 'dynamic' && searchMeta.trim()) {
        const newValue = searchMeta.trim();
        const exists = metaOptions.some(option => option.value === newValue);
        if (!exists) {
            metaOptions.unshift({
                label: `Créer "${newValue}"`,
                value: newValue
            });
        }
    }

    // Obtenir toutes les valeurs brutes déjà associées
    const associatedRawValues = useMemo(() => {
        const allAssociated = new Set<string>();
        Object.values(localMappings).forEach(values => {
            values.forEach(value => allAssociated.add(value));
        });
        return allAssociated;
    }, [localMappings]);

    // Filtrer les valeurs brutes disponibles (non associées)
    const availableRawValues = useMemo(() => {
        return filteredRawValues.filter(item => !associatedRawValues.has(item.nom));
    }, [filteredRawValues, associatedRawValues]);

    // Compter le nombre total de valeurs brutes non associées (toutes, pas seulement filtrées)
    const unassociatedCount = useMemo(() => {
        return rawValues.reduce((count, item) => count + (associatedRawValues.has(item.nom) ? 0 : 1), 0);
    }, [rawValues, associatedRawValues]);

    // Gérer la sélection/désélection de toutes les valeurs brutes
    const handleSelectAllRaw = useCallback((checked: boolean) => {
        if (checked) {
            setSelectedRaw(new Set(availableRawValues.map(item => item.nom)));
        } else {
            setSelectedRaw(new Set());
        }
    }, [availableRawValues]);

    // Gérer la sélection d'une valeur brute individuelle
    const handleSelectRaw = useCallback((item: RawValue, checked: boolean) => {
        const newSelected = new Set(selectedRaw);
        if (checked) {
            newSelected.add(item.nom);
        } else {
            newSelected.delete(item.nom);
        }
        setSelectedRaw(newSelected);
    }, [selectedRaw]);

    // Associer les valeurs brutes sélectionnées au meta (modifications locales uniquement)
    const handleAssociate = useCallback(() => {
        if (!selectedMeta || selectedRaw.size === 0) return;

        const newMappings = { ...localMappings };
        const metaKey = selectedMeta.value;
        
        // S'assurer que le meta existe dans le mapping
        if (!newMappings[metaKey]) {
            newMappings[metaKey] = [];
        }
        
        // Ajouter les nouvelles valeurs brutes au meta
        const newRawValues = Array.from(selectedRaw);
        newMappings[metaKey] = [
            ...newMappings[metaKey],
            ...newRawValues
        ];

        // Mise à jour locale immédiate
        setLocalMappings(newMappings);
        onMappingChange(config, newMappings);
        setSelectedRaw(new Set());
        setSelectedMeta(null);
        setSearchMeta(''); // Réinitialiser la recherche pour les mappings dynamiques
    }, [selectedMeta, selectedRaw, localMappings, onMappingChange, config]);

    // Supprimer une association (modifications locales uniquement)
    const handleRemoveAssociation = useCallback((metaKey: string, rawValue: string) => {
        const newMappings = { ...localMappings };
        newMappings[metaKey] = newMappings[metaKey].filter(value => value !== rawValue);
        
        if (newMappings[metaKey].length === 0) {
            delete newMappings[metaKey];
        }

        // Mise à jour locale immédiate
        setLocalMappings(newMappings);
        onMappingChange(config, newMappings);
    }, [localMappings, onMappingChange, config]);

    // Synchroniser les mappings locaux avec les mappings reçus en props
    useEffect(() => {
        setLocalMappings(mappings);
    }, [mappings]);

    return (
        <div className="mb-12 relative group">
            <div className="mb-4 px-10">
                <button
                    type="button"
                    onClick={() => setIsOpen(prev => !prev)}
                    className="w-full text-left flex items-center justify-between"
                >
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 flex items-center">
                            {config.label}
                            {unassociatedCount > 0 && (
                                <span
                                    className="ml-2 inline-block h-2.5 w-2.5 rounded-full bg-red-500"
                                    title={`${unassociatedCount} valeur(s) brute(s) non associée(s)`}
                                    aria-label={`${unassociatedCount} valeur(s) brute(s) non associée(s)`}
                                />
                            )}
                        </h3>
                        <p className="text-gray-600">{config.description}</p>
                    </div>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-5 w-5 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                    >
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
            
            {isOpen && (
            <div className="grid grid-cols-2 gap-8 px-10">
                {/* Colonne gauche - Valeurs brutes */}
                <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-gray-800"><span className="text-xl font-bold">{config.label} </span> brutes des PDFs</h4>
                    
                    {/* Barre de recherche */}
                    <input
                        type="text"
                        placeholder={`Les champs bruts reconnus comme ${config.label.toLowerCase()} par l'IA :`}
                        value={searchRaw}
                        onChange={(e) => setSearchRaw(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    {/* Checkbox "Sélectionner tout" */}
                    {availableRawValues.length > 0 && (
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={selectedRaw.size === availableRawValues.length}
                                onChange={(e) => handleSelectAllRaw(e.target.checked)}
                                className="form-checkbox h-4 w-4 text-blue-600"
                            />
                            <label className="text-sm text-gray-700">
                                Sélectionner tout ({availableRawValues.length})
                            </label>
                        </div>
                    )}

                    {/* Liste des valeurs brutes */}
                    <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
                        {availableRawValues.length === 0 ? (
                            <div className="p-4 text-gray-500 text-center">
                                {searchRaw ? 'Aucune valeur trouvée' : 'Aucune valeur brute disponible'}
                            </div>
                        ) : (
                            <div className="space-y-1 p-2">
                                {availableRawValues.map((item) => (
                                    <div key={item.nom} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                                        <input
                                            type="checkbox"
                                            checked={selectedRaw.has(item.nom)}
                                            onChange={(e) => handleSelectRaw(item, e.target.checked)}
                                            className="form-checkbox h-4 w-4 text-blue-600"
                                        />
                                        <div className="flex items-center gap-2 flex-1">
                                            <span className={`text-sm ${RAW_FIELD_CLASS}`}>{item.nom}</span>
                                            {(() => {
                                                const flag = getDocumentFlag(item.typeDoc);
                                                return (
                                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${flag.className}`}>
                                                        {flag.label}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => onOpenPdf(item)}
                                                className="text-blue-500 hover:text-blue-700 text-xs"
                                                title="Ouvrir le PDF"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </button>
                                            {item.pdf_path && (
                                                <ExtractDoc
                                                    pdf_id={item.pdfId}
                                                    pdf_path={item.pdf_path}
                                                    pdf_status={item.pdf_status}
                                                />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Colonne droite - Valeurs métas et associations */}
                <div className="space-y-4">
                    <h4 className="text-md font-semibold text-gray-800"><span className="text-xl font-bold">{config.label} </span> de référence et associations</h4>
                    
                    {/* Sélection du meta */}
                    <div className="space-y-2">
                        <label className="hidden text-sm font-medium text-gray-700">Sélectionner un {config.label.toLowerCase()} meta :</label>
                        <Select
                            isClearable
                            value={selectedMeta}
                            onChange={(newValue) => setSelectedMeta(newValue)}
                            options={metaOptions}
                            placeholder={`Vos ${config.label.toLowerCase()} de référence :`}
                            className="flex-1"
                            classNamePrefix="select"
                            noOptionsMessage={() => `Aucun ${config.label.toLowerCase()} de référence trouvé`}
                            onInputChange={(newValue) => setSearchMeta(newValue)}
                            inputValue={searchMeta}
                        />
                        
                        {selectedMeta && selectedRaw.size > 0 && (
                            <button
                                onClick={handleAssociate}
                                className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                            >
                                Associer {selectedRaw.size} valeur(s) à &quot;{selectedMeta.label}&quot;
                            </button>
                        )}
                    </div>

                                         {/* Associations existantes */}
                     <div className="space-y-3">
                         <h5 className="text-md font-medium text-gray-700">Associations existantes :</h5>
                         {Object.keys(localMappings).length === 0 ? (
                            <div className="text-gray-500 text-center p-4">
                                Aucune association créée
                            </div>
                                                 ) : (
                             <div className="space-y-3">
                                 {Object.entries(localMappings).map(([metaKey, values]) => {
                                    const { nom, code, siret } = parseMetaKey(metaKey);
                                    const meta = metaValues.find(m => getMetaKey(m) === metaKey);
                                    
                                    return (
                                        <div key={metaKey} className="border border-blue-600 rounded-lg p-2">
                                            <h6 className={`mb-2 ${REFERENCE_ENTITY_CLASS}`}>
                                                {meta?.nom || nom}
                                                {(siret || code) && (
                                                    <span>
                                                        ({siret || code})
                                                    </span>
                                                )}
                                            </h6>
                                            <div className="space-y-1">
                                                {values.map((value) => (
                                                    <div key={value} className="flex items-center justify-between bg-gray-50 rounded p-1">
                                                        <span className={`text-sm ${RAW_FIELD_CLASS}`}>{value}</span>
                                                        <button
                                                            onClick={() => handleRemoveAssociation(metaKey, value)}
                                                            className="text-red-500 hover:text-red-700"
                                                            title="Supprimer l'association"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            )}
        </div>
    );
}

