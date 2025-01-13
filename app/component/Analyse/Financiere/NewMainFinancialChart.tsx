/*'use client'
import { Line } from 'react-chartjs-2';
import { Facture, ChartData } from './types';
import { Chart as ChartJS } from 'chart.js/auto';

interface Props {
    factures: Facture[];
}

const NewMainFinancialChart = ({ factures }: Props) => {
    // Grouper les montants par mois
    const monthlyData = factures.reduce((acc: { [key: string]: number }, facture) => {
        const date = new Date(facture.other_infos.date_collecte);
        const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
        
        if (!acc[monthYear]) {
            acc[monthYear] = 0;
        }
        acc[monthYear] += facture.infos_json.footer.total_ht;
        
        return acc;
    }, {});

    const chartData: ChartData = {
        labels: Object.keys(monthlyData).sort(),
        datasets: [{
            label: 'Montant total HT par mois',
            data: Object.values(monthlyData),
            borderColor: 'rgb(75, 192, 192)',
            fill: false
        }]
    };

    return (
        <div className="w-full h-[400px] p-4">
            <Line 
                data={chartData}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }}
            />
        </div>
    );
};

export default NewMainFinancialChart; */