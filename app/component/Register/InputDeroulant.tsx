import React from "react";

interface InputDeroulantProps {
    titre: string;
    placeholder: string;
    options: string[];
    width?: number;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    enabled?: boolean;
    changeLoad?: boolean;
}

const InputDeroulant: React.FC<InputDeroulantProps> = ({titre, placeholder, options, width=1, name, value, onChange, enabled=true, changeLoad=false}:InputDeroulantProps) => {
    //console.log(titre, options, name, value);
    const w = width*230;
    return (
        <div>
        {/*<div>
            <label className={`form-control w-[${w}px]`}>
                <div className="label">
                    <span className="label-text">{titre}</span>
                    <span className="label-text-alt"></span>
                </div>
                <select className="select select-bordered" name={name} value={value} onChange={onChange}>
                    <option disabled selected>{placeholder}</option>
                    {options.map((option,index)=>(
                        <option key={index}>{option}</option>
                    ))}
                    
                </select>
            </label>
        </div>*/}
            <div className="w-[350px] overflow-x-auto my-1">
                <div className="flex justify-start items-center space-x-4">
                    {/* Label avec une largeur fixe pour un alignement uniforme */}
                    <div className="w-[120px] text-right text-xs font-thin">{titre}</div>
                    {changeLoad ? <div className="w-[20px] text-center animate-spin">♻</div>
                                : 
                        <div>
                            {enabled ?
                            <select className="w-[210px] flex-1 text-xs border border-black rounded-md p-2 whitespace-nowrap overflow-x-auto" name={name} value={value} onChange={onChange}>
                                <option disabled selected>{placeholder}</option>
                                {options.map((option,index)=>(
                                    <option key={index}>{option}</option>
                                ))}
                            </select> :
                            <div className="w-[210px] flex-1 text-xs border border-gray-400 rounded-md p-2 whitespace-nowrap overflow-x-auto">{value}</div>
                            }
                        </div>
                    }
                </div>
            </div>
        </div>

    )


}

export default InputDeroulant;
