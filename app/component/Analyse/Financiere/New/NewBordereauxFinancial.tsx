import React, { useMemo } from "react";
import { Facture } from "../types";

interface Props {
    factures: Facture[];
}

const NewBordereauxFinancial = ({ factures }: Props) => {
    const stats = useMemo(() => {
        // Calculate total cost from all factures
        const totalCost = factures.reduce((sum, facture) => 
            sum + facture.infos_json.footer.total_ht, 0);

        // Group costs by month
        const costsByMonth = factures.reduce((acc: { [key: string]: number }, facture) => {
            const departsCount = facture.infos_json.departs.length;
            const montantParDepart = facture.infos_json.footer.total_ht / departsCount;

            facture.infos_json.departs.forEach(depart => {
                const date = new Date(depart.line_header.date_depart);
                const monthYear = `${date.getMonth()}-${date.getFullYear()}`;
                
                if (!acc[monthYear]) {
                    acc[monthYear] = 0;
                }
                
                acc[monthYear] += montantParDepart;
            });
            return acc;
        }, {});

        // Calculer l'évolution mensuelle
        const sortedMonths = Object.keys(costsByMonth).sort();
        const currentMonth = sortedMonths[sortedMonths.length - 1];
        const previousMonth = sortedMonths[sortedMonths.length - 2];
        
        const currentMonthCost = costsByMonth[currentMonth] || 0;
        const previousMonthCost = costsByMonth[previousMonth] || 0;
        
        const monthlyEvolution = previousMonthCost ? 
            ((currentMonthCost - previousMonthCost) / previousMonthCost) * 100 : 0;

        // Calculer la moyenne mensuelle
        const averageCost = sortedMonths.length > 0 ? 
            totalCost / sortedMonths.length : 0;

        return {
            totalCost,
            monthlyEvolution,
            averageCost,
            totalFactures: factures.length
        };
    }, [factures]);

    return (
        <div className="flex justify-between bg-white p-4 rounded-lg shadow">
            <div className="block">
                <div className="text-sm text-gray-600 font-thin">Coût total</div>
                <div className="flex items-center mt-2">
                    <div className="font-bold text-xl">
                        {stats.totalCost.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                    </div>
                    <div className={`ml-4 px-2 py-1 rounded-full text-xs ${
                        stats.monthlyEvolution >= 0 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                    }`}>
                        {stats.monthlyEvolution >= 0 ? '+' : ''}{stats.monthlyEvolution.toFixed(1)}%
                    </div>
                </div>
            </div>
            {/*<div className="block">
                <div className="text-sm text-gray-600 font-thin">Moyenne mensuelle</div>
                <div className="font-bold text-xl mt-2">{stats.averageCost.toFixed(2)} €</div>
            </div>
            <div className="block">
                <div className="text-sm text-gray-600 font-thin">Nombre de factures</div>
                <div className="font-bold text-xl mt-2">{stats.totalFactures}</div>
            </div>*/}
        </div>
    );
};

export default NewBordereauxFinancial;