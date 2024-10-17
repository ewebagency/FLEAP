import React from "react";

const InputDeroulant = ({titre, placeholder, options}:{titre:string, placeholder:string, options:string[]}) => {

    return (
        <div>
            <label className="form-control w-full max-w-xs">
                <div className="label">
                    <span className="label-text">{titre}</span>
                    <span className="label-text-alt"></span>
                </div>
                <select className="select select-bordered">
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