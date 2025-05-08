import React, { useState } from "react";
import CreatableSelect from 'react-select/creatable';
import { ActionMeta, SingleValue } from 'react-select';

interface SelectOption {
  label: string;
  value: string;
  isFiltered: boolean;
}

interface SelectGroup {
  options: SelectOption[];
}

interface InputFullProps {
    titre: string;
    placeholder: string;
    options: {
        filteredOptions: string[];
        allOptions: string[];
    };
    width?: number;
    name: string;
    value: string | boolean;
    onChange: (e: React.ChangeEvent<HTMLSelectElement> | {
        target: {
            name: string;
            value: string;
        };
    }) => void | Promise<void>;
    enabled?: boolean;
    changeLoad?: boolean;
    enableText?: boolean;
    stade?: "freeze" | "current" | "done";
    display?: boolean;
    stylePrimary?: boolean;
    popup?: boolean;
    isCheckbox?: boolean;
}

const InputFull: React.FC<InputFullProps> = ({
    titre, 
    placeholder, 
    options, 
    width=1, 
    name, 
    value, 
    onChange, 
    enabled=true, 
    changeLoad=false, 
    enableText=true, 
    stade="freeze", 
    display=true,
    stylePrimary=false,
    popup=false,
    isCheckbox=false
}: InputFullProps) => {
    const [isTextMode, setIsTextMode] = useState(false);

    const getBackgroundColor = () => {
        switch(stade) {
            case "current":
                return "bg-yellow-200";
            case "done":
                return "bg-green-200";
            case "freeze":
            default:
                return "bg-white";
        }
    };

    //console.log("options", options);
    // Convertir les options en format attendu par CreatableSelect avec distinction des sources
    const selectOptions = [
        {
            options: options.filteredOptions.map(opt => ({
                label: String(opt),
                value: String(opt),
                isFiltered: true
            }))
        },
        {
            options: options.allOptions.map(opt => ({
                label: String(opt),
                value: String(opt),
                isFiltered: false
            }))
        }
    ].filter(group => group.options.length > 0);

    // Trouver la valeur actuelle dans les options
    const currentValue = value ? {
        label: String(value),
        value: String(value),
        isFiltered: true
    } : null;

    // Gérer le changement de valeur pour CreatableSelect
    const handleSelectChange = (
        newValue: SingleValue<SelectOption>,
        actionMeta: ActionMeta<SelectOption>
    ) => {
        if (actionMeta.action === 'create-option') {
            const formattedValue: SelectOption = {
                label: newValue?.label || '',
                value: newValue?.label || '',
                isFiltered: true
            };
            
            onChange({
                target: {
                    name: name,
                    value: formattedValue.value
                }
            });
        } else {
            onChange({
                target: {
                    name: name,
                    value: newValue?.value || ''
                }
            });
        }
    };

    // Fonction de filtrage personnalisée
    const filterOption = (option: { label: string }, inputValue: string) => {
        return option.label.toLowerCase().includes(inputValue.toLowerCase());
    };

    return (
        <div>
            <div className={`w-full max-w-full my-0.5 ${display ? "block" : "hidden"}`}>
                <div className="flex justify-start items-center space-x-2">
                    {!popup && titre && (
                        <div className={`w-[120px] text-right text-sm text-gray-500 ${stylePrimary ? 'font-medium' : 'font-thin'}`}>
                            {titre}
                        </div>
                    )}
                    {changeLoad ? (
                        <div className="w-[20px] text-center animate-spin">♻</div>
                    ) : (
                        <div className={popup ? 'w-full' : `w-[${(width * 10) - 120}px]`}>
                            {enabled ? (
                                isCheckbox ? (
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={value === true || value === 'true'}
                                            onChange={(e) => {
                                                onChange({
                                                    target: {
                                                        name,
                                                        value: e.target.checked.toString()
                                                    }
                                                });
                                            }}
                                            className={`h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${stylePrimary ? 'border-blue-500' : ''}`}
                                        />
                                    </div>
                                ) : (
                                    <CreatableSelect<SelectOption>
                                        isClearable
                                        isSearchable
                                        placeholder={placeholder}
                                        value={value ? { 
                                            label: value.toString(), 
                                            value: value.toString(),
                                            isFiltered: true 
                                        } : null}
                                        onChange={(newValue: SingleValue<SelectOption>, actionMeta: ActionMeta<SelectOption>) => {
                                            onChange({
                                                target: {
                                                    name,
                                                    value: newValue?.value || ''
                                                }
                                            });
                                        }}
                                        options={[
                                            ...options.filteredOptions.map(opt => ({
                                                label: opt,
                                                value: opt,
                                                isFiltered: true
                                            })),
                                            ...options.allOptions.map(opt => ({
                                                label: opt,
                                                value: opt,
                                                isFiltered: false
                                            }))
                                        ]}
                                        styles={{
                                            control: (base) => ({
                                                ...base,
                                                minHeight: popup ? '42px' : '16px',
                                                minWidth: '200px',
                                                width: popup ? '100%' : `${(width * 10) - 120}px`,
                                                backgroundColor: getBackgroundColor(),
                                                borderColor: stylePrimary ? '#43A047' : base.borderColor,
                                                borderWidth: '1px',
                                                fontSize: '0.8rem'
                                            }),
                                            valueContainer: (base) => ({
                                                ...base,
                                                padding: popup ? '6px 8px' : '0 3px'
                                            }),
                                            input: (base) => ({
                                                ...base,
                                                margin: '0px',
                                                fontSize: '0.8rem'
                                            }),
                                            menu: (base) => ({
                                                ...base,
                                                zIndex: 9999,
                                                position: 'absolute',
                                                width: '100%',
                                                backgroundColor: 'white',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                                fontSize: '0.8rem'
                                            }),
                                            menuPortal: (base) => ({
                                                ...base,
                                                zIndex: 9999
                                            }),
                                            option: (base, state) => ({
                                                ...base,
                                                backgroundColor: (state.data as SelectOption).isFiltered ? 
                                                    (state.isSelected ? '#2684FF' : '#E8F0FE') : 
                                                    (state.isSelected ? '#2684FF' : 'white'),
                                                color: state.isSelected ? 'white' : 'black',
                                                fontSize: '0.8rem',
                                                padding: popup ? '8px 12px' : '4px 8px'
                                            }),
                                            dropdownIndicator: (base) => ({
                                                ...base,
                                                padding: 2,
                                                display: popup ? 'none' : 'flex'
                                            }),
                                            clearIndicator: (base) => ({
                                                ...base,
                                                padding: 2,
                                                display: popup ? 'none' : 'flex'
                                            }),
                                            indicatorSeparator: (base) => ({
                                                ...base,
                                                margin: 2,
                                                display: popup ? 'none' : 'flex'
                                            })
                                        }}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                    />
                                )
                            ) : (
                                <div className={`w-full text-sm border border-gray-400 rounded-md p-2 whitespace-nowrap overflow-hidden text-ellipsis ${stylePrimary ? 'bg-blue-50 border-blue-500 border-2' : getBackgroundColor()}`}>
                                    {value}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InputFull;