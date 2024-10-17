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
        position: 'top', // Position de la légende
      },
      title: {
        display: true,
        text: 'Revenus et Coûts par Mois', // Titre du graphique
      },
    },
    scales: {
      x: {
        stacked: false, // Permet d'afficher les barres côte à côte
      },
      y: {
        stacked: false, // Permet d'afficher les barres côte à côte
        beginAtZero: true,
        ticks: {
          max: 10000, // Ajuste le maximum de l'axe Y pour rendre les barres plus petites
        },
      },
    },
  };

  return <Bar data={data} options={options} height={60}/>;
};

export default BarChart;
