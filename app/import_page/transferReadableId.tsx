'use client';

import React, { useState } from 'react';
import { supabase } from '../database/supabaseClient';
import { useSession } from '../component/SessionProvider';
import { toast } from 'react-hot-toast';

const TransferReadableIdButton: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const { entreprise_id } = useSession();

    const handleTransferReadableId = async () => {
        if (!entreprise_id) {
            toast.error('Aucune entreprise sélectionnée');
            return;
        }

        setIsLoading(true);
        
        try {
            let updatedCount = 0;
            let skippedCount = 0;
            let totalProcessed = 0;
            let hasMore = true;
            let from = 0;
            const pageSize = 1000; // Limite Supabase par défaut

            // Récupérer tous les BSDs de l'entreprise avec pagination
            while (hasMore) {
                const { data: bsds, error: fetchError } = await supabase
                    .from('bsd')
                    .select('id, readable_id_track_dechets, infos_json')
                    //.eq('entreprise_id', entreprise_id)
                    .range(from, from + pageSize - 1)
                    .order('id', { ascending: true });

                if (fetchError) {
                    console.error('Erreur lors de la récupération des BSDs:', fetchError);
                    toast.error('Erreur lors de la récupération des données');
                    return;
                }

                if (!bsds || bsds.length === 0) {
                    if (totalProcessed === 0) {
                        toast.success('Aucun BSD trouvé pour cette entreprise');
                    }
                    break;
                }

                // Traiter chaque BSD de cette page
                for (const bsd of bsds) {
                    totalProcessed++;
                    
                    // Vérifier si readable_id_track_dechets est null
                    if (!bsd.readable_id_track_dechets) {
                                            // Récupérer le readableId depuis infos_json
                    const readableId = bsd.infos_json?.formAPI?.createFormInput?.readableId;
                    
                    if (readableId && readableId.trim() !== '') {
                            // Mettre à jour le BSD
                            const { error: updateError } = await supabase
                                .from('bsd')
                                .update({ readable_id_track_dechets: readableId })
                                .eq('id', bsd.id);

                            if (updateError) {
                                console.error(`Erreur lors de la mise à jour du BSD ${bsd.id}:`, updateError);
                            } else {
                                updatedCount++;
                            }
                        }
                    } else {
                        skippedCount++;
                    }
                }

                // Vérifier s'il y a plus de données à récupérer
                if (bsds.length < pageSize) {
                    hasMore = false;
                } else {
                    from += pageSize;
                }

                // Afficher le progrès pour les grandes entreprises
                if (totalProcessed % 1000 === 0) {
                    console.log(`Progression: ${totalProcessed} BSDs traités...`);
                }
            }

            toast.success(`Mise à jour terminée ! ${updatedCount} BSDs mis à jour, ${skippedCount} ignorés sur ${totalProcessed} traités`);
            console.log(`Transfert terminé: ${updatedCount} mis à jour, ${skippedCount} ignorés sur ${totalProcessed} traités`);

        } catch (error) {
            console.error('Erreur lors du transfert:', error);
            toast.error('Erreur lors du transfert des IDs');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={handleTransferReadableId}
            disabled={isLoading || !entreprise_id}
            className={`
                px-4 py-2 rounded-md font-medium transition-colors
                ${isLoading || !entreprise_id
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }
            `}
        >
            {isLoading ? (
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Transfert en cours...
                </div>
            ) : (
                'Transférer les Readable IDs'
            )}
        </button>
    );
};

export default TransferReadableIdButton;
