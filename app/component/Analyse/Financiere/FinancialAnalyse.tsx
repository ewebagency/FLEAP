import React from "react";
import TopBordereau from "../MetaComponent/TopBordereau";
import BarChart from "../MetaComponent/BarChart";
import TopCaption from "../MetaComponent/TopCaption";
import Table from "../MetaComponent/Table";
import PieChart from "../MetaComponent/PieChart";
import {DechetCost, PieChartProps} from "../MetaComponent/PieChart"

interface Props {
    active:boolean;
}


const FinancialAnalyse = ({active}:Props) => {

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

                        <div className="flex justify-between m-5">
                            <Table/>
                            <div>
                                <div className="text-gray-300 text-sm text-center">Nombre de collecte de filière par mois</div>
                                <div className="flex space-x-4"> {/* Flexbox container for PieCharts */}
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
    )

}

export default FinancialAnalyse
