'use client'
import { Doughnut } from 'react-chartjs-2';
import { Facture, ChartData } from '../types';
import { Chart as ChartJS, TooltipItem, LegendItem } from 'chart.js';
import { useEffect, useState } from 'react';
import { getMappingTableFiliere } from "@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new";
import { tailwindToRgb } from '../../MetaComponent/Colours';
import { Filiere, useFilterContext } from '@/app/FilterContext';

interface Props {
    factures: Facture[];
    entreprise_id: string;
}

const NewPieFinancialChart = ({ factures, entreprise_id }: Props) => {
    const [mappingTable, setMappingTable] = useState<{ ced: string, filiere: string }[]>([]);
    const {filieres} = useFilterContext();

    useEffect(() => {
        const fetchMappingTable = async () => {
            const mapping = await getMappingTableFiliere(entreprise_id);
            setMappingTable(mapping || []);
        };
        fetchMappingTable();
    }, [entreprise_id]);

    // Group amounts by filière, separating costs and revenues
    const { costs, revenues } = factures.reduce((acc: { 
        costs: { [key: string]: number }, 
        revenues: { [key: string]: number }
    }, facture) => {
        const departsCount = facture.infos_json.departs.length;
        const montantParDepart = facture.infos_json.footer.total_ht / departsCount;

        facture.infos_json.departs.forEach(depart => {
            const cleanedCed = depart.line_header.code_dechet.replaceAll(' ', '').replace('*', '');
            const filiere = mappingTable.find(m => m.ced.replace(' ', '').replace('*', '') === cleanedCed)?.filiere || 'Autres';
            
            if (montantParDepart < 0) {
                if (!acc.costs[filiere]) acc.costs[filiere] = 0;
                acc.costs[filiere] += Math.abs(montantParDepart);
            } else {
                if (!acc.revenues[filiere]) acc.revenues[filiere] = 0;
                acc.revenues[filiere] += montantParDepart;
            }
        });
        
        return acc;
    }, { costs: {}, revenues: {} });

    const getChartData = (data: {[key: string]: number}): ChartData => {
        const colors = Object.keys(data).map(filiere => {
            const filiereColor = filieres.find(f => f.name === filiere)?.color || '#000000';
            return tailwindToRgb(filiereColor);
        });

        const total = Object.values(data).reduce((sum, value) => sum + value, 0);

        return {
            labels: Object.keys(data),
            datasets: [{
                label: 'Montant',
                data: Object.values(data),
                backgroundColor: colors,
            }]
        };
    };

    // Plugin pour afficher le titre au centre
    const centerTextPlugin = (title: string) => {
        return {
            id: 'centerText',
            afterDraw: function(chart: ChartJS<'doughnut'>) {
                // Obtenir les dimensions du graphique sans la légende
                const chartArea = chart.chartArea;
                if (!chartArea) return;
                
                // Calculer le centre du graphique (pas de la canvas entière)
                const centerX = (chartArea.left + chartArea.right) / 2;
                const centerY = (chartArea.top + chartArea.bottom) / 2;
                
                const ctx = chart.ctx;
                
                ctx.save();
                ctx.font = '600 14px sans-serif';
                ctx.textBaseline = 'middle';
                ctx.textAlign = 'center';
                
                // Fond blanc semi-transparent
                ctx.fillStyle = 'rgba(255, 255, 255, 0)';
                const textWidth = ctx.measureText(title).width;
                const padding = 10;
                const rectWidth = textWidth + padding * 2;
                const rectHeight = 24;
                ctx.beginPath();
                ctx.roundRect(
                    centerX - rectWidth / 2,
                    centerY - rectHeight / 2,
                    rectWidth,
                    rectHeight,
                    8
                );
                ctx.fill();
                
                // Texte
                ctx.fillStyle = '#4B5563'; // text-gray-600
                ctx.fillText(title, centerX, centerY);
                ctx.restore();
            }
        };
    };

    const getOptions = (title: string) => {
        return {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'bottom' as const,
                    align: 'center' as const,
                    labels: {
                        boxWidth: 12,
                        padding: 15,
                        font: { size: 11 },
                        filter: (legendItem: LegendItem, data: ChartData) => {
                            const dataset = data.datasets[0];
                            const total = dataset.data.reduce((a: number, b: number) => a + b, 0);
                            const value = dataset.data[legendItem.index as number];
                            return ((value / total) * 100) >= 5;
                        }
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14 },
                    bodyFont: { size: 13 },
                    displayColors: true,
                    callbacks: {
                        label: function(context: TooltipItem<'doughnut'>) {
                            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                            const value = context.raw as number;
                            const percentage = ((value / total) * 100).toFixed(1);
                            return ` ${percentage}% (${value.toLocaleString('fr-FR')} €)`;
                        }
                    }
                }
            }
        };
    };

    return (
        <div className="w-full grid grid-cols-2 gap-4">
            {/* Couts inversé */}
            <div className="flex flex-col">
                <div className="h-[200px] relative">
                    <Doughnut 
                        data={getChartData(revenues)}
                        options={getOptions('Coûts')}
                        plugins={[centerTextPlugin('Coûts')]}
                    />
                </div>
            </div>
            {/* Revenus (inversé) */}
            <div className="flex flex-col">
                <div className="h-[200px] relative">
                    <Doughnut 
                        data={getChartData(costs)}
                        options={getOptions('Revenus')}
                        plugins={[centerTextPlugin('Revenus')]}
                    />
                </div>
            </div>
        </div>
    );
};

export default NewPieFinancialChart; 