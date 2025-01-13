import React, { useMemo } from "react";
import { useAnalysis } from "@/app/analysis/AnalysisProvider";

const AnalOpBordereau = () => {
    const { bsds, loading } = useAnalysis();

    const stats = useMemo(() => {
        const currentMonth = new Date().getMonth();
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;

        let totalWeight = 0;
        let currentMonthWeight = 0;
        let lastMonthWeight = 0;
        const totalBSDs = bsds.length;

        bsds.forEach(bsd => {
            const quantity = Number(bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity) || 0;
            const bsdMonth = new Date(bsd.created_at).getMonth();

            totalWeight += quantity;
            if (bsdMonth === currentMonth) {
                currentMonthWeight += quantity;
            } else if (bsdMonth === lastMonth) {
                lastMonthWeight += quantity;
            }
        });

        const monthlyEvolution = lastMonthWeight === 0 ? 0 : 
            ((currentMonthWeight - lastMonthWeight) / lastMonthWeight) * 100;

        return {
            totalWeight,
            monthlyEvolution,
            averageWeight: totalWeight / 12,
            totalBSDs
        };
    }, [bsds]);

    return (
        <div className="flex justify-between bg-gray-200 p-2 rounded-lg">
            <div className="block ml-4">
                <div className="text-sm text-gray-600 font-thin">Tonnage total</div>
                <div className="flex items-center mt-2">
                    <div className="font-bold text-xl ml-4">{stats.totalWeight.toFixed(2)} T</div>
                    <div className={`badge ${stats.monthlyEvolution >= 0 ? 'bg-green-300' : 'bg-red-300'} ml-8 text-xs`}>
                        {stats.monthlyEvolution >= 0 ? '+' : ''}{stats.monthlyEvolution.toFixed(1)}%
                    </div>
                </div>
            </div>
            <div className="block mx-10 hidden">
                <div className="text-sm text-gray-600 font-thin">Moyenne mensuelle</div>
                <div className="font-bold text-xl mt-2">{stats.averageWeight.toFixed(2)} T</div>
            </div>
            <div className="block mr-10 hidden">
                <div className="text-sm text-gray-600 font-thin">Nombre de BSDs</div>
                <div className="font-bold text-xl mt-2">{stats.totalBSDs}</div>
            </div>
        </div>
    );
};

export default AnalOpBordereau;