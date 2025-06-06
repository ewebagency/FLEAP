import React from 'react';
import { useAnalysis } from '../../../analysis/AnalysisProvider';
import { estimerCarbone } from './environnement_utils';
import TauxRecyclage from './TauxRecyclage';
import TauxValorisation from './TauxValorisation';
import ButtonReportAMO from '../../ReportAMO/ButtonReportAMO';
import { cofounders_user_id } from '../../SideBar';
import { useSession } from '../../SessionProvider';

const COMPARISONS = [
    {
        threshold: 1000,
        options: [
            { emoji: "🚗", text: (co2Kg: number) => `Équivalent à ${Math.round(co2Kg / 123)} trajets Paris-Lyon en voiture` },
            { emoji: "🏃", text: (co2Kg: number) => `Un coureur devrait courir ${Math.round(co2Kg * 8)} km pour émettre autant de CO2` },
            { emoji: "🍔", text: (co2Kg: number) => `Équivalent à la production de ${Math.round(co2Kg / 7)} hamburgers` }
        ]
    },
    {
        threshold: 10000,
        options: [
            { emoji: "✈️", text: (co2Kg: number) => `Équivalent à ${Math.round(co2Kg / 900)} vol(s) Paris-New York` },
            { emoji: "🐄", text: (co2Kg: number) => `Équivalent aux émissions de ${Math.round(co2Kg / 2500)} vache(s) pendant un an` },
            { emoji: "📱", text: (co2Kg: number) => `Équivalent à la fabrication de ${Math.round(co2Kg / 80)} smartphone(s)` }
        ]
    },
    {
        threshold: 100000,
        options: [
            { emoji: "🏠", text: (co2Kg: number) => `Équivalent à la consommation annuelle de ${Math.round(co2Kg / 5000)} maison(s)` },
            { emoji: "🚢", text: (co2Kg: number) => `Équivalent à ${Math.round(co2Kg / 20000)} traversée(s) de l'Atlantique en cargo` },
            { emoji: "🏭", text: (co2Kg: number) => `Équivalent à la production de ${Math.round(co2Kg / 3000)} tonnes d'acier` }
        ]
    },
    {
        threshold: Infinity,
        options: [
            { emoji: "🌳", text: (co2Kg: number) => `Il faudrait ${Math.round(co2Kg / 25)} arbre(s) planté(s) pour compenser ces émissions sur 1 an` },
            { emoji: "🌍", text: (co2Kg: number) => `Équivalent à ${Math.round(co2Kg / 50000)} tour(s) du monde en avion` },
            { emoji: "🏞️", text: (co2Kg: number) => `Une forêt de ${Math.round(co2Kg / 1000)} hectare(s) serait nécessaire pour absorber ce CO2 en un an` }
        ]
    }
];

const getComparison = (totalCO2: number): { emoji: string; text: string } => {
    const co2Kg = totalCO2 * 1000;
    
    const category = COMPARISONS.find(cat => co2Kg < cat.threshold);
    if (!category) return { 
        emoji: COMPARISONS[0].options[0].emoji,
        text: COMPARISONS[0].options[0].text(co2Kg)
    };
    
    const randomOption = category.options[Math.floor(Math.random() * category.options.length)];
    
    return {
        emoji: randomOption.emoji,
        text: randomOption.text(co2Kg)
    };
};

const EnvBordereau = () => {
    const { bsds } = useAnalysis();
    const {user_id} = useSession();

    const calculateEmissions = () => {
        if (!bsds || bsds.length === 0) return { total: 0, evolution: 0, average: 0, totalBSDs: 0 };

        const monthlyEmissions = new Map<number, number>();
        let totalEmissions = 0;
        const totalBSDs = bsds.length;

        bsds.forEach((bsd) => {
            try {
                // Vérifier et convertir les valeurs en nombres
                const quantity = bsd.infos_json?.formAPI?.createFormInput?.quantityReceived ? Number(bsd.infos_json?.formAPI?.createFormInput?.quantityReceived) : Number(bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity) || 0;
                const cedCode = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code;
                const processingOperation = bsd.infos_json?.formAPI?.createFormInput?.recipient?.processingOperation || 'default';
                
                // Vérifier la validité de la date
                const dateStr = bsd.infos_json?.formAPI?.createFormInput?.takenOverAt || bsd.created_at;
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return; // Ignorer les BSD avec dates invalides
                
                const month = date.getMonth();

                // S'assurer que l'émission carbone est un nombre valide
                const carbonEmission = Number(estimerCarbone(cedCode, processingOperation, quantity));
                if (!isNaN(carbonEmission) && isFinite(carbonEmission)) {
                    monthlyEmissions.set(month, (monthlyEmissions.get(month) || 0) + carbonEmission);
                    totalEmissions += carbonEmission;
                }
            } catch (error) {
                console.warn('Erreur de calcul pour un BSD:', error);
                // Ignorer les BSD problématiques
            }
        });

        // S'assurer que toutes les valeurs retournées sont des nombres valides
        const currentMonth = new Date().getMonth();
        const currentMonthEmissions = monthlyEmissions.get(currentMonth) || 0;
        const previousMonthEmissions = monthlyEmissions.get((currentMonth - 1 + 12) % 12) || 0;
        const evolution = previousMonthEmissions === 0 ? 0 : 
            ((currentMonthEmissions - previousMonthEmissions) / previousMonthEmissions) * 100;

        return {
            total: Number(totalEmissions) || 0,
            evolution: Number(evolution) || 0,
            average: Number(totalEmissions / 12) || 0,
            totalBSDs: Number(totalBSDs) || 0
        };
    };

    const stats = calculateEmissions();
    const comparison = getComparison(stats.total);

    return (
        <div className="flex justify-between bg-gray-200 p-4 rounded-lg">
            <div className="block">
                <div className="text-sm text-gray-600 font-thin">Émissions CO₂ totales</div>
                <div className="flex items-center mt-2">
                    <div className="font-bold text-xl text-gray-700">
                        {stats.total.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} T CO₂
                    </div>
                    {/*<div className={`ml-4 px-2 py-1 rounded-full text-xs ${
                        stats.evolution >= 0 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                    }`}>
                        {stats.evolution >= 0 ? '+' : ''}{Math.abs(Math.round(stats.evolution))}%
                    </div>*/}
                </div>
            </div>
            <div className="flex justify-end items-center gap-6">
                <div className="flex items-start gap-2 text-gray-500 w-[400px]">
                    <div className="text-3xl">{comparison.emoji}</div>
                    <div className="text-sm">{comparison.text}</div>
                </div>
                {/*<TauxRecyclage />*/}
                <TauxValorisation />
                <ButtonReportAMO/>
            </div>
        </div>
    );
};

export default EnvBordereau; 