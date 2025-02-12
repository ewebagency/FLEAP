import React, { useMemo } from "react";
import { useAnalysis } from "@/app/analysis/AnalysisProvider";
import { getFiliere } from "@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new";
import { formatNumber } from '@/app/utils/formatNumber';

const AnalOpTable = () => {
    const { bsds, loading, mappingTable, filieres_ou_prestataires, siretToName } = useAnalysis();

    const tableData = useMemo(() => {
        const stats: {
            [key: string]: {
                totalWeight: number;
                monthlyData: number[];
                bsdCount: number;
                fillRateSum: number;
                fillRateCount: number;
                weightedFillRateSum: number;
                weightWithFillRate: number;
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
                    bsdCount: 0,
                    fillRateSum: 0,
                    fillRateCount: 0,
                    weightedFillRateSum: 0,
                    weightWithFillRate: 0
                };
            }

            let quantity = 0;
            if(bsd.infos_json.formAPI.createFormInput.quantityReceived) {
                quantity = Number(bsd.infos_json.formAPI.createFormInput.quantityReceived) || 0;
            } else {
                quantity = Number(bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity) || 0;
            }
            const month = new Date(bsd.created_at).getMonth();

            stats[segmentKey].totalWeight += quantity;
            stats[segmentKey].monthlyData[month] += quantity;
            stats[segmentKey].bsdCount += 1;

            // Calculer la moyenne pondérée du remplissage
            if (bsd.other_infos?.fillRate) {
                const fillRate = Number(bsd.other_infos.fillRate);
                stats[segmentKey].weightedFillRateSum += fillRate * quantity;
                stats[segmentKey].weightWithFillRate += quantity;
                stats[segmentKey].fillRateSum += fillRate;
                stats[segmentKey].fillRateCount += 1;
            }
        });

        // Calculer les totaux
        const totals = {
            totalWeight: 0,
            bsdCount: 0,
            weightedFillRateSum: 0,
            weightWithFillRate: 0
        };

        Object.values(stats).forEach(stat => {
            totals.totalWeight += stat.totalWeight;
            totals.bsdCount += stat.bsdCount;
            totals.weightedFillRateSum += stat.weightedFillRateSum;
            totals.weightWithFillRate += stat.weightWithFillRate;
        });

        return { stats, totals };
    }, [bsds, mappingTable, filieres_ou_prestataires, siretToName]);

    return (
        <div className="flex-1 p-4 bg-white rounded-lg">
            <div className="text-gray-500 text-xs mb-2">
                Détails par {filieres_ou_prestataires.nom === 'prestataire' ? 'prestataire' : 'filière'}
            </div>
            <div className="h-[250px] overflow-auto">
                <table className="min-w-full text-xs">
                    <thead className="sticky top-0 bg-white">
                        <tr className="bg-white border-b border-gray-600">
                            <th className="px-2 py-1 text-left font-bold">
                                {filieres_ou_prestataires.nom === 'prestataire' ? 'Prestataire' : 'Filière'}
                            </th>
                            <th className="px-2 py-1 text-right font-bold">Tonnage</th>
                            <th className="px-2 py-1 text-right font-bold">Remplissage moyen</th>
                            <th className="px-2 py-1 text-right font-bold">Nombre de collectes</th>
                            <th className="px-2 py-1 text-right font-bold">Déclassements</th>
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
                                        {formatNumber(data.totalWeight)} T
                                    </td>
                                    <td className="px-2 py-1 text-right">
                                        {data.weightWithFillRate > 0 
                                            ? `${(data.weightedFillRateSum / data.weightWithFillRate).toFixed(0)}%`
                                            : '-'}
                                    </td>
                                    <td className="px-2 py-1 text-right">
                                        {formatNumber(data.bsdCount, false)}
                                    </td>
                                    <td className="px-2 py-1 text-right">
                                        0
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-white">
                        <tr className="bg-white hover:bg-gray-50">
                            <td className="px-2 py-1 font-bold">Total</td>
                            <td className="px-2 py-1 text-right font-bold">
                                {formatNumber(tableData.totals.totalWeight)} T
                            </td>
                            <td className="px-2 py-1 text-right font-bold">
                                {tableData.totals.weightWithFillRate > 0 
                                    ? `${(tableData.totals.weightedFillRateSum / tableData.totals.weightWithFillRate).toFixed(0)}%`
                                    : '-'}
                            </td>
                            <td className="px-2 py-1 text-right font-bold">
                                {formatNumber(tableData.totals.bsdCount, false)}
                            </td>
                            <td className="px-2 py-1 text-right font-bold">
                                0
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default AnalOpTable;