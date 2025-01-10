import React, { useEffect, useMemo } from 'react';
import { DynamicCharts } from '../MetaComponent/ChartWrapper';
import { useAnalysis } from '@/app/analysis/AnalysisProvider';
import { getFiliere } from '@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new';
import { tailwindToRgb } from '../MetaComponent/Colours';
import { getColors } from "../MetaComponent/Colours";
import { useFilterContext } from '@/app/FilterContext';

const { Line } = DynamicCharts;

const AnalOpMainChart = () => {
  const { bsds, loading, mappingTable, filieres_ou_prestataires, siretToName } = useAnalysis();
  const { filieres } = useFilterContext();

  const filteredChartData = useMemo(() => {
    const monthLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const quantitiesBySegment: { [key: string]: number[] } = {};
    const colors = getColors(20);

    // Initialiser les données par segment (filière ou prestataire)
    bsds.forEach(bsd => {
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
        quantitiesBySegment[segmentKey] = Array(12).fill(0);
      }

      const month = new Date(bsd.created_at).getMonth();
      const quantity = bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity || 0;
      quantitiesBySegment[segmentKey][month] += quantity;
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

    // Ajouter des console.log pour déboguer
    console.log("Filières disponibles:", filieres);
    console.log("Segments triés:", sortedSegments);

    // Créer les datasets
    const datasets = sortedSegments.map(([segment, data], index) => {
        const color = filieres_ou_prestataires.nom === 'filiere'
            ? tailwindToRgb(filieres.find(f => f.name === segment)?.color || '#000000')
            : prestatairesColors[index % prestatairesColors.length];

        return {
            label: segment,
            data: data,
            borderColor: color,
            backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.6)'),
            fill: true,
            borderWidth: 1,
            pointRadius: 0,
        };
    });

    console.log("Datasets finaux:", datasets);

    return {
        labels: monthLabels,
        datasets
    };
  }, [bsds, mappingTable, filieres_ou_prestataires, siretToName, filieres]);

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Évolution des tonnages mensuels'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        stacked: true,
        title: {
          display: true,
          text: 'Tonnes'
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
    }
  };

  useEffect(() => {
    console.log("Filtered Chart Data:", filteredChartData);
  }, [filteredChartData]);

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
