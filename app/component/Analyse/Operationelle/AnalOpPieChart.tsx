'use client'
import React, { useContext } from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { AnalysisContext } from "@/app/analysis/page";

ChartJS.register(ArcElement, Tooltip, Legend);

const AnalOpPieChart = () => {

    const data = [
        { type: 'DIB', collecte: 15 },
        { type: 'Dangereux', collecte: 10 },
        { type: 'Verre', collecte: 20 },
        { type: 'Carton & Papier', collecte: 25 },
        { type: 'Plastiques', collecte: 18 },
    ];

    const chartData = {
        labels: data.map(row => row.type),
        datasets: [
            {
                label: 'Nombre de collecte',
                data: data.map(row => row.collecte),
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
        <div className="text-center">
            <div className="text-gray-300 text-sm">Nombre de collecte de filière par mois</div>
            <Pie data={chartData} />
        </div>
    );
}

export default AnalOpPieChart;
