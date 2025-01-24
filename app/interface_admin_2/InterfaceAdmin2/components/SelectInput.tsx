import { SelectInputProps } from '../types/interfaces';
import CreatableSelect from 'react-select/creatable';
import { ActionMeta, SingleValue } from 'react-select';

interface Option {
    value: string;
    isSuggested?: boolean;
}

interface SelectOption {
    label: string;
    value: string;
    isSuggested: boolean;
}

export const SelectInput = ({ 
    label, 
    value, 
    onChange, 
    options,
    className = "",
    enableAutoComplete = true
}: SelectInputProps) => {
    // Séparer les options en deux groupes
    const suggestedOptions = options.filter(opt => opt.isSuggested);
    const otherOptions = options.filter(opt => !opt.isSuggested);

    if (!enableAutoComplete) {
        return (
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                    {label}
                </label>
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={`w-full p-1 text-xs border rounded ${className}`}
                >
                    <option value="">A remplir...</option>
                    
                    {/* Options suggérées en bleu */}
                    {suggestedOptions.length > 0 && (
                        <optgroup label="Suggérées">
                            {suggestedOptions.map((option) => (
                                <option 
                                    key={option.value} 
                                    value={option.value}
                                    className="text-blue-600 font-medium"
                                >
                                    {option.value}
                                </option>
                            ))}
                        </optgroup>
                    )}

                    {/* Autres options en noir */}
                    {otherOptions.length > 0 && (
                        <optgroup label="Autres">
                            {otherOptions.map((option) => (
                                <option 
                                    key={option.value} 
                                    value={option.value}
                                >
                                    {option.value}
                                </option>
                            ))}
                        </optgroup>
                    )}
                </select>
            </div>
        );
    }

    // Convertir les options pour CreatableSelect
    const selectOptions = [
        {
            label: "Suggérées",
            options: suggestedOptions.map(opt => ({
                label: opt.value,
                value: opt.value,
                isSuggested: true
            }))
        },
        {
            label: "Autres",
            options: otherOptions.map(opt => ({
                label: opt.value,
                value: opt.value,
                isSuggested: false
            }))
        }
    ].filter(group => group.options.length > 0);

    // Trouver la valeur actuelle
    const currentValue = value ? {
        label: value,
        value: value,
        isSuggested: suggestedOptions.some(opt => opt.value === value)
    } : null;

    // Gérer le changement de valeur
    const handleSelectChange = (
        newValue: SingleValue<SelectOption>,
        actionMeta: ActionMeta<SelectOption>
    ) => {
        if (newValue) {
            onChange(newValue.value);
        } else {
            onChange("");
        }
    };

    return (
        <div className="relative">
            <label className="block text-xs font-medium text-gray-700 mb-1">
                {label}
            </label>
            <CreatableSelect
                isClearable
                isSearchable
                value={currentValue}
                onChange={handleSelectChange}
                options={selectOptions}
                className={`text-xs ${className}`}
                placeholder="A remplir..."
                formatCreateLabel={(inputValue: string) => `Créer "${inputValue}"`}
                noOptionsMessage={() => "Aucune option"}
                styles={{
                    control: (base) => ({
                        ...base,
                        minHeight: '18px',
                        height: '24px',
                        fontSize: '0.75rem',
                        borderColor: '#e5e7eb',
                        '&:hover': {
                            borderColor: '#d1d5db'
                        }
                    }),
                    valueContainer: (base) => ({
                        ...base,
                        padding: '0 6px',
                        height: '24px'
                    }),
                    input: (base) => ({
                        ...base,
                        margin: '0px',
                        padding: '0px',
                        height: '24px',
                        fontSize: '0.75rem'
                    }),
                    menu: (base) => ({
                        ...base,
                        zIndex: 9999,
                        position: 'absolute',
                        minWidth: '100%',
                        width: 'max-content',
                        backgroundColor: 'white',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        border: '1px solid #e5e7eb'
                    }),
                    menuPortal: (base) => ({
                        ...base,
                        zIndex: 9999,
                        pointerEvents: 'auto'
                    }),
                    container: (base) => ({
                        ...base,
                        position: 'relative',
                        zIndex: 50
                    }),
                    option: (base, state) => ({
                        ...base,
                        backgroundColor: state.data.isSuggested ? 
                            (state.isSelected ? '#2684FF' : 'transparent') : 
                            (state.isSelected ? '#2684FF' : 'transparent'),
                        color: state.data.isSuggested ? 
                            (state.isSelected ? 'white' : '#3B82F6') :
                            (state.isSelected ? 'white' : 'black'),
                        fontSize: '0.75rem',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        '&:hover': {
                            backgroundColor: '#EBF5FF'
                        }
                    }),
                    group: (base) => ({
                        ...base,
                        paddingTop: 4,
                        paddingBottom: 4
                    }),
                    groupHeading: (base) => ({
                        ...base,
                        fontSize: '0.75rem',
                        color: '#666',
                        fontWeight: 600,
                        marginBottom: 2,
                        padding: '2px 8px'
                    }),
                    indicatorsContainer: (base) => ({
                        ...base,
                        height: '24px'
                    }),
                    clearIndicator: (base) => ({
                        ...base,
                        padding: '2px'
                    }),
                    dropdownIndicator: (base) => ({
                        ...base,
                        padding: '2px'
                    })
                }}
                classNamePrefix="react-select"
                menuPortalTarget={document.body}
                menuPlacement="auto"
            />
        </div>
    );
}; 