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
            if (filieres_ou_prestataires.nom === 'prestataire') {
                const siret = bsd.infos_json.formAPI.createFormInput.recipient.company.siret;
                key = siretToName[siret] || siret;
                if (key === '') return; // Ignorer seulement les entrées vides
            } else {
                key = getFiliere(
                    bsd.infos_json.formAPI.createFormInput.wasteDetails.code,
                    mappingTable
                ) || 'Autres'; // Garder la catégorie "Autres" pour les filières
            }

            const quantity = bsd.infos_json.formAPI.createFormInput.quantityReceived ? bsd.infos_json.formAPI.createFormInput.quantityReceived : bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity || 0;
            if (!quantities[key]) quantities[key] = 0;
            quantities[key] += quantity;
        });

        // Trier les données avec "Autres" à la fin pour les filières
        const sortedEntries = Object.entries(quantities).sort((a, b) => {
            if (filieres_ou_prestataires.nom === 'filiere') {
                if (a[0] === 'Autres') return 1;
                if (b[0] === 'Autres') return -1;
            }
            return b[1] - a[1];
        });

        // Palette de couleurs pour les prestataires
        const prestatairesColors = [
            'rgba(142, 202, 230, 1)',    // Bleu clair
            'rgba(255, 183, 178, 1)',    // Rose pâle
            'rgba(181, 234, 215, 1)',    // Vert menthe
            'rgba(199, 206, 234, 1)',    // Lavande
            'rgba(255, 218, 193, 1)',    // Pêche
            'rgba(168, 218, 220, 1)',    // Turquoise
            'rgba(241, 192, 232, 1)',    // Rose lilas
            'rgba(204, 213, 174, 1)',    // Vert sauge
            'rgba(254, 200, 216, 1)',    // Rose poudré
            'rgba(173, 216, 230, 1)',    // Bleu poudré
        ];

        return {
            labels: sortedEntries.map(([key]) => key),
            datasets: [{
                data: sortedEntries.map(([_, value]) => value),
                backgroundColor: sortedEntries.map(([key], index) => {
                    if (filieres_ou_prestataires.nom === 'filiere') {
                        const filiere = filieres.find(f => f.name === key);
                        return tailwindToRgba(filiere?.color || 'gray-500');
                    } else {
                        return prestatairesColors[index % prestatairesColors.length];
                    }
                }),
                borderColor: 'white',
                borderWidth: 1,
            }]
        };
    }, [bsds, mappingTable, filieres_ou_prestataires, siretToName, filieres]);

    return (
        <div className="flex-1 p-4 bg-white rounded-lg shadow">
            <div className="text-gray-500 text-xs mb-2">
                Répartition par {filieres_ou_prestataires.nom === 'prestataire' ? 'prestataire' : 'filière'}
            </div>
            <div className="h-[250px]"> {/* Hauteur augmentée à 250px */}
                <Pie data={pieData} options={options} />
            </div>
        </div>
    );
}

export default AnalOpPieChart;
