import React, { useMemo } from "react";
import { useAnalysis } from "@/app/analysis/AnalysisProvider";
import { getFiliere } from "@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new";

const AnalOpTable = () => {
    const { bsds, loading, mappingTable, filieres_ou_prestataires, siretToName } = useAnalysis();

    const tableData = useMemo(() => {
        const stats: {
            [key: string]: {
                totalWeight: number;
                monthlyData: number[];
                bsdCount: number;
            }
        } = {};

        bsds.forEach(bsd => {
            let segmentKey;
            if (filieres_ou_prestataires.nom === 'prestataire') {
                const siret = bsd.infos_json.formAPI.createFormInput.recipient.company.siret;
                segmentKey = siretToName[siret] || siret || 'Non renseigné';
            } else {
                segmentKey = getFiliere(
                    bsd.infos_json.formAPI.createFormInput.wasteDetails.code,
                    mappingTable
                ) || 'Autres';
            }

            if (!stats[segmentKey]) {
                stats[segmentKey] = {
                    totalWeight: 0,
                    monthlyData: Array(12).fill(0),
                    bsdCount: 0
                };
            }

            const quantity = bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity || 0;
            const month = new Date(bsd.created_at).getMonth();

            stats[segmentKey].totalWeight += quantity;
            stats[segmentKey].monthlyData[month] += quantity;
            stats[segmentKey].bsdCount += 1;
        });

        // Calculer les totaux
        const totals = {
            totalWeight: 0,
            bsdCount: 0
        };

        Object.values(stats).forEach(stat => {
            totals.totalWeight += stat.totalWeight;
            totals.bsdCount += stat.bsdCount;
        });

        return { stats, totals };
    }, [bsds, mappingTable, filieres_ou_prestataires, siretToName]);

    return (
        <div className="flex-1 p-4 bg-white rounded-lg shadow">
            <div className="text-gray-500 text-xs mb-2">
                Détails par {filieres_ou_prestataires.nom === 'prestataire' ? 'prestataire' : 'filière'}
            </div>
            <div className="h-[180px] overflow-auto">
                <table className="min-w-full text-xs">
                    <thead className="sticky top-0 bg-white">
                        <tr className="bg-gray-50">
                            <th className="px-2 py-1 text-left">
                                {filieres_ou_prestataires.nom === 'prestataire' ? 'Prestataire' : 'Filière'}
                            </th>
                            <th className="px-2 py-1 text-right">Total (T)</th>
                            <th className="px-2 py-1 text-right">Moy. mensuelle</th>
                            <th className="px-2 py-1 text-right">Nb BSDs</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(tableData.stats)
                            .sort((a, b) => {
                                if (a[0] === 'Autres') return 1;
                                if (b[0] === 'Autres') return -1;
                                return b[1].totalWeight - a[1].totalWeight;
                            })
                            .map(([segment, data], index) => (
                                <tr key={index} className="border-b hover:bg-gray-50">
                                    <td className="px-2 py-1">{segment}</td>
                                    <td className="px-2 py-1 text-right">
                                        {data.totalWeight.toFixed(2)}
                                    </td>
                                    <td className="px-2 py-1 text-right">
                                        {(data.totalWeight / 12).toFixed(2)}
                                    </td>
                                    <td className="px-2 py-1 text-right">
                                        {data.bsdCount}
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-white">
                        <tr className="bg-gray-50">
                            <td className="px-2 py-1">Total</td>
                            <td className="px-2 py-1 text-right">
                                {tableData.totals.totalWeight.toFixed(2)}
                            </td>
                            <td className="px-2 py-1 text-right">
                                {(tableData.totals.totalWeight / 12).toFixed(2)}
                            </td>
                            <td className="px-2 py-1 text-right">
                                {tableData.totals.bsdCount}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default AnalOpTable;