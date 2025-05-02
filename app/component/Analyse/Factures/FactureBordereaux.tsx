import React, { useMemo } from "react";

const FactureBordereaux = () => {

    return (
        <div className="m-4">
            <div className="flex justify-between bg-gray-200 p-4 rounded-lg">
                <div className="block">
                    <div className="text-sm text-gray-600 font-bold">Anomalies</div>
                    <div className="flex items-center mt-2">
                        <div className="font-bold text-xl text-red-600 ml-2">
                            0
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
                <div className="text-sm text-gray-600 mt-8">
                            Les tarifs des prestataires sont inconnus - les factures ne peuvent pas être vérifiées
                </div>
                <div className="flex gap-12">
                    <div className="block">
                        <div className="text-sm text-gray-600 font-thin">Factures vérifiées</div>
                        <div className="flex items-center mt-2">
                            <div className="font-medium text-xl text-gray-700 ml-2">
                                0
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FactureBordereaux;