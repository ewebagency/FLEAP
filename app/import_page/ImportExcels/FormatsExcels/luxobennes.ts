import { ExcelData, StandardizedLineData } from '../ButtonImportExcels';
import { getDestinataire, getTransporteur } from './ecobtp';

// Types spécifiques pour le format Luxobennes
interface LuxobennesRow {
  // À définir selon la structure de l'Excel Luxobennes
  [key: string]: string | number | boolean | null;
}

// Interface pour le mapping des headers
interface HeaderMapping {
  exutoire: string;
  date: string;
  nChantier: string;
  numChantier2: string;
  adresse1: string;
  ville: string;
  numBonManuel: string;
  numBon: string;
  description: string;
  cubageContenant: string;
  quantiteLigne: string;
  montantHTContenantLigne: string;
  pourcentageValorisation: string;
}

// Headers attendus dans l'Excel
const EXPECTED_HEADERS = {
  exutoire: "Exutoire",
  date: "Date",
  nChantier: "NChantier",
  numChantier2: "numChantier2",
  adresse1: "adresse1",
  ville: "ville",
  numBonManuel: "Num Bon Manuel",
  numBon: "Num Bon",
  description: "Description",
  cubageContenant: "CubageContenant",
  quantiteLigne: "QuantiteLigne",
  montantHTContenantLigne: "MontantHTContenantLigne",
  pourcentageValorisation: "PourcentageValorisation"
};

// Fonction de formatage de date inspirée de ecobtp.ts
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

// Fonction pour convertir en nombre
const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value.replace(',', '.'));
    return isNaN(num) ? 0 : num;
  }
  return 0;
};


// Fonction pour détecter et mapper les headers
const parametrage_header = (sheetData: unknown[]): HeaderMapping | null => {
  console.log('=== Détection des headers ===');
  
  // Chercher dans les premières lignes (par exemple les 10 premières)
  const searchRange = Math.min(10, sheetData.length);
  
  for (let rowIndex = 0; rowIndex < searchRange; rowIndex++) {
    const row = sheetData[rowIndex] as LuxobennesRow;
    console.log(`Vérification ligne ${rowIndex + 1}:`, row);
    
    // Vérifier si cette ligne contient les headers attendus
    const foundHeaders: Partial<HeaderMapping> = {};
    let headerCount = 0;
    
    // Parcourir toutes les colonnes de cette ligne
    Object.entries(row).forEach(([columnKey, value]) => {
      const stringValue = String(value).trim();
      
      // Chercher les headers attendus
      Object.entries(EXPECTED_HEADERS).forEach(([headerKey, expectedValue]) => {
        if (stringValue === expectedValue) {
          foundHeaders[headerKey as keyof HeaderMapping] = columnKey;
          headerCount++;
          console.log(`Header trouvé: ${expectedValue} dans la colonne ${columnKey}`);
        }
      });
    });
    
    // Si on a trouvé au moins 8 headers, on considère que c'est la ligne de headers
    if (headerCount >= 8) {
      console.log('Ligne de headers trouvée à l\'index:', rowIndex);
      console.log('Mapping des headers:', foundHeaders);
      
      // Vérifier que tous les headers requis sont présents
      const missingHeaders = Object.keys(EXPECTED_HEADERS).filter(
        key => !foundHeaders[key as keyof HeaderMapping]
      );
      
      if (missingHeaders.length > 0) {
        console.warn('Headers manquants:', missingHeaders);
      }
      
      return foundHeaders as HeaderMapping;
    }
  }
  
  console.error('Aucune ligne de headers trouvée');
  return null;
};

// Fonction pour filtrer les lignes avec un numéro de bon à 8 chiffres
const filterValidRows = (sheetData: unknown[], headerMapping: HeaderMapping): LuxobennesRow[] => {
  console.log('=== Filtrage des lignes valides ===');
  
  const validRows: LuxobennesRow[] = [];
  
  sheetData.forEach((row: unknown, index: number) => {
    const luxobennesRow = row as LuxobennesRow;
    const numBonColumn = headerMapping.numBon;
    
    if (numBonColumn && luxobennesRow[numBonColumn]) {
      const numBon = String(luxobennesRow[numBonColumn]).trim();
      
      // Vérifier si c'est un nombre à 8 chiffres
      if (/^\d{8}$/.test(numBon)) {
        console.log(`Ligne ${index + 1} valide - Num Bon: ${numBon}`);
        validRows.push(luxobennesRow);
      } else {
        console.log(`Ligne ${index + 1} ignorée - Num Bon invalide: ${numBon}`);
      }
    } else {
      console.log(`Ligne ${index + 1} ignorée - Pas de Num Bon`);
    }
  });
  
  console.log(`Nombre de lignes valides trouvées: ${validRows.length}`);
  return validRows;
};

const standard_with_luxobennes = async (
  data_excel: ExcelData,
  user_id: string,
  entreprise_id: string
): Promise<StandardizedLineData[]> => {
  console.log('=== Traitement format Luxobennes ===');
  console.log('Données Excel reçues:', data_excel);

  const standardizedData: StandardizedLineData[] = [];

  // Parcourir toutes les sheets du fichier Excel
  for (const [sheetName, sheetData] of Object.entries(data_excel.excel_data)) {
    console.log(`Traitement de la sheet: ${sheetName}`);
    console.log('Données de la sheet:', sheetData);

    // 1. Détecter les headers
    const headerMapping = parametrage_header(sheetData);
    
    if (!headerMapping) {
      console.error(`Impossible de détecter les headers dans la sheet: ${sheetName}`);
      continue;
    }

    // 2. Filtrer les lignes valides (avec numéro de bon à 8 chiffres)
    const validRows = filterValidRows(sheetData, headerMapping);
    
    if (validRows.length === 0) {
      console.warn(`Aucune ligne valide trouvée dans la sheet: ${sheetName}`);
      continue;
    }

    // 3. Traiter les lignes valides
    validRows.forEach((luxobennesRow: LuxobennesRow, index: number) => {
      //console.log(`Traitement ligne valide ${index + 1}:`, luxobennesRow);

      // Mapping des colonnes Excel vers les champs standardisés selon le headerMapping
      // Mappings standardisés :
      // - dateCollecteTransporteur ← date
      // - numeroBsd ← numBon
      // - descDechet ← description
      // - cubage ← cubageContenant
      // - quantiteEstimeeReelleTransporteur ← quantiteLigne
      // - numBonManuel (disponible dans headerMapping.numBonManuel pour usage futur)
      const standardizedRow: StandardizedLineData = {
        numeroBsd: String(luxobennesRow[headerMapping.numBon] || `LUXO-${Date.now()}-${index}`),
        dateCollecteTransporteur: formatDate(String(luxobennesRow[headerMapping.date] || new Date().toISOString())),
        nomSiteEmetteur: String(data_excel.site.nom),
        siretEmetteur: String(data_excel.site.siret),
        adresseCollecte: String(data_excel.site.pointsCollecte[0].adresse),
        nomPointCollecte: String(data_excel.site.pointsCollecte[0].nom),
        nomTransporteur: String(getTransporteur(data_excel).nomBoite || ''),
        siretTransporteur: String(getTransporteur(data_excel).siret || ''),
        adresseTransporteur: String(getTransporteur(data_excel).adresse || ''),
        nomContactTransporteur: String(getTransporteur(data_excel).nomPrenom || ''),
        telephoneContactTransporteur: String(getTransporteur(data_excel).telephone || ''),
        emailContactTransporteur: String(getTransporteur(data_excel).email || ''),
        recepisseTransporteur: String(''),
        immatriculationTransporteur: String(''),
        nomInstallationDestination: String(getDestinataire(data_excel).nomBoite || ''),
        siretInstallationDestination: String(getDestinataire(data_excel).siret || ''),
        adresseInstallationDestination: String(getDestinataire(data_excel).adresse || ''),
        codeTraitementPrevuInstallationDestination: parseInt(String(luxobennesRow[headerMapping.pourcentageValorisation])) > 50 ? "R5" : "D1",
        valo1_dest: "R5",
        tonnage1_dest: toNumber(luxobennesRow[headerMapping.quantiteLigne])*parseFloat(String(luxobennesRow[headerMapping.pourcentageValorisation]))/100,
        valo2_dest: "D1",
        tonnage2_dest: toNumber(luxobennesRow[headerMapping.quantiteLigne])*(1-(parseFloat(String(luxobennesRow[headerMapping.pourcentageValorisation]))/100)),
        codeCed: mapping_ced(String(luxobennesRow[headerMapping.description] || '')),
        descDechet: String(luxobennesRow[headerMapping.description] || ''),
        quantiteEstimeeReelleTransporteur: toNumber(luxobennesRow[headerMapping.quantiteLigne]),
        cubage: String(luxobennesRow[headerMapping.cubageContenant] || ''),
        volumeUnitaire: String('m3'),
        sent_to_rep: String(luxobennesRow[headerMapping.description]).split(" ")[0].includes("REP") ? true : false,
      };

      standardizedData.push(standardizedRow);
    });
  }

  //console.log('Données standardisées:', standardizedData);
  return standardizedData;
};

export default standard_with_luxobennes;



const mapping_ced = (descDechet: string): string => {
    //17 09 04 - DIB / impur 1 impur 3 / rep platre
    //17 01 07 - Inertes DI / REP INERTES GDD
    //17 02 01 rep bois
    //17 02 01 BOIS A
    //17 02 01 BOIS B
    //17 04 05 Ferraille    -> from BSD
    const ced_mapping = [
        {"ced":"17 02 01","nom":"Bois B (T)"},
        {"ced":"17 02 01","nom":"Bois A(T)"},
        {"ced":"17 09 04","nom":"Déchets DIB (T)"},
        {"ced":"17 04 05","nom":"Ferraille (T)"},
        {"ced":"17 09 04","nom":"Impur 4 (T)"},
        {"ced":"17 09 04","nom":"Impurs (T)"},
        {"ced":"17 09 04","nom":"Impurs 2 (T)"},
        {"ced":"17 09 04","nom":"Impurs 3 (T)"},
        {"ced":"17 01 07","nom":"Inertes DI (T)"},
        {"ced":"17 02 01","nom":"REP BOIS (T)"},
        {"ced":"17 01 07","nom":"REP INERTES GDD  (T)"},
        {"ced":"17 09 04","nom":"REP PLATRE (T)"}]
    const ced = ced_mapping.find(item => item.nom === descDechet);
    return ced ? ced.ced : "";
}