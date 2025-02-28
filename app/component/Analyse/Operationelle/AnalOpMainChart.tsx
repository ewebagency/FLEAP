import React, { useEffect, useMemo, useState } from 'react';
import { DynamicCharts } from '../MetaComponent/ChartWrapper';
import { useAnalysis } from '@/app/analysis/AnalysisProvider';
import { getFiliere } from '@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new';
import { tailwindToRgb } from '../MetaComponent/Colours';
import { getColors } from "../MetaComponent/Colours";
import { useFilterContext, SegmentDates } from '@/app/FilterContext';
import { TooltipItem, ChartOptions, ChartDataset, ScaleOptionsByType, Scale, ScaleType } from 'chart.js';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Context } from 'chartjs-plugin-datalabels';

const { Bar } = DynamicCharts;

interface Dataset {
  label: string;
  data: number[];
  borderColor: string;
  backgroundColor: string;
  borderWidth: number;
}

interface ChartData {
  labels: string[];
  datasets: Dataset[];
}

interface DatasetWithLabel extends ChartDataset<'bar'> {
  label: string;
}

const AnalOpMainChart = () => {
  const { bsds, loading, mappingTable, filieres_ou_prestataires, siretToName } = useAnalysis();
  const { filieres, segmentDates, setSegmentDates } = useFilterContext();

  const handleDateChange = (date: Date | null, type: 'debut' | 'fin') => {
    if (date) {
        setSegmentDates({
            ...segmentDates,
            [type]: date
        });
    }
  };

  const filteredChartData = useMemo(() => {
    const monthLabels: string[] = [];
    const currentDate = new Date(segmentDates.debut || new Date());
    const endDate = segmentDates.fin || new Date();
    
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
      // Convertir la date PostgreSQL en objet Date
      const date = new Date(bsd.created_at);
      // Réinitialiser currentDate car il a été modifié dans la boucle while
      const startDate = new Date(segmentDates.debut || new Date());
      
      // Vérifier si la date est dans la plage
      if (date < startDate || date > endDate) return;

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
        (date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
      );
      if (monthIndex >= 0 && monthIndex < monthLabels.length) {
        const quantity = bsd.infos_json.formAPI.createFormInput.quantityReceived ? bsd.infos_json.formAPI.createFormInput.quantityReceived : bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity || 0;
        
        //if(typeof quantity !== 'number')console.log("quantité", quantity, bsd.id);
          
        
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
            borderWidth: 1
        };
    });

    return {
        labels: monthLabels,
        datasets
    };
  }, [bsds, mappingTable, filieres_ou_prestataires, siretToName, filieres, segmentDates]);

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
        position: 'bottom',
      },
      title: {
        display: true,
        text: 'Évolution des tonnages mensuels',
        color: 'gray',
        align: 'center',
        padding: {
          top: 10,
          bottom: 10
        },
        font: {
          size: 14,
          weight: 'normal'
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        position: 'nearest',
        callbacks: {
          label(tooltipItem: TooltipItem<'bar'>) {
            const value = Number(tooltipItem.raw);
            return ` ${tooltipItem.dataset.label} : ${value.toFixed(2)} T`;
          },
          footer(tooltipItems: TooltipItem<'bar'>[]) {
            const total = tooltipItems.reduce((sum, item) => sum + (Number(item.raw) || 0), 0);
            return `Total : ${total.toFixed(2)} T`;
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
          
          // Cacher les totaux s'il y a plus de 10 barres
          if (context.chart.data.labels?.length && context.chart.data.labels.length > 14) {
            return false;
          }
          
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
          return `${total.toFixed(2)} T`;
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
          color: 'rgba(0, 0, 0, 0)',
        }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        title: {
          display: true,
          text: 'Tonnes'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          callback: function(value) {
            return value;
          },
          padding: 5
        }
      }
    },
    elements: {
      bar: {
        borderRadius: 4
      }
    }
  };

  return (
    <div className="mt-4">
      <div className="bg-white rounded-lg relative">
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
          {bsds.length > 0 ? (
            <Bar 
              data={filteredChartData} 
              options={options} 
              plugins={[ChartDataLabels]} 
              height={300} 
            />
          ) : (
            <div className="text-center text-gray-500">Aucune donnée disponible</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalOpMainChart;
