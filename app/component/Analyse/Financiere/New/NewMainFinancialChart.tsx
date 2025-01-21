'use client'
import { Line } from 'react-chartjs-2';
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
    const { filieres } = useFilterContext();
    
    const [startDate, setStartDate] = useState<Date>(() => {
        const date = new Date();
        date.setMonth(date.getMonth() - 11);
        return date;
    });
    const [endDate, setEndDate] = useState<Date>(new Date());

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
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const label = currentDate.toLocaleString('fr-FR', { 
                month: 'short',
                year: '2-digit'
            });
            monthLabels.push(label.charAt(0).toUpperCase() + label.slice(1));
            currentDate.setMonth(currentDate.getMonth() + 1);
        }

        const amountsByFiliere: { [key: string]: number[] } = {};

        factures.forEach(facture => {
            facture.infos_json.departs.forEach(depart => {
                if (!depart.line_header?.code_dechet) {
                    return;
                }

                const date = new Date(depart.line_header.date_depart);
                if (date < startDate || date > endDate) {
                    return;
                }

                const cleanedCed = depart.line_header.code_dechet
                    .replaceAll(' ', '')
                    .replace('*', '');

                const filiere = mappingTable.find(m => 
                    m.ced.replaceAll(' ', '').replace('*', '') === cleanedCed
                )?.filiere || 'Autres';

                if (!amountsByFiliere[filiere]) {
                    amountsByFiliere[filiere] = Array(monthLabels.length).fill(0);
                }

                const monthIndex = Math.floor(
                    (date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
                );

                if (monthIndex >= 0 && monthIndex < monthLabels.length) {
                    const departTotal = depart.line_body.reduce((sum, operation) => 
                        sum + (operation.montant_ht || 0), 0);
                    amountsByFiliere[filiere][monthIndex] += departTotal;
                }
            });
        });

        const datasets = Object.entries(amountsByFiliere).map(([filiere, data]) => {
            const filiereColor = filieres.find(f => f.name === filiere)?.color || '#000000';
            const color = tailwindToRgb(filiereColor);

            return {
                label: filiere,
                data: data,
                borderColor: color,
                backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 1)'),
                fill: true,
                borderWidth: 1,
                pointRadius: 0,
                tension: 0.2,
                cubicInterpolationMode: 'monotone' as 'default' | 'monotone',
                hidden: false
            };
        });

        const sortedDatasets = datasets.sort((a, b) => {
            const totalA = a.data.reduce((sum, val) => sum + val, 0);
            const totalB = b.data.reduce((sum, val) => sum + val, 0);
            return totalB - totalA;
        });

        return {
            labels: monthLabels,
            datasets: sortedDatasets
        };
    }, [factures, mappingTable, filieres, startDate, endDate]);

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
                position: 'bottom' as const,
                onClick: function(
                    this: LegendElement<"line">,
                    e: ChartEvent,
                    legendItem: LegendItem,
                    legend: LegendElement<"line">
                ) {
                    const index = legendItem.datasetIndex ?? 0;
                    const ci = legend.chart;
                    const meta = ci.getDatasetMeta(index);

                    meta.hidden = meta.hidden === null || meta.hidden === undefined ? true : !meta.hidden;
                    ci.update();
                }
            },
            title: {
                display: true,
                text: 'Évolution des coûts mensuels'
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
                position: 'nearest' as const,
                caretPadding: 10,
                caretSize: 0,
                yAlign: 'bottom' as const,
                callbacks: {
                    title: (tooltipItems: TooltipItem<"line">[]) => {
                        return tooltipItems[0].label;
                    },
                    label: function(tooltipItem: TooltipItem<"line">) {
                        const value = tooltipItem.raw as number;
                        return `${value.toLocaleString('fr-FR')} €`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                stacked: true,
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
                stacked: true,
                grid: {
                    display: false
                }
            }
        },
        interaction: {
            intersect: false,
            mode: 'index' as const
        },
        elements: {
            line: {
                tension: 0.2
            }
        }
    };

    const handleDateChange = (date: Date | null, setter: (date: Date) => void) => {
        if (date) {
            setter(date);
        }
    };

    return (
        <div className="mt-4">
            <div className="bg-white rounded-lg shadow relative">
                <div className="absolute top-2 left-14 z-10 flex items-center space-x-2">
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => {
                                const newDate = new Date(startDate);
                                newDate.setMonth(startDate.getMonth() - 1);
                                setStartDate(newDate);
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
                                selected={startDate}
                                onChange={(date) => handleDateChange(date, setStartDate)}
                                selectsStart
                                startDate={startDate}
                                endDate={endDate}
                                dateFormat="MMM yy"
                                showMonthYearPicker
                                className="w-12 mb-[5px] pl-[4px] px-0 py-0 text-xs rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <button
                            onClick={() => {
                                const newDate = new Date(startDate);
                                newDate.setMonth(startDate.getMonth() + 1);
                                if (newDate < endDate) {
                                    setStartDate(newDate);
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
                                const newDate = new Date(endDate);
                                newDate.setMonth(endDate.getMonth() - 1);
                                if (newDate > startDate) {
                                    setEndDate(newDate);
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
                                selected={endDate}
                                onChange={(date) => handleDateChange(date, setEndDate)}
                                selectsEnd
                                startDate={startDate}
                                endDate={endDate}
                                dateFormat="MMM yy"
                                showMonthYearPicker
                                className="w-12 mb-[5px] pl-[4px] px-0 py-0 text-xs rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <button
                            onClick={() => {
                                const newDate = new Date(endDate);
                                newDate.setMonth(endDate.getMonth() + 1);
                                setEndDate(newDate);
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
                        <Line data={filteredChartData} options={options} height={60} />
                    ) : (
                        <div className="text-center text-gray-500">Aucune donnée disponible</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NewMainFinancialChart;