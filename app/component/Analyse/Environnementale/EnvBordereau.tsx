import React from 'react';
import { useAnalysis } from '../../../analysis/AnalysisProvider';
import { estimerCarbone } from './environnement_utils';

const EnvBordereau = () => {
    const { bsds } = useAnalysis();

    const calculateEmissions = () => {
        if (!bsds || bsds.length === 0) return { total: 0, evolution: 0 };

        const monthlyEmissions = new Map<number, number>();
        let totalEmissions = 0;

        bsds.forEach((bsd) => {
            const quantity = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity || 0;
            const cedCode = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code;
            const processingOperation = bsd.infos_json?.formAPI?.createFormInput?.processingOperation || 'default';
            const date = new Date(bsd.created_at);
            const month = date.getMonth();

            try {
                const carbonEmission = parseFloat(estimerCarbone(cedCode, processingOperation, quantity));
                monthlyEmissions.set(month, (monthlyEmissions.get(month) || 0) + carbonEmission);
                totalEmissions += carbonEmission;
            } catch (error) {
                // Ignorer les erreurs de calcul
            }
        });

        // Calculer l'évolution par rapport au mois précédent
        const currentMonth = new Date().getMonth();
        const currentMonthEmissions = monthlyEmissions.get(currentMonth) || 0;
        const previousMonthEmissions = monthlyEmissions.get((currentMonth - 1 + 12) % 12) || 0;
        const evolution = previousMonthEmissions === 0 ? 0 : 
            ((currentMonthEmissions - previousMonthEmissions) / previousMonthEmissions) * 100;

        return {
            total: totalEmissions,
            evolution: evolution
        };
    };

    const { total, evolution } = calculateEmissions();

    return (
        <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-sm text-gray-500 mb-1">Total des émissions CO₂</div>
                <div className="text-2xl font-semibold">{total.toFixed(2)} kg CO₂</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-sm text-gray-500 mb-1">Évolution mensuelle</div>
                <div className={`text-2xl font-semibold flex items-center ${evolution > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {evolution > 0 ? '↑' : '↓'} {Math.abs(evolution).toFixed(1)}%
                </div>
            </div>
        </div>
    );
};

export default EnvBordereau; 