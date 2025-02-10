import React, { useMemo } from "react";
import { Facture } from "../types";

interface Props {
    factures: Facture[];
}

const NewBordereauxFinancial = ({ factures }: Props) => {
    const stats = useMemo(() => {
        const { costs, revenues } = factures.reduce((acc: { 
            costs: number,
            revenues: number
        }, facture) => {
            const montant = facture.infos_json.footer.total_ht;
            
            if (montant < 0) {
                acc.revenues += Math.abs(montant);
            } else {
                acc.costs += montant;
            }
            
            return acc;
        }, { costs: 0, revenues: 0 });

        const profit = revenues - costs;
        const profitPercentage = costs > 0 ? ((revenues - costs) / costs * 100) : 0;

        return {
            totalCosts: costs,
            totalRevenues: revenues,
            profit: Math.abs(profit),
            profitPercentage
        };
    }, [factures]);

    return (
        <div className="flex justify-between bg-white p-4 rounded-lg shadow">
            <div className="block">
                <div className="text-sm text-gray-600 font-thin">Budget Déchet</div>
                <div className="flex items-center mt-2">
                    <div className="font-bold text-xl text-gray-700">
                        {stats.profit.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                    </div>
                    {/*<div className={`ml-4 px-2 py-1 rounded-full text-xs ${
                        stats.profitPercentage >= 0 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                    }`}>
                        {stats.profitPercentage >= 0 ? '+' : ''}{stats.profitPercentage.toFixed(1)}%
                    </div>*/}
                </div>
            </div>
            <div className="flex gap-12">
                <div className="block">
                    <div className="text-sm text-gray-600 font-thin">Revenus totaux</div>
                    <div className="flex items-center mt-2">
                        <div className="font-bold text-xl text-green-600">
                            {stats.totalRevenues.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                        </div>
                    </div>
                </div>
                <div className="block">
                    <div className="text-sm text-gray-600 font-thin">Coûts totaux</div>
                    <div className="flex items-center mt-2">
                        <div className="font-bold text-xl text-gray-700">
                            {stats.totalCosts.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewBordereauxFinancial;