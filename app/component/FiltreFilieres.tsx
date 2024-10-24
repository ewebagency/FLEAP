"use client"
import React, { useContext } from "react";
import { AnalysisContext, useAnalysisContext } from "../analysis/AnalysisContext";

interface FiltreFilieresProps {
    //selectedMaterials: { id: number; checked: boolean; color: string; label: string; }[];
    onMaterialsChange: (id: number) => void;
}

const FiltreFilieres: React.FC<FiltreFilieresProps> = ({ onMaterialsChange }) => {
    const { valueChain, selectedMaterials, serverData } = useAnalysisContext();
    
    return (
        <div className="join m-5">
            {selectedMaterials.map((item, index) => (
                <label
                    key={item.id}
                    className={`flex items-center cursor-pointer ${index === 0 ? 'rounded-l-md' : ''} ${index === selectedMaterials.length - 1 ? 'rounded-r-md' : ''}`}
                >
                    <input
                        className="hidden"
                        type="checkbox"
                        name="options_material"
                        aria-label={item.label}
                        checked={item.checked}
                        onChange={() => onMaterialsChange(item.id)}
                    />
                    <span
                        className={`text-xs h-6 px-3 flex items-center justify-center transition-colors duration-200 text-sm ${
                            item.checked ? 'text-white ' + item.color : 'bg-gray-300 text-gray-700'
                        } ${index > 0 ? 'border-l-0' : ''} ${index === 0 ? 'rounded-l-md' : ''} ${index === selectedMaterials.length - 1 ? 'rounded-r-md' : ''}`}
                    >
                        {item.label}
                    </span>
                </label>
            ))}
        </div>
    )
}

export default FiltreFilieres;
