import React, { useEffect, useState } from "react";
import TopBordereau from "../MetaComponent/TopBordereau";
import BarChart from "../MetaComponent/BarChart";
import TopCaption from "../MetaComponent/TopCaption";
import Table from "../MetaComponent/Table";
import PieChart from "../MetaComponent/PieChart";
import { DechetCost, PieChartProps } from "../MetaComponent/PieChart";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { AnalysisContext, useAnalysisContext } from "@/app/analysis/AnalysisContext_deprecated";
import { supabase } from "@/app/database/supabaseClient";
import { useSession } from "../../SessionProvider";
import { useFilterContext } from "@/app/FilterContext";
import { TooltipItem } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface Props {
    active: boolean;
}

interface FactureBDD {
    infos_json: {
        depart: {
          bsd_id: number;
          montant_ht: number;
          code_dechet: string;
          type_dechet: string;
          date_collecte: string;
          lieu_collecte: string;
          linked_to_bsd: boolean;
          type_operation: string;
        },
        footer: {
          total_ht: number;
        },
        header: {
          prestataire_nom: string;
        }
      }
}

const FinancialAnalyse = ({active}: Props) => {
    const session = useSession();
    const { filieres_ou_prestataires } = useFilterContext();
    const [financialData, setFinancialData] = useState<FactureBDD[]>([]);

    const getFinancialData = async (user_id: string) => {
        const {data, error} = await supabase
        .from('facture')
        .select('infos_json')
        .eq('user_id', user_id);
        if(error) console.log(error);
        return data;
    }


    useEffect(() => {
        if(session && session.user_id){
            getFinancialData(session.user_id).then((data) => {
                setFinancialData(data || []);
            });
        }
    }, [session]);

    const renderPrestatairePieChart = () => {
        // Préparation des données pour le pie chart des prestataires
        const prestatairesData = financialData.reduce((acc, facture) => {
            const prestataire = facture.infos_json.header.prestataire_nom;
            const montant = facture.infos_json.depart.montant_ht || 0;
            acc[prestataire] = (acc[prestataire] || 0) + montant;
            return acc;
        }, {} as { [key: string]: number });

        // Arrondir les montants à 2 décimales
        Object.keys(prestatairesData).forEach(key => {
            prestatairesData[key] = Math.round(prestatairesData[key] * 100) / 100;
        });

        return createPieChart(
            prestatairesData,
            'Répartition des montants HT par prestataire (€)',
            'Montants HT par prestataire'
        );
    };

    const renderFilierePieChart = () => {
        // Préparation des données pour le pie chart des filières
        const filiereData = financialData.reduce((acc, facture) => {
            const typeDechet = facture.infos_json.depart.type_dechet;
            const montant = facture.infos_json.depart.montant_ht || 0;
            acc[typeDechet] = (acc[typeDechet] || 0) + montant;
            return acc;
        }, {} as { [key: string]: number });

        // Arrondir les montants à 2 décimales
        Object.keys(filiereData).forEach(key => {
            filiereData[key] = Math.round(filiereData[key] * 100) / 100;
        });

        return createPieChart(
            filiereData,
            'Répartition des montants HT par filière (€)',
            'Montants HT par filière'
        );
    };

    const createPieChart = (data: { [key: string]: number }, titleText: string, captionText: string) => {
        const generateColors = (count: number) => {
            const colors = [];
            for (let i = 0; i < count; i++) {
                colors.push(`hsl(${(i * 360) / count}, 70%, 50%)`);
            }
            return colors;
        };

        const pieChartData = {
            labels: Object.keys(data),
            datasets: [
                {
                    data: Object.values(data),
                    backgroundColor: generateColors(Object.keys(data).length),
                    borderWidth: 1,
                },
            ],
        };

        const pieChartOptions = {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right' as const,
                },
                title: {
                    display: true,
                    text: titleText,
                },
                tooltip: {
                    callbacks: {
                        label: function(context: TooltipItem<'pie'>) {
                            const label = context.label || '';
                            const value = context.raw as number || 0;
                            const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${value.toLocaleString('fr-FR')}€ (${percentage}%)`;
                        }
                    }
                }
            },
        };

        return (
            <div>
                <div className="text-gray-300 text-sm text-center m-0">{captionText}</div>
                <div className="w-96 h-96">
                    <Pie data={pieChartData} options={pieChartOptions} />
                </div>
            </div>
        );
    };

    const bordereauData = {
        titre_g1 : "Coûts et revenues totaux (HT)",
        chiffre_g1 : 258872.4,
        unite_g1 : "€",
        titre_d1 : "Coût total (HT)",
        chiffre_d1 : 287347.9,
        unite_d1 : "€",
        titre_d2 : "Revenue total (HT)",
        chiffre_d2 : 28475.5,
        unite_d2 : "€",
    }

    const dechets_plus:DechetCost[] = [
        {name:'DIB', value:31, unite:'€'},
        {name:'Verre', value:21, unite:'€'},
        {name:'Dangereux', value:90, unite:'€'},
    ]

    const dechets_moins:DechetCost[] = [
        {name:'Carton et Papier', value:31, unite:'€'},
        {name:'Plastique', value:21, unite:'€'},
    ]

    const pie_data:PieChartProps[] = [
        { logo_center : '+', dechets_cost : dechets_plus },
        { logo_center : '-', dechets_cost : dechets_moins },
    ]

    return (
        <div>
            { active &&
                <div className="border-b border-r border-l border-gray-200 rounded-br rounded-bl">
                    <div className="pt-5 mb-5 ml-5 mr-5">
                        <TopCaption/>
                        <TopBordereau {...bordereauData}/>
                        <BarChart/>

                        <div className="flex justify-between m-1">
                            <Table/>
                            <div>
                                {filieres_ou_prestataires.nom === 'prestataire' && renderPrestatairePieChart()}
                                {filieres_ou_prestataires.nom === 'filiere' && renderFilierePieChart()}
                                <div className="flex space-x-4">
                                    {pie_data.map((data, index) => (
                                        <PieChart key={index} {...data} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>  
            }
        </div>
    );
}

export default FinancialAnalyse;
