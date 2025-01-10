import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { useAnalysis } from '@/app/analysis/AnalysisProvider';
import { getFiliere } from '@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new';
import { tailwindToRgba } from '../MetaComponent/Colours';
import { useFilterContext } from '@/app/FilterContext';
import { calculateFinancialAmount } from '@/app/utils/financial';
import { FormInput } from '@/app/register/interface/BSD_Interface';

// Importer Doughnut dynamiquement
const Doughnut = dynamic(
  () => import('react-chartjs-2').then(mod => mod.Doughnut),
  { ssr: false }
);

// Enregistrer Chart.js uniquement côté client
if (typeof window !== 'undefined') {
  ChartJS.register(ArcElement, Tooltip, Legend);
}

interface TooltipContext {
    raw: unknown;
    label: string;
    dataset: {
        data: number[];
    };
}

interface ChartData {
    labels: string[];
    datasets: {
        data: number[];
        backgroundColor: string[];
        borderColor: string;
        borderWidth: number;
    }[];
}

const FinancialPieChart = () => {
    const { bsds, mappingTable, filieres_ou_prestataires, siretToName } = useAnalysis();
    const { filieres } = useFilterContext();

    // Palette de couleurs pour les prestataires
    const prestatairesColors = [
        'rgba(142, 202, 230, 0.8)',    // Bleu clair
        'rgba(255, 183, 178, 0.8)',    // Rose pâle
        'rgba(181, 234, 215, 0.8)',    // Vert menthe
        'rgba(199, 206, 234, 0.8)',    // Lavande
        'rgba(255, 218, 193, 0.8)',    // Pêche
        'rgba(168, 218, 220, 0.8)',    // Turquoise
        'rgba(241, 192, 232, 0.8)',    // Rose lilas
        'rgba(204, 213, 174, 0.8)',    // Vert sauge
        'rgba(254, 200, 216, 0.8)',    // Rose poudré
        'rgba(173, 216, 230, 0.8)',    // Bleu poudré
    ];

    const processChartData = () => {
        const costs: { [key: string]: number } = {};
        const revenues: { [key: string]: number } = {};
        const prestatairesMap = new Map(); // Pour garder une couleur constante par prestataire

        bsds.forEach((bsd: {created_at: string, infos_json: {formAPI: {createFormInput: FormInput}}}) => {
            let key;
            if (filieres_ou_prestataires.nom === 'prestataire') {
                const siret = bsd.infos_json.formAPI.createFormInput.recipient.company.siret;
                key = siretToName[siret] || siret || 'Non renseigné';
                if (!prestatairesMap.has(key)) {
                    prestatairesMap.set(key, prestatairesColors[prestatairesMap.size % prestatairesColors.length]);
                }
            } else {
                key = getFiliere(
                    bsd.infos_json.formAPI.createFormInput.wasteDetails.code,
                    mappingTable
                ) || 'Autres';
            }

            const weight = bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity || 0;
            const wasteCode = bsd.infos_json.formAPI.createFormInput.wasteDetails.code;
            const amount = calculateFinancialAmount(weight, wasteCode);
            
            if (amount > 0) {
                if (!costs[key]) costs[key] = 0;
                costs[key] += amount;
            } else {
                if (!revenues[key]) revenues[key] = 0;
                revenues[key] += Math.abs(amount);
            }
        });

        const sortAndPrepareData = (data: { [key: string]: number }) => {
            const sortedEntries = Object.entries(data)
                .sort((a, b) => {
                    if (a[0] === 'Autres') return 1;
                    if (b[0] === 'Autres') return -1;
                    return b[1] - a[1];
                });

            return {
                labels: sortedEntries.map(([key]) => key),
                datasets: [{
                    data: sortedEntries.map(([_, value]) => value),
                    backgroundColor: sortedEntries.map(([key]) => {
                        if (filieres_ou_prestataires.nom === 'filiere') {
                            const filiere = filieres.find(f => f.name === key);
                            return tailwindToRgba(filiere?.color || 'gray-500');
                        }
                        return prestatairesMap.get(key) || prestatairesColors[0];
                    }),
                    borderColor: 'white',
                    borderWidth: 1,
                }]
            };
        };


        return {
            costs: sortAndPrepareData(costs),
            revenues: sortAndPrepareData(revenues)
        };
    };

    const chartData = useMemo(() => processChartData(), [bsds, mappingTable, filieres_ou_prestataires, siretToName, filieres]);


    const options = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '50%',
        rotation: -90,
        circumference: 360,
        plugins: {
            legend: {
                position: 'right' as const,
                labels: {
                    font: { size: 11 }
                }
            },
            tooltip: {
                callbacks: {
                    label: (context: TooltipContext) => {
                        const value = context.raw as number;
                        const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                        const percentage = ((value / total) * 100).toFixed(1);
                        return `${context.label}: ${value.toLocaleString('fr-FR')}€ (${percentage}%)`;
                    }
                }
            }
        }
    };

    return (
        <div className="flex-1 p-4 bg-white rounded-lg shadow max-w-[50%]">
            <div className="flex justify-between space-x-4 w-full">
                {/* Graphique des coûts */}
                <div className="w-1/2">
                    <div className="text-gray-500 text-xs mb-2 text-center">
                        - Coûts
                    </div>
                    <div style={{ height: '180px', position: 'relative' }}>
                        {chartData.costs.datasets[0].data.length > 0 ? (
                            <Doughnut data={chartData.costs} options={options} />
                        ) : (
                            <div className="text-center text-gray-500 mt-4">Aucun coût</div>
                        )}
                    </div>
                </div>

                {/* Graphique des revenus */}
                <div className="w-1/2">
                    <div className="text-gray-500 text-xs mb-2 text-center">
                        + Revenus
                    </div>
                    <div style={{ height: '180px', position: 'relative' }}>
                        {chartData.revenues.datasets[0].data.length > 0 ? (
                            <Doughnut data={chartData.revenues} options={options} />
                        ) : (
                            <div className="text-center text-gray-500 mt-4">Aucun revenu</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinancialPieChart; 