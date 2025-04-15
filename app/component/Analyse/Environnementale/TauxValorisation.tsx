'use client'
import React, { useMemo, useState } from "react";
import { useAnalysis } from "@/app/analysis/AnalysisProvider";
import { tauxValorisationGlobale, tauxValorisationMatière } from "./codeTraitement";

const TauxValorisation = () => {
    const { bsds } = useAnalysis();
    const [showTooltipMatiere, setShowTooltipMatiere] = useState(false);
    const [showTooltipGlobale, setShowTooltipGlobale] = useState(false);

    const { globalValorizationRate, materialValorizationRate, credibilityScore, processedBsdsCount } = useMemo(() => {
        const bsdsWithProcessingOperation = bsds.filter(bsd => 
            bsd.infos_json?.formAPI?.createFormInput?.recipient?.processingOperation
        );
        const totalBsds = bsds.length;

        const globallyValorizedBsds = bsdsWithProcessingOperation.filter(bsd => {
            const processingCode = bsd.infos_json?.formAPI?.createFormInput?.recipient?.processingOperation
                ?.replace(/\s+/g, '');
            return processingCode && tauxValorisationGlobale.includes(processingCode);
        });

        const materiallyValorizedBsds = bsdsWithProcessingOperation.filter(bsd => {
            const processingCode = bsd.infos_json?.formAPI?.createFormInput?.recipient?.processingOperation
                ?.replace(/\s+/g, '');
            return processingCode && tauxValorisationMatière.includes(processingCode);
        });

        const globalValorizationRate = bsdsWithProcessingOperation.length > 0 
            ? (globallyValorizedBsds.length / bsdsWithProcessingOperation.length) * 100 
            : 0;

        const materialValorizationRate = bsdsWithProcessingOperation.length > 0 
            ? (materiallyValorizedBsds.length / bsdsWithProcessingOperation.length) * 100 
            : 0;

        const credibilityScore = totalBsds > 0 
            ? (bsdsWithProcessingOperation.length / totalBsds) * 100 
            : 0;

        return { 
            globalValorizationRate, 
            materialValorizationRate,
            credibilityScore,
            processedBsdsCount: bsdsWithProcessingOperation.length 
        };
    }, [bsds]);

    return (
        <div className="flex flex-row gap-4">
            {/* Taux de valorisation matière */}
            <div 
                className="relative rounded-lg"
                onMouseEnter={() => setShowTooltipMatiere(true)}
                onMouseLeave={() => setShowTooltipMatiere(false)}
            >
                <div className="flex flex-col space-y-1">
                    <div className="text-sm font-medium text-gray-600 mb-1">
                        Valorisation matière
                    </div>
                    <div className="text-xl font-medium text-gray-800">
                        {materialValorizationRate.toFixed(1)} %
                    </div>
                </div>

                {showTooltipMatiere && (
                    <div className="absolute z-10 bottom-0 right-full mr-2 bg-gray-800 text-white p-2 rounded-lg shadow-lg text-xs w-48">
                        <div className="font-semibold">Sur {credibilityScore.toFixed(1)}% de BSD renseignés</div>
                        <div className="text-gray-400">({processedBsdsCount} ont un code de traitement)</div>
                    </div>
                )}
            </div>

            {/* Taux de valorisation globale */}
            <div 
                className="relative rounded-lg"
                onMouseEnter={() => setShowTooltipGlobale(true)}
                onMouseLeave={() => setShowTooltipGlobale(false)}
            >
                <div className="flex flex-col space-y-1">
                    <div className="text-sm font-medium text-gray-600 mb-1">
                        Valorisation globale
                    </div>
                    <div className="text-xl font-medium text-gray-800">
                        {globalValorizationRate.toFixed(1)} %
                    </div>
                </div>

                {showTooltipGlobale && (
                    <div className="absolute z-10 bottom-0 right-full mr-2 bg-gray-800 text-white p-2 rounded-lg shadow-lg text-xs w-48">
                        <div className="font-semibold">Sur {credibilityScore.toFixed(1)}% de BSD renseignés</div>
                        <div className="text-gray-400">({processedBsdsCount} ont un code de traitement)</div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default TauxValorisation; 