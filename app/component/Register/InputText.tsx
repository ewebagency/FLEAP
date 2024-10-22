import React from "react";

interface InputTextProps {
    titre: string;
    placeholder: string;
    type: string;
    width?: number;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const InputText: React.FC<InputTextProps> = ({ titre, placeholder, type, width = 1, name, value, onChange }: InputTextProps) => {
    const w = width * 230; // Utilise la valeur par défaut de 1 si width n'est pas fourni
    return (
        <div>
            <label className={`form-control w-[${w}px]`}>
                <div className="label">
                    <span className="label-text">{titre}</span>
                    <span className="label-text-alt"></span>
                </div>
                <input type={type} placeholder={placeholder} className="input input-bordered" name={name} value={value} onChange={onChange}/>
                <div className="label">
                    <span className="label-text-alt"></span>
                    <span className="label-text-alt"></span>
                </div>
            </label>
        </div>
    );
}

export default InputText;
