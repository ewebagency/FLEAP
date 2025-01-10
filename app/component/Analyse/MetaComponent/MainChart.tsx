'use client';

import React from 'react';
import { DynamicCharts } from './ChartWrapper';

const { Line } = DynamicCharts;

const AnalOpMainChart = () => {
  // Les données du graphique
  const data = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
    datasets: [
      {
        label: 'Dataset 1',
        data: [30, 50, 60, 40, 70, 80, 90],
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderColor: 'rgba(75, 192, 192, 1)',
        fill: true, // Remplissage sous la courbe
      },
      {
        label: 'Dataset 2',
        data: [20, 30, 50, 20, 40, 60, 80],
        backgroundColor: 'rgba(255, 159, 64, 0.5)',
        borderColor: 'rgba(255, 159, 64, 1)',
        fill: true, // Remplissage sous la courbe
      },
      {
        label: 'Dataset 3',
        data: [10, 20, 30, 10, 30, 40, 50],
        backgroundColor: 'rgba(153, 102, 255, 0.5)',
        borderColor: 'rgba(153, 102, 255, 1)',
        fill: true, // Remplissage sous la courbe
      },
    ],
  };

  // Options du graphique
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const, // Changed to a valid string literal
      },
    },
    scales: {
      x: {
        stacked: true, // Empilement sur l'axe X
      },
      y: {
        stacked: true, // Empilement sur l'axe Y (les courbes s'additionnent)
      },
    },
  };

  return <Line data={data} options={options} height={60}/>;
};

export default AnalOpMainChart;
