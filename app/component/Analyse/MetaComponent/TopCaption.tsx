import React from "react";


const TopCaption = () => {
    return (
        <div className="flex justify-between m-1">
            <div className="flex items-end">
                <div className="text-sm text-gray-400 font-light">Coûts et revenues (HT)</div>    
                <div className="ml-3 text-[10px] text-gray-400 font-light">inclus les coûts de location des contenants</div>    
            </div>
            <div className="join">
                <input className="join-item btn btn-xs text-[10px] font-normal" type="radio" name="options" aria-label="HT" />
                <input className="join-item btn btn-xs text-[10px] font-normal" type="radio" name="options" aria-label="TTC" />
            </div>
        </div>
    )
}

export default TopCaption