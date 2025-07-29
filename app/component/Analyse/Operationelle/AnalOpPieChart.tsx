'use client'
import React, { useEffect, useMemo } from "react";
import { DynamicCharts } from '../MetaComponent/ChartWrapper';
import { useAnalysis } from "@/app/analysis/AnalysisProvider";
import { getColors } from "../MetaComponent/Colours";
import { tailwindToRgba } from '@/app/component/Analyse/MetaComponent/Colours';
import { getFiliere } from "@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new";
import { useFilterContext } from '@/app/FilterContext';
import { FormInput } from '@/app/register/interface/BSD_Interface';
import { BSD } from '@/app/analysis/AnalysisProvider';
import { LegendItem, ChartData } from 'chart.js';
import { Doughnut } from "react-chartjs-2";

const { Pie } = DynamicCharts;

const AnalOpPieChart = () => {
    const { bsds, loading, mappingTable, filieres_ou_prestataires, siretToName } = useAnalysis();
    const { filieres } = useFilterContext();

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            tooltip: {
                callbacks: {
                    label: function(context: { 
                        dataset: { data: number[] };
                        dataIndex: number;
                        label: string;
                    }) {
                        const dataset = context.dataset;
                        const total = dataset.data.reduce((acc: number, data: number) => {
                            return acc + (typeof data === 'string' ? parseFloat(data) : data);
                        }, 0);
                        const value = parseFloat(String(dataset.data[context.dataIndex]));
                        
                        //console.log("Debug - value:", value, "total:", total, "type of value:", typeof value);
                        const percentage = ((value / total) * 100).toFixed(1);
                        return ` ${percentage}% (${value.toLocaleString('fr-FR')} T)`;
                    }
                },
                position: 'nearest' as const,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                titleFont: {
                    size: 14
                },
                bodyFont: {
                    size: 13
                }
            },
            legend: {
                position: 'bottom' as const,
                labels: {
                    font: {
                        size: 11
                    },
                    filter: (item: LegendItem, data: ChartData) => {
                        const dataset = data.datasets[0];
                        const total = (dataset.data as number[]).reduce((a, b) => a + b, 0);
                        const value = dataset.data[item.index || 0] as number;
                        return ((value / total) * 100) >= 5;
                    },
                    sort: (a: { text: string }, b: { text: string }) => {
                        if (a.text === 'Autres') return 1;
                        if (b.text === 'Autres') return -1;
                        return 0;
                    }
                }
            }
        }
    };


    const pieData = useMemo(() => {
        const quantities: { [key: string]: number } = {};

        bsds.forEach((bsd: BSD) => {
            let key;
            if (filieres_ou_prestataires.nom === 'filiere_nom') {
                // En mode filiere_nom, utiliser le nom du déchet pour déterminer la filière
                const wasteName = bsd.infos_json.formAPI.createFormInput.wasteDetails.name;
                if (wasteName) {
                    // Chercher dans le mapping_nom_filiere avec la même logique que le graphique principal
                    const mappingEntry = mappingTable.find(m => 'nom' in m && m.nom && typeof m.nom === 'string' && m.nom.trim() === wasteName.trim());
                    key = mappingEntry ? mappingEntry.filiere : 'Autres';
                } else {
                    key = 'Non renseigné';
                }
            } else {
                // Filtrer le mappingTable pour ne garder que les objets avec ced
                const cedMappingTable = mappingTable.filter(m => 'ced' in m && m.ced) as Array<{ced: string, filiere: string}>;
                key = getFiliere(
                    bsd.infos_json.formAPI.createFormInput.wasteDetails.code,
                    cedMappingTable
                ) || 'Autres'; // Garder la catégorie "Autres" pour les filières
            }

            const quantity = bsd.infos_json.formAPI.createFormInput.quantityReceived ? bsd.infos_json.formAPI.createFormInput.quantityReceived : bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity || 0;
            if (!quantities[key]) quantities[key] = 0;
            quantities[key] += quantity;
        });

        // Trier les données avec "Autres" et "Non renseigné" à la fin
        const sortedEntries = Object.entries(quantities).sort((a, b) => {
            if (a[0] === 'Non renseigné') return 1;
            if (b[0] === 'Non renseigné') return 1;
            if (filieres_ou_prestataires.nom === 'filiere') {
                if (a[0] === 'Autres') return 1;
                if (b[0] === 'Autres') return -1;
            }
            return b[1] - a[1];
        });

        return {
            labels: sortedEntries.map(([key]) => key),
            datasets: [{
                data: sortedEntries.map(([_, value]) => value),
                backgroundColor: sortedEntries.map(([key], index) => {
                    // Pour les modes filiere et filiere_nom, utiliser les couleurs du contexte
                    const filiereColor = filieres.find(f => f.name === key)?.color;
                    if (filiereColor) {
                        return tailwindToRgba(filiereColor);
                    } else {
                        // Fallback avec getColors si la filière n'est pas trouvée
                        const fallbackColors = getColors(sortedEntries.length);
                        return tailwindToRgba(fallbackColors[index % fallbackColors.length]);
                    }
                }),
                borderColor: 'white',
                borderWidth: 1,
            }]
        };
    }, [bsds, mappingTable, filieres_ou_prestataires, siretToName, filieres]);

    return (
        <div className="flex-1 p-4 bg-white rounded-lg">
            <div className="text-gray-500 text-xs mb-2">
                Répartition par filière
            </div>
            <div className="h-[200px]"> {/* Hauteur augmentée à 250px */}
                <Doughnut data={pieData} options={options} />
            </div>
        </div>
    );
}

export default AnalOpPieChart;
