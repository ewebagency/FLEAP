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
    onMobile?: boolean;
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
    onMobile = false,
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
                return "bg-gray-200";
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
            <div className={`${onMobile ? 'w-full' : 'w-[400px]'} overflow-x-auto my-0.5 ${display ? "block" : "hidden"}`}>
                <div className="flex justify-start items-center space-x-2">
                    <div className={`${onMobile ? 'w-[80px]' : 'w-[120px]'} text-right text-xs text-gray-500 ${stylePrimary ? 'font-medium' : 'font-thin'}`}>{titre}</div>
                    {changeLoad ? (
                        <div className="w-[20px] text-center animate-spin">♻</div>
                    ) : (
                        <div className={`${onMobile ? 'w-[200px]' : 'w-[260px]'}`}>
                            {enabled ? (
                                <CreatableSelect
                                    isClearable
                                    isSearchable
                                    options={selectOptions}
                                    value={currentValue}
                                    onChange={handleSelectChange}
                                    placeholder={placeholder}
                                    className="text-xs"
                                    formatCreateLabel={(inputValue: string) => `Créer "${inputValue}"`}
                                    noOptionsMessage={() => "Aucune option"}
                                    filterOption={filterOption}
                                    menuPortalTarget={document.body}
                                    menuPosition="fixed"
                                    createOptionPosition="first"
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            minHeight: '16px',
                                            backgroundColor: getBackgroundColor(), //stylePrimary ? '#EBF5FF' : getBackgroundColor(),
                                            borderColor: stylePrimary ? '#43A047' : base.borderColor,
                                            borderWidth: '1px',//stylePrimary ? '2px' : '1px',
                                            fontSize: '0.65rem'
                                        }),
                                        valueContainer: (base) => ({
                                            ...base,
                                            padding: '0 3px'
                                        }),
                                        input: (base) => ({
                                            ...base,
                                            margin: '0px',
                                            fontSize: '0.65rem'
                                        }),
                                        menu: (base) => ({
                                            ...base,
                                            zIndex: 9999,
                                            position: 'absolute',
                                            width: '100%',
                                            backgroundColor: 'white',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                            fontSize: '0.65rem'
                                        }),
                                        menuPortal: (base) => ({
                                            ...base,
                                            zIndex: 9999
                                        }),
                                        option: (base, state) => ({
                                            ...base,
                                            backgroundColor: state.data.isFiltered ? 
                                                (state.isSelected ? '#2684FF' : '#E8F0FE') : 
                                                (state.isSelected ? '#2684FF' : 'white'),
                                            color: state.isSelected ? 'white' : 'black',
                                            fontSize: '0.65rem',
                                            padding: '4px 8px'
                                        }),
                                        group: (base) => ({
                                            ...base,
                                            paddingTop: 4,
                                            paddingBottom: 4
                                        }),
                                        groupHeading: (base) => ({
                                            ...base,
                                            fontSize: '0.65rem',
                                            color: '#666',
                                            fontWeight: 600,
                                            marginBottom: 2,
                                            padding: '2px 8px'
                                        }),
                                        dropdownIndicator: (base) => ({
                                            ...base,
                                            padding: 2
                                        }),
                                        clearIndicator: (base) => ({
                                            ...base,
                                            padding: 2
                                        }),
                                        indicatorSeparator: (base) => ({
                                            ...base,
                                            margin: 2
                                        })
                                    }}
                                    isValidNewOption={(inputValue) => {
                                        return inputValue.length > 0;
                                    }}
                                />
                            ) : (
                                <div className={`w-full text-xs border border-gray-400 rounded-md p-2 whitespace-nowrap overflow-x-auto ${stylePrimary ? 'bg-blue-50 border-blue-500 border-2' : getBackgroundColor()}`}>
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
