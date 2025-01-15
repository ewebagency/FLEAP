'use client'
import { Pie } from 'react-chartjs-2';
import { Facture, ChartData } from '../types';
import { Chart as ChartJS } from 'chart.js/auto';
import { useEffect, useState } from 'react';
import { getMappingTableFiliere } from "@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new";

import { tailwindToRgb } from '../../MetaComponent/Colours';
import { Filiere, useFilterContext } from '@/app/FilterContext';

interface Props {
    factures: Facture[];
    entreprise_id: string;
}

const NewPieFinancialChart = ({ factures, entreprise_id }: Props) => {
    const [mappingTable, setMappingTable] = useState<{ ced: string, filiere: string }[]>([]);
    const {filieres} = useFilterContext();

    useEffect(() => {
        const fetchMappingTable = async () => {
            const mapping = await getMappingTableFiliere(entreprise_id);
            setMappingTable(mapping || []);
        };
        fetchMappingTable();
    }, [entreprise_id]);

    // Group amounts by filière
    const operationData = factures.reduce((acc: { [key: string]: number }, facture) => {
        const cleanedCed = facture.infos_json.depart.line_header.code_dechet.replaceAll(' ', '').replace('*', '');
        const filiere = mappingTable.find(m => m.ced === cleanedCed)?.filiere || 'Autres';
        
        
        if (!acc[filiere]) {
            acc[filiere] = 0;
        }
        acc[filiere] += facture.infos_json.footer.total_ht;
        return acc;
    }, {});

    const colors = Object.keys(operationData).map(filiere => {
        const filiereColor = filieres.find(f => f.name === filiere)?.color || '#000000';
        return tailwindToRgb(filiereColor);
    });

    const chartData: ChartData = {
        labels: Object.keys(operationData),
        datasets: [{
            label: 'Montant par filière',
            data: Object.values(operationData),
            backgroundColor: colors,
        }]
    };

    return (
        <div className="w-full h-[200px] p-2">
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

export default NewPieFinancialChart; 