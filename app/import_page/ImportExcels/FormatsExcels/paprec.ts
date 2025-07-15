import { sendDataToBdd } from '../send_data_to_bdd';

// Types pour les données Excel
interface ExcelData {
  nom_fichier: string;
  presta: {
    id: number;
    type: 'transporteur' | 'destinataire';
    nom: string;
    siret?: string;
    email?: string;
    nomBoite?: string;
    nomPrenom?: string;
    adresse?: string;
    telephone?: string;
  };
  site: {
    id: number;
    nom: string;
    siret: string;
    adresseSiege: string;
    pointsCollecte: { nom: string; adresse: string; }[];
  };
  excel_data: { [sheetName: string]: unknown[] };
  sheets: string[];
  nombre_sheets: number;
  nombre_lignes_total: number;
  nombre_lignes_par_sheet: { [sheetName: string]: number };
  date_import: string;
}

// Types pour les opérations de mapping
type MappingOperation = 
  | { target: string; source: string; op: "copy" }
  | { target: string; source: string; op: "divide"; by: number }
  | { target: string; op: "constant"; value: string | ((data_excel: ExcelData) => string) }
  | { 
      target: string; 
      op: "formula"; 
      formula: (args: { [key: string]: string | number }) => string; 
      dependencies: string[] 
    };

// Fonction de debug pour comparer les headers
const debugModelDetection = (model: { name: string; mapping: MappingOperation[] }, headers: string[]) => {
  console.log(`\n=== Debug détection modèle: ${model.name} ===`);
  const sourcesWithSource = model.mapping.filter(map => 'source' in map) as Array<{ target: string; source: string; op: string }>;
  
  console.log('Headers disponibles:', headers);
  console.log('Sources requises par le modèle:');
  
  sourcesWithSource.forEach(map => {
    const found = headers.includes(map.source);
    console.log(`  ${map.source}: ${found ? '✅' : '❌'}`);
  });
  
  const missingSources = sourcesWithSource.filter(map => !headers.includes(map.source));
  if (missingSources.length > 0) {
    console.log('Sources manquantes:', missingSources.map(m => m.source));
  }
};

// Mappings complets pour Paprec avec les targets exacts demandés
const PAPREC_MAPPINGS: Array<{ [standard: string]: string }> = [
  {
    // Premier mapping - correspondance avec les targets demandés
    codeCed: "Code déchets entrants",
    descDechet: "Libéllé qualité",
    numeroBsd: "numéro de bordereau de suivi de déchets",
    nomSiteEmetteur: "Nom de l'installation de provenance des déchets",
    adresseCollecte: "Adresse de l'installation de provenance des déchets",
    codePostalCollecte: "Code Postal de l'installation de provenance des déchets",
    villeCollecte: "Ville de l'installation de provenance des déchets",
    paysCollecte: "Pays de l'installation de provenance des déchets",
    nomTransporteur: "Nom du ou des transporteurs",
    adresseTransporteur: "Adresse du ou des transporteurs",
    recepisseTransporteur: "numéros de récépissé de transport du ou des transporteurs",
    annexeVii: "numéro de l'annexe VII en cas de transport transfrontalier",
    codeTraitementPrevuInstallationDestination: "Code de traitement opéré",
    cubage: "Cubage",
    contrat: "Contrat",
    valorisation: "Valorisation",
    dateCollecteTransporteur: "Date de réception",
    quantiteEstimeeReelleTransporteur: "Quantités"
  },
  {
    // Deuxième mapping - déjà correct
    dateCollecteTransporteur: "Date Reception",
    ticketNumero: "N° Ticket",
    beNumero: "Nr BE",
    codeQualite: "Code Qualité",
    descDechet: "Libelle Qualité",
    quantiteEstimeeReelleTransporteur: "Poids",
    uniteMesure: "Unite Mesure",
    codeCed: "Code Dechet Entrant",
    codeTraitementPrevuInstallationDestination: "Code Traitement",
    contrat: "Contrat",
    nomSiteEmetteur: "Nom Installation Provenance Dechet",
    adresseCollecte: "Adresse Installation Provenance Dechet",
    codePostalCollecte: "Code Postal Installation Provenance Dechet",
    villeCollecte: "Ville Installation Provenance Dechet",
    paysCollecte: "Pays Installation Provenance Dechet",
    nomTransporteur: "Nom Transporteur",
    adresseTransporteur: "Adresse Transporteur",
    recepisseTransporteur: "Nr Recepisse Transp",
    immatriculationTransporteur: "Immatriculation",
    numeroBsd: "N° BSD",
    cubage: "Cubage",
    valorisation: "Valorisation"
  }
];

// Type pour les données standardisées (tous les champs possibles)
type StandardizedData = { [standard: string]: string | number };

// Type pour les données prêtes à envoyer
interface RowBSD {
  created_at: string;
  user_id: string;
  entreprise_id: string;
  infos_json: {
    formAPI: {
      createFormInput: {
        readableId: string;
        takenOverAt: string;
        emitter: {
          type: string;
          company: {
            name: string;
            siret: string;
            orgId: string;
            address: string;
            country: string;
            contact: string;
            phone: string;
            mail: string;
          };
          workSite: {
            name: string;
            address: string;
            city: string;
            postalCode: string;
            infos: string;
          };
        };
        transporter: {
          company: {
            name: string;
            siret: string;
            orgId: string;
            address: string;
            country: string;
            contact: string;
            phone: string;
            mail: string;
          };
          takenOverAt: string;
          isExemptedOfReceipt: boolean;
          receipt: string | undefined;
          numberPlate: string | undefined;
        };
        recipient: {
          company: {
            name: string;
            siret: string;
            orgId: string;
            address: string;
            country: string;
            contact: string;
            phone: string;
            mail: string;
          };
          cap: string;
          processingOperation: string;
          valoParts: Array<{
            code_valo: string;
            tonnage: number;
          }>;
        };
        wasteDetails: {
          code: string;
          name: string;
          isSubjectToADR: boolean;
          onuCode: string;
          packagingInfos: Array<{
            type: string;
            quantity: number;
          }>;
          quantity: number;
          quantityType: "REAL";
          consistence: string;
          pop: boolean;
          isDangerous: boolean;
          parcelNumbers: {
            city: string;
            postalCode: string;
          };
        };
      };
    };
  };
  other_infos: {
    volume: string;
    volumeUnit: string;
  };
  status_track_dechets: string;
  readable_id_track_dechets: string;
  source: string;
}

// Fonctions de transformation
const formatCodeCed = (codeCed: string): string => {
  // Mettre en format 00 00 00
  if (!codeCed) return "";
  // Supprimer tous les espaces et caractères non numériques
  const cleanCode = codeCed.replace(/[^\d]/g, "");
  // Ajouter des espaces tous les 2 chiffres
  return cleanCode.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return "";
  
  // Gérer les numéros de série Excel (nombre de jours depuis 1900-01-01)
  const excelSerialNumber = parseFloat(dateStr);
  if (!isNaN(excelSerialNumber) && excelSerialNumber > 1000) {
    // Convertir le numéro de série Excel en date
    // Excel compte les jours depuis le 1er janvier 1900
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (excelSerialNumber - 2) * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0]; // Format YYYY-MM-DD
  }
  
  // Essayer de parser comme une date normale
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]; // Format YYYY-MM-DD
    }
  } catch {
    // Ignorer les erreurs de parsing
  }
  
  // Si rien ne fonctionne, retourner l'original
  return dateStr;
};

const formatFloat = (value: string): number => {
  if (!value) return 0;
  const num = parseFloat(value.replace(",", "."));
  return isNaN(num) ? 0 : num;
};

const getTransporteur = (data_excel: ExcelData): {nomBoite: string, siret: string, email: string, telephone: string, nomPrenom: string, adresse: string} => {
  // Retourner les infos du transporteur si c'est un transporteur, sinon vide
  return data_excel.presta.type === 'transporteur' ? 
    { nomBoite: data_excel.presta.nomBoite || "", siret: data_excel.presta.siret || "", email: data_excel.presta.email || "", telephone: data_excel.presta.telephone || "", nomPrenom: data_excel.presta.nomPrenom || "", adresse: data_excel.presta.adresse || "" } : 
    { nomBoite: "", siret: "", email: "", telephone: "", nomPrenom: "", adresse: "" };
};

const getDestinataire = (data_excel: ExcelData): {nomBoite: string, siret: string, email: string, telephone: string, nomPrenom: string, adresse: string} => {
  // Retourner les infos du destinataire si c'est un destinataire, sinon vide
  return data_excel.presta.type === 'destinataire' ? 
    { nomBoite: data_excel.presta.nomBoite || "", siret: data_excel.presta.siret || "", email: data_excel.presta.email || "", telephone: data_excel.presta.telephone || "", nomPrenom: data_excel.presta.nomPrenom || "", adresse: data_excel.presta.adresse || "" } : 
    { nomBoite: "", siret: "", email: "", telephone: "", nomPrenom: "", adresse: "" };
};

// Fonction utilitaire pour convertir en string
const toString = (value: string | number): string => {
  return String(value);
};

// Fonction utilitaire pour convertir en number
const toNumber = (value: string | number): number => {
  if (typeof value === 'number') return value;
  const num = parseFloat(String(value).replace(",", "."));
  return isNaN(num) ? 0 : num;
};

// Champs à transformer (exemple: diviser, formules, etc.)
const EXTRA_FIELDS: MappingOperation[][] = [
  // Pour le premier mapping
  [
    // Transformations des champs existants
    { target: "codeCed", source: "Code déchets entrants", op: "copy" }, // Sera transformé après
    { target: "dateCollecteTransporteur", source: "Date de réception", op: "copy" }, // Sera transformé après
    { target: "quantiteEstimeeReelleTransporteur", source: "Quantités", op: "divide", by: 1000 },
    { target: "codeTraitementPrevuInstallationDestination", source: "Code de traitement opéré", op: "copy" },

    { target: "nomSiteEmetteur", op: "constant", value: (data_excel: ExcelData) => data_excel.site.nom || "" },
    { target: "siretEmetteur", op: "constant", value: (data_excel: ExcelData) => data_excel.site.siret || "" },
    { target: "nomPointCollecte", op: "constant", value: (data_excel: ExcelData) => data_excel.site?.pointsCollecte?.[0]?.nom || "" },
    { target: "adresseCollecte", op: "constant", value: (data_excel: ExcelData) => data_excel.site?.pointsCollecte?.[0]?.adresse || "" },
    
    // Nouveaux targets avec formules
    { target: "valo1_dest", op: "constant", value: "R5" },
    {
      target: "tonnage1_dest",
      op: "formula",
      formula: (args: { [key: string]: string | number }) => {
        const valorisation = String(args.valorisation || "0");
        const quantite = typeof args.quantiteEstimeeReelleTransporteur === 'number' ? args.quantiteEstimeeReelleTransporteur : parseFloat(String(args.quantiteEstimeeReelleTransporteur || "0"));
        const v = parseFloat(valorisation.replace(",", "."));
        return (v * quantite).toString();
      },
      dependencies: ["valorisation", "quantiteEstimeeReelleTransporteur"]
    },
    { target: "valo2_dest", op: "constant", value: "D13" },
    {
      target: "tonnage2_dest",
      op: "formula",
      formula: (args: { [key: string]: string | number }) => {
        const valorisation = String(args.valorisation || "0");
        const quantite = typeof args.quantiteEstimeeReelleTransporteur === 'number' ? args.quantiteEstimeeReelleTransporteur : parseFloat(String(args.quantiteEstimeeReelleTransporteur || "0"));
        const v = parseFloat(valorisation.replace(",", "."));
        return ((1 - v) * quantite).toString();
      },
      dependencies: ["valorisation", "quantiteEstimeeReelleTransporteur"]
    },
    
    // Champs constants
    { target: "volumeUnitaire", op: "constant", value: "m3" },

    { target: "nomInstallationDestination", op: "constant", value: (data_excel: ExcelData) => getDestinataire(data_excel).nomBoite || "" },
    { target: "siretInstallationDestination", op: "constant", value: (data_excel: ExcelData) => getDestinataire(data_excel).siret || "" },
    { target: "adresseInstallationDestination", op: "constant", value: (data_excel: ExcelData) => getDestinataire(data_excel).adresse },

    { target: "nomTransporteur", op: "constant", value: (data_excel: ExcelData) => getTransporteur(data_excel).nomBoite || "" },
    { target: "siretTransporteur", op: "constant", value: (data_excel: ExcelData) => getTransporteur(data_excel).siret || "" },
  ],
  // Pour le second mapping
  [
    // Transformations des champs existants
    { target: "codeCed", source: "Code Dechet Entrant", op: "copy" }, // Sera transformé après
    { target: "dateCollecteTransporteur", source: "Date Reception", op: "copy" }, // Sera transformé après
    { target: "quantiteEstimeeReelleTransporteur", source: "Poids", op: "copy" },
    { target: "codeTraitementPrevuInstallationDestination", source: "Code Traitement", op: "copy" },

    { target: "nomSiteEmetteur", op: "constant", value: (data_excel: ExcelData) => data_excel.site.nom || "" },
    { target: "siretEmetteur", op: "constant", value: (data_excel: ExcelData) => data_excel.site.siret || "" },
    { target: "nomPointCollecte", op: "constant", value: (data_excel: ExcelData) => data_excel.site?.pointsCollecte?.[0]?.nom || "" },
    { target: "adresseCollecte", op: "constant", value: (data_excel: ExcelData) => data_excel.site?.pointsCollecte?.[0]?.adresse || "" },
    
    // Nouveaux targets avec formules
    { target: "valo1_dest", op: "constant", value: "R5" },
    {
      target: "tonnage1_dest",
      op: "formula",
      formula: (args: { [key: string]: string | number }) => {
        const valorisation = String(args.valorisation || "0");
        const quantite = typeof args.quantiteEstimeeReelleTransporteur === 'number' ? args.quantiteEstimeeReelleTransporteur : parseFloat(String(args.quantiteEstimeeReelleTransporteur || "0"));
        const v = parseFloat(valorisation.replace(",", "."));
        return (v * quantite).toString();
      },
      dependencies: ["valorisation", "quantiteEstimeeReelleTransporteur"]
    },
    { target: "valo2_dest", op: "constant", value: "D13" },
    {
      target: "tonnage2_dest",
      op: "formula",
      formula: (args: { [key: string]: string | number }) => {
        const valorisation = String(args.valorisation || "0");
        const quantite = typeof args.quantiteEstimeeReelleTransporteur === 'number' ? args.quantiteEstimeeReelleTransporteur : parseFloat(String(args.quantiteEstimeeReelleTransporteur || "0"));
        const v = parseFloat(valorisation.replace(",", "."));
        return ((1 - v) * quantite).toString();
      },
      dependencies: ["valorisation", "quantiteEstimeeReelleTransporteur"]
    },
    
    // Champs constants
    { target: "volumeUnitaire", op: "constant", value: "m3" },
    { target: "nomInstallationDestination", op: "constant", value: (data_excel: ExcelData) => getDestinataire(data_excel).nomBoite || "" },
    { target: "siretInstallationDestination", op: "constant", value: (data_excel: ExcelData) => getDestinataire(data_excel).siret || "" },
    { target: "adresseInstallationDestination", op: "constant", value: (data_excel: ExcelData) => getDestinataire(data_excel).adresse },

    { target: "nomTransporteur", op: "constant", value: (data_excel: ExcelData) => getTransporteur(data_excel).nomBoite || "" },
    { target: "siretTransporteur", op: "constant", value: (data_excel: ExcelData) => getTransporteur(data_excel).siret || "" },
  ]
];

// Génération dynamique des modèles
const MODELS = PAPREC_MAPPINGS.map((mapping, idx) => {
  // mapping: { [standard: string]: string }
  // Pour chaque champ standard, on crée une règle de mapping "copy"
  const mappingArr: MappingOperation[] = Object.entries(mapping).map(([standard, source]) => ({
    target: standard,
    source,
    op: "copy"
  }));
  // Ajoute les champs extra (divide, constant, formula, etc.)
  const fullMapping = [
    ...mappingArr,
    ...(EXTRA_FIELDS[idx] || [])
  ];
  return {
    name: `Paprec Format ${idx + 1}`,
    mapping: fullMapping
  };
});

const ready_to_send = (allStandardizedData: StandardizedData[], data_excel: ExcelData, user_id: string, entreprise_id: string): RowBSD[] => {
    const data_ready_to_send: RowBSD[] = [];
    allStandardizedData.forEach(row => {
        const newRow: RowBSD = {
            created_at: toString(row.dateCollecteTransporteur),
            user_id: user_id,
            entreprise_id: entreprise_id,
            infos_json: {
                formAPI: {
                    createFormInput: {
                        takenOverAt: toString(row.dateCollecteTransporteur),
                        readableId: toString(row.numeroBsd),
                        emitter: {
                            type: "PRODUCER",
                            company: {
                                name: toString(row.nomSiteEmetteur),
                                siret: toString(row.siretEmetteur),
                                orgId: toString(row.siretEmetteur),
                                address: toString(row.adresseCollecte),
                                country: "FR",
                                contact: "",
                                phone: "",
                                mail: "",
                            },
                            workSite: {
                                name: toString(row.nomPointCollecte),
                                address: toString(row.adresseCollecte),
                                city: "",
                                postalCode: "",
                                infos: "",
                            },
                            
                        },
                        transporter: {
                            company: {
                                name: toString(row.nomTransporteur),
                                siret: toString(row.siretTransporteur),
                                orgId: toString(row.siretTransporteur),
                                address: toString(row.adresseTransporteur),
                                country: "FR",
                                contact: toString(row.nomPrenomTransporteur || ""),
                                phone: toString(row.telephoneTransporteur || ""),
                                mail: toString(row.emailTransporteur || ""),
                            },
                            takenOverAt: toString(row.dateCollecteTransporteur),
                            isExemptedOfReceipt: false,
                            receipt: row.recepisseTransporteur ? toString(row.recepisseTransporteur) : undefined,
                            numberPlate: row.immatriculationTransporteur ? toString(row.immatriculationTransporteur) : undefined,
                        },
                        recipient: {
                            company: {
                                name: toString(row.nomInstallationDestination),
                                siret: toString(row.siretInstallationDestination),
                                orgId: toString(row.siretInstallationDestination),
                                address: "",
                                country: "FR",
                                contact: "",
                                phone: "",
                                mail: "",
                            },
                            cap: "",
                            processingOperation: toString(row.codeTraitementPrevuInstallationDestination),
                            valoParts: [
                                {
                                    code_valo: toString(row.valo1_dest),
                                    tonnage: toNumber(row.tonnage1_dest),
                                },
                                {
                                    code_valo: toString(row.valo2_dest),
                                    tonnage: toNumber(row.tonnage2_dest),
                                },
                            ]
                        },
                        wasteDetails: {
                            code: toString(row.codeCed),
                            name: toString(row.descDechet),
                            isSubjectToADR: false,
                            onuCode: "",
                            packagingInfos: [],
                            quantity: toNumber(row.quantiteEstimeeReelleTransporteur),
                            quantityType: "REAL",
                            consistence: "SOLIDE",
                            pop: false,
                            isDangerous: false,
                            parcelNumbers: {
                                city: "",
                                postalCode: "",
                            },
                        }

                    }
                }
            },
            other_infos: {
                volume: toString(row.cubage),
                volumeUnit: toString(row.volumeUnitaire),
            },
            status_track_dechets: "IMPORTED",
            readable_id_track_dechets: toString(row.numeroBsd),
            source : data_excel.nom_fichier,

        }
        data_ready_to_send.push(newRow);
    })
    return data_ready_to_send;
}

const standard_with_paprec = async (data_excel: ExcelData, user_id: string, entreprise_id: string): Promise<StandardizedData[]> => {
  const allStandardizedData: StandardizedData[] = [];

  Object.entries(data_excel.excel_data).forEach(([sheetName, sheetData]) => {
    if (!Array.isArray(sheetData) || sheetData.length < 2) return;
    const headers = Object.values(sheetData[0] as Record<string, unknown>).map((h) => String(h).trim());

    console.log(`\n=== Traitement de la feuille: ${sheetName} ===`);
    console.log('Headers détectés:', headers);

    // Debug: afficher tous les modèles
    /*MODELS.forEach(model => {
      debugModelDetection(model, headers);
    });*/

    // Détection du modèle : tous les sources du mapping doivent être présents dans les headers
    const model = MODELS.find(m => {
      const sourcesWithSource = m.mapping.filter(map => 'source' in map) as Array<{ target: string; source: string; op: string }>;
      return sourcesWithSource.every(map => headers.includes(map.source));
    });
    
    if (!model) {
      console.log('❌ Aucun modèle trouvé pour ces headers');
      return;
    }
    console.log('✅ Modèle utilisé:', model.name);

    // Associer chaque target à l'index de la colonne source (si applicable)
    const mappingIndexes: { [target: string]: number } = {};
    for (const map of model.mapping) {
      if ('source' in map) {
        const sourceMap = map as { target: string; source: string; op: string };
        mappingIndexes[map.target] = headers.findIndex(h => h === sourceMap.source);
      }
    }

    for (let i = 1; i < sheetData.length; i++) {
      const rowArray = Object.values(sheetData[i] as Record<string, unknown>).map((v) => v !== undefined && v !== null ? String(v).trim() : "");
      const standardizedRow: StandardizedData = {};
      
      // Appliquer le mapping de chaque colonne finale
      for (const map of model.mapping) {
        if (map.op === "copy" && 'source' in map) {
          const sourceMap = map as { target: string; source: string; op: string };
          const idx = mappingIndexes[map.target];
          const rawValue = (idx !== -1 && rowArray[idx] !== undefined) ? rowArray[idx] : "";
          
          // Appliquer les transformations spécifiques
          if (map.target === "codeCed") {
            standardizedRow[map.target] = formatCodeCed(rawValue);
          } else if (map.target === "dateCollecteTransporteur") {
            standardizedRow[map.target] = formatDate(rawValue);
          } else if (map.target === "quantiteEstimeeReelleTransporteur") {
            standardizedRow[map.target] = formatFloat(rawValue);
          } else {
            standardizedRow[map.target] = rawValue;
          }
        }
        if (map.op === "divide" && 'source' in map && 'by' in map) {
          const divideMap = map as { target: string; source: string; op: string; by: number };
          const idx = mappingIndexes[map.target];
          const val = (idx !== -1 && rowArray[idx] !== undefined) ? rowArray[idx] : "0";
          const dividedValue = (parseFloat(val.replace(",", ".")) / divideMap.by).toString();
          standardizedRow[map.target] = formatFloat(dividedValue);
        }
        if (map.op === "constant") {
          const constantMap = map as { target: string; op: string; value: string | ((data_excel: ExcelData) => string) };
          if (typeof constantMap.value === "function") {
            standardizedRow[map.target] = constantMap.value(data_excel);
          } else {
            standardizedRow[map.target] = constantMap.value ?? "";
          }
        }
        if (map.op === "formula" && 'formula' in map && 'dependencies' in map) {
          const formulaMap = map as { target: string; op: string; formula: (args: { [key: string]: string | number }) => string; dependencies: string[] };
          const args: { [key: string]: string | number } = {};
          for (const dep of formulaMap.dependencies) {
            args[dep] = standardizedRow[dep];
          }
          standardizedRow[map.target] = formulaMap.formula(args);
        }
      }
      allStandardizedData.push(standardizedRow);
    }
    console.log(`Lignes extraites de ${sheetName}:`, allStandardizedData.length);
    console.log("allStandardizedData", allStandardizedData);
  });

  console.log("Données standardisées prêtes pour prévisualisation");
  
  return allStandardizedData;
};

export default standard_with_paprec;



