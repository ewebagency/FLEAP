import React, { useState } from "react";

interface InputDeroulantProps {
    titre: string;
    placeholder: string;
    options: string[];
    width?: number;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    onTextChange: (name: string, value: string) => void;
    enabled?: boolean;
    changeLoad?: boolean;
    enableText?: boolean;
    stade?: "freeze" | "current" | "done";
}

const InputDeroulant: React.FC<InputDeroulantProps> = ({titre, placeholder, options, width=1, name, value, onChange, onTextChange, enabled=true, changeLoad=false, enableText=true, stade="freeze"}:InputDeroulantProps) => {
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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>) => {
        if (enableText && !isTextMode) {
            setIsTextMode(true);
        }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onTextChange(name, e.target.value);
    };

    return (
        <div>
            <div className="w-[350px] overflow-x-auto my-1">
                <div className="flex justify-start items-center space-x-4">
                    <div className="w-[120px] text-right text-xs font-thin">{titre}</div>
                    {changeLoad ? <div className="w-[20px] text-center animate-spin">♻</div>
                                : 
                        <div>
                            {enabled ? 
                                isTextMode ? (
                                    <input
                                        type="text"
                                        className={`w-[210px] flex-1 text-xs border border-black rounded-md p-2 ${getBackgroundColor()}`}
                                        name={name}
                                        value={value}
                                        onChange={handleTextChange}
                                        onBlur={() => setIsTextMode(false)}
                                    />
                                ) : (
                                    <select
                                        className={`w-[210px] flex-1 text-xs border border-black rounded-md p-2 whitespace-nowrap overflow-x-auto ${getBackgroundColor()}`}
                                        name={name}
                                        value={value}
                                        onChange={onChange}
                                        onKeyDown={handleKeyDown}
                                    >
                                        <option value={value} hidden>{value}</option>
                                        {options.map((option, index) => (
                                            <option key={index} value={option}>{option}</option>
                                        ))}
                                    </select>
                                )
                            : 
                            <div className={`w-[210px] flex-1 text-xs border border-gray-400 rounded-md p-2 whitespace-nowrap overflow-x-auto ${getBackgroundColor()}`}>
                                {value}
                            </div>
                            }
                        </div>
                    }
                </div>
            </div>
        </div>
    );
}

export default InputDeroulant;
