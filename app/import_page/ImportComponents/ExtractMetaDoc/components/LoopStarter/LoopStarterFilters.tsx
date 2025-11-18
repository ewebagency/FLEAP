'use client';

import React, { useState, useEffect, useRef } from 'react';
import BoxIcon from '@/app/component/BoxIconWrapper';
import { MultiSelectProps, AlerteFlag } from './LoopStarterTypes';

// Composant multiselect personnalisé
export const MultiSelect: React.FC<MultiSelectProps> = ({ options, selectedValues, onChange, placeholder, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fermer le dropdown quand on clique en dehors
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(option => {
        const name = 'name' in option ? option.name : option.label;
        return name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const handleToggleOption = (value: string) => {
        const newValues = selectedValues.includes(value)
            ? selectedValues.filter(v => v !== value)
            : [...selectedValues, value];
        onChange(newValues);
    };

    const handleSelectAll = () => {
        const allValues = options.map(option => 'id' in option ? option.id : option.value);
        onChange(allValues);
    };

    const handleClearAll = () => {
        onChange([]);
    };

    const getDisplayText = () => {
        if (selectedValues.length === 0) return placeholder;
        if (selectedValues.length === 1) {
            const option = options.find(opt => ('id' in opt ? opt.id : opt.value) === selectedValues[0]);
            if (option) {
                return 'name' in option ? option.name : option.label;
            }
            return selectedValues[0];
        }
        return `${selectedValues.length} sélectionné(s)`;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <label className="block text-xs font-medium text-gray-700 mb-1">
                {label}
            </label>
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full p-1 text-xs border border-gray-200 rounded-sm focus:outline-none focus:ring-0.5 focus:ring-blue-300 bg-white text-left flex items-center justify-between hover:border-gray-300 transition-colors"
                >
                    <span className="truncate">{getDisplayText()}</span>
                    <BoxIcon name="bx-chevron-down" size="16" className="text-gray-400" />
                </button>
                
                {isOpen && (
                    <div className="absolute z-50 min-w-[200px] w-full mt-0.5 bg-white border border-gray-200 rounded-md shadow-sm max-h-60 overflow-hidden">
                        {options.length >= 6 && (
                        <div className="p-1.5 border-b border-gray-100">
                            <input
                                type="text"
                                placeholder="Rechercher..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full p-1 text-xs border border-gray-200 rounded-sm focus:outline-none focus:ring-0.5 focus:ring-blue-300 hover:border-gray-300 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        )}
                        
                        <div className="p-1.5 border-b border-gray-100 flex gap-1">
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-sm hover:bg-blue-100 transition-colors"
                            >
                                Tout
                            </button>
                            <button
                                type="button"
                                onClick={handleClearAll}
                                className="text-xs px-2 py-0.5 bg-gray-50 text-gray-600 rounded-sm hover:bg-gray-100 transition-colors"
                            >
                                Rien
                            </button>
                        </div>
                        
                        <div className="max-h-40 overflow-y-auto">
                            {filteredOptions.length === 0 ? (
                                <div className="p-2 text-xs text-gray-500 text-center">
                                    Aucune option trouvée
                                </div>
                            ) : (
                                filteredOptions.map((option) => {
                                    const value = 'id' in option ? option.id : option.value;
                                    const name = 'name' in option ? option.name : option.label;
                                    const isSelected = selectedValues.includes(value);
                                    
                                    return (
                                        <label
                                            key={value}
                                            className="flex items-center px-2 py-1.5 hover:bg-gray-50 cursor-pointer transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleToggleOption(value)}
                                                className="w-3 h-3 text-blue-500 border-gray-200 rounded-sm focus:ring-0.5 focus:ring-blue-300"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <span className="ml-2 text-xs text-gray-600 truncate">
                                                {name}
                                            </span>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

type FlagDefinition = {
    label: string;
    color: string;
};

const FLAG_DEFINITIONS: Record<string, FlagDefinition> = {
    site_inconnu: { label: 'Site inconnu', color: 'bg-red-100 text-red-700' },
    site_non_affilie: { label: 'Site non affilié', color: 'bg-red-100 text-red-700' },
    presta_inconnu: { label: 'Presta inconnu', color: 'bg-red-100 text-red-700' },
    presta_non_affilie: { label: 'Presta non affilié', color: 'bg-red-100 text-red-700' },
    operation_inconnue: { label: 'Opération inconnue', color: 'bg-red-100 text-red-700' },
    operation_non_affiliee: { label: 'Opération non affiliée', color: 'bg-red-100 text-red-700' },
    unite_inconnue: { label: 'Unité inconnue', color: 'bg-red-100 text-red-700' },
    unite_non_affiliee: { label: 'Unité non affiliée', color: 'bg-red-100 text-red-700' },
    contenant_inconnu: { label: 'Contenant inconnu', color: 'bg-red-100 text-red-700' },
    contenant_non_affilie: { label: 'Contenant non affilié', color: 'bg-red-100 text-red-700' },
    dechet_inconnu: { label: 'Déchet inconnu', color: 'bg-red-100 text-red-700' },
    dechet_non_affilie: { label: 'Déchet non affilié', color: 'bg-red-100 text-red-700' },
    tonnage_non_lu: { label: 'Tonnage non lu', color: 'bg-orange-100 text-orange-700' },
    tonnage_invalide: { label: 'Tonnage invalide', color: 'bg-orange-100 text-orange-700' },
    tonnage_negatif: { label: 'Tonnage négatif', color: 'bg-orange-100 text-orange-700' },
    tonnage_eleve: { label: 'Tonnage >50t', color: 'bg-orange-100 text-orange-700' },
    date_non_lue: { label: 'Date non lue', color: 'bg-yellow-100 text-yellow-700' },
    date_invalide: { label: 'Date invalide', color: 'bg-yellow-100 text-yellow-700' },
    num_bsd_non_lu: { label: 'N° BSD non lu', color: 'bg-purple-100 text-purple-700' },
    num_bsd_invalide: { label: 'N° BSD invalide', color: 'bg-purple-100 text-purple-700' },
    num_bon_non_lu: { label: 'N° Bon non lu', color: 'bg-purple-100 text-purple-700' },
    num_bon_invalide: { label: 'N° Bon invalide', color: 'bg-purple-100 text-purple-700' },
    num_facture_non_lu: { label: 'N° Facture non lu', color: 'bg-purple-100 text-purple-700' },
    num_facture_invalide: { label: 'N° Facture invalide', color: 'bg-purple-100 text-purple-700' },
    ced_non_lu: { label: 'CED non lu', color: 'bg-pink-100 text-pink-700' },
    ced_invalide: { label: 'CED invalide', color: 'bg-pink-100 text-pink-700' },
    type_bon_inconnu: { label: 'Type de bon inconnu', color: 'bg-indigo-100 text-indigo-700' },
    type_facture_inconnu: { label: 'Type de facture inconnu', color: 'bg-indigo-100 text-indigo-700' },
    code_dr_invalide: { label: 'Code DR invalide', color: 'bg-teal-100 text-teal-700' },
    structure_collecte_fausse: { label: 'Structure de collecte fausse', color: 'bg-amber-100 text-amber-700' },
    calcul_errone: { label: 'Calcul erroné', color: 'bg-blue-100 text-blue-700' },
    somme_erronee: { label: 'Somme erronée', color: 'bg-blue-100 text-blue-700' },
    large_word_review_llm_can_understand: { label: 'Lecture OCR douteuse', color: 'bg-rose-100 text-rose-700' }
};

const FLAG_DEFINITION_ENTRIES = Object.entries(FLAG_DEFINITIONS);

const buildFlagFromValue = (value: string): AlerteFlag | null => {
    const def = FLAG_DEFINITIONS[value];
    if (!def) return null;
    return { label: def.label, color: def.color };
};

export const getFlagsFromValues = (values: string[]): AlerteFlag[] => {
    const seen = new Set<string>();
    const result: AlerteFlag[] = [];
    values.forEach(value => {
        if (seen.has(value)) return;
        const flag = buildFlagFromValue(value);
        if (flag) {
            seen.add(value);
            result.push(flag);
        }
    });
    return result;
};

// Obtenir tous les types de flags possibles pour le filtre
export const getAllPossibleAlerteFlags = (): Array<{value: string, label: string}> => {
    return FLAG_DEFINITION_ENTRIES.map(([value, def]) => ({
        value,
        label: def.label
    }));
};

// Obtenir tous les statuts de linkage possibles pour le filtre
export const getAllPossibleLinkageStatuses = (): Array<{value: string, label: string}> => {
    return [
        { value: 'created', label: 'Créé' },
        { value: 'linked', label: 'Lié' },
        { value: 'pushed', label: 'Poussé' },
        { value: 'check_by_user', label: 'À vérifier' },
        { value: 'to_check_by_user', label: 'À vérifier (auto)' },
        { value: 'none', label: 'Aucun lien' }
    ];
};

// Mapper un label de flag vers sa value
export const getFlagValueFromLabel = (label: string): string => {
    for (const [value, def] of FLAG_DEFINITION_ENTRIES) {
        if (def.label === label) {
            return value;
        }
    }
    return label.toLowerCase().replace(/\s+/g, '_');
};

export const getAlerteFlags = (message: string): AlerteFlag[] => {
    if (!message) return [];
    
    const flags: AlerteFlag[] = [];
    const lowerMessage = message.toLowerCase();
    const addFlagValue = (value: string) => {
        const flag = buildFlagFromValue(value);
        if (!flag) return;
        if (!flags.some(existing => existing.label === flag.label)) {
            flags.push(flag);
        }
    };
    const hasFlagValue = (value: string) => flags.some(flag => getFlagValueFromLabel(flag.label) === value);
    const removeFlagValue = (value: string) => {
        const label = FLAG_DEFINITIONS[value]?.label;
        if (!label) return;
        const index = flags.findIndex(flag => flag.label === label);
        if (index !== -1) {
            flags.splice(index, 1);
        }
    };
    const fieldFlagValues: Record<string, { inconnu: string; non_affilie: string }> = {
        site: { inconnu: 'site_inconnu', non_affilie: 'site_non_affilie' },
        presta: { inconnu: 'presta_inconnu', non_affilie: 'presta_non_affilie' },
        operation: { inconnu: 'operation_inconnue', non_affilie: 'operation_non_affiliee' },
        unite: { inconnu: 'unite_inconnue', non_affilie: 'unite_non_affiliee' },
        contenant: { inconnu: 'contenant_inconnu', non_affilie: 'contenant_non_affilie' },
        dechet: { inconnu: 'dechet_inconnu', non_affilie: 'dechet_non_affilie' }
    };
    const addFieldFlag = (field: keyof typeof fieldFlagValues, status: 'inconnu' | 'non_affilie') => {
        const values = fieldFlagValues[field];
        if (!values) return;
        const value = values[status];
        if (!value) return;
        if (status === 'inconnu' && hasFlagValue(values.non_affilie)) {
            removeFlagValue(values.non_affilie);
        }
        if (status === 'non_affilie' && hasFlagValue(values.inconnu)) {
            return;
        }
        addFlagValue(value);
    };
    const mentionsSiteFacture = lowerMessage.includes('site(s) facture') || lowerMessage.includes('site facture') || lowerMessage.includes('sites facture');
    const mentionsSite = lowerMessage.includes('site');
    const mentionsAnySite = mentionsSiteFacture || mentionsSite;
    const mentionsPrestataire = lowerMessage.includes('prestataire');
    const mentionsOperation = lowerMessage.includes('opération') || lowerMessage.includes('operation');
    const mentionsUnite = lowerMessage.includes('unité') || lowerMessage.includes('unite');
    const mentionsContenant = lowerMessage.includes('contenant');
    const mentionsDechet = lowerMessage.includes('déchet') || lowerMessage.includes('dechet');
    const mentionsTypeBon = lowerMessage.includes('type de bon');
    const mentionsTypeFacture = lowerMessage.includes('type de facture');
    const mentionsCodeDr = lowerMessage.includes('code dr');
    const mentionsStructureCollecte = lowerMessage.includes('structure de collecte fausse');
    
    // Associations manquantes (non reconnu = lu mais pas de mapping)
    if (lowerMessage.includes('non reconnu')) {
        if (mentionsAnySite) addFieldFlag('site', 'inconnu');
        if (mentionsPrestataire) addFieldFlag('presta', 'inconnu');
        if (mentionsOperation) addFieldFlag('operation', 'inconnu');
        if (mentionsUnite) addFieldFlag('unite', 'inconnu');
        if (mentionsContenant) addFieldFlag('contenant', 'inconnu');
        if (mentionsDechet) addFieldFlag('dechet', 'inconnu');
        if (mentionsTypeBon) addFlagValue('type_bon_inconnu');
        if (mentionsTypeFacture) addFlagValue('type_facture_inconnu');
    }

    if (mentionsCodeDr) {
        addFlagValue('code_dr_invalide');
    }

    if (mentionsStructureCollecte) {
        addFlagValue('structure_collecte_fausse');
    }
    
    // Associations manquantes (non affilié = proximité mais pas de mapping)
    if (lowerMessage.includes('non affili')) {
        if (mentionsAnySite) addFieldFlag('site', 'non_affilie');
        if (mentionsPrestataire) addFieldFlag('presta', 'non_affilie');
        if (mentionsOperation) addFieldFlag('operation', 'non_affilie');
        if (mentionsUnite) addFieldFlag('unite', 'non_affilie');
        if (mentionsContenant) addFieldFlag('contenant', 'non_affilie');
    }
    
    // Tonnage
    if (lowerMessage.includes('tonnage')) {
        if (lowerMessage.includes('manquant')) addFlagValue('tonnage_non_lu');
        else if (lowerMessage.includes('non numérique')) addFlagValue('tonnage_invalide');
        else if (lowerMessage.includes('négatif')) addFlagValue('tonnage_negatif');
        else if (lowerMessage.includes('trop élevé')) addFlagValue('tonnage_eleve');
    }
    
    // Date
    if (lowerMessage.includes('date')) {
        if (lowerMessage.includes('manquante')) addFlagValue('date_non_lue');
        else if (lowerMessage.includes('invalide')) addFlagValue('date_invalide');
    }
    
    // Numéros
    if (lowerMessage.includes('numéro bsd') || lowerMessage.includes('num_bsd')) {
        if (lowerMessage.includes('manquant')) addFlagValue('num_bsd_non_lu');
        else if (lowerMessage.includes('insuffisant')) addFlagValue('num_bsd_invalide');
    }
    if (lowerMessage.includes('numéro de bon') || lowerMessage.includes('num_bon')) {
        if (lowerMessage.includes('manquant')) addFlagValue('num_bon_non_lu');
        else if (lowerMessage.includes('insuffisant')) addFlagValue('num_bon_invalide');
    }
    if (lowerMessage.includes('numéro de facture') || lowerMessage.includes('num_facture')) {
        if (lowerMessage.includes('manquant')) addFlagValue('num_facture_non_lu');
        else if (lowerMessage.includes('insuffisant')) addFlagValue('num_facture_invalide');
    }
    
    // Code CED
    if (lowerMessage.includes('code ced') || lowerMessage.includes('ced')) {
        if (lowerMessage.includes('manquant')) addFlagValue('ced_non_lu');
        else if (lowerMessage.includes('invalide')) addFlagValue('ced_invalide');
    }
    
    if (lowerMessage.includes('lecture ocr douteuse')) {
        addFlagValue('large_word_review_llm_can_understand');
    }

    // Calculs
    if (lowerMessage.includes('calcul incorrect')) {
        addFlagValue('calcul_errone');
    }
    if (lowerMessage.includes('somme incorrecte')) {
        addFlagValue('somme_erronee');
    }
    
    return flags;
};

// Interface pour les flags agrégés par priorité
export interface AggregatedFlags {
    must: AlerteFlag[];
    nice: AlerteFlag[];
}

// Définition des flags MUST selon le type de document
const getMustFlagsForDocumentType = (documentType: string | null): Set<string> => {
    const docType = (documentType || '').toLowerCase();
    const mustFlags = new Set<string>();
    
    // Flags communs à tous les types (Bon, BSD, Facture)
    const commonMustFlags = [
        'site_inconnu',
        'site_non_affilie',
        'presta_inconnu',
        'presta_non_affilie',
        'dechet_inconnu',
        'dechet_non_affilie',
        'date_non_lue',
        'date_invalide',
        'tonnage_non_lu',
        'tonnage_invalide',
        'tonnage_negatif',
        'num_bon_non_lu',
        'num_bon_invalide',
        'num_bsd_non_lu',
        'num_bsd_invalide'
    ];
    
    commonMustFlags.forEach(flag => mustFlags.add(flag));
    
    // Flags spécifiques selon le type
    if (docType === 'bsd') {
        // BSD : ajouter code_dr_invalide
        mustFlags.add('code_dr_invalide');
    } else if (docType === 'facture') {
        // Facture : ajouter les flags de calcul et structure
        mustFlags.add('somme_erronee');
        mustFlags.add('calcul_errone');
        mustFlags.add('structure_collecte_fausse');
        // Pour facture, on garde aussi num_facture
        mustFlags.add('num_facture_non_lu');
        mustFlags.add('num_facture_invalide');
    }
    
    return mustFlags;
};

// Fonction pour agréger les flags en MUST et NICE
export const aggregateFlagsByPriority = (flags: AlerteFlag[], documentType: string | null): AggregatedFlags => {
    const mustFlagValues = getMustFlagsForDocumentType(documentType);
    const must: AlerteFlag[] = [];
    const nice: AlerteFlag[] = [];
    
    flags.forEach(flag => {
        const flagValue = getFlagValueFromLabel(flag.label);
        if (mustFlagValues.has(flagValue)) {
            must.push(flag);
        } else {
            nice.push(flag);
        }
    });
    
    return { must, nice };
};

// Obtenir tous les flags MUST possibles (union de tous les types de documents)
export const getAllMustFlagValues = (): string[] => {
    const allMustFlags = new Set<string>();
    
    // Flags communs à tous les types
    const commonMustFlags = [
        'site_inconnu',
        'site_non_affilie',
        'presta_inconnu',
        'presta_non_affilie',
        'dechet_inconnu',
        'dechet_non_affilie',
        'date_non_lue',
        'date_invalide',
        'tonnage_non_lu',
        'tonnage_invalide',
        'tonnage_negatif',
        'num_bon_non_lu',
        'num_bon_invalide',
        'num_bsd_non_lu',
        'num_bsd_invalide'
    ];
    
    commonMustFlags.forEach(flag => allMustFlags.add(flag));
    
    // Flags spécifiques BSD
    allMustFlags.add('code_dr_invalide');
    
    // Flags spécifiques Facture
    allMustFlags.add('somme_erronee');
    allMustFlags.add('calcul_errone');
    allMustFlags.add('structure_collecte_fausse');
    allMustFlags.add('num_facture_non_lu');
    allMustFlags.add('num_facture_invalide');
    
    return Array.from(allMustFlags);
};

// Obtenir tous les flags NICE possibles (tout ce qui n'est pas MUST)
export const getAllNiceFlagValues = (): string[] => {
    const allFlagValues = FLAG_DEFINITION_ENTRIES.map(([value]) => value);
    const mustFlagValues = new Set(getAllMustFlagValues());
    
    return allFlagValues.filter(value => !mustFlagValues.has(value));
};

