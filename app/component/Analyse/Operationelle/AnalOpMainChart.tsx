import React, { useEffect, useMemo } from 'react';
import { DynamicCharts } from '../MetaComponent/ChartWrapper';
import { useAnalysis } from '@/app/analysis/AnalysisProvider';
import { getFiliere } from '@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new';
import { tailwindToRgb } from '../MetaComponent/Colours';
import { getColors } from "../MetaComponent/Colours";
import { useFilterContext } from '@/app/FilterContext';
import { TooltipItem } from 'chart.js';

const { Line } = DynamicCharts;

// Ajout des interfaces pour les types
interface Dataset {
  label: string;
  data: number[];
  borderColor: string;
  backgroundColor: string;
  fill: boolean;
  borderWidth: number;
  pointRadius: number;
  tension: number;
  cubicInterpolationMode: 'default' | 'monotone';
}

interface ChartData {
  labels: string[];
  datasets: Dataset[];
}

const AnalOpMainChart = () => {
  const { bsds, loading, mappingTable, filieres_ou_prestataires, siretToName } = useAnalysis();
  const { filieres } = useFilterContext();

  const filteredChartData = useMemo(() => {
    // Calculer la plage de dates (12 mois avant la date actuelle)
    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Dernier jour du mois actuel
    const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1); // Premier jour d'il y a 12 mois

    // Générer les labels des mois pour la période
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

    const quantitiesBySegment: { [key: string]: number[] } = {};

    // Initialiser les données par segment (filière ou prestataire)
    bsds.forEach(bsd => {
      let bsdDate; //-------------------A voir comment on fait pour les dates
      if (bsd.infos_json.formAPI.createFormInput.takenOverAt) {
        const takenOverDate = new Date(bsd.infos_json.formAPI.createFormInput.takenOverAt);
        // Vérifier si la date est valide et entre 2020 et 2030
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
      // Ignorer les BSDs hors de la plage de dates
      if (bsdDate < startDate || bsdDate > endDate) return;

      let segmentKey;
      if (filieres_ou_prestataires.nom === 'prestataire') {
        const siret = bsd.infos_json.formAPI.createFormInput.recipient.company.siret;
        segmentKey = siretToName[siret] || siret;
        if (!segmentKey || segmentKey === '') {
          segmentKey = 'Non renseigné';
        }
      } else {
        segmentKey = getFiliere(
          bsd.infos_json.formAPI.createFormInput.wasteDetails.code,
          mappingTable
        ) || 'Autres';
      }

      if (!quantitiesBySegment[segmentKey]) {
        quantitiesBySegment[segmentKey] = Array(monthLabels.length).fill(0);
      }

      // Calculer l'index du mois relatif à la période
      const monthIndex = Math.floor(
        (bsdDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
      );
      if (monthIndex >= 0 && monthIndex < monthLabels.length) {
        const quantity = bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity || 0;
        quantitiesBySegment[segmentKey][monthIndex] += quantity;
      }
    });

    // Trier les segments
    const sortedSegments = Object.entries(quantitiesBySegment).sort((a, b) => {
      if (a[0] === 'Non renseigné') return 1;
      if (b[0] === 'Non renseigné') return 1;
      if (filieres_ou_prestataires.nom === 'filiere') {
        if (a[0] === 'Autres') return 1;
        if (b[0] === 'Autres') return -1;
      }
      const totalA = a[1].reduce((sum, val) => sum + val, 0);
      const totalB = b[1].reduce((sum, val) => sum + val, 0);
      return totalB - totalA;
    });

    // Palette de couleurs pour les prestataires
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

    const getColor = (segment: string, index: number) => {
        if (filieres_ou_prestataires.nom === 'filiere') {
            const filiereIndex = filieres.findIndex(f => f.name === segment);
            return tailwindToRgb(filieres[filiereIndex].color);
        } else {
            return prestatairesColors[index % prestatairesColors.length];
        }
    };


    // Créer les datasets
    const datasets = sortedSegments.map(([segment, data], index) => {
        const color = filieres_ou_prestataires.nom === 'filiere'
            ? tailwindToRgb(filieres.find(f => f.name === segment)?.color || '#000000')
            : prestatairesColors[index % prestatairesColors.length];

        return {
            label: segment,
            data: data,
            borderColor: color,
            backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 1)'),
            fill: true,
            borderWidth: 1,
            pointRadius: 0,
            tension: 0.2,
            cubicInterpolationMode: 'monotone' as 'default' | 'monotone'
        };
    });


    return {
        labels: monthLabels,
        datasets
    };
  }, [bsds, mappingTable, filieres_ou_prestataires, siretToName, filieres]);

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      title: {
        display: true,
        text: 'Évolution des tonnages mensuels'
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
          text: 'Tonnes'
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


  return (
    <div className="mt-4 p-2 bg-white rounded-lg shadow">
      {bsds.length > 0 ? (
        <Line data={filteredChartData} options={options} height={60} />
      ) : (
        <div className="text-center text-gray-500">Aucune donnée disponible</div>
      )}
    </div>
  );
};

export default AnalOpMainChart;
