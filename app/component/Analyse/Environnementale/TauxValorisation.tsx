'use client'
import React, { useMemo, useState } from "react";
import { useAnalysis } from "@/app/analysis/AnalysisProvider";
import { tauxValorisationGlobale, tauxValorisationMatière, tauxValorisationEnergetique, findBestMatchingCode } from "./codeTraitement";
import { BSD } from '@/app/analysis/AnalysisProvider';

// Fonction exportée pour calculer les taux de valorisation
export const calculateTauxValorisation = (bsds: BSD[]) => {
    let totalTonnage = 0;
    let globallyValorizedTonnage = 0;
    let materiallyValorizedTonnage = 0;
    let energeticallyValorizedTonnage = 0;
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
            let bsdEnergeticallyValorizedTonnage = 0;

            recipient.valoParts.forEach((part: { tonnage: number; code_valo: string }) => {
                const tonnage = part.tonnage || 0;
                const codeValo = part.code_valo || '';
                
                bsdTotalTonnage += tonnage;
                
                // Utiliser findBestMatchingCode pour nettoyer et faire correspondre le code
                const matchedGlobalCode = findBestMatchingCode(codeValo, tauxValorisationGlobale);
                const matchedMatiereCode = findBestMatchingCode(codeValo, tauxValorisationMatière);
                const matchedEnergétiqueCode = (codeValo === 'R1' || codeValo === 'R 1') ? true : false;
                
                if (matchedGlobalCode) {
                    bsdGloballyValorizedTonnage += tonnage;
                }
                
                if (matchedMatiereCode) {
                    bsdMateriallyValorizedTonnage += tonnage;
                }

                if (matchedEnergétiqueCode) {
                    bsdEnergeticallyValorizedTonnage += tonnage;
                }
            });

            if (bsdTotalTonnage > 0) {
                totalTonnage += bsdTotalTonnage;
                globallyValorizedTonnage += bsdGloballyValorizedTonnage;
                materiallyValorizedTonnage += bsdMateriallyValorizedTonnage;
                energeticallyValorizedTonnage += bsdEnergeticallyValorizedTonnage;
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
                const matchedEnergétiqueCode = (processingCode === 'R1' || processingCode === 'R 1') ? true : false;
                
                if (matchedGlobalCode) {
                    globallyValorizedTonnage += tonnage;
                }
                
                if (matchedMatiereCode) {
                    materiallyValorizedTonnage += tonnage;
                }

                if (matchedEnergétiqueCode) {
                    energeticallyValorizedTonnage += tonnage;
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

    const energeticValorizationRate = totalTonnage > 0 
        ? (energeticallyValorizedTonnage / totalTonnage) * 100 
        : 0;

    const credibilityScore = bsds.length > 0 
        ? (processedBsdsCount / bsds.length) * 100 
        : 0;

    return { 
        globalValorizationRate, 
        materialValorizationRate,
        energeticValorizationRate,
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
    const [showTooltipEnergetique, setShowTooltipEnergetique] = useState(false);

    const { globalValorizationRate, materialValorizationRate, energeticValorizationRate, credibilityScore, processedBsdsCount, totalTonnage, valorizedTonnage } = useMemo(() => {
        return calculateTauxValorisation(bsds);
    }, [bsds]);

    return (
        <div className="grid grid-cols-3 gap-2">
            {/* Taux de valorisation énergétique */}
            <div 
                className="relative bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-2 shadow-sm hover:shadow-md transition-all duration-200"
                onMouseEnter={() => setShowTooltipEnergetique(true)}
                onMouseLeave={() => setShowTooltipEnergetique(false)}
            >
                <div className="text-xs text-orange-600 mb-1">
                    <p>Valorisation</p>
                    <p>Energétique</p>
                </div>
                
                <div className="flex items-center justify-between gap-2">
                    <div className="text-lg font-bold text-orange-800">
                        {energeticValorizationRate.toFixed(1)}%
                    </div>
                    <div className="w-6 h-6 bg-orange-500 rounded-md flex items-center justify-center hidden">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                </div>

                {showTooltipEnergetique && (
                    <div className="absolute z-20 bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white p-3 rounded-lg shadow-xl text-xs w-56">
                        <div className="font-semibold mb-1">Détails valorisation énergétique</div>
                        <div className="text-gray-300">Code: R1</div>
                        <div className="text-gray-300">Sur {credibilityScore.toFixed(1)}% de BSD renseignés</div>
                        <div className="text-gray-300">({processedBsdsCount} ont un code de traitement)</div>
                        <div className="text-gray-300">Total: {totalTonnage.toFixed(1)} tonnes</div>
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                )}
            </div>

            {/* Taux de valorisation matière */}
            <div 
                className="relative bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-2 shadow-sm hover:shadow-md transition-all duration-200"
                onMouseEnter={() => setShowTooltipMatiere(true)}
                onMouseLeave={() => setShowTooltipMatiere(false)}
            >
                <div className="text-xs text-green-600 mb-1">
                    <p>Valorisation</p>
                    <p>Matière</p>
                </div>
                
                <div className="flex items-center justify-between gap-2">
                    <div className="text-lg font-bold text-green-800">
                        {materialValorizationRate.toFixed(1)}%
                    </div>
                    <div className="w-6 h-6 bg-green-500 rounded-md flex items-center justify-center hidden">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                </div>

                {showTooltipMatiere && (
                    <div className="absolute z-20 bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white p-3 rounded-lg shadow-xl text-xs w-56">
                        <div className="font-semibold mb-1">Détails valorisation matière</div>
                        <div className="text-gray-300">Codes: R2 - R13</div>
                        <div className="text-gray-300">Sur {credibilityScore.toFixed(1)}% de BSD renseignés</div>
                        <div className="text-gray-300">({processedBsdsCount} ont un code de traitement)</div>
                        <div className="text-gray-300">Total: {totalTonnage.toFixed(1)} tonnes</div>
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                )}
            </div>

            {/* Taux de valorisation globale */}
            <div 
                className="relative bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-2 shadow-sm hover:shadow-md transition-all duration-200"
                onMouseEnter={() => setShowTooltipGlobale(true)}
                onMouseLeave={() => setShowTooltipGlobale(false)}
            >
                <div className="text-xs text-blue-600 mb-1">
                    <p>Valorisation</p>
                    <p>Globale</p>
                </div>
                
                <div className="flex items-center justify-between gap-2">
                    <div className="text-lg font-bold text-blue-800">
                        {globalValorizationRate.toFixed(1)}%
                    </div>
                    <div className="w-6 h-6 bg-blue-500 rounded-md flex items-center justify-center hidden">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                </div>

                {showTooltipGlobale && (
                    <div className="absolute z-20 bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white p-3 rounded-lg shadow-xl text-xs w-56">
                        <div className="font-semibold mb-1">Détails valorisation globale</div>
                        <div className="text-gray-300">Codes: R1 - R13</div>
                        <div className="text-gray-300">Sur {credibilityScore.toFixed(1)}% de BSD renseignés</div>
                        <div className="text-gray-300">({processedBsdsCount} ont un code de traitement)</div>
                        <div className="text-gray-300">Total: {totalTonnage.toFixed(1)} tonnes</div>
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default TauxValorisation; 