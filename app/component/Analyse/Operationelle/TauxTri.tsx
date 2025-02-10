'use client'
import React, { useMemo, useState } from "react";
import { DynamicCharts } from '../MetaComponent/ChartWrapper';
import { useAnalysis } from "@/app/analysis/AnalysisProvider";
import { getFiliere } from "@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new";
import { BSD } from '@/app/analysis/AnalysisProvider';

const { Doughnut } = DynamicCharts;

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

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        rotation: -90,
        circumference: 360,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                enabled: false
            }
        }
    };

    const data = {
        datasets: [{
            data: [tauxTri, 100 - tauxTri],
            backgroundColor: [
                'rgba(34, 197, 94, 0.8)',  // vert pour le taux de tri
                'rgba(229, 231, 235, 0.5)', // gris clair pour le reste
            ],
            borderWidth: 0,
        }]
    };

    return (
        <div 
            className="w-[100px] bg-white rounded-lg shadow p-1 relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <div className="h-[60px] relative">
                <Doughnut data={data} options={options} />
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-gray-700">
                        {tauxTri.toFixed(1)}%
                    </span>
                </div>
            </div>
            <div className="text-xs text-gray-600 text-center mt-1">
                Tri
            </div>
            

            {showTooltip && nonRecycledDetails.length > 0 && (
                <div className="absolute z-10 bottom-0 right-full mr-2 bg-gray-800 text-white p-2 rounded-lg shadow-lg text-xs w-64">
                    <div className="font-semibold mb-1">Principaux déchets non triés :</div>
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
