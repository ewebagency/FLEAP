import { RowBSDPreview } from '../ButtonImportExcels';
// import { sendDataToBdd } from '../send_data_to_bdd';
import { ExcelData } from './ecobtp';


// Type pour les données standardisées
type StandardizedData = { 
  [standard: string]: string | number | boolean;
} & {
  rep?: { sent_to_rep: boolean };
};

// Mapping entre les colonnes du header et les champs standardisés
const CLASSIC_HEADER_MAPPING = [
  'codeCed',
  'descDechet',
  'numeroBsd',
  'tri',
  'nomSiteEmetteur',
  'nomPointCollecte',
  'adresseCollecte',
  'siretEmetteur',
  'nomTransporteur',
  'siretTransporteur',
  'recepisseTransporteur',
  'dateCollecteTransporteur',
  'quantiteEstimeeReelleTransporteur',
  'nomInstallationDestination',
  'siretInstallationDestination',
  'adresseInstallationDestination',
  'codeTraitementPrevuInstallationDestination',
  'volumeUnitaire',
  'valo1_dest',
  'tonnage1_dest',
  'valo2_dest',
  'tonnage2_dest',
  'valo3_dest',
  'tonnage3_dest'
];

const toString = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  return String(value);
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value.replace(',', '.'));
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value.toLowerCase() === '1' || value.toLowerCase() === 'oui';
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  return false;
};

// Fonction pour formater les codes CED (ajouter des espaces tous les 2 caractères)
const formatCodeCed = (codeCed: string): string => {
  if (!codeCed) return '';
  // Supprimer les espaces existants et formater
  const cleanCode = codeCed.replace(/\s/g, '');
  if (cleanCode.length === 6) {
    return `${cleanCode.slice(0, 2)} ${cleanCode.slice(2, 4)} ${cleanCode.slice(4, 6)}`;
  }
  return cleanCode; // Retourner tel quel si pas 6 caractères
};

// Fonction de formatage de date
const formatDate = (dateStr: string): string => {
  if (!dateStr) return "";
  
  // Gérer les numéros de série Excel (nombre de jours depuis 1900-01-01)
  const excelSerialNumber = parseFloat(dateStr);
  if (!isNaN(excelSerialNumber) && excelSerialNumber > 1000) {
    // Convertir le numéro de série Excel en date
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

// Fonction pour transformer les données standardisées en RowBSDPreview
const ready_to_send = (allStandardizedData: StandardizedData[], data_excel: ExcelData, user_id: string, entreprise_id: string): RowBSDPreview[] => {
  const data_ready_to_send: RowBSDPreview[] = [];
  
  allStandardizedData.forEach(row => {
    const newRow: RowBSDPreview = {
      created_at: String(row.dateCollecteTransporteur || ''),
      user_id: user_id,
      entreprise_id: entreprise_id,
      infos_json: {
        formAPI: {
          createFormInput: {
                    readableId: String(row.numeroBsd || ''),
        takenOverAt: String(row.dateCollecteTransporteur || ''),
                    emitter: {
          type: "PRODUCER",
          company: {
            name: String(row.nomSiteEmetteur || ''),
            siret: String(row.siretEmetteur || ''),
            orgId: String(row.siretEmetteur || ''),
            address: String(row.adresseCollecte || ''),
            country: "FR",
            contact: "",
            phone: "",
            mail: "",
          },
          workSite: {
            name: String(row.nomPointCollecte || ''),
            address: String(row.adresseCollecte || ''),
            city: "",
            postalCode: "",
            infos: "",
          },
        },
            transporter: {
              company: {
                name: String(row.nomTransporteur || ''),
                siret: String(row.siretTransporteur || ''),
                orgId: String(row.siretTransporteur || ''),
                address: "",
                country: "FR",
                contact: "",
                phone: "",
                mail: "",
              },
              takenOverAt: String(row.dateCollecteTransporteur),
              isExemptedOfReceipt: false,
              receipt: String(row.recepisseTransporteur || ''),
              numberPlate: '',
            },
            recipient: {
              company: {
                name: String(row.nomInstallationDestination || ''),
                siret: String(row.siretInstallationDestination || ''),
                orgId: String(row.siretInstallationDestination || ''),
                address: String(row.adresseInstallationDestination || ''),
                country: "FR",
                contact: "",
                phone: "",
                mail: "",
              },
              cap: "",
              processingOperation: String(row.codeTraitementPrevuInstallationDestination || ''),
              valoParts: [
                {
                  code_valo: String(row.valo1_dest || ''),
                  tonnage: typeof row.tonnage1_dest === 'number' ? row.tonnage1_dest : parseFloat(String(row.tonnage1_dest || 0)),
                },
                {
                  code_valo: String(row.valo2_dest || ''),
                  tonnage: typeof row.tonnage2_dest === 'number' ? row.tonnage2_dest : parseFloat(String(row.tonnage2_dest || 0)),
                },
                {
                  code_valo: String(row.valo3_dest || ''),
                  tonnage: typeof row.tonnage3_dest === 'number' ? row.tonnage3_dest : parseFloat(String(row.tonnage3_dest || 0)),
                },
              ].filter(valo => valo.tonnage > 0) // Filtrer les valorisations avec tonnage > 0
            },
            wasteDetails: {
              code: formatCodeCed(String(row.codeCed || '')),
              name: String(row.descDechet || ''),
              isSubjectToADR: false,
              onuCode: "",
              packagingInfos: [{type: "OTHER", quantity: 1}],
              quantity: typeof row.quantiteEstimeeReelleTransporteur === 'number' ? row.quantiteEstimeeReelleTransporteur : parseFloat(String(row.quantiteEstimeeReelleTransporteur || 0)),
              quantityType: "REAL" as const,
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
        volume: String(row.volumeUnitaire || ""),
        volumeUnit: "m3",
        tri: typeof row.tri === 'boolean' ? row.tri : toBoolean(row.tri ?? false),
        ...(row.rep && { rep: row.rep })
      },
      status_track_dechets: "IMPORTED",
              readable_id_track_dechets: String(row.numeroBsd || ''),
      source: data_excel.nom_fichier
    };
    data_ready_to_send.push(newRow);
  });
  
  // Afficher la donnée envoyée en preview juste avant l'import
  console.log("data_ready_to_send", data_ready_to_send);
  return data_ready_to_send;
};

const standard_with_classic = async (data_excel: ExcelData, user_id: string, entreprise_id: string): Promise<RowBSDPreview[]> => {
  // On prend la première sheet du fichier
  const sheetName = data_excel.sheets[0];
  if (!sheetName) {
    console.warn('Aucune sheet trouvée dans le fichier Excel.');
    return [];
  }
  
  const rows = (data_excel.excel_data[sheetName] || []) as Record<string, unknown>[];
  
  if (rows.length === 0) {
    console.warn('Aucune donnée trouvée dans la sheet.');
    return [];
  }

  // Vérifier que le header contient au moins 3 colonnes communes avec le format attendu
  const firstRow = rows[0];
  const headerKeys = Object.keys(firstRow);
  
  // Calculer l'intersection entre le header attendu et le header trouvé
  const intersection = CLASSIC_HEADER_MAPPING.filter(expectedHeader => 
    headerKeys.includes(expectedHeader)
  );
  
  
  
  // Vérifier si l'intersection contient au moins 3 colonnes
  if (intersection.length < 3) {
    console.warn(`Le header ne contient que ${intersection.length} colonnes communes avec le format classic attendu (minimum 3 requis).`);
    return [];
  }

  // Extraire les données standardisées (en commençant à partir de la ligne 1, après le header)
  const allStandardizedData: StandardizedData[] = [];
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const standardizedRow: StandardizedData = {};
    
    // Mapping selon les colonnes disponibles dans l'intersection
    intersection.forEach((fieldName) => {
      const value = row[fieldName];
      
      if (value !== undefined && value !== null) {
        if (fieldName === 'dateCollecteTransporteur') {
          standardizedRow[fieldName] = formatDate(toString(value));
        } else if (fieldName === 'quantiteEstimeeReelleTransporteur' || 
                   fieldName === 'tonnage1_dest' || 
                   fieldName === 'tonnage2_dest' || 
                   fieldName === 'tonnage3_dest') {
          standardizedRow[fieldName] = toNumber(value);
        } else if (fieldName === 'tri') {
          standardizedRow[fieldName] = toBoolean(value);
        } else if (fieldName === 'volumeUnitaire') {
          standardizedRow[fieldName] = toString(value);
        } else {
          standardizedRow[fieldName] = toString(value);
        }

        
      }
    });

    // Écraser les valeurs des prestataires et sites avec celles de data_excel si elles existent
    if (data_excel.presta.type === 'transporteur' && data_excel.presta.nomBoite && data_excel.presta.nomBoite !== '') {
      standardizedRow.nomTransporteur = data_excel.presta.nomBoite;
    }
    if (data_excel.presta.type === 'transporteur' && data_excel.presta.siret && data_excel.presta.siret !== '') {
      standardizedRow.siretTransporteur = data_excel.presta.siret;
    }
    if (data_excel.presta.type === 'destinataire' && data_excel.presta.nomBoite && data_excel.presta.nomBoite !== '') {
      standardizedRow.nomInstallationDestination = data_excel.presta.nomBoite;
    }
    if (data_excel.presta.type === 'destinataire' && data_excel.presta.siret && data_excel.presta.siret !== '') {
      standardizedRow.siretInstallationDestination = data_excel.presta.siret;
    }
    if (data_excel.presta.type === 'destinataire' && data_excel.presta.adresse && data_excel.presta.adresse !== '') {
      standardizedRow.adresseInstallationDestination = data_excel.presta.adresse;
    }
    
    // Écraser les valeurs du site si elles existent
    if (data_excel.site.nom !== '') {
      standardizedRow.nomSiteEmetteur = data_excel.site.nom;
    }
    if (data_excel.site.siret !== '') {
      standardizedRow.siretEmetteur = data_excel.site.siret;
    }
    if (data_excel.site.pointsCollecte[0]?.adresse && data_excel.site.pointsCollecte[0].adresse !== '') {
      standardizedRow.adresseCollecte = data_excel.site.pointsCollecte[0].adresse ?? '';
    }
    if (data_excel.site.pointsCollecte[0]?.nom && data_excel.site.pointsCollecte[0].nom !== '') {
      standardizedRow.nomPointCollecte = data_excel.site.pointsCollecte[0].nom ?? '';
    }

    // Champs par défaut
    standardizedRow.volumeUnitaire = "m3";
    standardizedRow.status_track_dechets = "IMPORTED";
    standardizedRow.source = data_excel.nom_fichier;
    
    // Vérifier si le déchet contient "REP" et ajouter rep: { sent_to_rep: true }
    if (standardizedRow.descDechet && standardizedRow.descDechet.toString().toUpperCase().includes('REP')) {
      standardizedRow.rep = { sent_to_rep: true };
    }
    
    allStandardizedData.push(standardizedRow);
  }

  
  
  // Transformer les données standardisées en RowBSDPreview
  const data_ready_to_send = ready_to_send(allStandardizedData, data_excel, user_id, entreprise_id);
  return data_ready_to_send;
};

export default standard_with_classic;
