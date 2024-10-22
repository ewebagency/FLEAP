import React from "react";

interface InputDeroulantProps {
    titre: string;
    placeholder: string;
    options: string[];
    width?: number;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

const InputDeroulant: React.FC<InputDeroulantProps> = ({titre, placeholder, options, width=1, name, value, onChange}:InputDeroulantProps) => {
    const w = width*230;
    return (
        <div>
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
        </div>
    )


}

export default InputDeroulant;
