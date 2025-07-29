import React, { useMemo } from "react";
import { useAnalysis } from "@/app/analysis/AnalysisProvider";
import TauxTri from "./TauxTri";
import TauxRemplissage from "./TauxRemplissage";
import ObjectifTonnage from "./ObjectifTonnage";

const AnalOpBordereau = () => {
    const { bsds, loading, filterImportedOnly, setFilterImportedOnly } = useAnalysis();

    

    const stats = useMemo(() => {
        const currentMonth = new Date().getMonth();
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;

        let totalWeight = 0;
        let currentMonthWeight = 0;
        let lastMonthWeight = 0;
        const totalBSDs = bsds.length;
        let totalDeclassements = 0;

        bsds.forEach(bsd => {
            const quantity = bsd.infos_json.formAPI.createFormInput.quantityReceived ? Number(bsd.infos_json.formAPI.createFormInput.quantityReceived) : Number(bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity) || 0;
            const bsdMonth = new Date(bsd.created_at).getMonth();

            totalWeight += quantity;
            if (bsdMonth === currentMonth) {
                currentMonthWeight += quantity;
            } else if (bsdMonth === lastMonth) {
                lastMonthWeight += quantity;
            }

            if (bsd.other_infos?.declassement?.declassement_boolean === true) {
                totalDeclassements++;
            }
        });

        const monthlyEvolution = lastMonthWeight === 0 ? 0 : 
            ((currentMonthWeight - lastMonthWeight) / lastMonthWeight) * 100;

        return {
            totalWeight,
            monthlyEvolution,
            averageWeight: totalWeight / 12,
            totalBSDs,
            totalDeclassements
        };
    }, [bsds]);

    return (
        <div className="flex justify-between bg-gray-200 p-4 rounded-lg items-center">
            <div className="block">
                <div className="text-sm text-gray-600 font-thin">Tonnage total</div>
                <div className="flex items-center mt-2">
                    <div className="font-bold text-xl text-gray-700">
                        {stats.totalWeight.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} T
                    </div>
                    {/*<div className={`ml-4 px-2 py-1 rounded-full text-xs ${
                        stats.monthlyEvolution >= 0 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                    }`}>
                        {stats.monthlyEvolution >= 0 ? '+' : ''}{stats.monthlyEvolution.toFixed(1)}%
                    </div>*/}
                </div>
            </div>
            <div className="block">
                <ObjectifTonnage/>
            </div>
            <div className="flex gap-9 items-center">
                <div className="block">
                    <div className="text-sm text-gray-600 font-thin hidden">Taux de tri</div>
                    <div className="flex items-center mt-0">
                        <TauxTri />
                    </div>
                </div>
                <div className="block hidden">
                    <div className="text-sm text-gray-600 font-thin hidden">Taux de remplissage</div>
                    <div className="flex items-center mt-0">
                        <TauxRemplissage />
                    </div>
                </div>
                <div className="block hidden">
                    <div className="text-sm text-gray-600 font-thin">Nombre de BSDs</div>
                    <div className="flex items-center mt-2">
                        <div className="font-medium text-xl text-gray-700">
                            {stats.totalBSDs}
                        </div>
                    </div>
                </div>
                <div className="block">
                    <div className="text-sm text-gray-600 font-thin">Déclassements</div>
                    <div className="font-medium text-xl text-gray-700 mt-2 ml-2">
                        {stats.totalDeclassements}
                    </div>
                </div>
                {/* Mini bouton filterLineRegister */}
                <div className="ml-4 hidden">
                    <button
                        onClick={() => setFilterImportedOnly(!filterImportedOnly)}
                        className={`px-2 py-1 rounded text-xs font-medium border transition-colors duration-150 ${filterImportedOnly ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-blue-500 border-blue-500 hover:bg-blue-50'}`}
                        title={filterImportedOnly ? 'Afficher toutes les lignes' : 'Afficher uniquement les lignes importées'}
                    >
                        {filterImportedOnly ? 'Lignes importées' : 'Toutes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AnalOpBordereau;