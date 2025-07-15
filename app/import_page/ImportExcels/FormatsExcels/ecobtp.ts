import { RowBSDPreview } from '../ButtonImportExcels';
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

// Type pour les données standardisées
type StandardizedData = { [standard: string]: string | number | boolean };

// Mapping entre les champs standardisés et les colonnes Ecobtp
const ECOBTP_MAPPING: { [standard: string]: string } = {
  descDechet: 'Nature des déchets',
  numeroBsd: "Numéro\r\ndu BSD",
  nomTransporteur: 'Transporteur',
  nomInstallationDestination: 'Installation de transit',
  quantiteEstimeeReelleTransporteur: 'Poids\r\nen tonnes',
  volume : 'Volume\r\nen m3',
  cubage: 'M3',
  dateCollecteTransporteur: "Date d'enlèvement",
  poids_matiere: 'Poids recyclé en matière',
  poids_valo_global: 'Poids valorisé global',
  ligne_a_prendre: 'VERIFICATION si ↵poids triés = poids total',
};

const HEADER_VALUES = [
    "Transporteur",
    "Installation\r\nde transit",
    "Inertes\r\n(Gravats/Terre)",
    "Blocs béton",
    "PLATRE",
    "Bois B",
    "Ferrailles / Métaux",
    "ALUMINIUM",
    "Cartons & Papier",
    "Plastiques",
    "PVC / PE / PEHD",
    "Verres",
    "PVC des menuiseries",
    "Cables",
    "Déchets Dangereux",
    "BOIS A",
    "Ultimes incinérés",
    "Ultimes enfouis",
    "Déchets verts",
    "Emballages transparent",
    "Poids recyclé en matière",
    "Poids valorisé global",
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

// Fonction de formatage de date inspirée de paprec.ts
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

// Fonction pour obtenir les infos du transporteur
export const getTransporteur = (data_excel: ExcelData): {nomBoite: string, siret: string, email: string, telephone: string, nomPrenom: string, adresse: string} => {
  return data_excel.presta.type === 'transporteur' ? 
    { nomBoite: data_excel.presta.nomBoite || "", siret: data_excel.presta.siret || "", email: data_excel.presta.email || "", telephone: data_excel.presta.telephone || "", nomPrenom: data_excel.presta.nomPrenom || "", adresse: data_excel.presta.adresse || "" } : 
    { nomBoite: "", siret: "", email: "", telephone: "", nomPrenom: "", adresse: "" };
};

// Fonction pour obtenir les infos du destinataire
export const getDestinataire = (data_excel: ExcelData): {nomBoite: string, siret: string, email: string, telephone: string, nomPrenom: string, adresse: string} => {
  return data_excel.presta.type === 'destinataire' ? 
    { nomBoite: data_excel.presta.nomBoite || "", siret: data_excel.presta.siret || "", email: data_excel.presta.email || "", telephone: data_excel.presta.telephone || "", nomPrenom: data_excel.presta.nomPrenom || "", adresse: data_excel.presta.adresse || "" } : 
    { nomBoite: "", siret: "", email: "", telephone: "", nomPrenom: "", adresse: "" };
};

// Fonction pour transformer les données standardisées en RowBSDPreview
const ready_to_send = (allStandardizedData: StandardizedData[], data_excel: ExcelData, user_id: string, entreprise_id: string): RowBSDPreview[] => {
  const data_ready_to_send: RowBSDPreview[] = [];
  
  allStandardizedData.forEach(row => {
    const newRow: RowBSDPreview = {
      created_at: String(row.dateCollecteTransporteur),
      user_id: user_id,
      entreprise_id: entreprise_id,
      infos_json: {
        formAPI: {
          createFormInput: {
            readableId: String(row.numeroBsd),
            takenOverAt: String(row.dateCollecteTransporteur),
            emitter: {
              type: "PRODUCER",
              company: {
                name: String(row.nomSiteEmetteur),
                siret: String(row.siretEmetteur || ''),
                orgId: String(row.siretEmetteur || ''),
                address: String(row.adresseCollecte),
                country: "FR",
                contact: "",
                phone: "",
                mail: "",
              },
              workSite: {
                name: String(row.nomPointCollecte),
                address: String(row.adresseCollecte),
                city: "",
                postalCode: "",
                infos: "",
              },
            },
            transporter: {
              company: {
                name: String(row.nomTransporteur),
                siret: String(row.siretTransporteur || ''),
                orgId: String(row.siretTransporteur || ''),
                address: String(row.adresseTransporteur || ''),
                country: "FR",
                contact: String(row.nomPrenomTransporteur || ''),
                phone: String(row.telephoneTransporteur || ''),
                mail: String(row.emailTransporteur || ''),
              },
              takenOverAt: String(row.dateCollecteTransporteur),
              isExemptedOfReceipt: false,
              receipt: row.recepisseTransporteur ? String(row.recepisseTransporteur) : undefined,
              numberPlate: row.immatriculationTransporteur ? String(row.immatriculationTransporteur) : undefined,
            },
            recipient: {
              company: {
                name: String(row.nomInstallationDestination),
                siret: String(row.siretInstallationDestination || ''),
                orgId: String(row.siretInstallationDestination || ''),
                address: String(row.adresseInstallationDestination || ''),
                country: "FR",
                contact: String(row.nomPrenomInstallationDestination || ''),
                phone: String(row.telephoneInstallationDestination || ''),
                mail: String(row.emailInstallationDestination || ''),
              },
              cap: "",
              processingOperation: String(row.processingOperation || ''),
              valoParts: [
                {
                  code_valo: String(row.valo1_dest),
                  tonnage: typeof row.tonnage1_dest === 'number' ? row.tonnage1_dest : parseFloat(String(row.tonnage1_dest || 0)),
                },
                {
                  code_valo: String(row.valo2_dest),
                  tonnage: typeof row.tonnage2_dest === 'number' ? row.tonnage2_dest : parseFloat(String(row.tonnage2_dest || 0)),
                },
                {
                  code_valo: String(row.valo3_dest),
                  tonnage: typeof row.tonnage3_dest === 'number' ? row.tonnage3_dest : parseFloat(String(row.tonnage3_dest || 0)),
                },
              ].filter(valo => valo.tonnage > 0) // Filtrer les valorisations avec tonnage > 0
            },
            wasteDetails: {
              code: String(row.codeCed),
              name: String(row.descDechet),
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
        volume: String(row.cubage || row.volume || ''),
        volumeUnit: String(row.volumeUnitaire || 'm3'),
        tri: String(row.tri) === "true" ? true : false,
      },
      status_track_dechets: "IMPORTED",
      readable_id_track_dechets: String(row.numeroBsd),
      source: data_excel.nom_fichier
    };
    data_ready_to_send.push(newRow);
  });
  
  console.log("data_ready_to_send", data_ready_to_send);
  return data_ready_to_send;
};

const standard_with_ecobtp = async (data_excel: ExcelData, user_id: string, entreprise_id: string): Promise<RowBSDPreview[]> => {
  // On prend la feuille "Registre déchets" du fichier
  const sheetName = data_excel.sheets.find(s => s.trim().toLowerCase() === 'registre déchets');
  if (!sheetName) {
    console.warn('Sheet "Registre déchets" non trouvée dans le fichier Excel. Sheets disponibles :', data_excel.sheets);
    return [];
  }
  const rows = (data_excel.excel_data[sheetName] || []) as Record<string, unknown>[];

  const check_header = (keys: string[]) => {
    const max_keys = Math.round(HEADER_VALUES.length*0.9);
    const matchCount = HEADER_VALUES.filter(h => keys.includes(h)).length;
    return matchCount > max_keys;
  }

  // Recherche de la ligne de header à partir de laquelle on peut prendre
  /*let i_header = -5;
  for (let i = 0; i < 150; i++) {
    const keys = Object.keys(rows[i]).map(toString);
    const line_real_header = check_header(keys);
    if (line_real_header) {
      i_header = i;
      break;
    }
  }
  console.log("i_header", i_header);
  console.log("rows[i_header]", rows[i_header]);*/
  const get_mapping_ced = (rows: Record<string, unknown>[]) => {
    const mapping: { [key: string]: string } = {};
    let begin=false;
    for (let i = 0; i < 50; i++) {
        //console.log("rows[i]", Object.values(rows[i]));
        if(begin) {
          const nom_1: string = toString(rows[i]["Date d'enlèvement"])
          const nom_2: string = toString(rows[i]["Producteur"])
          const ced_1: string = toString(rows[i]["Nature des déchets"])
          const ced_2: string = toString(rows[i]["Zone chantier"])
          mapping[nom_1] = ced_1;
          mapping[nom_2] = ced_2;
        }
        if(Object.values(rows[i]).includes('CODES DE NOMENCLATURE DES DECHETS')) {
            console.log("beginiiiiiiii");
            begin=true;
        }
        if(begin && !Object.keys(rows[i+1]).includes("Producteur")){
            console.log("rows[i+1] qu'on va enlever", rows[i+1]);
            console.log("endddddddddd");
            begin=false;
        }
    }
    return mapping;
  }
  const mapping_ced = get_mapping_ced(rows);
  console.log("mapping_ced", mapping_ced);

  // Prendre les données jusqu'à la fin des datas (=='Ok')
  const data_rows = [];
  for (let i = 0; i < 200; i++) {
    //console.log("colonne ", i, Object.keys(rows[i]));
    const nom_colonne_verif = "VERIFICATION si\r\npoids triés = poids total";
    const contains_colonne_verif = Object.keys(rows[i]).find(k => k.includes(nom_colonne_verif));  
    if (contains_colonne_verif) {
        const verif = rows[i][nom_colonne_verif];
        if (toString(verif).toLowerCase() === 'ok') {
            data_rows.push(rows[i]);
        }
    }
  }
  console.log("data_rows", data_rows);

  // Extraire les données standardisées
  const allStandardizedData: StandardizedData[] = [];
  
  data_rows.forEach(row => {
    const standardizedRow: StandardizedData = {};
    //console.log("Ligne row", row);
    // Mapping des champs selon ECOBTP_MAPPING
    Object.entries(ECOBTP_MAPPING).forEach(([standard, source]) => {
      const value = row[source];
      if(source === 'Tonne') {
        console.log("value pour tonne", value);
      }
      //console.log("source", source);
      //console.log("value", value);
      if (value !== undefined && value !== null) {
        if (standard === 'dateCollecteTransporteur') {
          standardizedRow[standard] = formatDate(toString(value));
        } else if(standard === 'quantiteEstimeeReelleTransporteur' || standard === 'cubage' || standard === 'volume' || standard === 'poids_matiere' || standard === 'poids_valo_global') {
          standardizedRow[standard] = toNumber(value);
        } else {
          standardizedRow[standard] = toString(value);
        }
      }
    });

    
    // Ajouter les champs constants
    standardizedRow.nomSiteEmetteur = data_excel.site.nom;
    standardizedRow.siretEmetteur = data_excel.site.siret;
    standardizedRow.adresseCollecte = data_excel.site.pointsCollecte[0]?.adresse || "";
    standardizedRow.nomPointCollecte = data_excel.site.pointsCollecte[0]?.nom || "";
    
    // Infos transporteur/destinataire selon le type de presta
    const transporteur = getTransporteur(data_excel);
    const destinataire = getDestinataire(data_excel);
    //console.log("destinataire", destinataire);
    //console.log("transporteur", transporteur);
    
    standardizedRow.nomTransporteur = transporteur.nomBoite;
    standardizedRow.siretTransporteur = transporteur.siret;
    standardizedRow.adresseTransporteur = transporteur.adresse;
    standardizedRow.emailTransporteur = transporteur.email;
    standardizedRow.telephoneTransporteur = transporteur.telephone;
    standardizedRow.nomPrenomTransporteur = transporteur.nomPrenom;
    
    standardizedRow.nomInstallationDestination = destinataire.nomBoite;
    standardizedRow.siretInstallationDestination = destinataire.siret;
    standardizedRow.adresseInstallationDestination = destinataire.adresse;
    standardizedRow.nomPrenomInstallationDestination = destinataire.nomPrenom;
    standardizedRow.emailInstallationDestination = destinataire.email;
    standardizedRow.telephoneInstallationDestination = destinataire.telephone;
    
    // Champs par défaut
    standardizedRow.volumeUnitaire = "m3";
    standardizedRow.status_track_dechets = "IMPORTED";
    standardizedRow.source = data_excel.nom_fichier;
    
    standardizedRow.codeCed = mapping_ced[toString(standardizedRow.descDechet)].trim() || "";

    const poids_total = standardizedRow.quantiteEstimeeReelleTransporteur
    const poids_valo_matiere = standardizedRow.poids_matiere
    const poids_valo_global = standardizedRow.poids_valo_global
    const poids_elimination = toNumber(poids_total) - toNumber(poids_valo_global);
    const poids_valo_enr = toNumber(poids_valo_global) - toNumber(poids_valo_matiere);
    const valo1_dest = "R1"; //Valo Energetique
    const tonnage1_dest = poids_valo_enr;
    const valo2_dest = "R13"; //Valo matière
    const tonnage2_dest = poids_valo_matiere;
    const valo3_dest = "D1"; //Elimination
    const tonnage3_dest = poids_elimination;
    const dic = [{code:valo1_dest, tonnage:tonnage1_dest}, {code:valo2_dest, tonnage:tonnage2_dest}, {code:valo3_dest, tonnage:tonnage3_dest}]
    const {code:code_traitement_preponderant, tonnage:tonnage_preponderant} = dic.reduce((max, curr) => curr.tonnage > max.tonnage ? curr : max, dic[0]);
    standardizedRow.processingOperation = code_traitement_preponderant;
    standardizedRow.valo1_dest = valo1_dest;
    standardizedRow.tonnage1_dest = tonnage1_dest;
    standardizedRow.valo2_dest = valo2_dest;
    standardizedRow.tonnage2_dest = tonnage2_dest;
    standardizedRow.valo3_dest = valo3_dest;
    standardizedRow.tonnage3_dest = tonnage3_dest;
    standardizedRow.tri = (standardizedRow.descDechet.toString().includes("DIB") || standardizedRow.descDechet.toString().includes("GIM")) ? true : false;
    
    //console.log("Ligne standardized", standardizedRow);
    allStandardizedData.push(standardizedRow);
  });

  //console.log("Données standardisées Ecobtp:", allStandardizedData);
  
  // Transformer les données standardisées en RowBSDPreview
  const data_ready_to_send = ready_to_send(allStandardizedData, data_excel, user_id, entreprise_id);
  return data_ready_to_send;
};

export default standard_with_ecobtp;
