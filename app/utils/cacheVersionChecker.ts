/**
 * Système de versioning du cache pour synchroniser tous les utilisateurs
 * 
 * Principe :
 * - Redis stocke une version (timestamp) pour chaque entreprise
 * - Chaque modification incrémente cette version
 * - Avant d'utiliser le cache localStorage, on vérifie si la version locale correspond à la version serveur
 * - Si différente → cache local obsolète → rechargement
 * 
 * Avantages :
 * - Multi-utilisateurs synchronisés en temps réel
 * - 1 seule requête HTTP légère (GET)
 * - Fonctionne même si utilisateurs sur différents ordinateurs
 */

/**
 * Récupère la version actuelle du cache depuis Redis
 */
export const getServerCacheVersion = async (entreprise_id: string): Promise<number> => {
    try {
        const response = await fetch(`/api/get_cache_version?entreprise_id=${entreprise_id}`, {
            cache: 'no-store' // Ne pas mettre en cache cette requête
        });
        
        if (!response.ok) {
            console.warn('⚠️ Impossible de récupérer la version serveur, utilisation timestamp actuel');
            return Date.now();
        }
        
        const data = await response.json();
        return data.version || Date.now();
    } catch (error) {
        console.error('❌ Erreur récupération version cache:', error);
        return Date.now();
    }
};

/**
 * Vérifie si le cache local est à jour en comparant avec la version serveur
 */
export const isCacheUpToDate = async (entreprise_id: string, cacheType: 'sites' | 'waste-names' | 'analysis-bsds'): Promise<boolean> => {
    try {
        // 1. Récupérer la version serveur
        const serverVersion = await getServerCacheVersion(entreprise_id);
        
        // 2. Récupérer la version locale
        const localVersionKey = `cache-version-${cacheType}-${entreprise_id}`;
        const localVersion = localStorage.getItem(localVersionKey);
        
        if (!localVersion) {
            console.log(`📦 Pas de version locale pour ${cacheType}`);
            return false;
        }
        
        // 3. Comparer
        const isUpToDate = localVersion === String(serverVersion);
        
        if (isUpToDate) {
            console.log(`✅ Cache ${cacheType} à jour (version ${serverVersion})`);
        } else {
            console.log(`⚠️ Cache ${cacheType} obsolète (local: ${localVersion}, serveur: ${serverVersion})`);
        }
        
        return isUpToDate;
    } catch (error) {
        console.error('❌ Erreur vérification version cache:', error);
        return false; // En cas d'erreur, considérer le cache comme obsolète
    }
};

/**
 * Sauvegarde la version actuelle du cache
 */
export const saveCacheVersion = async (entreprise_id: string, cacheType: 'sites' | 'waste-names' | 'analysis-bsds'): Promise<void> => {
    try {
        const serverVersion = await getServerCacheVersion(entreprise_id);
        const localVersionKey = `cache-version-${cacheType}-${entreprise_id}`;
        localStorage.setItem(localVersionKey, String(serverVersion));
        console.log(`💾 Version ${cacheType} sauvegardée: ${serverVersion}`);
    } catch (error) {
        console.error('❌ Erreur sauvegarde version cache:', error);
    }
};

