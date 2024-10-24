import { useAnalysisContext } from "@/app/analysis/AnalysisContext";
import { table } from "console";
import React, { useEffect, useState } from "react";


const AnalOpTable = () => {
    const { valueChain, selectedMaterials, serverData } = useAnalysisContext()


    // Assurez-vous que vous utilisez tableData correctement dans votre rendu
    const data: { id: number; type: string; collecte: number; remplissage: number; declassement: number }[] = [];
    serverData.datasets.map((row) => {
        data.push({
            id:row.id, type: row.label, collecte: row.data[0], remplissage: row.remplissage[0], declassement: row.declassement
        })
    })

    const filteredData = data.filter( (data:{id:number}) => 
        selectedMaterials.some((material:{id:number;  checked:boolean}) => ( (material.id === data.id) && material.checked))
    );


    return (
        <div className="text-center">
            <div className="text-gray-300 text-sm">Nombre de collecte de filière par mois</div>
                <table className="border-collapse border border-gray-300 text-xs w-32">
                    <thead>
                    <tr>
                        <th className="border border-gray-300 px-2 py-1">Type de Déchets</th>
                        <th className="border border-gray-300 px-2 py-1">Nombre de collecte moyen par mois</th>
                        <th className="border border-gray-300 px-2 py-1">Taux de remplissage moyen</th>
                        <th className="border border-gray-300 px-2 py-1">Déclassement</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filteredData && filteredData.map((row, index) => (
                        <tr key={index} className="odd:bg-gray-100 even:bg-white">
                        <td className="border border-gray-300 px-2 py-1">{row.type}</td>
                        <td className="border border-gray-300 px-2 py-1">{row.collecte}</td>
                        <td className="border border-gray-300 px-2 py-1">{row.remplissage}</td>
                        <td className="border border-gray-300 px-2 py-1">{row.declassement}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
    )
}

export default AnalOpTable