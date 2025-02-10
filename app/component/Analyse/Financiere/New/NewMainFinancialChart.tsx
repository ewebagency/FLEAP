'use client'
import { Line, Bar } from 'react-chartjs-2';
import { Facture, ChartData } from '../types';
import { Chart as ChartJS, ChartEvent, LegendItem, LegendElement } from 'chart.js/auto';
import { useEffect, useState, useMemo } from 'react';
import { getMappingTableFiliere } from "@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new";
import { useFilterContext } from '@/app/FilterContext';
import { tailwindToRgb } from '../../MetaComponent/Colours';
import { TooltipItem } from 'chart.js';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { Chart } from 'chart.js';

interface Props {
    factures: Facture[];
    entreprise_id: string;
}

const NewMainFinancialChart = ({ factures, entreprise_id }: Props) => {
    const [mappingTable, setMappingTable] = useState<{ ced: string, filiere: string }[]>([]);
    const { filieres, segmentDates, setSegmentDates } = useFilterContext();
    
    const handleDateChange = (date: Date | null, type: 'debut' | 'fin') => {
        if (date) {
            setSegmentDates({
                ...segmentDates,
                [type]: date
            });
        }
    };

    useEffect(() => {
        const fetchMappingTable = async () => {
            const mapping = await getMappingTableFiliere(entreprise_id);
            console.log('Mapping table fetched:', mapping);
            setMappingTable(mapping || []);
        };
        fetchMappingTable();
    }, [entreprise_id]);

    const filteredChartData = useMemo(() => {
        if (!mappingTable.length) return null;

        const monthLabels: string[] = [];
        const currentDate = new Date(segmentDates.debut || new Date());
        const endDate = segmentDates.fin || new Date();
        
        while (currentDate <= endDate) {
            const label = currentDate.toLocaleString('fr-FR', { 
                month: 'short',
                year: '2-digit'
            });
            monthLabels.push(label.charAt(0).toUpperCase() + label.slice(1));
            currentDate.setMonth(currentDate.getMonth() + 1);
        }

        const positiveAmountsByFiliere: { [key: string]: number[] } = {};
        const negativeAmountsByFiliere: { [key: string]: number[] } = {};

        factures.forEach(facture => {
            facture.infos_json.departs.forEach(depart => {
                if (!depart.line_header?.code_dechet) return;

                const date = new Date(depart.line_header.date_depart);
                if (date < (segmentDates.debut || new Date(0)) || date > (segmentDates.fin || new Date())) {
                    return;
                }

                const cleanedCed = depart.line_header.code_dechet
                    .replaceAll(' ', '')
                    .replace('*', '');

                const filiere = mappingTable.find(m => 
                    m.ced.replaceAll(' ', '').replace('*', '') === cleanedCed
                )?.filiere || 'Autres';

                const amount = facture.infos_json.footer.total_ht;
                const monthIndex = Math.floor(
                    (date.getTime() - (segmentDates.debut || new Date(0)).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
                );

                if (monthIndex >= 0 && monthIndex < monthLabels.length) {
                    if (amount >= 0) {
                        if (!positiveAmountsByFiliere[filiere]) {
                            positiveAmountsByFiliere[filiere] = Array(monthLabels.length).fill(0);
                        }
                        positiveAmountsByFiliere[filiere][monthIndex] += amount;
                    } else {
                        if (!negativeAmountsByFiliere[filiere]) {
                            negativeAmountsByFiliere[filiere] = Array(monthLabels.length).fill(0);
                        }
                        negativeAmountsByFiliere[filiere][monthIndex] += Math.abs(amount);
                    }
                }
            });
        });

        const datasets = [
            ...Object.entries(negativeAmountsByFiliere).map(([filiere, data]) => {
                const filiereColor = filieres.find(f => f.name === filiere)?.color || '#000000';
                const color = tailwindToRgb(filiereColor);
                return {
                    label: filiere,
                    data: data.map(val => -val),
                    backgroundColor: color,
                    stack: 'negative',
                    hidden: false,
                    borderRadius: 4
                };
            }),
            ...Object.entries(positiveAmountsByFiliere).map(([filiere, data]) => {
                const filiereColor = filieres.find(f => f.name === filiere)?.color || '#000000';
                const color = tailwindToRgb(filiereColor);
                return {
                    label: filiere,
                    data: data,
                    backgroundColor: color,
                    stack: 'positive',
                    hidden: false,
                    borderRadius: 4
                };
            })
        ];

        return {
            labels: monthLabels,
            datasets: datasets
        };
    }, [factures, mappingTable, filieres, segmentDates]);

    if (!mappingTable.length) {
        return <div className="text-center text-gray-500">Chargement des données...</div>;
    }

    if (!filteredChartData) {
        return <div className="text-center text-gray-500">Traitement des données...</div>;
    }

    const options = {
        responsive: true,
        plugins: {
            legend: {
                display: false,
                position: 'bottom' as const,
                labels: {
                    padding: 20,
                    generateLabels: (chart: Chart) => {
                        const originalLabels = ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
                        
                        const negativeHeader = {
                            text: '(+) Revenus',
                            fillStyle: 'transparent',
                            strokeStyle: 'transparent',
                            lineWidth: 0,
                            fontColor: '#666',
                            fontStyle: 'bold'
                        };
                        
                        const positiveHeader = {
                            text: '(-) Coûts',
                            fillStyle: 'transparent',
                            strokeStyle: 'transparent',
                            lineWidth: 0,
                            fontColor: '#666',
                            fontStyle: 'bold'
                        };
                        
                        const negativeLabels = originalLabels.filter(label => 
                            chart.data.datasets[label.datasetIndex!].stack === 'negative'
                        );
                        
                        const positiveLabels = originalLabels.filter(label => 
                            chart.data.datasets[label.datasetIndex!].stack === 'positive'
                        );
                        
                        return [
                            negativeHeader,
                            ...negativeLabels,
                            positiveHeader,
                            ...positiveLabels
                        ];
                    }
                }
            },
            title: {
                display: true,
                text: 'Évolution des coûts et revenus mensuels'
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
                callbacks: {
                    label: function(tooltipItem: TooltipItem<"bar">) {
                        const value = Math.abs(tooltipItem.raw as number);
                        const isNegative = tooltipItem.dataset.stack === 'negative';
                        const symbol = isNegative ? '+' : '-';
                        return `${symbol} ${tooltipItem.dataset.label}: ${value.toLocaleString('fr-FR')} €`;
                    },
                    title: function(tooltipItems: TooltipItem<"bar">[]) {
                        return tooltipItems[0].label;
                    },
                    footer: function(tooltipItems: TooltipItem<"bar">[]) {
                        const positiveTotal = tooltipItems
                            .filter(item => item.dataset.stack === 'negative')
                            .reduce((sum, item) => sum + Math.abs(item.raw as number), 0);
                        
                        const negativeTotal = tooltipItems
                            .filter(item => item.dataset.stack === 'positive')
                            .reduce((sum, item) => sum + Math.abs(item.raw as number), 0);

                        return [
                            `Total revenus : +${positiveTotal.toLocaleString('fr-FR')} €`,
                            `Total coûts : -${negativeTotal.toLocaleString('fr-FR')} €`,
                            `Bilan : ${(positiveTotal - negativeTotal).toLocaleString('fr-FR')} €`
                        ];
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Euros'
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)',
                    drawBorder: false
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        }
    };

    return (
        <div className="mt-4">
            <div className="bg-white rounded-lg shadow relative">
                <div className="absolute top-2 left-14 z-10 flex items-center space-x-2">
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => {
                                const newDate = new Date(segmentDates.debut || new Date());
                                newDate.setMonth(newDate.getMonth() - 1);
                                handleDateChange(newDate, 'debut');
                            }}
                            className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </button>
                        <div className="flex items-center space-x-0">
                            <span className="text-xs text-gray-600">Début:</span>
                            <DatePicker
                                selected={segmentDates.debut}
                                onChange={(date) => handleDateChange(date, 'debut')}
                                selectsStart
                                startDate={segmentDates.debut}
                                endDate={segmentDates.fin}
                                dateFormat="MMM yy"
                                showMonthYearPicker
                                className="w-12 mb-[5px] pl-[4px] px-0 py-0 text-xs rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <button
                            onClick={() => {
                                const newDate = new Date(segmentDates.debut || new Date());
                                newDate.setMonth(newDate.getMonth() + 1);
                                if (newDate < (segmentDates.fin || new Date())) {
                                    handleDateChange(newDate, 'debut');
                                }
                            }}
                            className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>

                    <div className="h-6 w-px bg-gray-300"></div>

                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => {
                                const newDate = new Date(segmentDates.fin || new Date());
                                newDate.setMonth(newDate.getMonth() - 1);
                                if (newDate > (segmentDates.debut || new Date())) {
                                    handleDateChange(newDate, 'fin');
                                }
                            }}
                            className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </button>
                        <div className="flex items-center space-x-0">
                            <span className="text-xs text-gray-600">Fin :</span>
                            <DatePicker
                                selected={segmentDates.fin}
                                onChange={(date) => handleDateChange(date, 'fin')}
                                selectsEnd
                                startDate={segmentDates.debut}
                                endDate={segmentDates.fin}
                                dateFormat="MMM yy"
                                showMonthYearPicker
                                className="w-12 mb-[5px] pl-[4px] px-0 py-0 text-xs rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <button
                            onClick={() => {
                                const newDate = new Date(segmentDates.fin || new Date());
                                newDate.setMonth(newDate.getMonth() + 1);
                                handleDateChange(newDate, 'fin');
                            }}
                            className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div className="pt-1">
                    {factures.length > 0 ? (
                        <Bar data={filteredChartData} options={options} height={80} />
                    ) : (
                        <div className="text-center text-gray-500">Aucune donnée disponible</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NewMainFinancialChart;