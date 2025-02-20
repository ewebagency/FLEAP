import { useState, useRef, useEffect } from "react";
import { useFiltresPerso } from "./FiltresPersoProvider";
import BoxIcon from "../BoxIconWrapper";

const SELECTED_FIELDS_KEY = 'selectedFields';

const CreationFiltrePerso = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { filterFields, filterData, updateFilterValue, isLoading } = useFiltresPerso();
    const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>(() => {
        // Initialiser selectedFields depuis localStorage si disponible
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(SELECTED_FIELDS_KEY);
            return saved ? JSON.parse(saved) : {};
        }
        return {};
    });
    const [hoveredFilter, setHoveredFilter] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Sauvegarder selectedFields dans localStorage quand il change
    useEffect(() => {
        if (Object.keys(selectedFields).length > 0) {
            localStorage.setItem(SELECTED_FIELDS_KEY, JSON.stringify(selectedFields));
        }
    }, [selectedFields]);

    // Initialiser selectedFields seulement si vide
    useEffect(() => {
        if (!filterFields.length || Object.keys(selectedFields).length > 0) return;
        
        const initialFields = filterFields.reduce((acc, field) => {
            acc[field.label] = false;
            return acc;
        }, {} as Record<string, boolean>);
        setSelectedFields(initialFields);
    }, [filterFields, selectedFields]);

    // Gérer les clics à l'extérieur
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (isLoading) {
        return <div>Chargement des filtres...</div>;
    }

    const toggleField = (fieldLabel: string) => {
        setSelectedFields(prev => {
            const newValue = !prev[fieldLabel];
            
            // Si on désélectionne le champ, réinitialiser toutes ses valeurs à true
            if (!newValue && filterData[fieldLabel]) {
                const fieldValues = filterData[fieldLabel];
                fieldValues.forEach(value => {
                    updateFilterValue(fieldLabel, value.value, true);
                });
            }
            
            const newFields = {
                ...prev,
                [fieldLabel]: newValue
            };
            
            localStorage.setItem(SELECTED_FIELDS_KEY, JSON.stringify(newFields));
            return newFields;
        });
    };

    return (
        <div className="flex flex-col gap-1">
            {/* Menu principal de sélection des champs */}
            <div 
                ref={containerRef}
                className="relative"
                onMouseEnter={() => setIsOpen(true)}
                onMouseLeave={() => setIsOpen(false)}
            >
                <div className="flex items-center justify-between px-4 py-2 bg-white shadow-xs border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div className="flex items-center space-x-2">
                        <BoxIcon name="pencil" type="solid" size="20px" color="#6B7280"/>
                        <span className="text-sm font-medium text-gray-700">Filtres personnalisés</span>
                    </div>
                    <span className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                        <BoxIcon name="chevron-down" type="solid" size="20px" color="#6B7280"/>
                    </span>
                </div>
            
            {isOpen && (
                    <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
                        <div className="max-h-64 overflow-y-auto">
                    {filterFields.map((field) => (
                                <label 
                                    key={field.label} 
                                    className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedFields[field.label]}
                                        onChange={() => toggleField(field.label)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="ml-3 text-sm text-gray-700">
                                        {field.label}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Filtres individuels pour chaque champ sélectionné */}
            <div className="mr-6 flex flex-col gap-1">
                {Object.entries(selectedFields).map(([fieldLabel, isSelected]) => {
                    if (!isSelected) return null;
                    
                    return (
                        <div 
                            key={fieldLabel} 
                            className="relative"
                            onMouseEnter={() => setHoveredFilter(fieldLabel)}
                            onMouseLeave={() => setHoveredFilter(null)}
                        >
                            <div className="flex items-center justify-between px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                                <div className="flex items-center space-x-2">
                                    <BoxIcon name="filter" type="solid" size="20px" color="#6B7280"/>
                                    <span className="text-sm font-medium text-gray-700">{fieldLabel}</span>
                                </div>
                                <span className={`transform transition-transform duration-200 ${hoveredFilter === fieldLabel ? 'rotate-180' : ''}`}>
                                    <BoxIcon name="chevron-down" type="solid" size="20px" color="#6B7280"/>
                                </span>
                            </div>
                            {hoveredFilter === fieldLabel && (
                                <div className="absolute z-40 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
                                    <div className="p-3 max-h-64 overflow-y-auto">
                                        {filterData[fieldLabel]?.map((value) => (
                                            <label 
                                                key={value.value} 
                                                className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                            >
                                        <input
                                            type="checkbox"
                                            checked={value.checked}
                                            onChange={(e) => updateFilterValue(
                                                        fieldLabel,
                                                value.value,
                                                e.target.checked
                                            )}
                                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                />
                                                <span className="ml-3 text-sm text-gray-700">
                                                    {value.value}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                            </div>
                            )}
                        </div>
                    );
                })}
                </div>
        </div>
    );
};

export default CreationFiltrePerso;
