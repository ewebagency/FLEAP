import { supabase } from '@/app/database/supabaseClient';
import { FactureLineOnSupabase } from "../interface/facture_line";

interface SelectedFacture {
    id: string;
}

const ColonneFactures = ({ 
    factureLines, 
    selectedFacture, 
    setSelectedFacture,
}: { 
    factureLines: FactureLineOnSupabase[], 
    selectedFacture: SelectedFacture | null,
    setSelectedFacture: (selection: SelectedFacture | null) => void,
}) => {

    // Fonction pour gérer la suppression d'une facture et la réinitialisation du PDF associé
    const handleDelete = async (factureId: string) => {
        try {
            // 1. Récupérer le pdf_infos_id associé à cette facture
            const { data: factureData, error: factureError } = await supabase
                .from('facture')
                .select('pdf_infos_id')
                .eq('id', factureId)
                .single();

            if (factureError) throw factureError;

            // 2. Mettre à jour le statut du PDF à 'unread'
            const { error: pdfError } = await supabase
                .from('pdf_infos')
                .update({ status: 'unread' })
                .eq('id', factureData.pdf_infos_id);

            if (pdfError) throw pdfError;

            // 3. Supprimer toutes les factures associées à ce PDF
            const { error: deleteError } = await supabase
                .from('facture')
                .delete()
                .eq('pdf_infos_id', factureData.pdf_infos_id);

            if (deleteError) throw deleteError;

            // 4. Rafraîchir la page pour voir les changements
            window.location.reload();

        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
            alert('Erreur lors de la suppression de la facture');
        }
    };

    console.log("factureLines", factureLines);

    return (
        <div className="space-y-4">
            {factureLines.map((factureLine) => (
                <div 
                    key={factureLine.id} 
                    className={`relative p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md
                        ${selectedFacture?.id === factureLine.id
                            ? 'border-blue-500 bg-blue-50/50' 
                            : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                >
                    {/* En-tête avec radio et prestataire */}
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center space-x-2">
                            <input
                                type="radio"
                                name="facture"
                                checked={selectedFacture?.id === factureLine.id}
                                onChange={() => setSelectedFacture({ id: factureLine.id })}
                                className="w-4 h-4 text-blue-600"
                            />
                            <h3 className="font-medium text-gray-900">
                                {factureLine.infos_json.header.prestataire_nom}
                            </h3>
                        </div>
                        <span className="text-sm text-gray-500">
                            {new Date(factureLine.created_at).toLocaleDateString('fr-FR')}
                        </span>
                    </div>

                    {/* Informations principales */}
                    <div className="bg-white rounded-lg p-4 border border-gray-100">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <p className="text-sm text-gray-600">{factureLine.infos_json.depart.line_header.type_dechet}</p>
                                <p className="text-xs text-gray-500">{factureLine.infos_json.depart.line_header.code_dechet}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">{new Date(factureLine.infos_json.depart.line_header.date_collecte).toLocaleDateString('fr-FR')}</p>
                                <p className="text-xs text-gray-500">{factureLine.infos_json.depart.line_header.lieu_collecte}</p>
                            </div>
                        </div>

                        {/* Opérations avec montant > 0 */}
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-3">
                                {factureLine.infos_json.depart.line_body
                                    .filter(op => op.montant_ht > 0)
                                    .map((operation, opIndex) => (
                                        <div 
                                            key={opIndex} 
                                            className="flex justify-start items-center rounded"
                                        >
                                            <span className="text-sm text-gray-700 bg-gray-200 px-1 rounded-l-md">{operation.type_operation}</span>
                                            <span className="text-sm font-medium bg-gray-200 text-gray-900 pr-1 rounded-r-md">{operation.montant_ht}€</span>
                                        </div>
                                    ))}
                            </div>
                        </div>

                        {/* Commentaire */}
                        {factureLine.infos_json.depart.commentaire && (
                            <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                                <p className="text-sm text-yellow-800">
                                    📝 {factureLine.infos_json.depart.commentaire}
                                </p>
                            </div>
                        )}

                        {/* Total */}
                        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700">Total HT</span>
                            <span className="text-lg font-semibold text-gray-900">
                                {factureLine.infos_json.footer.total_ht}€
                            </span>
                        </div>
                    </div>

                    {/* Bouton de suppression */}
                    <button
                        onClick={() => {
                            if (window.confirm('Êtes-vous sûr de vouloir supprimer cette facture ?')) {
                                handleDelete(factureLine.id);
                            }
                        }}
                        className="absolute top-0.5 right-0.5 text-gray-400 hover:text-red-500 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </button>
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