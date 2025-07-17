'use client'
import React, { useMemo, useState } from "react";
import { useAnalysis } from "@/app/analysis/AnalysisProvider";
import { tauxValorisationGlobale, tauxValorisationMatière, findBestMatchingCode } from "./codeTraitement";
import { BSD } from '@/app/analysis/AnalysisProvider';

// Fonction exportée pour calculer les taux de valorisation
export const calculateTauxValorisation = (bsds: BSD[]) => {
    let totalTonnage = 0;
    let globallyValorizedTonnage = 0;
    let materiallyValorizedTonnage = 0;
    let processedBsdsCount = 0;

    bsds.forEach(bsd => {
        const recipient = bsd.infos_json?.formAPI?.createFormInput?.recipient;
        
        if (!recipient) return;

        // Vérifier si valoParts existe
        
        if (recipient.valoParts && Array.isArray(recipient.valoParts)) {    
            // Utiliser valoParts avec les tonnages
            let bsdTotalTonnage = 0;
            let bsdGloballyValorizedTonnage = 0;
            let bsdMateriallyValorizedTonnage = 0;

            recipient.valoParts.forEach((part: { tonnage: number; code_valo: string }) => {
                const tonnage = part.tonnage || 0;
                const codeValo = part.code_valo || '';
                
                bsdTotalTonnage += tonnage;
                
                // Utiliser findBestMatchingCode pour nettoyer et faire correspondre le code
                const matchedGlobalCode = findBestMatchingCode(codeValo, tauxValorisationGlobale);
                const matchedMatiereCode = findBestMatchingCode(codeValo, tauxValorisationMatière);
                
                if (matchedGlobalCode) {
                    bsdGloballyValorizedTonnage += tonnage;
                }
                
                if (matchedMatiereCode) {
                    bsdMateriallyValorizedTonnage += tonnage;
                }
            });

            if (bsdTotalTonnage > 0) {
                totalTonnage += bsdTotalTonnage;
                globallyValorizedTonnage += bsdGloballyValorizedTonnage;
                materiallyValorizedTonnage += bsdMateriallyValorizedTonnage;
                processedBsdsCount++;
            }
        } else if (recipient.processingOperation) {
            // Fallback sur processingOperation (ancienne méthode)
            const processingCode = recipient.processingOperation;
            const tonnage = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity || 0;
            
            if (processingCode && tonnage > 0) {
                totalTonnage += tonnage;
                
                // Utiliser findBestMatchingCode pour nettoyer et faire correspondre le code
                const matchedGlobalCode = findBestMatchingCode(processingCode, tauxValorisationGlobale);
                const matchedMatiereCode = findBestMatchingCode(processingCode, tauxValorisationMatière);
                
                if (matchedGlobalCode) {
                    globallyValorizedTonnage += tonnage;
                }
                
                if (matchedMatiereCode) {
                    materiallyValorizedTonnage += tonnage;
                }
                
                processedBsdsCount++;
            }
        }
    });

    const globalValorizationRate = totalTonnage > 0 
        ? (globallyValorizedTonnage / totalTonnage) * 100 
        : 0;

    const materialValorizationRate = totalTonnage > 0 
        ? (materiallyValorizedTonnage / totalTonnage) * 100 
        : 0;

    const credibilityScore = bsds.length > 0 
        ? (processedBsdsCount / bsds.length) * 100 
        : 0;

    return { 
        globalValorizationRate, 
        materialValorizationRate,
        credibilityScore,
        processedBsdsCount,
        totalTonnage,
        valorizedTonnage: globallyValorizedTonnage
    };
};

const TauxValorisation = () => {
    const { bsds } = useAnalysis();
    const [showTooltipMatiere, setShowTooltipMatiere] = useState(false);
    const [showTooltipGlobale, setShowTooltipGlobale] = useState(false);

    const { globalValorizationRate, materialValorizationRate, credibilityScore, processedBsdsCount, totalTonnage, valorizedTonnage } = useMemo(() => {
        return calculateTauxValorisation(bsds);
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
                        <div className="text-gray-400">Total: {totalTonnage.toFixed(1)} tonnes</div>
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
                        <div className="text-gray-400">Total: {totalTonnage.toFixed(1)} tonnes</div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default TauxValorisation; 