// Fonction pour invalider le cache localStorage des sites
const invalidateSitesLocalStorage = (entreprise_id: string): void => {
    try {
        localStorage.removeItem(`sites-processed-${entreprise_id}`);
        localStorage.removeItem(`cache-version-sites-${entreprise_id}`);
        console.log(`✅ Cache localStorage des sites invalidé`);
    } catch (error) {
        console.error('❌ Erreur invalidation cache sites localStorage:', error);
    }
};

// Fonction pour invalider le cache localStorage des noms de déchets
const invalidateWasteNamesLocalStorage = (entreprise_id: string): void => {
    try {
        localStorage.removeItem(`waste-names-processed-${entreprise_id}`);
        localStorage.removeItem(`cache-version-waste-names-${entreprise_id}`);
        console.log(`✅ Cache localStorage des noms de déchets invalidé`);
    } catch (error) {
        console.error('❌ Erreur invalidation cache noms localStorage:', error);
    }
};

// Fonction pour invalider le cache localStorage des BSDs d'analyse
const invalidateAnalysisBSDsLocalStorage = (entreprise_id: string): void => {
    try {
        localStorage.removeItem(`analysis-bsds-${entreprise_id}`);
        localStorage.removeItem(`cache-version-analysis-bsds-${entreprise_id}`);
        console.log(`✅ Cache localStorage des BSDs d'analyse invalidé`);
    } catch (error) {
        console.error('❌ Erreur invalidation cache BSDs localStorage:', error);
    }
};

// Fonction centralisée qui invalide TOUS les caches (API Redis + localStorage des filtres)
// 
// ⚠️ AMÉLIORATION FUTURE : Invalidation sélective
// Actuellement, cette fonction invalide TOUT (même pour une petite modification).
// Pour optimiser les performances :
// - Ajouter un paramètre optionnel `options: { skipAnalysis?: boolean, skipFilters?: boolean }`
// - Permettre l'invalidation ciblée selon le type de modification
// - Exemple : Modifier un commentaire → invalider seulement Redis, pas les filtres/analyse
// - Exemple : Supprimer un BSD → invalider tout
//
export const invalidateCache = async (entreprise_id: string|null, user_id: string|null) => {
    if (!entreprise_id || !user_id) return;
    
    try {
        // 1. Invalider le cache API Redis (pour les BSDs du registre)
        // Cette API incrémente aussi la cache_version dans Redis pour synchroniser tous les clients
        const response = await fetch('/api/invalidate_bsd_cache', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                entreprise_id,
                user_id,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to invalidate cache');
        }

        console.log('✅ Cache API Redis invalidé + version incrémentée');
        
        // 2. Invalider les caches localStorage locaux (pour CET utilisateur)
        invalidateSitesLocalStorage(entreprise_id);
        invalidateWasteNamesLocalStorage(entreprise_id);
        invalidateAnalysisBSDsLocalStorage(entreprise_id);
        
        console.log('✅ Tous les caches invalidés avec succès (Redis + localStorage local)');
        console.log('ℹ️ Les autres utilisateurs recevront la nouvelle version au prochain chargement');
    } catch (error) {
        console.error('Error invalidating cache:', error);
    }
};