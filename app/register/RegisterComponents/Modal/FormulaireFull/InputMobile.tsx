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

interface InputMobileProps {
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
    popup?: boolean;
    hideIndicators?: boolean;
    onFocus?: () => void;
}

const InputMobile: React.FC<InputMobileProps> = ({
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
    popup = false,
    hideIndicators = false,
    onFocus,
}: InputMobileProps) => {
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
        <div className="relative w-full mr-2">
            <div className={`${display ? "block" : "hidden"} w-full`}>
                <div className="relative flex items-center w-full">
                    {titre && (
                        <div className={`${onMobile ? 'w-[70px]' : 'w-[120px]'} text-right text-base text-gray-500 mr-2 ${stylePrimary ? 'font-medium' : 'font-thin'}`}>
                            {titre}
                        </div>
                    )}
                    {changeLoad ? (
                        <div className="w-[20px] text-center animate-spin">♻</div>
                    ) : (
                        <div className="flex-1">
                            {enabled ? (
                                <CreatableSelect
                                    isClearable
                                    isSearchable
                                    options={selectOptions}
                                    value={currentValue}
                                    onChange={handleSelectChange}
                                    onFocus={onFocus}
                                    placeholder={placeholder}
                                    className="text-xs"
                                    formatCreateLabel={(inputValue: string) => `Créer "${inputValue}"`}
                                    noOptionsMessage={() => "Aucune option"}
                                    filterOption={filterOption}
                                    menuPosition="absolute"
                                    createOptionPosition="first"
                                    styles={{
                                        container: (base) => ({
                                            ...base,
                                            width: '100%',
                                            position: 'relative',
                                            height: '42px',
                                        }),
                                        control: (base) => ({
                                            ...base,
                                            minHeight: '42px !important',
                                            height: '42px !important',
                                            backgroundColor: getBackgroundColor(),
                                            borderColor: stylePrimary ? '#43A047' : base.borderColor,
                                            borderWidth: '1px',
                                            fontSize: '16px',
                                            width: '100%',
                                            borderRadius: '4px',
                                            ...(popup && {
                                                padding: '0 8px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            })
                                        }),
                                        clearIndicator: (base) => ({
                                            ...base,
                                            display: hideIndicators ? 'none' : popup ? 'none' : 'flex'
                                        }),
                                        indicatorSeparator: (base) => ({
                                            ...base,
                                            display: hideIndicators ? 'none' : popup ? 'none' : 'flex'
                                        }),
                                        valueContainer: (base) => ({
                                            ...base,
                                            padding: popup ? '0 8px' : '0 3px',
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            ...(popup && {
                                                justifyContent: 'center',
                                            })
                                        }),
                                        input: (base) => ({
                                            ...base,
                                            margin: '0px',
                                            padding: '0px',
                                            fontSize: '16px',
                                            '-webkit-tap-highlight-color': 'transparent',
                                            ...(popup && {
                                                textAlign: 'center'
                                            })
                                        }),
                                        singleValue: (base) => ({
                                            ...base,
                                            position: 'absolute',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            maxWidth: 'calc(100% - 20px)',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            ...(popup && {
                                                textAlign: 'center',
                                                left: '50%',
                                                transform: 'translate(-50%, -50%)'
                                            })
                                        }),
                                        menu: (base) => ({
                                            ...base,
                                            zIndex: 9999,
                                            position: 'absolute',
                                            width: '100%',
                                            backgroundColor: 'white',
                                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                            fontSize: '16px',
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            marginTop: '4px'
                                        }),
                                        option: (base, state) => ({
                                            ...base,
                                            backgroundColor: state.data.isFiltered ? 
                                                (state.isSelected ? '#2684FF' : '#E8F0FE') : 
                                                (state.isSelected ? '#2684FF' : 'white'),
                                            color: state.isSelected ? 'white' : 'black',
                                            fontSize: '16px',
                                            padding: '12px 8px'
                                        }),
                                        group: (base) => ({
                                            ...base,
                                            paddingTop: 4,
                                            paddingBottom: 4
                                        })
                                    }}
                                />
                            ) : (
                                <div className={`w-full text-xs border border-gray-400 rounded-md p-2 whitespace-nowrap overflow-hidden text-ellipsis ${stylePrimary ? 'bg-blue-50 border-blue-500 border-2' : getBackgroundColor()}`}>
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

export default InputMobile;
