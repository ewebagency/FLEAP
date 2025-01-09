import React, { useEffect, useState } from 'react';
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
import { useAnalysis } from '../../../analysis/AnalysisProvider';
import { useFilterContext } from '../../../FilterContext';
import { estimerCarbone } from './environnement_utils';
import { getFiliere } from '../../../register/RegisterComponents/Modal/FormulaireFull/utils_new';
import { tailwindToRgb, tailwindToRgba } from '../MetaComponent/Colours';
import { FormInput } from '../../../register/interface/BSD_Interface';

// Importer Bar dynamiquement avec une condition de chargement côté client uniquement
const Bar = dynamic(
  () => import('react-chartjs-2').then(mod => mod.Bar),
  { ssr: false } // Désactive le rendu côté serveur pour ce composant
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

interface ChartData {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        backgroundColor: string;
        borderColor: string;
        borderWidth: number;
    }[];
}

const EnvBarChart = () => {
    const { bsds, mappingTable, filieres_ou_prestataires, siretToName } = useAnalysis();
    const { filieres } = useFilterContext();
    const [monthlyData, setMonthlyData] = useState<ChartData>({
        labels: [],
        datasets: []
    });
    const [treatmentData, setTreatmentData] = useState<ChartData>({
        labels: [],
        datasets: []
    });

    // Palette de couleurs pour les prestataires
    const prestatairesColors = {
        rgb: [
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
        ],
        rgba: [
            'rgba(142, 202, 230, 0.8)',
            'rgba(255, 183, 178, 0.8)',
            'rgba(181, 234, 215, 0.8)',
            'rgba(199, 206, 234, 0.8)',
            'rgba(255, 218, 193, 0.8)',
            'rgba(168, 218, 220, 0.8)',
            'rgba(241, 192, 232, 0.8)',
            'rgba(204, 213, 174, 0.8)',
            'rgba(254, 200, 216, 0.8)',
            'rgba(173, 216, 230, 0.8)',
        ]
    };

    const getColor = (segment: string, index: number, needsOpacity: boolean = false) => {
        if (filieres_ou_prestataires.nom === 'filiere') {
            const filiere = filieres.find(f => f.name === segment);
            return needsOpacity ? 
                tailwindToRgba(filiere?.color || 'bg-gray-400') :
                tailwindToRgb(filiere?.color || 'bg-gray-400');
        } else {
            const colorArray = needsOpacity ? prestatairesColors.rgba : prestatairesColors.rgb;
            return colorArray[index % colorArray.length];
        }
    };

    useEffect(() => {
        if (!bsds || bsds.length === 0) return;

        // Initialiser les structures de données
        const monthlyEmissions = new Map<string, number[]>();
        const treatmentEmissions = new Map<string, Map<string, number>>();
        const monthLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
        
        bsds.forEach((bsd: {created_at:string, infos_json:{formAPI:{createFormInput:FormInput}}}) => {
            const quantity = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity || 0;
            const cedCode = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code;
            const processingOperation = bsd.infos_json?.formAPI?.createFormInput?.recipient?.processingOperation || 'default';
            const date = new Date(bsd.created_at);
            const month = date.getMonth();
            
            // Déterminer la clé (filière ou prestataire)
            let key;
            if (filieres_ou_prestataires.nom === 'filiere') {
                key = getFiliere(cedCode, mappingTable);
            } else {
                const siret = bsd.infos_json?.formAPI?.createFormInput?.recipient?.company?.siret;
                key = siretToName[siret] || siret || 'Non renseigné';
            }

            try {
                const carbonEmission = parseFloat(estimerCarbone(cedCode, processingOperation, quantity));
                
                if (!monthlyEmissions.has(key)) {
                    monthlyEmissions.set(key, Array(12).fill(0));
                }
                const monthlyValues = monthlyEmissions.get(key)!;
                monthlyValues[month] += carbonEmission;

                if (!treatmentEmissions.has(processingOperation)) {
                    treatmentEmissions.set(processingOperation, new Map<string, number>());
                }
                const treatmentMap = treatmentEmissions.get(processingOperation)!;
                treatmentMap.set(key, (treatmentMap.get(key) || 0) + carbonEmission);
            } catch (error) {
                // Ignorer les erreurs de calcul
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
        const monthlyDatasets = sortedSegments.map(([key, values], index) => ({
            label: key,
            data: values,
            backgroundColor: getColor(key, index, true),
            borderColor: getColor(key, index),
            borderWidth: 1
        }));

        setMonthlyData({
            labels: monthLabels,
            datasets: monthlyDatasets
        });

        // Préparer les données par traitement
        const treatmentLabels = {
            'D1': 'Mise en décharge',
            'D10': 'Incinération sans valorisation',
            'R1': 'Incinération avec valorisation',
            'R5': 'Recyclage',
            'default': 'Autre traitement'
        };

        const sortedTreatments = Array.from(treatmentEmissions.entries())
            .sort((a, b) => {
                const totalA = Array.from(a[1].values()).reduce((sum, val) => sum + val, 0);
                const totalB = Array.from(b[1].values()).reduce((sum, val) => sum + val, 0);
                return totalB - totalA;
            });

        // Créer un dataset pour chaque segment (filière/prestataire)
        const treatmentDatasets = sortedSegments.map(([key], index) => ({
            label: key,
            data: sortedTreatments.map(([_, treatmentMap]) => treatmentMap.get(key) || 0),
            backgroundColor: getColor(key, index, true),
            borderColor: getColor(key, index),
            borderWidth: 1
        }));

        setTreatmentData({
            labels: sortedTreatments.map(([code]) => treatmentLabels[code as keyof typeof treatmentLabels] || code),
            datasets: treatmentDatasets
        });

    }, [bsds, mappingTable, filieres_ou_prestataires, filieres, siretToName]);

    const monthlyOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top' as const,
            },
            title: {
                display: true,
                text: `Émissions CO₂ mensuelles par ${filieres_ou_prestataires.nom === 'filiere' ? 'filière' : 'prestataire'}`
            },
        },
        scales: {
            x: {
                stacked: true,
            },
            y: {
                stacked: true,
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'kg CO₂'
                }
            }
        }
    };

    const treatmentOptions = {
        indexAxis: 'y' as const,
        responsive: true,
        plugins: {
            legend: {
                position: 'top' as const,
            },
            title: {
                display: true,
                text: 'Émissions CO₂ par méthode de traitement'
            },
        },
        scales: {
            x: {
                stacked: true,
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'kg CO₂'
                }
            },
            y: {
                stacked: true
            }
        }
    };

    return (
        <div className="space-y-8">
            <div className="w-full h-[400px] p-4">
                {monthlyData.labels.length > 0 ? (
                    <Bar data={monthlyData} options={monthlyOptions} />
                ) : (
                    <div className="flex justify-center items-center h-full">
                        <p>Aucune donnée mensuelle disponible</p>
                    </div>
                )}
            </div>
            <div className="w-full h-[300px] p-4">
                {treatmentData.labels.length > 0 ? (
                    <Bar data={treatmentData} options={treatmentOptions} />
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
