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
                    <div className="absolute z-50 w-full mt-0.5 bg-white border border-gray-200 rounded-md shadow-sm max-h-60 overflow-hidden">
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

// Obtenir tous les types de flags possibles pour le filtre
export const getAllPossibleAlerteFlags = (): Array<{value: string, label: string}> => {
    return [
        { value: 'site_inconnu', label: 'Site inconnu' },
        { value: 'presta_inconnu', label: 'Presta inconnu' },
        { value: 'operation_inconnue', label: 'Opération inconnue' },
        { value: 'unite_inconnue', label: 'Unité inconnue' },
        { value: 'contenant_inconnu', label: 'Contenant inconnu' },
        { value: 'dechet_inconnu', label: 'Déchet inconnu' },
        { value: 'tonnage_non_lu', label: 'Tonnage non lu' },
        { value: 'tonnage_invalide', label: 'Tonnage invalide' },
        { value: 'tonnage_negatif', label: 'Tonnage négatif' },
        { value: 'tonnage_eleve', label: 'Tonnage >50t' },
        { value: 'date_non_lue', label: 'Date non lue' },
        { value: 'date_invalide', label: 'Date invalide' },
        { value: 'num_bsd_non_lu', label: 'N° BSD non lu' },
        { value: 'num_bsd_invalide', label: 'N° BSD invalide' },
        { value: 'num_bon_non_lu', label: 'N° Bon non lu' },
        { value: 'num_bon_invalide', label: 'N° Bon invalide' },
        { value: 'num_facture_non_lu', label: 'N° Facture non lu' },
        { value: 'num_facture_invalide', label: 'N° Facture invalide' },
        { value: 'ced_non_lu', label: 'CED non lu' },
        { value: 'ced_invalide', label: 'CED invalide' },
        { value: 'calcul_errone', label: 'Calcul erroné' },
        { value: 'somme_erronee', label: 'Somme erronée' }
    ];
};

// Mapper un label de flag vers sa value
export const getFlagValueFromLabel = (label: string): string => {
    const mapping: Record<string, string> = {
        'Site inconnu': 'site_inconnu',
        'Presta inconnu': 'presta_inconnu',
        'Opération inconnue': 'operation_inconnue',
        'Unité inconnue': 'unite_inconnue',
        'Contenant inconnu': 'contenant_inconnu',
        'Déchet inconnu': 'dechet_inconnu',
        'Tonnage non lu': 'tonnage_non_lu',
        'Tonnage invalide': 'tonnage_invalide',
        'Tonnage négatif': 'tonnage_negatif',
        'Tonnage >50t': 'tonnage_eleve',
        'Date non lue': 'date_non_lue',
        'Date invalide': 'date_invalide',
        'N° BSD non lu': 'num_bsd_non_lu',
        'N° BSD invalide': 'num_bsd_invalide',
        'N° Bon non lu': 'num_bon_non_lu',
        'N° Bon invalide': 'num_bon_invalide',
        'N° Facture non lu': 'num_facture_non_lu',
        'N° Facture invalide': 'num_facture_invalide',
        'CED non lu': 'ced_non_lu',
        'CED invalide': 'ced_invalide',
        'Calcul erroné': 'calcul_errone',
        'Somme erronée': 'somme_erronee'
    };
    return mapping[label] || label.toLowerCase().replace(/\s+/g, '_');
};

// Générer les flags d'alertes basés sur le message
export const getAlerteFlags = (message: string): AlerteFlag[] => {
    if (!message) return [];
    
    const flags: AlerteFlag[] = [];
    const lowerMessage = message.toLowerCase();
    
    // Associations manquantes (non reconnu = lu mais pas de mapping)
    if (lowerMessage.includes('non reconnu')) {
        if (lowerMessage.includes('site')) flags.push({ label: 'Site inconnu', color: 'bg-red-100 text-red-700' });
        if (lowerMessage.includes('prestataire')) flags.push({ label: 'Presta inconnu', color: 'bg-red-100 text-red-700' });
        if (lowerMessage.includes('opération')) flags.push({ label: 'Opération inconnue', color: 'bg-red-100 text-red-700' });
        if (lowerMessage.includes('unité')) flags.push({ label: 'Unité inconnue', color: 'bg-red-100 text-red-700' });
        if (lowerMessage.includes('contenant')) flags.push({ label: 'Contenant inconnu', color: 'bg-red-100 text-red-700' });
        if (lowerMessage.includes('déchet')) flags.push({ label: 'Déchet inconnu', color: 'bg-red-100 text-red-700' });
    }
    
    // Tonnage
    if (lowerMessage.includes('tonnage')) {
        if (lowerMessage.includes('manquant')) flags.push({ label: 'Tonnage non lu', color: 'bg-orange-100 text-orange-700' });
        else if (lowerMessage.includes('non numérique')) flags.push({ label: 'Tonnage invalide', color: 'bg-orange-100 text-orange-700' });
        else if (lowerMessage.includes('négatif')) flags.push({ label: 'Tonnage négatif', color: 'bg-orange-100 text-orange-700' });
        else if (lowerMessage.includes('trop élevé')) flags.push({ label: 'Tonnage >50t', color: 'bg-orange-100 text-orange-700' });
    }
    
    // Date
    if (lowerMessage.includes('date')) {
        if (lowerMessage.includes('manquante')) flags.push({ label: 'Date non lue', color: 'bg-yellow-100 text-yellow-700' });
        else if (lowerMessage.includes('invalide')) flags.push({ label: 'Date invalide', color: 'bg-yellow-100 text-yellow-700' });
    }
    
    // Numéros
    if (lowerMessage.includes('numéro bsd') || lowerMessage.includes('num_bsd')) {
        if (lowerMessage.includes('manquant')) flags.push({ label: 'N° BSD non lu', color: 'bg-purple-100 text-purple-700' });
        else if (lowerMessage.includes('insuffisant')) flags.push({ label: 'N° BSD invalide', color: 'bg-purple-100 text-purple-700' });
    }
    if (lowerMessage.includes('numéro de bon') || lowerMessage.includes('num_bon')) {
        if (lowerMessage.includes('manquant')) flags.push({ label: 'N° Bon non lu', color: 'bg-purple-100 text-purple-700' });
        else if (lowerMessage.includes('insuffisant')) flags.push({ label: 'N° Bon invalide', color: 'bg-purple-100 text-purple-700' });
    }
    if (lowerMessage.includes('numéro de facture') || lowerMessage.includes('num_facture')) {
        if (lowerMessage.includes('manquant')) flags.push({ label: 'N° Facture non lu', color: 'bg-purple-100 text-purple-700' });
        else if (lowerMessage.includes('insuffisant')) flags.push({ label: 'N° Facture invalide', color: 'bg-purple-100 text-purple-700' });
    }
    
    // Code CED
    if (lowerMessage.includes('code ced') || lowerMessage.includes('ced')) {
        if (lowerMessage.includes('manquant')) flags.push({ label: 'CED non lu', color: 'bg-pink-100 text-pink-700' });
        else if (lowerMessage.includes('invalide')) flags.push({ label: 'CED invalide', color: 'bg-pink-100 text-pink-700' });
    }
    
    // Calculs
    if (lowerMessage.includes('calcul incorrect')) {
        flags.push({ label: 'Calcul erroné', color: 'bg-blue-100 text-blue-700' });
    }
    if (lowerMessage.includes('somme incorrecte')) {
        flags.push({ label: 'Somme erronée', color: 'bg-blue-100 text-blue-700' });
    }
    
    return flags;
};

