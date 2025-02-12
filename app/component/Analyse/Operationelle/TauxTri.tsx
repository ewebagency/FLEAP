'use client'
import React, { useMemo, useState } from "react";
import { useAnalysis } from "@/app/analysis/AnalysisProvider";
import { getFiliere } from "@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new";
import { BSD } from '@/app/analysis/AnalysisProvider';

interface WasteDetail {
    code: string;
    description: string;
    quantity: number;
}

const TauxTri = () => {
    const { bsds, mappingTable } = useAnalysis();
    const [showTooltip, setShowTooltip] = useState(false);

    const { tauxTri, totalWeight, nonRecycledDetails } = useMemo(() => {
        let totalWeight = 0;
        let nonRecycledWeight = 0;
        const wasteDetails: { [key: string]: WasteDetail } = {};

        bsds.forEach((bsd: BSD) => {
            const quantity = bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity || 0;
            totalWeight += quantity;

            const filiere = getFiliere(
                bsd.infos_json.formAPI.createFormInput.wasteDetails.code,
                mappingTable
            ) || 'Autres';

            if (filiere === 'DIB' || filiere === 'Autres') {
                nonRecycledWeight += quantity;
                const code = bsd.infos_json.formAPI.createFormInput.wasteDetails.code;
                const description = bsd.infos_json.formAPI.createFormInput.wasteDetails.name;

                if (!wasteDetails[code]) {
                    wasteDetails[code] = {
                        code,
                        description,
                        quantity: 0
                    };
                }
                wasteDetails[code].quantity += quantity;
            }
        });

        // Trier les déchets par quantité décroissante
        const nonRecycledDetails = Object.values(wasteDetails)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5); // Garder les 5 plus importants

        const tauxTri = totalWeight > 0 ? ((totalWeight - nonRecycledWeight) / totalWeight) * 100 : 0;
        return { tauxTri, totalWeight, nonRecycledDetails };
    }, [bsds, mappingTable]);

    return (
        <div 
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <div className="flex flex-col space-y-2">
                <div className="text-sm text-gray-600">
                    Taux de tri
                </div>
                <div className="text-xl font-medium text-gray-700 ml-2">
                    {tauxTri.toFixed(1)} %
                </div>

            </div>

            {showTooltip && nonRecycledDetails.length > 0 && (
                <div className="absolute z-10 bottom-0 right-full mr-2 bg-gray-800 text-white p-2 rounded-lg shadow-lg text-xs w-64">
                    <div className="font-semibold mb-1">Déchets non triés :</div>
                    {nonRecycledDetails.map((waste, index) => (
                        <div key={index} className="mb-1">
                            <div className="flex justify-between">
                                <span>{waste.code}</span>
                                <span>{waste.quantity.toFixed(1)}T</span>
                            </div>
                            <div className="text-gray-300 text-[10px]">{waste.description}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default TauxTri;
