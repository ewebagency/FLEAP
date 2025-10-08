/**
 * Calcul du taux de couverture des champs extraits
 * Parcourt récursivement infos_raw pour compter les champs remplis vs vides
 * Le template complet est déjà dans infos_raw (généré par backend-python/new/new_structure.py)
 */

/**
 * Vérifie si une valeur est considérée comme "remplie"
 */
function isFieldFilled(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (typeof value === 'number') return true;
    if (typeof value === 'boolean') return true;
    // Pour les arrays et objets, on les traite récursivement
    return false;
}

/**
 * Champs à ignorer dans le comptage (méta-données, pas des champs d'extraction)
 */
const IGNORED_FIELDS = new Set(['type_doc', 'facture', 'ligne']);

/**
 * Parcourt récursivement un objet et compte les champs remplis vs vides
 */
function countFields(obj: unknown, depth = 0): { filled: number; total: number } {
    let filled = 0;
    let total = 0;

    // Limiter la profondeur pour éviter les boucles infinies
    if (depth > 10) return { filled, total };

    if (Array.isArray(obj)) {
        // Pour un array, on compte la moyenne de couverture de chaque élément
        for (const item of obj) {
            const itemCount = countFields(item, depth + 1);
            filled += itemCount.filled;
            total += itemCount.total;
        }
    } else if (obj !== null && typeof obj === 'object') {
        // Pour un objet, on parcourt chaque propriété
        const record = obj as Record<string, unknown>;
        
        for (const [key, value] of Object.entries(record)) {
            // Ignorer les champs méta
            if (IGNORED_FIELDS.has(key)) {
                // Mais on doit quand même explorer leurs sous-propriétés
                if (typeof value === 'object' && value !== null) {
                    const subCount = countFields(value, depth + 1);
                    filled += subCount.filled;
                    total += subCount.total;
                }
                continue;
            }

            if (Array.isArray(value)) {
                // Si c'est un array, on le parcourt récursivement
                const arrayCount = countFields(value, depth + 1);
                filled += arrayCount.filled;
                total += arrayCount.total;
            } else if (value !== null && typeof value === 'object') {
                // Si c'est un objet, on le parcourt récursivement
                const objCount = countFields(value, depth + 1);
                filled += objCount.filled;
                total += objCount.total;
            } else {
                // C'est une valeur primitive (string, number, boolean)
                total += 1;
                if (isFieldFilled(value)) {
                    filled += 1;
                }
            }
        }
    }

    return { filled, total };
}

export interface CoverageResult {
    percentage: number;
    filledCount: number;
    totalCount: number;
}

/**
 * Calcule le taux de couverture des champs extraits
 * Parcourt récursivement infos_raw et compte les champs remplis
 */
export function calculateCoverage(
    infosRaw: unknown,
    documentType: string | null
): CoverageResult {
    // Valeurs par défaut si pas de données
    if (!infosRaw || typeof infosRaw !== 'object') {
        return {
            percentage: 0,
            filledCount: 0,
            totalCount: 0
        };
    }

    // Compter récursivement tous les champs
    const { filled, total } = countFields(infosRaw);

    // Calculer le pourcentage
    const percentage = total > 0 ? Math.round((filled / total) * 100) : 0;

    return {
        percentage,
        filledCount: filled,
        totalCount: total
    };
}

/**
 * Retourne la couleur du badge selon le pourcentage
 */
export function getCoverageColor(percentage: number): string {
    if (percentage >= 90) return 'bg-green-100 text-green-700';
    if (percentage >= 75) return 'bg-yellow-100 text-yellow-700';
    if (percentage >= 50) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
}

