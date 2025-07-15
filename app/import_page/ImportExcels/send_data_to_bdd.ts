import { supabase } from '@/app/database/supabaseClient';
import toast from 'react-hot-toast';
import { RowBSDPreview } from './ButtonImportExcels';


// Fonction pour récupérer tous les readable_id_track_dechets existants
const getExistingReadableIds = async (entreprise_id: string): Promise<string[]> => {
  const existingIds: string[] = [];
  let from = 0;
  const limit = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('bsd')
      .select('readable_id_track_dechets')
      .eq('entreprise_id', entreprise_id)
      .range(from, from + limit - 1);
      
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    // Filtrer les IDs non-null côté client
    data.forEach(row => {
      if (row.readable_id_track_dechets && row.readable_id_track_dechets.trim() !== '') {
        existingIds.push(row.readable_id_track_dechets);
      }
    });
    
    // Si on a moins de 1000 résultats, on a fini
    if (data.length < limit) break;
    from += limit;
  }
  
  return existingIds;
};

// Fonction pour envoyer les données vers Supabase
const sendToSupabase = async (
  rowBSD: RowBSDPreview,
  existingReadableIds: Set<string>
): Promise<{ success: boolean; skipped?: boolean; reason?: string }> => {
  
  // Vérification du doublon
  if (rowBSD.readable_id_track_dechets && existingReadableIds.has(rowBSD.readable_id_track_dechets)) {
    console.log(`Doublon détecté pour ${rowBSD.readable_id_track_dechets}, ignoré`);
    return { success: false, skipped: true, reason: 'duplicate' };
  }
  
  try {
    const { data, error } = await supabase
      .from('bsd')
      .insert({
        user_id: rowBSD.user_id,
        entreprise_id: rowBSD.entreprise_id,
        infos_json: rowBSD.infos_json,
        other_infos: rowBSD.other_infos,
        status_track_dechets: rowBSD.status_track_dechets,
        created_at: rowBSD.created_at,
        readable_id_track_dechets: rowBSD.readable_id_track_dechets,
        source: rowBSD.source,
        created_on_fleap: false,
      });

    if (error) {
      console.error('Erreur lors de l\'insertion:', error);
      return { success: false, reason: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Erreur lors de l\'envoi vers Supabase:', error);
    return { success: false, reason: 'Erreur inconnue' };
  }
};

// Fonction principale pour envoyer toutes les données
export const sendDataToBdd = async (
  dataReadyToSend: RowBSDPreview[],
  entreprise_id: string
): Promise<{ 
  success: boolean; 
  importedCount: number; 
  skippedCount: number; 
  errorCount: number;
  errors: string[];
}> => {
  
  if (!entreprise_id) {
    toast.error('Entreprise non trouvée');
    return { 
      success: false, 
      importedCount: 0, 
      skippedCount: 0, 
      errorCount: 0,
      errors: ['Entreprise non trouvée']
    };
  }

  try {
    // Récupérer tous les IDs existants
    const existingIds = await getExistingReadableIds(entreprise_id);
    const existingIdsSet = new Set(existingIds);
    
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Traiter chaque ligne
    for (const rowBSD of dataReadyToSend) {
      const result = await sendToSupabase(rowBSD, existingIdsSet);
      
      if (result.skipped) {
        skippedCount++;
        toast.error(`Ligne ignorée (doublon): ${rowBSD.readable_id_track_dechets}`);
      } else if (result.success) {
        importedCount++;
        toast.success(`Ligne importée avec succès: ${rowBSD.readable_id_track_dechets}`);
      } else {
        errorCount++;
        const errorMsg = `Erreur pour ${rowBSD.readable_id_track_dechets}: ${result.reason}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    // Afficher les résultats
    if (importedCount > 0) {
      toast.success(`${importedCount} lignes importées avec succès`);
    }
    if (skippedCount > 0) {
      toast.error(`${skippedCount} doublons ignorés`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} erreurs lors de l'import`);
    }

    return {
      success: errorCount === 0,
      importedCount,
      skippedCount,
      errorCount,
      errors
    };

  } catch (error) {
    console.error('Erreur lors de l\'envoi des données:', error);
    toast.error('Erreur lors de l\'envoi des données');
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      errorCount: dataReadyToSend.length,
      errors: ['Erreur lors de l\'envoi des données']
    };
  }
};
