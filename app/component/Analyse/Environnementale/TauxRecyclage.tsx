'use client'
import React, { useMemo, useState } from "react";
import { useAnalysis } from "@/app/analysis/AnalysisProvider";
import { BSD } from '@/app/analysis/AnalysisProvider';
import { codesRecyclage, codesReutilisation } from "./codeTraitement";

const TauxRecyclage = () => {
    const { bsds } = useAnalysis();
    const [showTooltip, setShowTooltip] = useState(false);

    const { recyclingRate, credibilityScore, processedBsdsCount } = useMemo(() => {
        const RECYCLING_CODES: string[] = Array.from(new Set([...codesRecyclage, ...codesReutilisation]));
        const bsdsWithProcessingOperation = bsds.filter(bsd => 
            bsd.infos_json?.formAPI?.createFormInput?.recipient?.processingOperation
        );
        const totalBsds = bsds.length;

        const recycledBsds = bsdsWithProcessingOperation.filter(bsd => {
            const processingCode = bsd.infos_json?.formAPI?.createFormInput?.recipient?.processingOperation
                ?.replace(/\s+/g, ''); // Supprime les espaces
            return processingCode && RECYCLING_CODES.includes(processingCode);
        });

        const recyclingRate = bsdsWithProcessingOperation.length > 0 
            ? (recycledBsds.length / bsdsWithProcessingOperation.length) * 100 
            : 0;

        const credibilityScore = totalBsds > 0 
            ? (bsdsWithProcessingOperation.length / totalBsds) * 100 
            : 0;

        return { 
            recyclingRate, 
            credibilityScore,
            processedBsdsCount: bsdsWithProcessingOperation.length 
        };
    }, [bsds]);

    return (
        <div 
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <div className="flex flex-col space-y-2">
                <div className="text-sm text-gray-600">
                    Taux de recyclage
                </div>
                <div className="text-xl font-medium text-gray-700 ml-2">
                    {recyclingRate.toFixed(1)} %
                </div>
            </div>

            {showTooltip && (
                <div className="absolute z-10 bottom-0 right-full mr-2 bg-gray-800 text-white p-2 rounded-lg shadow-lg text-xs w-48">
                    <div className="font-semibold">Sur {credibilityScore.toFixed(1)}% de BSD renseignés</div>
                    <div className="text-gray-400">({processedBsdsCount} ont un code de traitement)</div>
                </div>
            )}
        </div>
    );
}

export default TauxRecyclage;
