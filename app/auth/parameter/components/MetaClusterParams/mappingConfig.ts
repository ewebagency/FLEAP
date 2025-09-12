// Configuration des types de mapping
export interface MappingTypeConfig {
    key: string; // Clé dans la base de données (ex: params_mapping_site)
    label: string; // Label affiché dans l'interface
    description: string; // Description du type de mapping
    rawField: string; // Champ dans pdf_infos.infos_raw à extraire
    rawFieldType?: 'simple' | 'array'; // Type de champ (simple ou tableau)
    rawFieldPath?: string; // Chemin dans le tableau (ex: 'nom' pour dechet[].nom)
    metaSource: 'autocompletion' | 'hardcoded' | 'database' | 'dynamic'; // Source des valeurs de référence
    metaField?: string; // Champ dans table_autocompletion (si applicable)
    hardcodedValues?: string[]; // Valeurs codées en dur (si applicable)
    displayFormat: 'simple' | 'withCode'; // Format d'affichage
}

export const MAPPING_CONFIGS: MappingTypeConfig[] = [
    {
        key: 'params_mapping_site',
        label: 'Sites',
        description: 'Associer les sites bruts aux sites métas',
        rawField: 'site_raw',
        rawFieldType: 'simple',
        metaSource: 'autocompletion',
        metaField: 'site',
        displayFormat: 'withCode'
    },
    {
        key: 'params_mapping_presta',
        label: 'Prestataires',
        description: 'Associer les prestataires bruts aux prestataires métas (transporteurs et destinataires)',
        rawField: 'presta_raw',
        rawFieldType: 'simple',
        metaSource: 'autocompletion',
        metaField: 'presta',
        displayFormat: 'withCode'
    },
    {
        key: 'params_mapping_nom_dechet',
        label: 'Déchets',
        description: 'Associer les noms de déchets bruts aux déchets métas',
        rawField: 'dechet',
        rawFieldType: 'array',
        rawFieldPath: 'nom',
        metaSource: 'autocompletion',
        metaField: 'dechet',
        displayFormat: 'withCode'
    },
    {
        key: 'params_mapping_operation',
        label: 'Opérations',
        description: 'Associer les opérations brutes aux opérations métas',
        rawField: 'dechet',
        rawFieldType: 'array',
        rawFieldPath: 'facture.ligne.type_operation',
        metaSource: 'dynamic',
        displayFormat: 'simple'
    },
    {
        key: 'params_mapping_unite',
        label: 'Unités',
        description: 'Associer les unités brutes aux unités métas',
        rawField: 'dechet',
        rawFieldType: 'array',
        rawFieldPath: 'facture.ligne.unite',
        metaSource: 'dynamic',
        displayFormat: 'simple'
    },
    {
        key: 'params_mapping_contenant',
        label: 'Contenants',
        description: 'Associer les contenants bruts aux contenants métas',
        rawField: 'dechet',
        rawFieldType: 'array',
        rawFieldPath: 'contenant',
        metaSource: 'autocompletion',
        metaField: 'contenant',
        displayFormat: 'simple'
    }
];

// Types utilitaires
export interface MetaValue {
    id: string;
    nom: string;
    code?: string; // Pour les déchets (codeCED)
    siret?: string; // Pour les sites et prestataires
}

export interface RawValue {
    nom: string;
    typeDoc: string;
    pdfId: string;
    pdf_id: string;
    pdf_path?: string; // name_pdf_in_bucket pour ExtractDoc
    pdf_status?: string; // status pour ExtractDoc
}

export interface Mapping {
    [metaKey: string]: string[];
}