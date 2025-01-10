import React from 'react';
import dynamic from 'next/dynamic';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import { useAnalysis } from '@/app/analysis/AnalysisProvider';
import { getFiliere } from '@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new';
import { tailwindToRgb } from '../MetaComponent/Colours';
import { useFilterContext } from '@/app/FilterContext';
import { calculateFinancialAmount } from '@/app/utils/financial';
import { FormInput } from '../../../register/interface/BSD_Interface';

// Importer Bar dynamiquement
const Bar = dynamic(
    () => import('react-chartjs-2').then(mod => mod.Bar),
    { ssr: false }
);

// Enregistrer Chart.js uniquement côté client
if (typeof window !== 'undefined') {
    ChartJS.register(
        CategoryScale,
        LinearScale,
        BarElement,
        Title,
        Tooltip,
        Legend
    );
}

interface TooltipItem {
    raw: unknown;
    dataset: {
        label?: string;
        stack?: string;
    };
}

interface ChartLegendItem {
    text: string;
    // autres propriétés de l'item si nécessaire
}

const FinancialMainChart = () => {
    const { bsds, mappingTable, filieres_ou_prestataires, siretToName } = useAnalysis();
    const { filieres } = useFilterContext();

    const processChartData = () => {
        const monthLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
        const revenuesBySegment: { [key: string]: number[] } = {};
        const costsBySegment: { [key: string]: number[] } = {};

        // Traitement initial des données
        bsds.forEach((bsd: {created_at:string, infos_json:{formAPI:{createFormInput:FormInput}}}) => {
            let segmentKey;
            if (filieres_ou_prestataires.nom === 'prestataire') {
                const siret = bsd.infos_json.formAPI.createFormInput.recipient.company.siret;
                segmentKey = siretToName[siret] || siret || 'Non renseigné';
            } else {
                segmentKey = getFiliere(
                    bsd.infos_json.formAPI.createFormInput.wasteDetails.code,
                    mappingTable
                ) || 'Autres';
            }

            const month = new Date(bsd.created_at).getMonth();
            const weight = bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity || 0;
            const wasteCode = bsd.infos_json.formAPI.createFormInput.wasteDetails.code;
            const amount = calculateFinancialAmount(weight, wasteCode);

            if (amount > 0) {
                if (!costsBySegment[segmentKey]) costsBySegment[segmentKey] = Array(12).fill(0);
                costsBySegment[segmentKey][month] += amount;
            } else {
                if (!revenuesBySegment[segmentKey]) revenuesBySegment[segmentKey] = Array(12).fill(0);
                revenuesBySegment[segmentKey][month] += Math.abs(amount);
            }
        });

        // Créer les labels pour chaque mois (coûts et revenus)
        const doubleLabels = monthLabels.map(month => month);

        // Préparer d'abord les datasets pour les coûts (stacked)
        const costDatasets = Object.keys({ ...costsBySegment })
            .filter(segment => segment !== 'Autres')
            .concat(['Autres'])
            .map(segment => {
                const color = filieres_ou_prestataires.nom === 'filiere'
                    ? tailwindToRgb(filieres.find(f => f.name === segment)?.color || '#000000')
                    : `hsl(${Math.random() * 360}, 70%, 50%)`;

                return {
                    label: `${segment} (-)`,
                    data: monthLabels.map((_, i) => costsBySegment[segment]?.[i] || 0),
                    backgroundColor: color,
                    stack: 'costs',
                };
            });

        // Puis les datasets pour les revenus (stacked)
        const revenueDatasets = Object.keys({ ...revenuesBySegment })
            .filter(segment => segment !== 'Autres')
            .concat(['Autres'])
            .map(segment => {
                const color = filieres_ou_prestataires.nom === 'filiere'
                    ? tailwindToRgb(filieres.find(f => f.name === segment)?.color || '#000000')
                    : `hsl(${Math.random() * 360}, 70%, 50%)`;

                return {
                    label: `${segment} (+)`,
                    data: monthLabels.map((_, i) => revenuesBySegment[segment]?.[i] || 0),
                    backgroundColor: color,
                    stack: 'revenues',
                };
            });

        return {
            labels: doubleLabels,
            // Inverser l'ordre des datasets pour avoir les coûts à gauche
            datasets: [...costDatasets, ...revenueDatasets]
        };
    };

    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    filter: (item: ChartLegendItem) => !item.text.includes('(-)'),
                    generateLabels: (chart: ChartJS) => {
                        const originalLabels = ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
                        // Regrouper les labels par filière/prestataire
                        const uniqueLabels = new Map();
                        originalLabels.forEach(label => {
                            const baseName = label.text.split(' (')[0];
                            if (!uniqueLabels.has(baseName)) {
                                label.text = baseName;
                                uniqueLabels.set(baseName, label);
                            }
                        });
                        return Array.from(uniqueLabels.values());
                    }
                }
            },
            title: {
                display: true,
                text: 'Évolution mensuelle des revenus et coûts'
            },
            tooltip: {
                callbacks: {
                    label: (context: TooltipItem) => {
                        const isRevenue = context.dataset.stack === 'revenues';
                        const value = context.raw as number;
                        const label = context.dataset.label?.split(' (')[0] ?? '';
                        return `${label}: ${isRevenue ? '+' : '-'}${value.toLocaleString('fr-FR')}€`;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    font: {
                        size: 10
                    }
                }
            },
            y: {
                stacked: true,
                title: {
                    display: true,
                    text: 'Euros (€)'
                }
            }
        }
    };

    return (
        <div className="mt-4 p-2 bg-white rounded-lg shadow">
            {bsds.length > 0 ? (
                <div>
                    <Bar data={processChartData()} options={options} height={60} />
                    <div className="flex justify-center gap-4 text-xs text-gray-500 mt-2">
                        <div>- Coûts</div>
                        <div>+ Revenus</div>
                    </div>
                </div>
            ) : (
                <div className="text-center text-gray-500">Aucune donnée disponible</div>
            )}
        </div>
    );
};

export default FinancialMainChart; 