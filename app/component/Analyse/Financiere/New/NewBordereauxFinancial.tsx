import React, { useMemo } from "react";
import { Facture } from "../types";
import NewObjectifFinancier from "./NewObjectifFinancier";
import { useSession } from "@/app/component/SessionProvider";

interface Props {
    factures: Facture[];
}

const NewBordereauxFinancial = ({ factures }: Props) => {
    const { display_features } = useSession();
    const stats = useMemo(() => {
        const { costs, revenues } = factures.reduce((acc: { 
            costs: number,
            revenues: number
        }, facture) => {
            // Calculer la somme des montants des sous-factures
            facture.infos_json.departs.forEach(depart => {
                depart.line_body.forEach(line => {
                    const montant = line.montant_ht;
                    
                    if (montant < 0) {
                        acc.revenues += Math.abs(montant);
                    } else {
                        acc.costs += montant;
                    }
                });
            });
            
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
        <div className="flex justify-between p-4 rounded-lg bg-gray-200">
            <div className="block">
                <div className={`text-sm font-thin ${
                    stats.totalCosts > stats.totalRevenues ? "text-gray-600" : "text-gray-600"
                }`}>
                    {stats.totalCosts > stats.totalRevenues ? "Coûts nets" : "Gain Déchet"}
                </div>
                <div className="flex items-center mt-2">
                    <div className={`font-bold text-xl ${
                        stats.totalCosts > stats.totalRevenues ? "text-gray-700" : "text-green-600"
                    }`}>
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
            <div>
                {display_features?.objectifs && <NewObjectifFinancier factures={factures} />}
            </div>
            <div className="flex gap-12">
                <div className="block">
                    <div className="text-sm text-gray-600 font-thin">Revenus</div>
                    <div className="flex items-center mt-2">
                        <div className="font-medium text-xl text-green-600">
                            {stats.totalRevenues.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                        </div>
                    </div>
                </div>
                <div className="block">
                    <div className="text-sm text-gray-600 font-thin">Dépenses</div>
                    <div className="flex items-center mt-2">
                        <div className="font-medium text-xl text-gray-700">
                            {stats.totalCosts.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewBordereauxFinancial;