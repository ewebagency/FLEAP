import React, { useEffect, useMemo, useState } from 'react';
import { DynamicCharts } from '../MetaComponent/ChartWrapper';
import { useAnalysis } from '@/app/analysis/AnalysisProvider';
import { getFiliere } from '@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new';
import { tailwindToRgb } from '../MetaComponent/Colours';
import { getColors } from "../MetaComponent/Colours";
import { useFilterContext } from '@/app/FilterContext';
import { TooltipItem } from 'chart.js';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

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

  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 11);
    return date;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());

  const filteredChartData = useMemo(() => {
    // Utiliser directement les dates du state sans créer de nouvelles instances
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
  }, [bsds, mappingTable, filieres_ou_prestataires, siretToName, filieres, startDate, endDate]);

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
          },
          label: function(tooltipItem: TooltipItem<"line">) {
            const value = tooltipItem.raw as number;
            return `${value.toLocaleString('fr-FR')} T`;
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
          {bsds.length > 0 ? (
            <Line data={filteredChartData} options={options} height={60} />
          ) : (
            <div className="text-center text-gray-500">Aucune donnée disponible</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalOpMainChart;
