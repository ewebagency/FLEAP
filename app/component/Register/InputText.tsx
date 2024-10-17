import React from "react";

const InputText = ({titre, placeholder, type}:{titre:string, placeholder:string, type:string}) => {

    return (
        <div>
            <label className="form-control w-full max-w-xs">
                <div className="label">
                    <span className="label-text">{titre}?</span>
                    <span className="label-text-alt"></span>
                </div>
                <input type={type} placeholder={placeholder} className="input input-bordered w-full max-w-xs" />
                <div className="label">
                    <span className="label-text-alt"></span>
                    <span className="label-text-alt"></span>
                </div>
            </label>
        </div>
    )


}

export default InputText;