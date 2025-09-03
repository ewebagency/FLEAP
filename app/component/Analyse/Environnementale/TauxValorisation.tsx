'use client'
import React, { useMemo, useState } from "react";
import { useAnalysis } from "@/app/analysis/AnalysisProvider";
import { classifyTreatmentCode } from "./codeTraitement";
import { BSD } from '@/app/analysis/AnalysisProvider';
import { useFilterContext } from "@/app/FilterContext";

// Types pour les résultats
interface ValorisationResult {
    energeticValorizationRate: number;
    materialValorizationRate: number;
    globalValorizationRate: number;
    credibilityScore: number;
    processedBsdsCount: number;
    totalTonnage: number;
    valorizedTonnage: number;
    reemploiTonnage: number;
    reutilisationTonnage: number;
    reemploiRate: number;
    reutilisationRate: number;
}

// Interface pour les dates de filtrage
interface DateFilter {
    debut?: Date | null;
    fin?: Date | null;
}

// Fonction simplifiée pour calculer les taux de valorisation
export const calculateTauxValorisation = (bsds: BSD[], dateFilter?: DateFilter): ValorisationResult => {
    let totalTonnage = 0;
    let energeticTonnage = 0;
    let materialTonnage = 0;
    let reemploiTonnage = 0;
    let reutilisationTonnage = 0;
    let processedBsdsCount = 0;

    bsds.forEach(bsd => {
        // Filtrage par dates si spécifié
        if (dateFilter?.debut || dateFilter?.fin) {
            const date = new Date(bsd.infos_json?.formAPI?.createFormInput?.takenOverAt || bsd.created_at);
            const startDate = dateFilter.debut || new Date(0);
            const endDate = dateFilter.fin || new Date();
            
            if (date < startDate || date > endDate) return;
        }

        const recipient = bsd.infos_json?.formAPI?.createFormInput?.recipient;
        if (!recipient) return;

        // Traitement avec valoParts (méthode moderne)
        if (recipient.valoParts && Array.isArray(recipient.valoParts) && recipient.valoParts.length > 0) {
            let bsdTotalTonnage = 0;
            let bsdEnergeticTonnage = 0;
            let bsdMaterialTonnage = 0;
            let bsdReemploiTonnage = 0;
            let bsdReutilisationTonnage = 0;

            recipient.valoParts.forEach((part: { tonnage: number; code_valo: string }) => {
                const tonnage = part.tonnage || 0;
                const codeValo = part.code_valo || '';
                
                if (tonnage > 0) {
                    bsdTotalTonnage += tonnage;
                    
                    const treatmentType = classifyTreatmentCode(codeValo);
                    if (treatmentType === 'energetique') {
                        bsdEnergeticTonnage += tonnage;
                    } else if (treatmentType === 'matiere') {
                        bsdMaterialTonnage += tonnage;
                    } else if (treatmentType === 'reemploi') {
                        bsdReemploiTonnage += tonnage;
                    } else if (treatmentType === 'reutilisation') {
                        bsdReutilisationTonnage += tonnage;
                    }
                }
            });

            if (bsdTotalTonnage > 0) {
                totalTonnage += bsdTotalTonnage;
                energeticTonnage += bsdEnergeticTonnage;
                materialTonnage += bsdMaterialTonnage;
                reemploiTonnage += bsdReemploiTonnage;
                reutilisationTonnage += bsdReutilisationTonnage;
                processedBsdsCount++;
            }
        } 
        // Fallback sur processingOperation (valoParts n'existe pas OU est vide)
        else {
            const processingCode = recipient.processingOperation;
            // Harmoniser avec EnvBarChart.tsx : utiliser quantityReceived OU wasteDetails.quantity
            const tonnage = bsd.infos_json?.formAPI?.createFormInput?.quantityReceived ? 
                bsd.infos_json?.formAPI?.createFormInput?.quantityReceived : 
                bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity || 0;
            
            if (processingCode && tonnage > 0) {
                totalTonnage += tonnage;
                
                const treatmentType = classifyTreatmentCode(processingCode);
                if (treatmentType === 'energetique') {
                    energeticTonnage += tonnage;
                } else if (treatmentType === 'matiere') {
                    materialTonnage += tonnage;
                } else if (treatmentType === 'reemploi') {
                    reemploiTonnage += tonnage;
                } else if (treatmentType === 'reutilisation') {
                    reutilisationTonnage += tonnage;
                }
                
                processedBsdsCount++;
            }
        }
    });

    // Calcul des taux avec garantie que la valorisation globale ne dépasse pas 100%
    const energeticRate = totalTonnage > 0 ? (energeticTonnage / totalTonnage) * 100 : 0;
    const materialRate = totalTonnage > 0 ? (materialTonnage / totalTonnage) * 100 : 0;
    const reemploiRate = totalTonnage > 0 ? (reemploiTonnage / totalTonnage) * 100 : 0;
    const reutilisationRate = totalTonnage > 0 ? (reutilisationTonnage / totalTonnage) * 100 : 0;
    
    // Valorisation globale = énergétique + matière (exclut PR et RX), mais limitée à 100%
    const globalRate = Math.min(energeticRate + materialRate, 100);
    
    const credibilityScore = bsds.length > 0 ? (processedBsdsCount / bsds.length) * 100 : 0;

    return {
        energeticValorizationRate: energeticRate,
        materialValorizationRate: materialRate,
        globalValorizationRate: globalRate,
        credibilityScore,
        processedBsdsCount,
        totalTonnage,
        valorizedTonnage: energeticTonnage + materialTonnage,
        reemploiTonnage,
        reutilisationTonnage,
        reemploiRate,
        reutilisationRate
    };
};

const TauxValorisation = () => {
    const { bsds } = useAnalysis();
    const { segmentDates } = useFilterContext();
    const [showTooltipMatiere, setShowTooltipMatiere] = useState(false);
    const [showTooltipGlobale, setShowTooltipGlobale] = useState(false);
    const [showTooltipEnergetique, setShowTooltipEnergetique] = useState(false);

    const { 
        globalValorizationRate, 
        materialValorizationRate, 
        energeticValorizationRate, 
        credibilityScore, 
        processedBsdsCount, 
        totalTonnage,
        reemploiTonnage,
        reutilisationTonnage,
        reemploiRate,
        reutilisationRate
    } = useMemo(() => {
        // Utiliser les mêmes filtres de dates que EnvBarChart
        return calculateTauxValorisation(bsds, segmentDates);
    }, [bsds, segmentDates]);

    // Déterminer si on a des codes RX ou PR
    const hasReemploiReutilisation = reemploiTonnage > 0 || reutilisationTonnage > 0;

    return (
        <div className="grid grid-cols-3 gap-2">
            {!hasReemploiReutilisation ? (
                // Cas 1: Pas de RX/PR - 3 KPI séparés
                <>
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
                </>
            ) : (
                // Cas 2: Avec RX/PR - 3 KPI avec splits
                <>
                    {/* Réemploi + Réutilisation (1 KPI avec split) */}
                    <div 
                        className="relative bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-lg p-2 shadow-sm hover:shadow-md transition-all duration-200"
                        onMouseEnter={() => setShowTooltipMatiere(true)}
                        onMouseLeave={() => setShowTooltipMatiere(false)}
                    >
                        <div className="text-xs text-amber-600 mb-1">
                            <p>Réemploi +</p>
                            <p>Réutilisation</p>
                        </div>
                        
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-lg font-bold text-amber-800">
                                {(reemploiRate + reutilisationRate).toFixed(1)}%
                            </div>
                        </div>

                        {showTooltipMatiere && (
                            <div className="absolute z-20 bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white p-3 rounded-lg shadow-xl text-xs w-56">
                                <div className="font-semibold mb-1">Détails Réemploi + Réutilisation</div>
                                <div className="text-gray-300">Réemploi (RX): {reemploiRate.toFixed(1)}% - {reemploiTonnage.toFixed(1)} T</div>
                                <div className="text-gray-300">Réutilisation (PR): {reutilisationRate.toFixed(1)}% - {reutilisationTonnage.toFixed(1)} T</div>
                                <div className="text-gray-300">Total: {(reemploiTonnage + reutilisationTonnage).toFixed(1)} tonnes</div>
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                            </div>
                        )}
                    </div>

                    {/* Valorisation matière + énergétique (1 KPI avec split) */}
                    <div 
                        className="relative bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-lg p-2 shadow-sm hover:shadow-md transition-all duration-200"
                        onMouseEnter={() => setShowTooltipEnergetique(true)}
                        onMouseLeave={() => setShowTooltipEnergetique(false)}
                    >
                        <div className="text-xs text-emerald-600 mb-1">
                            <p>Valorisation</p>
                            <p>Matière + Énergie</p>
                        </div>
                        
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-lg font-bold text-emerald-800">
                                {(materialValorizationRate + energeticValorizationRate).toFixed(1)}%
                            </div>
                        </div>

                        {showTooltipEnergetique && (
                            <div className="absolute z-20 bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white p-3 rounded-lg shadow-xl text-xs w-56">
                                <div className="font-semibold mb-1">Détails Valorisation Matière + Énergie</div>
                                <div className="text-gray-300">Matière (R2-R13): {materialValorizationRate.toFixed(1)}% - {materialValorizationRate * totalTonnage / 100} T</div>
                                <div className="text-gray-300">Énergie (R1): {energeticValorizationRate.toFixed(1)}% - {energeticValorizationRate * totalTonnage / 100} T</div>
                                <div className="text-gray-300">Total: {(materialValorizationRate + energeticValorizationRate) * totalTonnage / 100} tonnes</div>
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                            </div>
                        )}
                    </div>

                    {/* Valorisation globale (1 KPI avec split) - masqué quand PR/RX présents */}
                    {!hasReemploiReutilisation && (
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
                            </div>

                            {showTooltipGlobale && (
                                <div className="absolute z-20 bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white p-3 rounded-lg shadow-xl text-xs w-56">
                                    <div className="font-semibold mb-1">Détails Valorisation Globale</div>
                                    <div className="text-gray-300">Matière (R2-R13): {materialValorizationRate.toFixed(1)}% - {materialValorizationRate * totalTonnage / 100} T</div>
                                    <div className="text-gray-300">Énergie (R1): {energeticValorizationRate.toFixed(1)}% - {energeticValorizationRate * totalTonnage / 100} T</div>
                                    <div className="text-gray-300">Total: {totalTonnage.toFixed(1)} tonnes</div>
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default TauxValorisation; 