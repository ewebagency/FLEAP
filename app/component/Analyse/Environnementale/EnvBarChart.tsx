import React, { useEffect, useState } from 'react';
import { DynamicCharts } from '../MetaComponent/ChartWrapper';
import { useAnalysis } from '../../../analysis/AnalysisProvider';
import { useFilterContext } from '../../../FilterContext';
import { estimerCarbone } from './environnement_utils';
import { getFiliere } from '../../../register/RegisterComponents/Modal/FormulaireFull/utils_new';
import { tailwindToRgb, tailwindToRgba } from '../MetaComponent/Colours';
import { FormInput } from '../../../register/interface/BSD_Interface';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { TooltipItem as ChartTooltipItem, Chart as ChartJS, ChartData, ChartOptions, ChartDataset } from 'chart.js';
import { Context } from 'chartjs-plugin-datalabels';

const { Bar } = DynamicCharts;

interface LocalChartData {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        backgroundColor: string;
        borderColor: string;
        borderWidth: number;
    }[];
}

interface TreatmentStats {
    tonnage: number;
    carbon: number;
}

interface DatasetWithLabel extends ChartDataset<'bar'> {
    label: string;
}

const treatmentLabels = {
  "D1": "D1 - Mise en décharge", // D1 : Mise en décharge
  "D2": "D2 - Traitement terrestre", // D2 : Traitement en milieu terrestre
  "D3": "D3 - Injection en profondeur", // D3 : Injection en profondeur
  "D4": "D4 - Lagunage", // D4 : Lagunage
  "D5": "D5 - Confinement spécial", // D5 : Installation spéciale de confinement
  "D6": "D6 - Rejet dans les eaux", // D6 : Rejet dans les eaux, à l'exception des mers et océans
  "D7": "D7 - Immersion en mer", // D7 : Rejet dans les mers et océans, y compris immersion
  "D8": "D8 - Traitement biologique", // D8 : Traitement biologique ne spécifié ailleurs
  "D9": "D9 - Traitement physico-chimique", // D9 : Traitement physico-chimique ne spécifié ailleurs
  "D10": "D10 - Incinération sur terre", // D10 : Incinération sur terre
  "D11": "D11 - Incinération en mer", // D11 : Incinération en mer
  "D12": "D12 - Stockage permanent", // D12 : Stockage permanent
  "D13": "D13 - Regroupement avant D1-D12", // D13 : Regroupement avant une opération D1 à D12
  "D14": "D14 - Reconditionnement avant D1-D13", // D14 : Reconditionnement avant une opération D1 à D13
  "D15": "D15 - Stockage en attente D1-D14", // D15 : Stockage en attente d'une opération D1 à D14
  "R0": "R0 - Réutilisation", // R0 : Réutilisation
  "R1": "R1 - Valorisation énergétique", // R1 : Utilisation principale comme combustible ou autre moyen de produire de l'énergie
  "R2": "R2 - Récupération de solvants", // R2 : Récupération ou régénération de solvants
  "R3": "R3 - Recyclage substances organiques", // R3 : Recyclage ou récupération des substances organiques ne utilisées comme solvants
  "R4": "R4 - Recyclage des métaux", // R4 : Recyclage ou récupération des métaux et composés métalliques
  "R5": "R5 - Recyclage matières inorganiques", // R5 : Recyclage ou récupération d'autres matières inorganiques
  "R6": "R6 - Régénération acides/bases", // R6 : Régénération des acides ou des bases
  "R7": "R7 - Valorisation composants antipollution", // R7 : Valorisation des composants utilisés pour réduire la pollution
  "R8": "R8 - Valorisation catalyseurs", // R8 : Valorisation des composants des catalyseurs
  "R9": "R9 - Régénération des huiles", // R9 : Régénération ou autres réemplois des huiles
  "R10": "R10 - Épandage agricole/écologique", // R10 : Épandage sur le sol au profit de l'agriculture ou de l'écologie
  "R11": "R11 - Utilisation après R1-R10", // R11 : Utilisation de déchets obtenus à partir de l'une des opérations numérotées R1 à R10
  "R12": "R12 - Échange avant R1-R11", // R12 : Échange de déchets en vue de les soumettre à l'une des opérations numérotées R1 à R11
  "R13": "R13 - Stockage avant R1-R12", // R13 : Stockage de déchets en attente de l'une des opérations numérotées R1 à R12
  "default": "Autre" // Autre traitement
};

  

const treatmentColors = {
    // Codes R (Valorisation) - Dégradés de vert/bleu
    'R0': 'rgba(34, 197, 94, 0.8)',  // Vert vif (Réutilisation)
    'R1': 'rgba(16, 185, 129, 0.8)', // Vert émeraude
    'R2': 'rgba(20, 184, 166, 0.8)', // Vert teal
    'R3': 'rgba(6, 182, 212, 0.8)',  // Cyan
    'R4': 'rgba(14, 165, 233, 0.8)', // Bleu ciel
    'R5': 'rgba(59, 130, 246, 0.8)', // Bleu
    'R6': 'rgba(99, 102, 241, 0.8)', // Indigo
    'R7': 'rgba(139, 92, 246, 0.8)', // Violet
    'R8': 'rgba(168, 85, 247, 0.8)', // Violet foncé
    'R9': 'rgba(192, 132, 252, 0.8)',// Violet clair
    'R10': 'rgba(216, 180, 254, 0.8)',// Violet très clair
    'R11': 'rgba(147, 197, 253, 0.8)',// Bleu clair
    'R12': 'rgba(186, 230, 253, 0.8)',// Bleu très clair
    'R13': 'rgba(125, 211, 252, 0.8)',// Bleu azur

    // Codes D (Élimination) - Dégradés de orange/rouge
    'D1': 'rgba(244, 63, 94, 0.8)',  // Rouge rose
    'D2': 'rgba(251, 113, 133, 0.8)',// Rose
    'D3': 'rgba(253, 164, 175, 0.8)',// Rose clair
    'D4': 'rgba(249, 115, 22, 0.8)', // Orange
    'D5': 'rgba(234, 88, 12, 0.8)',  // Orange foncé
    'D6': 'rgba(249, 168, 212, 0.8)',// Rose pâle
    'D7': 'rgba(236, 72, 153, 0.8)', // Rose vif
    'D8': 'rgba(244, 114, 182, 0.8)',// Rose moyen
    'D9': 'rgba(251, 207, 232, 0.8)',// Rose très clair
    'D10': 'rgba(225, 29, 72, 0.8)', // Rouge vif
    'D11': 'rgba(248, 113, 113, 0.8)',// Rouge clair
    'D12': 'rgba(239, 68, 68, 0.8)', // Rouge
    'D13': 'rgba(252, 165, 165, 0.8)',// Rouge pâle
    'D14': 'rgba(254, 202, 202, 0.8)',// Rouge très pâle
    'D15': 'rgba(220, 38, 38, 0.8)', // Rouge foncé

    // Autre
    'default': 'rgba(156, 163, 175, 0.8)' // Gris
};

const EnvBarChart = () => {
    const { bsds, mappingTable, filieres_ou_prestataires, siretToName } = useAnalysis();
    const { filieres } = useFilterContext();
    const [monthlyData, setMonthlyData] = useState<LocalChartData>({
        labels: [],
        datasets: []
    });
    const [treatmentData, setTreatmentData] = useState<LocalChartData>({
        labels: [],
        datasets: []
    });
    const [startDate, setStartDate] = useState<Date>(() => {
        const date = new Date();
        date.setMonth(date.getMonth() - 11);
        return date;
    });
    const [endDate, setEndDate] = useState<Date>(new Date());
    const [sortedTreatments, setSortedTreatments] = useState<[string, TreatmentStats][]>([]);
    const [totals, setTotals] = useState<{
        tonnage: number;
        carbon: number;
        currentMonthTonnage: number;
        currentMonthCarbon: number;
    }>({
        tonnage: 0,
        carbon: 0,
        currentMonthTonnage: 0,
        currentMonthCarbon: 0
    });

    // Remplacer la palette de couleurs prestataires par celle de l'analyse
    const prestatairesColors = [
            'rgb(142, 202, 230)',    // Bleu clair
            'rgb(255, 183, 178)',    // Rose pâle
            'rgb(181, 234, 215)',    // Vert menthe
            'rgb(199, 206, 234)',    // Lavande
            'rgb(255, 218, 193)',    // Pêche
            'rgb(168, 218, 220)',    // Turquoise
            'rgb(241, 192, 232)',    // Rose lilas
            'rgb(204, 213, 174)',    // Vert sauge
            'rgb(254, 200, 216)',    // Rose poudré
            'rgb(173, 216, 230)',    // Bleu poudré
    ];

    useEffect(() => {
        if (!bsds || bsds.length === 0) return;

        // Initialiser les structures de données
        const monthlyEmissions = new Map<string, number[]>();
        const treatmentEmissions = new Map<string, Map<string, number>>();
        
        // Créer les labels de mois dynamiquement basés sur la plage de dates
        const monthLabels: string[] = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            monthLabels.push(currentDate.toLocaleString('fr-FR', { 
                month: 'short',
                year: '2-digit'
            }));
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
        
        // Initialiser les tableaux avec la bonne longueur
        const numberOfMonths = monthLabels.length;
        
        bsds.forEach((bsd: {created_at:string, infos_json:{formAPI:{createFormInput:FormInput}}}) => {
            const quantity = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity || 0;
            const cedCode = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code;
            const processingOperation = bsd.infos_json?.formAPI?.createFormInput?.recipient?.processingOperation || 'default';
            
            // Nouvelle logique de date
            let bsdDate;
            if (bsd.infos_json?.formAPI?.createFormInput?.takenOverAt) {
                const takenOverDate = new Date(bsd.infos_json.formAPI.createFormInput.takenOverAt);
                if (!isNaN(takenOverDate.getTime()) && 
                    takenOverDate.getFullYear() >= 2020 && 
                    takenOverDate.getFullYear() <= 2030) {
                    bsdDate = takenOverDate;
                } else {
                    bsdDate = new Date(bsd.created_at);
                }
            } else {
                bsdDate = new Date(bsd.created_at);
            }
            
            // Vérifier si la date est dans la plage sélectionnée
            if (bsdDate >= startDate && bsdDate <= endDate) {
                // Calculer l'index du mois relatif au début de la période
                const monthIndex = Math.floor(
                    (bsdDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
                );
                
                if (monthIndex >= 0 && monthIndex < numberOfMonths) {
            // Déterminer la clé (filière ou prestataire)
            let key;
            if (filieres_ou_prestataires.nom === 'filiere') {
                key = getFiliere(cedCode, mappingTable) || 'Autres';
            } else {
                const siret = bsd.infos_json?.formAPI?.createFormInput?.recipient?.company?.siret;
                key = siretToName[siret] || siret || 'Non renseigné';
            }

            try {
                const carbonEmission = parseFloat(estimerCarbone(cedCode, processingOperation, quantity));
                
                if (!monthlyEmissions.has(key)) {
                            monthlyEmissions.set(key, Array(numberOfMonths).fill(0));
                }
                const monthlyValues = monthlyEmissions.get(key)!;
                        monthlyValues[monthIndex] += carbonEmission;

                if (!treatmentEmissions.has(processingOperation)) {
                    treatmentEmissions.set(processingOperation, new Map<string, number>());
                }
                const treatmentMap = treatmentEmissions.get(processingOperation)!;
                treatmentMap.set(key, (treatmentMap.get(key) || 0) + carbonEmission);
            } catch (error) {
                // Ignorer les erreurs de calcul
                    }
                }
            }
        });

        // Trier les segments avec "Autres" à la fin
        const sortedSegments = Array.from(monthlyEmissions.entries()).sort((a, b) => {
            if (a[0] === 'Autres') return 1;
            if (b[0] === 'Autres') return -1;
            const totalA = a[1].reduce((sum, val) => sum + val, 0);
            const totalB = b[1].reduce((sum, val) => sum + val, 0);
            return totalB - totalA;
        });

        // Préparer les données mensuelles
        const monthlyDatasets = sortedSegments.map(([segment, data], index) => {
            const color = filieres_ou_prestataires.nom === 'filiere'
                ? tailwindToRgb(filieres.find(f => f.name === segment)?.color || '#000000')
                : prestatairesColors[index % prestatairesColors.length];

            return {
                label: segment,
                data: data,
                borderColor: color,
                backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.8)'),
                borderWidth: 1
            };
        });

        setMonthlyData({
            labels: monthLabels,
            datasets: monthlyDatasets
        });

        // Nouvelle structure pour les données de traitement
        const treatmentStats = new Map<string, {
            tonnage: number;
            carbon: number;
        }>();

        // Calculer les totaux par méthode de traitement
        bsds.forEach((bsd) => {
            const quantity = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity || 0;
            const processingOperation = bsd.infos_json?.formAPI?.createFormInput?.recipient?.processingOperation || 'default';
            const cedCode = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code;

            if (!treatmentStats.has(processingOperation)) {
                treatmentStats.set(processingOperation, { tonnage: 0, carbon: 0 });
            }

            const stats = treatmentStats.get(processingOperation)!;
            stats.tonnage += quantity;
            stats.carbon += parseFloat(estimerCarbone(cedCode, processingOperation, quantity));
        });

        // Calculer les totaux pour les pourcentages
        const totalTonnage = Array.from(treatmentStats.values()).reduce((sum, stat) => sum + (Number(stat.tonnage) || 0), 0);
        const totalCarbon = Array.from(treatmentStats.values()).reduce((sum, stat) => sum + (Number(stat.carbon) || 0), 0);

        // Calculer les totaux du mois en cours
        const currentMonthTonnage = Array.from(treatmentStats.values()).reduce((sum, stat) => sum + (Number(stat.tonnage) || 0), 0);
        const currentMonthCarbon = Array.from(treatmentStats.values()).reduce((sum, stat) => sum + (Number(stat.carbon) || 0), 0);

        setTotals({
            tonnage: Number(totalTonnage) || 0,
            carbon: Number(totalCarbon) || 0,
            currentMonthTonnage: Number(currentMonthTonnage) || 0,
            currentMonthCarbon: Number(currentMonthCarbon) || 0
        });

        // Trier par tonnage
        const sorted = Array.from(treatmentStats.entries())
            .sort((a, b) => b[1].tonnage - a[1].tonnage);

        setSortedTreatments(sorted);

        // Créer les datasets
        setTreatmentData({
            labels: ['Tonnage', 'Équivalent CO₂'],
            datasets: sorted.map(([code, stats]) => ({
                label: treatmentLabels[code.replaceAll(' ', '') as keyof typeof treatmentLabels] || code,
                data: [
                    totalTonnage > 0 ? (Number(stats.tonnage) || 0) / totalTonnage * 100 : 0,
                    totalCarbon > 0 ? (Number(stats.carbon) || 0) / totalCarbon * 100 : 0
                ],
                backgroundColor: treatmentColors[code.replaceAll(' ', '') as keyof typeof treatmentColors] || treatmentColors.default,
                borderColor: treatmentColors[code.replaceAll(' ', '') as keyof typeof treatmentColors] || treatmentColors.default,
                borderWidth: 1
            }))
        });

    }, [bsds, mappingTable, filieres_ou_prestataires, filieres, siretToName, startDate, endDate]);

    const monthlyOptions: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
            },
            title: {
                display: true,
                text: `Émissions CO₂ mensuelles par ${filieres_ou_prestataires.nom === 'filiere' ? 'filière' : 'prestataire'}`
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                position: 'nearest',
                callbacks: {
                    label(tooltipItem: ChartTooltipItem<'bar'>) {
                        const value = Number(tooltipItem.raw);
                        return `${tooltipItem.dataset.label}: ${value.toFixed(2)} T CO₂`;
                    }
                }
            },
            datalabels: {
                display(context: Context) {
                    const datasetIndex = context.datasetIndex;
                    const datasets = context.chart.data.datasets as DatasetWithLabel[];
                    const value = Number(context.dataset.data[context.dataIndex]);
                    
                    let total = 0;
                    datasets.forEach(dataset => {
                        const dataValue = Number(dataset.data[context.dataIndex]) || 0;
                        total += dataValue;
                    });
                    
                    return datasetIndex === datasets.length - 1 && total > 0;
                },
                color: 'black',
                font: {
                    weight: 'bold',
                    size: 11
                },
                formatter(value: number, context: Context) {
                    const datasets = context.chart.data.datasets as DatasetWithLabel[];
                    let total = 0;
                    datasets.forEach(dataset => {
                        const dataValue = Number(dataset.data[context.dataIndex]) || 0;
                        total += dataValue;
                    });
                    return `${total.toFixed(2)} T CO₂`;
                },
                anchor: 'end',
                align: 'top',
                offset: 0
            }
        },
        scales: {
            x: {
                stacked: true,
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)',
                }
            },
            y: {
                stacked: true,
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Tonnes CO₂'
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)',
                }
            }
        },
        elements: {
            bar: {
                borderRadius: 4
            }
        }
    };

    const treatmentOptions: ChartOptions<'bar'> = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
            },
            title: {
                display: true,
                text: 'Répartition par méthode de traitement'
            },
            tooltip: {
                callbacks: {
                    label(tooltipItem: ChartTooltipItem<'bar'>) {
                        const stats = sortedTreatments.find(([code]) => 
                            treatmentLabels[code.replaceAll(' ', '') as keyof typeof treatmentLabels] === tooltipItem.dataset.label
                        )?.[1];
                        
                        if (stats) {
                            if (Number(tooltipItem.raw) === 0) return tooltipItem.dataset.label;
                            
                            const barLabel = treatmentData.labels[tooltipItem.dataIndex];
                            if (barLabel === 'Tonnage') {
                                return `${tooltipItem.dataset.label}: ${stats.tonnage.toFixed(2)} T`;
                            }
                                return `${tooltipItem.dataset.label}: ${stats.carbon.toFixed(2)} T CO₂`;
                            }
                        return tooltipItem.dataset.label;
                    }
                }
            },
            datalabels: {
                display(context: Context) {
                    const value = Number(context.dataset.data[context.dataIndex]);
                    return value > 3;
                },
                    color: 'white',
                    font: {
                        weight: 'bold',
                        size: 11
                    },
                formatter(value: number) {
                    return `${value.toFixed(1)}%`;
                },
                align: 'center',
                anchor: 'center',
                clamp: true
                }
        },
        scales: {
            x: {
                stacked: true,
                beginAtZero: true,
                max: 100,
                title: {
                    display: true,
                    text: 'Pourcentage (%)'
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)',
                }
            },
            y: {
                stacked: true,
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)',
                }
            }
        },
        elements: {
            bar: {
                borderRadius: 4
            }
        }
    };

    const handleDateChange = (date: Date | null, setter: (date: Date) => void) => {
        if (date) {
            setter(date);
        }
    };

    return (
        <div className="space-y-4">
            <div className="w-full h-[300px] bg-white rounded-lg shadow p-2 relative">
                <div className="absolute top-3 left-24 z-10 flex items-center space-x-2">
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
                <div className="absolute top-5 right-4 z-10 flex items-center space-x-4 hidden">
                    <div className="text-sm">
                        <span className="text-gray-500">Total période:</span>
                        <span className="ml-2 font-semibold">{totals.tonnage.toFixed(2)} T</span>
                        <span className="ml-2 text-gray-500">|</span>
                        <span className="ml-2">{totals.carbon.toFixed(2)} T CO₂</span>
                    </div>
                    <div className="text-sm">
                        <span className="text-gray-500">Mois en cours:</span>
                        <span className="ml-2 font-semibold">{totals.currentMonthTonnage.toFixed(2)} T</span>
                        <span className="ml-2 text-gray-500">|</span>
                        <span className="ml-2">{totals.currentMonthCarbon.toFixed(2)} T CO₂</span>
                    </div>
                </div>
                {monthlyData.labels.length > 0 ? (
                    <Bar data={monthlyData} options={monthlyOptions} plugins={[ChartDataLabels]} />
                ) : (
                    <div className="flex justify-center items-center h-full">
                        <p>Aucune donnée mensuelle disponible</p>
                    </div>
                )}
            </div>
            <div className="w-full h-[250px] bg-white rounded-lg shadow p-2 relative">
                {treatmentData.labels.length > 0 ? (
                    <Bar data={treatmentData} options={treatmentOptions} plugins={[ChartDataLabels]} />
                ) : (
                    <div className="flex justify-center items-center h-full">
                        <p>Aucune donnée de traitement disponible</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EnvBarChart;
