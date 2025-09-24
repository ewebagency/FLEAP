'use client'
import { Doughnut } from 'react-chartjs-2';
import { Facture, ChartData } from '../types';
import { Chart as ChartJS, TooltipItem, LegendItem } from 'chart.js';
import { useEffect, useState, useMemo } from 'react';
import { getMappingTableFiliere } from "@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new";
import { tailwindToRgb } from '../../MetaComponent/Colours';
import { useFilterContext } from '@/app/FilterContext';
import { useAnalysis } from '@/app/analysis/AnalysisProvider';

interface Props {
    factures: Facture[];
    entreprise_id: string;
}

const NewPieFinancialChart = ({ factures, entreprise_id }: Props) => {
    const [mappingTable, setMappingTable] = useState<{ ced: string, filiere: string }[]>([]);
    const [mappingNomFiliere, setMappingNomFiliere] = useState<{ nom: string; filiere: string }[]>([]);
    const {filieres} = useFilterContext();
    const { filieres_ou_prestataires } = useAnalysis();

    useEffect(() => {
        const fetchMappingTable = async () => {
            const mapping = await getMappingTableFiliere(entreprise_id);
            setMappingTable(mapping || []);
        };
        fetchMappingTable();
    }, [entreprise_id]);

    useEffect(() => {
        const fetchMappingNom = async () => {
            try {
                const res = await fetch(`/api/get_mapping_nom_filiere?entreprise_id=${entreprise_id}`);
                if (res.ok) {
                    const data = await res.json();
                    setMappingNomFiliere((data?.data || data) as { nom: string; filiere: string }[]);
                }
            } catch (e) {
                console.error('Error fetching mapping_nom_filiere', e);
            }
        };
        fetchMappingNom();
    }, [entreprise_id]);

    // Memoize the costs and revenues calculations
    const { costs, revenues } = useMemo(() => {
        return factures.reduce((acc: { 
            costs: { [key: string]: number }, 
            revenues: { [key: string]: number }
        }, facture) => {
            facture.infos_json.departs.forEach(depart => {
                let filiere = 'Autres';
                if (filieres_ou_prestataires.nom === 'filiere_nom') {
                    const wasteName = depart.line_header?.dechet_description || depart.line_header?.type_dechet;
                    if (wasteName) {
                        const mappingEntry = mappingNomFiliere.find((item: { nom?: string; filiere: string }) => item.nom === wasteName);
                        filiere = mappingEntry?.filiere || 'Autres';
                    }
                } else {
                    const cleanedCed = depart.line_header.code_dechet.replaceAll(' ', '').replace('*', '');
                    filiere = mappingTable.find(m => m.ced.replace(' ', '').replace('*', '') === cleanedCed)?.filiere || 'Autres';
                }

                // Traiter chaque ligne du body individuellement (comme dans NewTableFinancial)
                depart.line_body.forEach(line => {
                    const montant = line.montant_ht;
                    
                    if (montant < 0) {
                        if (!acc.costs[filiere]) acc.costs[filiere] = 0;
                        acc.costs[filiere] += Math.abs(montant);
                    } else {
                        if (!acc.revenues[filiere]) acc.revenues[filiere] = 0;
                        acc.revenues[filiere] += montant;
                    }
                });
            });
            
            return acc;
        }, { costs: {}, revenues: {} });
    }, [factures, mappingTable, mappingNomFiliere, filieres_ou_prestataires]);

    // Memoize the chart data generation
    const chartData = useMemo(() => {
        const getChartData = (data: {[key: string]: number}): ChartData => {
            const colors = Object.keys(data).map(filiere => {
                const filiereColor = filieres.find(f => f.name === filiere)?.color || '#000000';
                return tailwindToRgb(filiereColor);
            });

            // const total = Object.values(data).reduce((sum, value) => sum + value, 0);

            return {
                labels: Object.keys(data),
                datasets: [{
                    label: 'Montant',
                    data: Object.values(data),
                    backgroundColor: colors,
                }]
            };
        };

        return {
            costs: getChartData(costs),
            revenues: getChartData(revenues)
        };
    }, [costs, revenues, filieres]);

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

    const getOptions = (_title: string) => {
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
                        data={chartData.revenues}
                        options={getOptions('Coûts')}
                        plugins={[centerTextPlugin('Coûts')]}
                    />
                </div>
            </div>
            {/* Revenus (inversé) */}
            <div className="flex flex-col">
                <div className="h-[200px] relative">
                    <Doughnut 
                        data={chartData.costs}
                        options={getOptions('Revenus')}
                        plugins={[centerTextPlugin('Revenus')]}
                    />
                </div>
            </div>
        </div>
    );
};

export default NewPieFinancialChart; 