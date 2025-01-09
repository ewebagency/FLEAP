'use client'
import React, { useEffect, useMemo } from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { useAnalysis } from "@/app/analysis/AnalysisProvider";
import { getColors } from "../MetaComponent/Colours";
import { tailwindToRgba } from '@/app/component/Analyse/MetaComponent/Colours';
import { getFiliere } from "@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new";
import { useFilterContext } from '@/app/FilterContext';
import { FormInput } from '@/app/register/interface/BSD_Interface';
import { BSD } from '@/app/analysis/AnalysisProvider';

ChartJS.register(ArcElement, Tooltip, Legend);

const AnalOpPieChart = () => {
    const { bsds, loading, mappingTable, filieres_ou_prestataires, siretToName } = useAnalysis();
    const { filieres } = useFilterContext();

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: {
                    font: {
                        size: 11
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

    useEffect(() => {
        console.log("BSDs from PieChart:", bsds);
    }, [bsds]);

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

            const quantity = bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity || 0;
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
            <div className="h-[180px]"> {/* Hauteur réduite */}
                <Pie data={pieData} options={options} />
            </div>
        </div>
    );
}

export default AnalOpPieChart;
