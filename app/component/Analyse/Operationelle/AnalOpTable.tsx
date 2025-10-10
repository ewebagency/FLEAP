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
                pricePerVolume: number[];
                pricePerTon: number[];
                pricePerCollection: number[];
                declassements: number;
            }
        } = {};

        bsds.forEach(bsd => {
            let segmentKey;
            if (filieres_ou_prestataires.nom === 'filiere_nom') {
                // En mode filiere_nom, utiliser le nom du déchet pour déterminer la filière
                const wasteName = bsd.infos_json.formAPI.createFormInput.wasteDetails.name;
                const mappingEntry = mappingTable.find((item: { nom?: string; filiere: string }) => 
                    item.nom === wasteName
                );
                segmentKey = mappingEntry ? mappingEntry.filiere : 'Autres';
            } else {
                // Filtrer le mappingTable pour ne garder que les objets avec ced
                const cedMappingTable = mappingTable.filter(m => 'ced' in m && m.ced) as Array<{ced: string, filiere: string}>;
                segmentKey = getFiliere(
                    bsd.infos_json.formAPI.createFormInput.wasteDetails.code,
                    cedMappingTable
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
                    weightWithFillRate: 0,
                    pricePerVolume: [],
                    pricePerTon: [],
                    pricePerCollection: [],
                    declassements: 0
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

            // Calculer les différents prix
            if (bsd.facture_infos?.footer?.total_ht) {
                const totalHT = Number(bsd.facture_infos.footer.total_ht);
                
                // Prix au volume
                if (bsd.other_infos?.volume && bsd.other_infos?.volumeUnit) {
                    let volume = Number(bsd.other_infos.volume);
                    
                    // Convertir en m³ si l'unité est en L
                    if (bsd.other_infos.volumeUnit === 'L') {
                        volume = volume / 1000; // Conversion de L en m³
                    }
                    
                    const fillRate = bsd.other_infos?.fillRate ? Number(bsd.other_infos.fillRate) / 100 : 1;
                    const effectiveVolume = volume * fillRate;
                    
                    if (effectiveVolume > 0) {
                        const pricePerVolume = totalHT / effectiveVolume;
                        stats[segmentKey].pricePerVolume.push(pricePerVolume);
                    }
                }

                // Prix à la tonne
                if (quantity > 0) {
                    const pricePerTon = totalHT / quantity;
                    stats[segmentKey].pricePerTon.push(pricePerTon);
                }

                // Prix par collecte
                stats[segmentKey].pricePerCollection.push(totalHT);
            }

            if (bsd.other_infos?.declassement?.declassement_boolean === true) {
                stats[segmentKey].declassements++;
            }
        });

        // Calculer les totaux
        const totals = {
            totalWeight: 0,
            bsdCount: 0,
            weightedFillRateSum: 0,
            weightWithFillRate: 0,
            totalDeclassements: 0
        };

        Object.values(stats).forEach(stat => {
            totals.totalWeight += stat.totalWeight;
            totals.bsdCount += stat.bsdCount;
            totals.weightedFillRateSum += stat.weightedFillRateSum;
            totals.weightWithFillRate += stat.weightWithFillRate;
            totals.totalDeclassements += stat.declassements;
        });

        return { stats, totals };
    }, [bsds, mappingTable, filieres_ou_prestataires, siretToName]);

    const calculateMedian = (arr: number[]) => {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[middle - 1] + sorted[middle]) / 2;
        }
        return sorted[middle];
    };

    return (
        <div className="flex-1 p-4 bg-white rounded-lg">
            <div className="text-gray-500 text-xs mb-2">
                Détails par filière
            </div>
            <div className="h-[250px] overflow-auto">
                <table className="min-w-full text-xs">
                    <thead className="sticky top-0 bg-white">
                        <tr className="bg-white border-b border-gray-600">
                            <th className="px-2 py-1 text-left font-bold">
                                Filière
                            </th>
                            <th className="px-2 py-1 text-right font-bold">Tonnage</th>
                            <th className="px-2 py-1 text-right font-bold hidden">Remplissage</th>
                            <th className="px-2 py-1 text-right font-bold">Collectes</th>
                            <th className="px-2 py-1 text-right font-bold">Déclassés</th>
                            {/*<th className="px-2 py-1 text-right font-bold">(€/m³)</th>*/}
                            <th className="px-2 py-1 text-right font-bold">(€/tonne)</th>
                            {/*<th className="px-2 py-1 text-right font-bold">(€/collecte)</th>*/}
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
                                        {formatNumber(data.totalWeight, true, true)} T
                                    </td>
                                    <td className="px-2 py-1 text-right hidden">
                                        {data.weightWithFillRate > 0 
                                            ? `${(data.weightedFillRateSum / data.weightWithFillRate).toFixed(0)}%`
                                            : '-'}
                                    </td>
                                    <td className="px-2 py-1 text-right">
                                        {formatNumber(data.bsdCount, false)}
                                    </td>
                                    <td className="px-2 py-1 text-right">
                                        {data.declassements}
                                    </td>
                                    {/*<td className="px-2 py-1 text-right">
                                        {data.pricePerVolume.length > 0 
                                            ? `${calculateMedian(data.pricePerVolume).toFixed(1)}`
                                            : '-'}
                                    </td>*/}
                                    <td className="px-2 py-1 text-right">
                                        {data.pricePerTon.length > 0 
                                            ? `${calculateMedian(data.pricePerTon).toFixed(1)}`
                                            : '-'}
                                    </td>
                                    {/*<td className="px-2 py-1 text-right">
                                        {data.pricePerCollection.length > 0 
                                            ? `${calculateMedian(data.pricePerCollection).toFixed(1)}`
                                            : '-'}
                                    </td>*/}
                                </tr>
                            ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-white">
                        <tr className="bg-white hover:bg-gray-50">
                            <td className="px-2 py-1 font-bold">Total</td>
                            <td className="px-2 py-1 text-right font-bold">
                                {formatNumber(tableData.totals.totalWeight, true, true)} T
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
                                {tableData.totals.totalDeclassements}
                            </td>
                            {/*<td className="px-2 py-1 text-right font-bold">
                                -
                            </td>*/}
                            <td className="px-2 py-1 text-right font-bold">
                                -
                            </td>
                            {/*<td className="px-2 py-1 text-right font-bold">
                                -
                            </td>*/}
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default AnalOpTable;