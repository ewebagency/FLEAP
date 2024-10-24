import React from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { useAnalysisContext } from '@/app/analysis/AnalysisContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);


const AnalOpMainChart = () => {

  const {valueChain, selectedMaterials, serverData} = useAnalysisContext()
  console.log(valueChain);


  //if (loading) return <div>Chargement...</div>;
  //if (error) return <div>Erreur: {error}</div>;

  // Options du graphique
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      x: {
        stacked: true,
      },
      y: {
        stacked: true,
      },
    },
  };


  const filteredChartData = {
    labels: serverData.labels,
    datasets: serverData.datasets.filter((dataset: { id: number }) => 
      selectedMaterials.some((material: { id: number; checked: boolean }) => (material.id === dataset.id) && material.checked)
    ),
  };

  return <Line data={filteredChartData} options={options} height={60} />;
};

export default AnalOpMainChart;
