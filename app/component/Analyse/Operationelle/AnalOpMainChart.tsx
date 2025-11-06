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
import LoadingState from '@/app/component/LoadingState';

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
  const [viewType, setViewType] = useState<'chart' | 'table'>('chart');
  const [aggregation, setAggregation] = useState<'month' | 'year'>('month');

  // Vérifier si les filtres et métadonnées sont initialisés (pas les BSDs)
  const areFiltersReady = useMemo(() => {
    // Ne vérifier que les dépendances CRITIQUES pour le rendu du graphique
    // Les filières peuvent être vides (c'est un filtre actif par l'utilisateur)
    return Boolean(
      mappingTable.length > 0 && 
      filieres_ou_prestataires?.nom && 
      segmentDates?.debut && 
      segmentDates?.fin
    );
  }, [mappingTable, filieres_ou_prestataires, segmentDates]);

  const handleDateChange = (date: Date | null, type: 'debut' | 'fin') => {
    if (date) {
        setSegmentDates({
            ...segmentDates,
            [type]: date
        });
    }
  };

  const filteredChartData = useMemo(() => {
    if (!areFiltersReady) {
      return {
        labels: [],
        datasets: []
      };
    }

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
      try {
      // Utiliser takenOverAt si disponible, sinon created_at
      const date = new Date(bsd.infos_json?.formAPI?.createFormInput?.takenOverAt || bsd.created_at);
      // Réinitialiser currentDate car il a été modifié dans la boucle while
      const startDate = new Date(segmentDates.debut || new Date());
      
      // Vérifier si la date est dans la plage
      if (date < startDate || date > endDate) return;

      let segmentKey;
      if (filieres_ou_prestataires.nom === 'filiere_nom') {
        // Mode filiere_nom : utiliser le mapping_nom_filiere pour déterminer la filière
        const wasteName = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.name;
        if (wasteName) {
          // Chercher dans le mapping_nom_filiere
          const mappingEntry = mappingTable.find(m => 'nom' in m && m.nom && typeof m.nom === 'string' && m.nom.trim() === wasteName.trim());
          segmentKey = mappingEntry?.filiere || 'Autres';
        } else {
          segmentKey = 'Non renseigné';
        }
      } else {
        // Mode filiere : utiliser le code CED
        // Filtrer le mappingTable pour ne garder que les objets avec ced
        const cedMappingTable = mappingTable.filter(m => 'ced' in m && m.ced) as Array<{ced: string, filiere: string}>;
        segmentKey = getFiliere(
            bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code,
          cedMappingTable
        ) || 'Autres';
      }

      if (!quantitiesBySegment[segmentKey]) {
        quantitiesBySegment[segmentKey] = Array(monthLabels.length).fill(0);
      }

      // Calculer l'index du mois en utilisant l'année et le mois uniquement
      const monthDiff = (date.getFullYear() - startDate.getFullYear()) * 12 + 
                       (date.getMonth() - startDate.getMonth());
      
      if (monthDiff >= 0 && monthDiff < monthLabels.length) {
          const quantity = bsd.infos_json?.formAPI?.createFormInput?.quantityReceived || 
                          bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity || 0;
        
          quantitiesBySegment[segmentKey][monthDiff] += Number(quantity) || 0;
        }
      } catch (error) {
        console.warn('Erreur lors du traitement d\'un BSD:', error);
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

    // Créer les datasets
    const datasets = sortedSegments.map(([segment, data], index) => {
        // Pour les modes filiere et filiere_nom, utiliser les couleurs du contexte
        const filiereColor = filieres.find(f => f.name === segment)?.color;
        let color;
        if (filiereColor) {
            color = tailwindToRgb(filiereColor);
        } else {
            // Fallback avec getColors si la filière n'est pas trouvée
            const fallbackColors = getColors(sortedSegments.length);
            color = tailwindToRgb(fallbackColors[index % fallbackColors.length]);
        }

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

  const aggregatedData = useMemo(() => {
    if (!filteredChartData.labels.length) return filteredChartData;

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
        <div className="absolute top-1 left-14 z-10">
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

        <div className="absolute top-2 right-6 z-10 flex items-center space-x-2 hidden">
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
          <LoadingState
            isLoading={loading === true || !areFiltersReady}
            isEmpty={loading === false && areFiltersReady && bsds.length === 0}
            loadingMessage="Chargement des données d'analyse..."
            emptyMessage="Aucune donnée disponible pour cette période"
            height="300px"
          >
            {viewType === 'chart' ? (
              <Bar 
                data={filteredChartData} 
                options={options} 
                plugins={[ChartDataLabels]} 
                height={300} 
              />
            ) : (
              <div className="overflow-x-auto mt-8">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                        {filieres_ou_prestataires.nom === 'filiere' ? 'Filière' : 'Prestataire'}
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
                            {value.toFixed(2)} T
                          </td>
                        ))}
                        <td className="px-6 py-1 whitespace-nowrap font-medium text-gray-900">
                          {dataset.data.reduce((sum, val) => sum + val, 0).toFixed(2)} T
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
                            {total.toFixed(2)} T
                          </td>
                        );
                      })}
                      <td className="px-6 py-1 whitespace-nowrap text-gray-900">
                        {aggregatedData.datasets.reduce(
                          (sum, dataset) => sum + dataset.data.reduce((s, v) => s + v, 0), 0
                        ).toFixed(2)} T
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </LoadingState>
        </div>
      </div>
    </div>
  );
};

export default AnalOpMainChart;
