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
                    <div className="flex justify-between mb-4">
                        <div className="text-xs text-gray-600 mt-2">ID : {factureLine.factureId}</div>
                        <div className="text-xs text-gray-600 mt-2">Ligne n°{factureLine.lineNumber}</div>
                    </div>
        
                    <div className="text-xs text-gray-600 mt-2">Prestataire : {factureLine.infos.prestataire_nom}</div>
                    <div className="flex justify-between gap-2">
                        <div className="text-xs text-gray-600 mt-2">{factureLine.infos.code_dechet} / {factureLine.infos.type_dechet}</div>
                        <div className="text-xs text-gray-600 mt-2">Opération: {factureLine.infos.type_operation}</div>
                    </div>
                    <div className="flex justify-between gap-2">
                        <div className="text-xs text-gray-600 mt-2">{factureLine.infos.lieu_collecte} / {factureLine.infos.date_collecte}</div>
                        <div className="text-xs text-gray-600 mt-2">Montant HT: {factureLine.infos.montant_ht}</div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ColonneFactures;


/*
    facture_form : {
      header: {
        prestataire_nom: "Nom du prestataire",
      },
      footer: {
        total_ht: 0,
      },
      departs: [
        {
          type_operation: "Type d'opération",
          type_dechet: "Type de déchet",
          code_dechet: "Code CED si possible",
          date_collecte: "JJ/MM/AAAA",
          lieu_collecte: "Lieu de collecte",
          montant_ht: 0,
        }
      ],
    },
*/