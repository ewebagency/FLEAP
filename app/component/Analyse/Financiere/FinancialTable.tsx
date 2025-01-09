import React from 'react';
import { useAnalysis } from '@/app/analysis/AnalysisProvider';
import { getFiliere } from '@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new';
import { calculateFinancialAmount } from '@/app/utils/financial';

const FinancialTable = () => {
    const { bsds, mappingTable, filieres_ou_prestataires, siretToName } = useAnalysis();

    const processTableData = () => {
        const segmentData: { 
            [key: string]: { 
                totalAmount: number;
                totalWeight: number;
                averagePerTon: number;
                monthlyData: number[];
                numberOfBSDs: number;
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

            if (!segmentData[segmentKey]) {
                segmentData[segmentKey] = {
                    totalAmount: 0,
                    totalWeight: 0,
                    averagePerTon: 0,
                    monthlyData: Array(12).fill(0),
                    numberOfBSDs: 0
                };
            }

            const weight = bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity || 0;
            const wasteCode = bsd.infos_json.formAPI.createFormInput.wasteDetails.code;
            const amount = calculateFinancialAmount(weight, wasteCode);
            const month = new Date(bsd.created_at).getMonth();

            segmentData[segmentKey].totalAmount += amount;
            segmentData[segmentKey].totalWeight += weight;
            segmentData[segmentKey].monthlyData[month] += amount;
            segmentData[segmentKey].numberOfBSDs += 1;
        });

        // Calculer les moyennes
        Object.values(segmentData).forEach(data => {
            data.averagePerTon = data.totalWeight ? data.totalAmount / data.totalWeight : 0;
        });

        return segmentData;
    };

    const tableData = processTableData();

    return (
        <div className="flex-1 p-4 bg-white rounded-lg shadow max-w-[50%]">
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
                            <th className="px-2 py-1 text-right">Montant total (€)</th>
                            <th className="px-2 py-1 text-right">Moy. mensuelle (€)</th>
                            <th className="px-2 py-1 text-right">Coût/tonne (€/t)</th>
                            <th className="px-2 py-1 text-right">Nb BSDs</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(tableData)
                            .sort((a, b) => {
                                if (a[0] === 'Autres') return 1;
                                if (b[0] === 'Autres') return -1;
                                return Math.abs(b[1].totalAmount) - Math.abs(a[1].totalAmount);
                            })
                            .map(([segment, data], index) => (
                                <tr key={index} className="border-b hover:bg-gray-50">
                                    <td className="px-2 py-1">{segment}</td>
                                    <td className="px-2 py-1 text-right">
                                        {data.totalAmount.toLocaleString('fr-FR')}
                                    </td>
                                    <td className="px-2 py-1 text-right">
                                        {(data.totalAmount / 12).toLocaleString('fr-FR')}
                                    </td>
                                    <td className="px-2 py-1 text-right">
                                        {data.averagePerTon.toFixed(2)}
                                    </td>
                                    <td className="px-2 py-1 text-right">
                                        {data.numberOfBSDs}
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FinancialTable; 