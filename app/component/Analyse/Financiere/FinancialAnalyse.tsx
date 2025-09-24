import React, { useState } from "react";
import TopBordereau from "../MetaComponent/TopBordereau";
import TopCaption from "../MetaComponent/TopCaption";
import { useAnalysis } from '@/app/analysis/AnalysisProvider';
import { useFilterContext } from "@/app/FilterContext";
import { calculateFinancialAmount } from '@/app/utils/financial';
import { getFiliere, getFiliereByNom } from '@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new';
import NewFinancialSource from "./New/NewFinancialSource";

interface Props {
    active: boolean;
}

const FinancialAnalyse = ({active}: Props) => {
    const { bsds, loading, mappingTable, filieres_ou_prestataires, siretToName } = useAnalysis();
    const { filieres } = useFilterContext();
    const [financialData, setFinancialData] = useState<{[key: string]: number}[]>([]);

    const processFinancialData = () => {
        const monthlyData: { [key: string]: number[] } = {};
        let totalRevenue = 0;
        let totalCost = 0;
        
        bsds.forEach(bsd => {
            const wasteDetails = bsd.infos_json.formAPI.createFormInput.wasteDetails;
            const filiere = filieres_ou_prestataires.nom === 'filiere_nom'
                ? (getFiliereByNom(
                        wasteDetails.name,
                        mappingTable.filter(m => 'nom' in m && m.nom) as Array<{nom: string, filiere: string}>
                    ) || 'Autres')
                : (getFiliere(
                        wasteDetails.code,
                        mappingTable.filter(m => 'ced' in m && m.ced) as Array<{ced: string, filiere: string}>
                    ) || 'Autres');
            const weight = bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity || 0;
            const wasteCode = bsd.infos_json.formAPI.createFormInput.wasteDetails.code;
            const amount = calculateFinancialAmount(weight, wasteCode);
            const month = new Date(bsd.created_at).getMonth();

            if (!monthlyData[filiere]) {
                monthlyData[filiere] = Array(12).fill(0);
            }
            monthlyData[filiere][month] += amount;

            if (amount > 0) {
                totalCost += amount;
            } else {
                totalRevenue += Math.abs(amount);
            }
        });

        return {
            monthlyData,
            totalRevenue,
            totalCost,
            netAmount: totalRevenue - totalCost
        };
    };

    /*const renderFinancialPieChart = () => {
        const data = processFinancialData();
        const chartData = {
            labels: Object.keys(data.monthlyData),
            datasets: [{
                data: Object.values(data.monthlyData).map(amounts => 
                    amounts.reduce((sum, amount) => sum + amount, 0)
                ),
                backgroundColor: Object.keys(data.monthlyData).map(filiereName => {
                    const filiere = filieres.find(f => f.name === filiereName);
                    return filiere ? tailwindToRgb(filiere.color) : '#000000';
                }),
            }]
        };

        const options = {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right' as const,
                },
                title: {
                    display: true,
                    text: 'Répartition des coûts par filière (€)',
                },
                tooltip: {
                    callbacks: {
                        label: function(context: TooltipItem<'pie'>) {
                            const value = context.raw as number;
                            const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${context.label}: ${value.toLocaleString('fr-FR')}€ (${percentage}%)`;
                        }
                    }
                }
            }
        };

        return (
            <div className="w-96 h-96">
                <Pie data={chartData} options={options} />
            </div>
        );
    };*/

    const bordereauData = () => {
        const { totalRevenue, totalCost, netAmount } = processFinancialData();
        return {
            titre_g1: "Bilan financier total (HT)",
            chiffre_g1: Math.abs(netAmount),
            unite_g1: "€",
            titre_d1: "Coûts totaux (HT)",
            chiffre_d1: totalCost,
            unite_d1: "€",
            titre_d2: "Revenus totaux (HT)",
            chiffre_d2: totalRevenue,
            unite_d2: "€",
        };
    };

    return (
        <div>
            {active && (
                <div className="rounded-br rounded-bl">
                    {/*<div className="pt-5 mb-5 ml-5 mr-5">
                        <TopCaption/>
                        <TopBordereau {...bordereauData()}/>
                        <FinancialMainChart/>
                        
                        <div className="flex justify-between m-1">
                            <FinancialTable/>
                            <FinancialPieChart/>
                        </div>
                    </div>*/}
                    <NewFinancialSource/>
                </div>
            )}
        </div>
    );
};

export default FinancialAnalyse;
