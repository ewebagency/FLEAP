export type FilterType = 'all' | 'imported' | 'registres' | 'demandes';

/**
 * Apply the high-level filterType to a list of items using provided accessors.
 * - imported: exclut les demandes de collecte (registre normal)
 * - demandes: uniquement les demandes de collecte
 * - registres: status_track_dechets === 'IMPORTED'
 * - all: no extra filter
 */
export function applyFilterType<T>(
  items: T[],
  filterType: FilterType,
  opts: { getStatus: (item: T) => string | undefined; getCreatedOnFleap: (item: T) => boolean | undefined }
): T[] {
  switch (filterType) {
    case 'imported':
      //return items.filter((it) => opts.getCreatedOnFleap(it) === false);
      return items.filter((it) => !(
           opts.getStatus(it) === "Ligne demandée" 
        || opts.getStatus(it) === "Ligne créée" 
        || opts.getStatus(it) === "Ligne créée automatiquement" 
        || opts.getStatus(it) === "Ligne validée"
        || opts.getStatus(it) === "Traitée"
        || opts.getStatus(it) === "Traité"
        || opts.getStatus(it) === "Collecté"
        || opts.getStatus(it) === "Collecte demandée"
        || opts.getStatus(it) === "Brouillon"
        || opts.getStatus(it) === "Brouillon Local"
        || opts.getStatus(it) === "Accepté"
      ));
    case 'demandes':
      // Inverse de 'imported' : uniquement les demandes de collecte
      return items.filter((it) => (
           opts.getStatus(it) === "Ligne demandée" 
        || opts.getStatus(it) === "Ligne créée" 
        || opts.getStatus(it) === "Ligne créée automatiquement" 
        || opts.getStatus(it) === "Ligne validée"
        || opts.getStatus(it) === "Traitée"
        || opts.getStatus(it) === "Traité"
        || opts.getStatus(it) === "Collecté"
        || opts.getStatus(it) === "Collecte demandée"
        || opts.getStatus(it) === "Brouillon"
        || opts.getStatus(it) === "Brouillon Local"
        || opts.getStatus(it) === "Accepté"
      ));
    case 'registres':
      return items.filter((it) => opts.getStatus(it) === 'IMPORTED');
    case 'all':
    default:
      return items;
  }
}


