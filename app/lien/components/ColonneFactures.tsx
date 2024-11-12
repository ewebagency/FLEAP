import FactureLine from "../interface/facture_line";

interface SelectedFacture {
  factureId: string;
  lineNumber: number;
}

const ColonneFactures = ({ 
    factureLines, 
    selectedFacture, 
    setSelectedFacture,
}: { 
    factureLines: FactureLine[], 
    selectedFacture: SelectedFacture | null,
    setSelectedFacture: (selection: SelectedFacture | null) => void,
}) => {
    return (
        <div className="space-y-4">
            {factureLines.map((factureLine) => (
                <div key={`${factureLine.factureId}-${factureLine.lineNumber}`} 
                    className={`relative p-4 rounded-lg border transition-all duration-200
                        ${(selectedFacture?.factureId === factureLine.factureId && 
                           selectedFacture?.lineNumber === factureLine.lineNumber)
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                >
                    <div className="absolute top-4 right-4">
                        <input
                            type="radio"
                            name="facture"
                            checked={selectedFacture?.factureId === factureLine.factureId && 
                                   selectedFacture?.lineNumber === factureLine.lineNumber}
                            onChange={() => setSelectedFacture({
                                factureId: factureLine.factureId,
                                lineNumber: factureLine.lineNumber
                            })}
                            className="w-4 h-4 text-blue-600"
                        />
                    </div>
                    <div className="font-semibold text-gray-800">
                        {new Date(factureLine.created_at).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </div>
                    <div className="flex justify-between">
                        <div className="text-xs text-gray-600 mt-2">ID : {factureLine.factureId}</div>
                        <div className="text-xs text-gray-600 mt-2">Ligne n°{factureLine.lineNumber}</div>
                    </div>
        
                    <div className="text-gray-600 mt-2">Code CED: {factureLine.infos.code_ced}</div>
                    <div className="text-gray-600 mt-1">{factureLine.infos.description_adresse_site}</div>
                </div>
            ))}
        </div>
    );
};

export default ColonneFactures;