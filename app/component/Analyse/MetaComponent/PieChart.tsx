'use client'
import React from "react";
import dynamic from 'next/dynamic';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

// Importer Doughnut dynamiquement
const Doughnut = dynamic(
  () => import('react-chartjs-2').then(mod => mod.Doughnut),
  { ssr: false }
);

// Enregistrer Chart.js uniquement côté client
if (typeof window !== 'undefined') {
  ChartJS.register(ArcElement, Tooltip, Legend);
}

export interface DechetCost {
    name: string;
    value: number;
    unite: string;
}

export interface PieChartProps {
    logo_center?: string; // +, - ou rien
    dechets_cost: DechetCost[];
}

interface Data {
    type: string;
    collecte: number;
}

const PieChart = ({ logo_center, dechets_cost }: PieChartProps) => { // Bonfinal c'est un doughnut quoi..
    const data: Data[] = [];

    // Vérifiez si dechets_cost est défini et est un tableau
    if (dechets_cost && Array.isArray(dechets_cost)) {
        dechets_cost.map((dechet) => (
            data.push(
                { type: dechet.name, collecte: dechet.value }
            )
        ));
    }

    const chartData = {
        labels: data.map((row) => row.type),
        datasets: [
            {
                label: 'Nombre de collecte',
                data: data.map((row) => row.collecte),
                backgroundColor: [
                    'rgba(255, 99, 132, 0.6)',
                    'rgba(54, 162, 235, 0.6)',
                    'rgba(255, 206, 86, 0.6)',
                    'rgba(75, 192, 192, 0.6)',
                    'rgba(153, 102, 255, 0.6)',
                ],
                borderColor: 'rgba(255, 255, 255, 1)',
                borderWidth: 1,
            },
        ],
    };

    return (
        <div className="text-center relative">
            <Doughnut data={chartData} width={200} height={200} />
            {logo_center && (
                <div className="absolute inset-0 flex items-center mt-12 justify-center text-3xl text-gray-400 font-thin">
                    {logo_center}
                </div>
            )}
        </div>
    );
}

export default PieChart;
