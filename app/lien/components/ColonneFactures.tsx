import { supabase } from '@/app/database/supabaseClient';
import FactureLine from "../interface/facture_line";

interface SelectedFacture {
  id: string;
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

    return (
        <div className="space-y-4">
            {factureLines.map((factureLine) => (
                
                <div 
                key={factureLine.id} 
                    className={`relative p-4 rounded-lg border transition-all duration-200
                        ${(selectedFacture?.id === factureLine.id)
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                >
                    <div className="absolute top-4 right-4">
                        <input
                            type="radio"
                            name="facture"
                            checked={selectedFacture?.id === factureLine.id}
                            onChange={() => setSelectedFacture({
                                id: factureLine.id
                            })}
                            className="w-4 h-4 text-blue-600"
                        />
                    </div>
                    <div className="font-semibold text-gray-800 ml-5">
                        {new Date(factureLine.infos_json.depart.date_collecte).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </div>
                    <div className="flex justify-between mb-4">
                        <div className="text-xs text-gray-600 mt-2">ID : {factureLine.id}</div>
                    </div>
        
                    <div className="text-xs text-gray-600 mt-2 mb-4">
                        {factureLine.infos_json.header.prestataire_nom}
                    </div>
                    <div className="flex justify-between gap-2 mb-2">
                        <div className="text-xs text-gray-600 mt-2">
                            <p>CED : {factureLine.infos_json.depart.code_dechet}</p>
                            <p>{factureLine.infos_json.depart.type_dechet}</p>
                        </div>
                        <div className="text-xs text-gray-600 mt-2">
                            {factureLine.infos_json.depart.type_operation}
                        </div>
                    </div>
                    <div className="flex justify-between gap-2">
                        <div className="text-xs text-gray-600 mt-2">
                            Lieu : {factureLine.infos_json.depart.lieu_collecte}
                        </div>
                        <div className="text-xs text-gray-600 mt-2">
                            Montant HT : {factureLine.infos_json.depart.montant_ht}
                        </div>
                    </div>
                    
                    {/* Bouton de suppression */}
                    <button
                        onClick={() => {
                            if (window.confirm('Êtes-vous sûr de vouloir supprimer cette facture ? Le PDF associé sera remis dans la file de traitement.')) {
                                handleDelete(factureLine.id);
                            }
                        }}
                        className="absolute top-4 left-3 text-red-500 hover:text-red-700"
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