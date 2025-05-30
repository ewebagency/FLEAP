'use client'
import { Line, Bar } from 'react-chartjs-2';
import { Facture, ChartData } from '../types';
import { Chart as ChartJS, ChartEvent, LegendItem, LegendElement } from 'chart.js/auto';
import { useEffect, useState, useMemo } from 'react';
import { getMappingTableFiliere } from "@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new";
import { useFilterContext } from '@/app/FilterContext';
import { tailwindToRgb } from '../../MetaComponent/Colours';
import { ChartDataset, TooltipItem } from 'chart.js';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { Chart } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Context } from 'chartjs-plugin-datalabels';

// Flag pour activer/désactiver l'échelle fixe
const ENABLE_FIXED_SCALE = false;

interface Props {
    factures: Facture[];
    entreprise_id: string;
}

const NewMainFinancialChart = ({ factures, entreprise_id }: Props) => {
    const [mappingTable, setMappingTable] = useState<{ ced: string, filiere: string }[]>([]);
    const { filieres, segmentDates, setSegmentDates } = useFilterContext();
    const [maxScale, setMaxScale] = useState<number | null>(null);
    const [minScale, setMinScale] = useState<number | null>(null);
    const [viewType, setViewType] = useState<'chart' | 'table'>('chart');
    const [aggregation, setAggregation] = useState<'month' | 'year'>('month');
    
    // Fonction pour normaliser les types d'opérations
    const normalizeOperationType = (type: string): string => {
        const normalized = type.toLowerCase().replace(/ /g, '_');
        if (normalized === 'gestion_global') return 'gestion_globale';
        if (normalized === 'préparation') return 'preparation';
        if (normalized === 'non_expliqués') return 'non_expliques';
        if (normalized.includes('contenant')) return 'autres_contenant';
        return normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };

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

        // Si aucune filière n'est sélectionnée, retourner un dataset vide
        const selectedFilieres = filieres.filter(f => f.checked).map(f => f.name);
        if (selectedFilieres.length === 0) {
            return {
                labels: [],
                datasets: []
            };
        }

        // Normaliser les dates de début et de fin au premier jour du mois
        const normalizedStartDate = new Date(segmentDates.debut || new Date());
        normalizedStartDate.setDate(1);
        normalizedStartDate.setHours(0, 0, 0, 0);

        const normalizedEndDate = new Date(segmentDates.fin || new Date());
        normalizedEndDate.setDate(1);
        normalizedEndDate.setHours(0, 0, 0, 0);

        const monthLabels: string[] = [];
        const currentDate = new Date(normalizedStartDate);
        
        while (currentDate <= normalizedEndDate) {
            const label = currentDate.toLocaleString('fr-FR', { 
                month: 'short',
                year: '2-digit'
            });
            monthLabels.push(label.charAt(0).toUpperCase() + label.slice(1));
            currentDate.setMonth(currentDate.getMonth() + 1);
        }

        console.log('All month labels:', monthLabels);
        console.log('Month labels mapping:', monthLabels.map(label => {
            const [monthStr, yearStr] = label.split(' ');
            return {
                original: label,
                monthStr,
                yearStr
            };
        }));

        const positiveAmountsByFiliere: { [key: string]: { [key: string]: number } } = {};
        const negativeAmountsByFiliere: { [key: string]: { [key: string]: number } } = {};

        factures.forEach(facture => {
            facture.infos_json.departs.forEach(depart => {
                const header = depart.line_header;
                const cleanedCed = header?.code_dechet?.replaceAll(' ', '').replace('*', '').trim() || '';

                // Détermination de la filière
                let filiere: string;
                
                // Si le code est dans le mapping, on utilise la filière correspondante
                const mappedFiliere = mappingTable.find(m => 
                    m.ced.replaceAll(' ', '').replace('*', '').trim() === cleanedCed
                )?.filiere;

                if (mappedFiliere) {
                    filiere = mappedFiliere;
                } else {
                    // Si le code n'est pas dans le mapping, c'est "Autres"
                    filiere = 'Autres';
                }

                // Calcul des montants ligne par ligne
                depart.line_body.forEach(line => {
                    const montant = line.montant_ht || 0;
                    const dateDepart = new Date(header?.date_depart);
                    console.log("header?.date_depart", header?.date_depart);
                    console.log("dateDepart", dateDepart);
                    // Extraire les composants de la date en UTC
                    const utcYear = dateDepart.getUTCFullYear();
                    const utcMonth = dateDepart.getUTCMonth();
                    // Créer une nouvelle date avec les composants UTC
                    dateDepart.setUTCFullYear(utcYear, utcMonth, 1);
                    dateDepart.setUTCHours(0, 0, 0, 0);

                    // Vérifier si la date est dans l'intervalle
                    if (dateDepart >= normalizedStartDate && dateDepart <= normalizedEndDate) {
                        const monthKey = dateDepart.toISOString().slice(0, 7); // Format YYYY-MM
                        const normalizedType = normalizeOperationType(line.type_operation);

                        // Les rachats sont considérés comme négatifs
                        if (normalizedType === 'rachat') {
                            if (!negativeAmountsByFiliere[filiere]) {
                                negativeAmountsByFiliere[filiere] = {};
                            }
                            negativeAmountsByFiliere[filiere][monthKey] = (negativeAmountsByFiliere[filiere][monthKey] || 0) + montant;
                        } else {
                            if (!positiveAmountsByFiliere[filiere]) {
                                positiveAmountsByFiliere[filiere] = {};
                            }
                            positiveAmountsByFiliere[filiere][monthKey] = (positiveAmountsByFiliere[filiere][monthKey] || 0) + montant;
                        }
                    }
                });
            });
        });

        console.log('Positive amounts:', positiveAmountsByFiliere);
        console.log('Negative amounts:', negativeAmountsByFiliere);

        const datasets = [
            ...Object.entries(positiveAmountsByFiliere).map(([filiere, data]) => {
                const filiereColor = filieres.find(f => f.name === filiere)?.color || '#000000';
                const color = tailwindToRgb(filiereColor);
                const mappedData = monthLabels.map(label => {
                    const [monthStr, yearStr] = label.split(' ');
                    const cleanMonthStr = monthStr.replace('.', '');
                    const monthMap = {
                        'Janv': 0, 'Févr': 1, 'Mars': 2, 'Avr': 3, 'Mai': 4, 'Juin': 5,
                        'Juil': 6, 'Août': 7, 'Sept': 8, 'Oct': 9, 'Nov': 10, 'Déc': 11
                    };
                    const monthIndex = monthMap[cleanMonthStr as keyof typeof monthMap];
                    const year = parseInt(yearStr, 10) + 2000;
                    const date = new Date(year, monthIndex, 1, 12, 0, 0, 0);
                    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
                    const value = data[monthKey] || 0;
                    
                    return value;
                });
                
                return {
                    label: filiere,
                    data: mappedData,
                    backgroundColor: color,
                    stack: 'negative',
                    hidden: false,
                    borderRadius: 4
                };
            }),
            ...Object.entries(negativeAmountsByFiliere).map(([filiere, data]) => {
                const filiereColor = filieres.find(f => f.name === filiere)?.color || '#000000';
                const color = tailwindToRgb(filiereColor);
                const mappedData = monthLabels.map(label => {
                    const [monthStr, yearStr] = label.split(' ');
                    const cleanMonthStr = monthStr.replace('.', '');
                    const monthMap = {
                        'Janv': 0, 'Févr': 1, 'Mars': 2, 'Avr': 3, 'Mai': 4, 'Juin': 5,
                        'Juil': 6, 'Août': 7, 'Sept': 8, 'Oct': 9, 'Nov': 10, 'Déc': 11
                    };
                    const monthIndex = monthMap[cleanMonthStr as keyof typeof monthMap];
                    const year = parseInt(yearStr, 10) + 2000;
                    const date = new Date(year, monthIndex, 1, 12, 0, 0, 0);
                    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
                    // Les rachats sont comptés négativement dans le total
                    const value = -(data[monthKey] || 0);
                    
                    return value;
                });
                
                return {
                    label: filiere,
                    data: mappedData,
                    backgroundColor: color,
                    stack: 'positive',
                    hidden: false,
                    borderRadius: 4
                };
            })
        ];

        // Calcul des totaux pour le tableau
        const tableData = monthLabels.map((label, index) => {
            const [monthStr, yearStr] = label.split(' ');
            const cleanMonthStr = monthStr.replace('.', '');
            const monthMap = {
                'Janv': 0, 'Févr': 1, 'Mars': 2, 'Avr': 3, 'Mai': 4, 'Juin': 5,
                'Juil': 6, 'Août': 7, 'Sept': 8, 'Oct': 9, 'Nov': 10, 'Déc': 11
            };
            const monthIndex = monthMap[cleanMonthStr as keyof typeof monthMap];
            const year = parseInt(yearStr, 10) + 2000;
            const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

            const positiveTotal = Object.values(positiveAmountsByFiliere).reduce((sum, data) => sum + (data[monthKey] || 0), 0);
            const negativeTotal = Object.values(negativeAmountsByFiliere).reduce((sum, data) => sum + (data[monthKey] || 0), 0);

            return {
                label,
                positive: positiveTotal,
                negative: -negativeTotal, // Les rachats sont comptés négativement
                total: positiveTotal - negativeTotal
            };
        });

        console.log('Final datasets:', datasets);

        // Calculate min and max values for the first time
        if (ENABLE_FIXED_SCALE && (minScale === null || maxScale === null)) {
            let allValues: number[] = [];
            Object.values(positiveAmountsByFiliere).forEach(data => {
                allValues = [...allValues, ...Object.values(data)];
            });
            Object.values(negativeAmountsByFiliere).forEach(data => {
                allValues = [...allValues, ...Object.values(data).map(v => -v)];
            });
            
            if (allValues.length > 0) {
                const maxValue = Math.max(...allValues);
                const minValue = Math.min(...allValues);
                // Add 10% padding to the scales
                const arrondi = 100;
                setMaxScale(Math.round(maxValue * 2 / arrondi) * arrondi);
                setMinScale(Math.round(minValue * 1.5 / arrondi) * arrondi);
            }
        }

        return {
            labels: monthLabels,
            datasets: datasets
        };
    }, [factures, mappingTable, filieres, segmentDates, maxScale, minScale]);

    const aggregatedData = useMemo(() => {
        if (!filteredChartData?.labels.length) return filteredChartData;

        if (aggregation === 'month') return filteredChartData;

        // Agréger par année
        const yearLabels = Array.from(new Set(
            filteredChartData.labels.map(label => label.split(' ')[1])
        )).sort();

        const yearData = filteredChartData.datasets.map(dataset => {
            const yearlyData = yearLabels.map(year => {
                const monthIndices = filteredChartData.labels
                    .map((label, index) => label.split(' ')[1] === year ? index : -1)
                    .filter(index => index !== -1);
                
                return monthIndices.reduce((sum, index) => sum + dataset.data[index], 0);
            });

            return {
                ...dataset,
                data: yearlyData
            };
        });

        return {
            labels: yearLabels,
            datasets: yearData
        };
    }, [filteredChartData, aggregation]);

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
                text: 'Évolution des coûts et revenus mensuels',
                color: 'gray',
                align: 'center' as const,
                padding: {
                    top: 10,
                    bottom: 10
                },
                font: {
                    size: 14,
                    weight: 'normal' as const
                }
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
                callbacks: {
                    label: function(tooltipItem: TooltipItem<"bar">) {
                        const value = Math.abs(tooltipItem.raw as number);
                        const isNegative = tooltipItem.dataset.stack === 'positive';
                        const symbol = isNegative ? '+' : '-';
                        return `${symbol} ${tooltipItem.dataset.label}: ${value.toLocaleString('fr-FR')} €`;
                    },
                    title: function(tooltipItems: TooltipItem<"bar">[]) {
                        return tooltipItems[0].label;
                    },
                    footer: function(tooltipItems: TooltipItem<"bar">[]) {
                        const positiveTotal = tooltipItems
                            .filter(item => item.dataset.stack === 'positive')
                            .reduce((sum, item) => sum + Math.abs(item.raw as number), 0);
                        
                        const negativeTotal = tooltipItems
                            .filter(item => item.dataset.stack === 'negative')
                            .reduce((sum, item) => sum + Math.abs(item.raw as number), 0);

                        return [
                            `Total coûts : -${negativeTotal.toLocaleString('fr-FR')} €`,
                            `Total revenus : +${positiveTotal.toLocaleString('fr-FR')} €`,
                            `Bilan : ${(positiveTotal - negativeTotal).toLocaleString('fr-FR')} €`
                        ];
                    }
                }
            },
            datalabels: {
                display(context: Context) {
                    const datasetIndex = context.datasetIndex;
                    const datasets = context.chart.data.datasets as ChartDataset<'bar'>[];
                    const value = Math.abs(Number(context.dataset.data[context.dataIndex]));
                    
                    const total = {
                        positive: 0,
                        negative: 0
                    };
                    
                    datasets.forEach(dataset => {
                        const dataValue = Math.abs(Number(dataset.data[context.dataIndex])) || 0;
                        if (dataset.stack === 'positive') {
                            total.positive += dataValue;
                        } else {
                            total.negative += dataValue;
                        }
                    });
                    
                    // Cacher les labels s'il y a plus de 14 barres
                    if (context.chart.data.labels?.length && context.chart.data.labels.length > 7) {
                        return false;
                    }
                    
                    // Afficher seulement pour le dernier dataset de chaque stack
                    const isLastPositive = (dataset: ChartDataset<'bar'>) => dataset.stack === 'positive';
                    const isLastNegative = (dataset: ChartDataset<'bar'>) => dataset.stack === 'negative';
                    
                    const lastPositiveIndex = datasets.findLastIndex(isLastPositive);
                    const lastNegativeIndex = datasets.findLastIndex(isLastNegative);
                    
                    return (datasetIndex === lastPositiveIndex || datasetIndex === lastNegativeIndex) && 
                           ((context.dataset.stack === 'positive' && total.positive > 0) || 
                            (context.dataset.stack === 'negative' && total.negative > 0));
                },
                color: 'black',
                font: {
                    weight: 'bold' as const,
                    size: 11
                },
                formatter(value: number, context: Context) {
                    const datasets = context.chart.data.datasets as ChartDataset<'bar'>[];
                    let total = 0;
                    const isPositiveStack = context.dataset.stack === 'positive';
                    
                    datasets.forEach(dataset => {
                        if (dataset.stack === context.dataset.stack) {
                            const dataValue = Math.abs(Number(dataset.data[context.dataIndex])) || 0;
                            total += dataValue;
                        }
                    });
                    
                    return `${isPositiveStack ? '+' : '-'}${total.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`;
                },
                anchor: 'end' as const,
                align: 'top' as const,
                offset(context: Context) {
                    return context.dataset.stack === 'positive' ? -20 : 0;
                }
            }
        },
        scales: {
            y: {
                beginAtZero: false,
                min: ENABLE_FIXED_SCALE ? minScale || undefined : undefined,
                max: ENABLE_FIXED_SCALE ? maxScale || undefined : undefined,
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
            <div className="bg-white rounded-lg relative">
                <div className="absolute top-1 left-16 z-10">
                    <button
                        onClick={() => setViewType(viewType === 'chart' ? 'table' : 'chart')}
                        className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded flex items-center space-x-2"
                    >
                        {viewType === 'chart' ? (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M2 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4zM8 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H9a1 1 0 01-1-1V4zM15 3a1 1 0 00-1 1v12a1 1 0 001 1h2a1 1 0 001-1V4a1 1 0 00-1-1h-2z" />
                                </svg>
                                <span className="text-xs">Vue Tableau</span>
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1v-6zM8 7a1 1 0 011-1h2a1 1 0 011 1v10a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM15 4a1 1 0 00-1 1v12a1 1 0 001 1h2a1 1 0 001-1V5a1 1 0 00-1-1h-2z" />
                                </svg>
                                <span className="text-xs">Vue Graphique</span>
                            </>
                        )}
                    </button>
                </div>

                {viewType === 'table' && (
                    <div className="absolute top-1 left-56 z-10">
                        <button
                            onClick={() => setAggregation(aggregation === 'month' ? 'year' : 'month')}
                            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded flex items-center space-x-2"
                        >
                            {aggregation === 'month' ? (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-xs">Vue Annuelle</span>
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-xs">Vue Mensuelle</span>
                                </>
                            )}
                        </button>
                    </div>
                )}

                <div className="absolute top-2 right-6 z-10 flex items-center space-x-2">
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
                        viewType === 'chart' ? (
                            <Bar 
                                data={filteredChartData} 
                                options={options} 
                                plugins={[ChartDataLabels]}
                                height={80} 
                            />
                        ) : aggregatedData ? (
                            <div className="overflow-x-auto mt-8">
                                <table className="min-w-full divide-y divide-gray-200 text-xs">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                                                Filière
                                            </th>
                                            {aggregatedData.labels.map((label, index) => (
                                                <th key={index} className="px-6 py-1 text-left font-medium text-gray-500 uppercase tracking-wider">
                                                    {label}
                                                </th>
                                            ))}
                                            <th className="px-6 py-1 text-left font-medium text-gray-500 uppercase tracking-wider">
                                                Total
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {aggregatedData.datasets.map((dataset, index) => (
                                            <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
                                                <td className="px-6 py-1 whitespace-nowrap font-medium text-gray-900">
                                                    {dataset.label}
                                                </td>
                                                {dataset.data.map((value, valueIndex) => (
                                                    <td key={valueIndex} className="px-6 py-2 whitespace-nowrap text-gray-500">
                                                        {dataset.stack === 'positive' ? '-' : ''}{Math.abs(value).toLocaleString('fr-FR')} €
                                                    </td>
                                                ))}
                                                <td className="px-6 py-1 whitespace-nowrap font-medium text-gray-900">
                                                    {dataset.stack === 'positive' ? '-' : ''}{Math.abs(dataset.data.reduce((sum, val) => sum + val, 0)).toLocaleString('fr-FR')} €
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="bg-gray-50 font-medium">
                                            <td className="px-6 py-1 whitespace-nowrap text-gray-900">Total</td>
                                            {aggregatedData.labels.map((_, index) => {
                                                const total = aggregatedData.datasets.reduce(
                                                    (sum, dataset) => sum + dataset.data[index], 0
                                                );
                                                return (
                                                    <td key={index} className="px-6 py-2 whitespace-nowrap text-gray-900">
                                                        {total < 0 ? '-' : ''}{Math.abs(total).toLocaleString('fr-FR')} €
                                                    </td>
                                                );
                                            })}
                                            <td className="px-6 py-1 whitespace-nowrap text-gray-900">
                                                {(() => {
                                                    const finalTotal = aggregatedData.datasets.reduce(
                                                        (sum, dataset) => sum + dataset.data.reduce((s, v) => s + v, 0), 0
                                                    );
                                                    return finalTotal < 0 ? `-${Math.abs(finalTotal).toLocaleString('fr-FR')} €` : `${Math.abs(finalTotal).toLocaleString('fr-FR')} €`;
                                                })()}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center text-gray-500">Aucune donnée disponible</div>
                        )
                    ) : (
                        <div className="text-center text-gray-500">Aucune donnée disponible</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NewMainFinancialChart;