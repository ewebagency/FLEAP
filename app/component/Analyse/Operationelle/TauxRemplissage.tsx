'use client'
import React, { useMemo, useState } from "react";
import { useAnalysis } from "@/app/analysis/AnalysisProvider";
import { BSD } from '@/app/analysis/AnalysisProvider';

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

    return (
        <div 
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <div className="flex flex-col space-y-2">
                <div className="text-sm text-gray-600">
                    Taux de remplissage
                </div>
                <div className="text-xl font-medium text-gray-700 ml-2">
                    {averageFillRate.toFixed(1)} %
                </div>
            </div>

            {showTooltip && (
                <div className="absolute z-10 bottom-0 right-full mr-2 bg-gray-800 text-white p-2 rounded-lg shadow-lg text-xs w-48">
                    <div className="font-semibold mb-1">{credibilityScore.toFixed(1)}% de BSD renseignés</div>
                </div>
            )}
        </div>
    );
}

export default TauxRemplissage;
