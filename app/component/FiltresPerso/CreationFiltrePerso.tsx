import { useState, useRef, useEffect } from "react";
import { useFiltresPerso } from "./FiltresPersoProvider";
import BoxIcon from "../BoxIconWrapper";

const SELECTED_FIELDS_KEY = 'selectedFields';

const CreationFiltrePerso = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { filterFields, filterData, updateFilterValue, updateAllFilterValues, isLoading, mappingCodeTraitement } = useFiltresPerso();
    const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(SELECTED_FIELDS_KEY);
            return saved ? JSON.parse(saved) : {};
        }
        return {};
    });
    const [hoveredFilter, setHoveredFilter] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (Object.keys(selectedFields).length > 0) {
            localStorage.setItem(SELECTED_FIELDS_KEY, JSON.stringify(selectedFields));
        }
    }, [selectedFields]);

    useEffect(() => {
        if (!filterFields.length || Object.keys(selectedFields).length > 0) return;
        
        const initialFields = filterFields.reduce((acc, field) => {
            acc[field.label] = false;
            return acc;
        }, {} as Record<string, boolean>);
        setSelectedFields(initialFields);
    }, [filterFields, selectedFields]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!hoveredFilter) {
            setSearchTerm('');
        }
    }, [hoveredFilter]);

    if (isLoading) {
        return <div>Chargement des filtres...</div>;
    }

    const toggleField = (fieldLabel: string) => {
        setSelectedFields(prev => {
            const newValue = !prev[fieldLabel];
            
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
            <div 
                ref={containerRef}
                className="relative"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
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
                    <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg" onClick={(e) => e.stopPropagation()}>
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
                                        {filterData[fieldLabel]?.length > 10 && (
                                            <div className="mb-1 p-1 border-b border-gray-200">
                                                <div className="relative flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Rechercher..."
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                        className="w-full p-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                    <BoxIcon 
                                                        name="search" 
                                                        size="20px" 
                                                        color="#6B7280"
                                                        className="absolute right-3 top-1/2 transform -translate-y-1/2"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        {filterData[fieldLabel]?.length > 5 && (
                                            <div className="mb-2 px-3 py-2 border-b border-gray-200">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        updateAllFilterValues(
                                                            fieldLabel,
                                                            !filterData[fieldLabel].every(v => v.checked)
                                                        );
                                                    }}
                                                    className="text-sm text-blue-600 hover:text-blue-800"
                                                >
                                                    {filterData[fieldLabel].every(v => v.checked) 
                                                        ? "Tout désélectionner" 
                                                        : "Tout sélectionner"}
                                                </button>
                                            </div>
                                        )}
                                        {fieldLabel === "Code de traitement" ? (
                                            mappingCodeTraitement && Object.keys(mappingCodeTraitement).length > 0 ? (
                                                <>
                                                    {Object.entries(mappingCodeTraitement).map(([groupName, mappedCodes]: [string, string[]]) => {
                                                        // Fonction pour normaliser les codes (enlever les espaces)
                                                        const normalizeCode = (code: string) => code.replace(/\s+/g, '');

                                                        // On ne garde que les codes qui existent dans filterData
                                                        const existingCodes = mappedCodes.filter(mappedCode => 
                                                            filterData[fieldLabel]?.some(v => normalizeCode(v.value) === normalizeCode(mappedCode))
                                                        );

                                                        // On filtre selon le terme de recherche
                                                        const filteredCodes = existingCodes.filter(code => {
                                                            if (!searchTerm) return true;
                                                            const searchLower = searchTerm.toLowerCase();
                                                            return normalizeCode(code).toLowerCase().includes(searchLower);
                                                        });

                                                        if (filteredCodes.length === 0) return null;

                                                        // Calculer si tous les codes existants du groupe sont cochés
                                                        const allCodesChecked = filteredCodes.every(mappedCode => {
                                                            const value = filterData[fieldLabel]?.find(v => normalizeCode(v.value) === normalizeCode(mappedCode));
                                                            return value?.checked ?? false;
                                                        });

                                                        return (
                                                            <div key={groupName} className="mb-2">
                                                                <div 
                                                                    className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md cursor-pointer hover:bg-gray-100"
                                                                    onClick={() => setExpandedGroups((prev: Record<string, boolean>) => ({
                                                                        ...prev,
                                                                        [groupName]: !prev[groupName]
                                                                    }))}
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`transform transition-transform duration-200 ${expandedGroups[groupName] ? 'rotate-90' : ''}`}>
                                                                            ▶
                                                                        </span>
                                                                        <span className="font-semibold text-sm">{groupName}</span>
                                                                    </div>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={allCodesChecked}
                                                                        onChange={(e) => {
                                                                            e.stopPropagation();
                                                                            const newCheckedState = e.target.checked;
                                                                            filteredCodes.forEach(mappedCode => {
                                                                                const matchingValue = filterData[fieldLabel]?.find(v => normalizeCode(v.value) === normalizeCode(mappedCode));
                                                                                if (matchingValue) {
                                                                                    updateFilterValue(fieldLabel, matchingValue.value, newCheckedState);
                                                                                }
                                                                            });
                                                                        }}
                                                                        className="form-checkbox h-4 w-4 text-blue-600"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                </div>
                                                                {expandedGroups[groupName] && (
                                                                    <div className="ml-4 mt-1">
                                                                        {filteredCodes.map(mappedCode => {
                                                                            const value = filterData[fieldLabel]?.find(v => normalizeCode(v.value) === normalizeCode(mappedCode));
                                                                            if (!value) return null;
                                                                            return (
                                                                                <label 
                                                                                    key={mappedCode}
                                                                                    className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                                                                >
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={value.checked}
                                                                                        onChange={(e) => {
                                                                                            e.stopPropagation();
                                                                                            updateFilterValue(fieldLabel, value.value, e.target.checked);
                                                                                        }}
                                                                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                                                    />
                                                                                    <span className="ml-3 text-sm text-gray-700">
                                                                                        {value.value}
                                                                                    </span>
                                                                                </label>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}

                                                    {/* Groupe "Autres" pour les codes non mappés */}
                                                    {(() => {
                                                        const normalizeCode = (code: string) => code.replace(/\s+/g, '');
                                                        const allMappedCodes = new Set(
                                                            Object.values(mappingCodeTraitement).flat().map(normalizeCode)
                                                        );
                                                        
                                                        const unmappedCodes = filterData[fieldLabel]?.filter(value => 
                                                            !allMappedCodes.has(normalizeCode(value.value))
                                                        );

                                                        if (!unmappedCodes?.length) return null;

                                                        const filteredUnmappedCodes = unmappedCodes.filter(value => {
                                                            if (!searchTerm) return true;
                                                            const searchLower = searchTerm.toLowerCase();
                                                            return normalizeCode(value.value).toLowerCase().includes(searchLower);
                                                        });

                                                        if (filteredUnmappedCodes.length === 0) return null;

                                                        const allUnmappedChecked = filteredUnmappedCodes.every(value => value.checked);

                                                        return (
                                                            <div className="mb-2">
                                                                <div 
                                                                    className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md cursor-pointer hover:bg-gray-100"
                                                                    onClick={() => setExpandedGroups(prev => ({
                                                                        ...prev,
                                                                        ["Autres"]: !prev["Autres"]
                                                                    }))}
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`transform transition-transform duration-200 ${expandedGroups["Autres"] ? 'rotate-90' : ''}`}>
                                                                            ▶
                                                                        </span>
                                                                        <span className="font-semibold text-sm">Autres</span>
                                                                    </div>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={allUnmappedChecked}
                                                                        onChange={(e) => {
                                                                            e.stopPropagation();
                                                                            const newCheckedState = e.target.checked;
                                                                            filteredUnmappedCodes.forEach(value => {
                                                                                updateFilterValue(fieldLabel, value.value, newCheckedState);
                                                                            });
                                                                        }}
                                                                        className="form-checkbox h-4 w-4 text-blue-600"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                </div>
                                                                {expandedGroups["Autres"] && (
                                                                    <div className="ml-4 mt-1">
                                                                        {filteredUnmappedCodes.map(value => (
                                                                            <label 
                                                                                key={value.value}
                                                                                className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={value.checked}
                                                                                    onChange={(e) => {
                                                                                        e.stopPropagation();
                                                                                        updateFilterValue(fieldLabel, value.value, e.target.checked);
                                                                                    }}
                                                                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                                                />
                                                                                <span className="ml-3 text-sm text-gray-700">
                                                                                    {value.value}
                                                                                </span>
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </>
                                            ) : (
                                                // Si pas de mapping, afficher tous les codes comme avant
                                                filterData[fieldLabel]?.filter(value => {
                                                    if (!searchTerm) return true;
                                                    const searchLower = searchTerm.toLowerCase();
                                                    const normalizedValue = value.value.replace(/\s+/g, '');
                                                    return normalizedValue.toLowerCase().includes(searchLower) ||
                                                           (value.mostFrequentName && value.mostFrequentName.toLowerCase().includes(searchLower));
                                                }).map((value) => (
                                                    <label 
                                                        key={value.value} 
                                                        className="flex flex-col px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                                    >
                                                        <div className="flex items-center">
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
                                                        </div>
                                                        {value.mostFrequentName && (
                                                            <span className="ml-7 text-xs text-gray-500">
                                                                {value.mostFrequentName}
                                                            </span>
                                                        )}
                                                    </label>
                                                ))
                                            )
                                        ) : (
                                            // Pour les autres champs, afficher comme avant
                                            filterData[fieldLabel]?.filter(value => {
                                                if (!searchTerm) return true;
                                                const searchLower = searchTerm.toLowerCase();
                                                return value.value.toLowerCase().includes(searchLower) ||
                                                       (value.mostFrequentName && value.mostFrequentName.toLowerCase().includes(searchLower));
                                            }).map((value) => (
                                                <label 
                                                    key={value.value} 
                                                    className="flex flex-col px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                                >
                                                    <div className="flex items-center">
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
                                                    </div>
                                                    {value.mostFrequentName && (
                                                        <span className="ml-7 text-xs text-gray-500">
                                                            {value.mostFrequentName}
                                                        </span>
                                                    )}
                                                </label>
                                            ))
                                        )}
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
