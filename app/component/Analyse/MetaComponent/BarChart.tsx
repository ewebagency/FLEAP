import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Enregistrement des composants nécessaires
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const BarChart = () => {
  const data = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'], // Les mois
    datasets: [
      {
        label: 'Revenus',
        data: [5000, 7000, 3000, 8000, 6000],
        backgroundColor: 'rgba(75, 192, 192, 0.6)', // Couleur des barres pour les revenus
        barThickness: 20, // Épaisseur des barres
      },
      {
        label: 'Coûts',
        data: [4000, 5000, 2000, 7000, 3000],
        backgroundColor: 'rgba(255, 99, 132, 0.6)', // Couleur des barres pour les coûts
        barThickness: 20, // Épaisseur des barres
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const, // Specify as a constant
      },
      title: {
        display: true,
        text: 'Revenus et Coûts par Mois', // Title of the chart
      },
    },
    scales: {
      x: {
        stacked: false, // Display bars side by side
      },
      y: {
        stacked: false, // Display bars side by side
        beginAtZero: true,
        ticks: {
          max: 10000, // Adjusts the maximum of the Y axis
        },
      },
    },
  };
  

  return <Bar data={data} height={60}/> //options={options} />;
};

export default BarChart;
