'use client'
import React, { useMemo, useState } from "react";
import { DynamicCharts } from '../MetaComponent/ChartWrapper';
import { useAnalysis } from "@/app/analysis/AnalysisProvider";
import { BSD } from '@/app/analysis/AnalysisProvider';

const { Doughnut } = DynamicCharts;

const TauxRemplissage = () => {
    const { bsds } = useAnalysis();
    const [showTooltip, setShowTooltip] = useState(false);

    const { averageFillRate, credibilityScore } = useMemo(() => {
        const bsdsWithFillRate = bsds.filter(bsd => bsd.other_infos?.fillRate);
        const totalBsds = bsds.length;
        

        let totalFillRate = 0;
        bsdsWithFillRate.forEach((bsd: BSD) => {
            totalFillRate += parseFloat(bsd.other_infos.fillRate);
        });

        const averageFillRate = bsdsWithFillRate.length > 0 
            ? totalFillRate / bsdsWithFillRate.length 
            : 0;

        const credibilityScore = totalBsds > 0 
            ? (bsdsWithFillRate.length / totalBsds) * 100 
            : 0;

        return { averageFillRate, credibilityScore };
    }, [bsds]);

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
            data: [averageFillRate, 100 - averageFillRate],
            backgroundColor: [
                'rgba(34, 197, 94, 0.8)',  // vert pour le taux de remplissage
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
                        {averageFillRate.toFixed(1)}%
                    </span>
                </div>
            </div>
            <div className="text-xs text-gray-600 text-center mt-1">
                Remplissage
            </div>
            
            {showTooltip && (
                <div className="absolute z-10 bottom-0 right-full mr-2 bg-gray-800 text-white p-2 rounded-lg shadow-lg text-xs w-48">
                    <div className="font-semibold mb-1">{credibilityScore.toFixed(1)}% des bordereaux renseignés</div>
                </div>


            )}
        </div>
    );
}

export default TauxRemplissage;
