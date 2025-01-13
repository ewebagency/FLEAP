/*'use client'
import { Pie } from 'react-chartjs-2';
import { Facture, ChartData } from './types';
import { Chart as ChartJS } from 'chart.js/auto';

interface Props {
    factures: Facture[];
}

const NewPieFinancialChart = ({ factures }: Props) => {
    // Grouper les montants par type d'opération
    const operationData = factures.reduce((acc: { [key: string]: number }, facture) => {
        facture.infos_json.depart.line_body.forEach(line => {
            if (!acc[line.type_operation]) {
                acc[line.type_operation] = 0;
            }
            acc[line.type_operation] += line.montant_ht;
        });
        return acc;
    }, {});

    const colors = [
        'rgb(255, 99, 132)',
        'rgb(54, 162, 235)',
        'rgb(255, 206, 86)',
        'rgb(75, 192, 192)',
        'rgb(153, 102, 255)',
        'rgb(255, 159, 64)',
        'rgb(199, 199, 199)',
        'rgb(83, 102, 255)',
        'rgb(255, 99, 132)',
    ];

    const chartData: ChartData = {
        labels: Object.keys(operationData),
        datasets: [{
            data: Object.values(operationData),
            backgroundColor: colors,
        }]
    };

    return (
        <div className="w-full h-[400px] p-4">
            <Pie 
                data={chartData}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                }}
            />
        </div>
    );
};

export default NewPieFinancialChart; */