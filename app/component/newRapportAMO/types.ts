export type TypeParam = 'bsd' | 'facture' | 'pdf';

export type Family =
  | 'site'
  | 'exutoire'
  | 'transport'
  | 'filiere'
  | 'mois_annee'
  | 'contenant'
  | 'code_dr'
  | 'valorisation'
  | 'tri'
  | 'rep'
  | 'source';

export type YAxis = 'tonnage' | 'nbr_ligne' | 'remplissage';

export interface DenominatorEntity { siret: string; name: string }

export interface Denominators {
  unique_site: Array<DenominatorEntity>;
  unique_exutoire: Array<DenominatorEntity>;
  unique_transport: Array<DenominatorEntity>;
  unique_filiere: string[];
  unique_mois_annee: string[];
  unique_contenant: string[];
  unique_code_dr: string[];
  unique_valorisation: string[];
  unique_tri: string[];
  unique_rep: string[];
  unique_source: string[];
}

export interface GroupedDataItem {
  site: string;
  exutoire: string;
  transport: string;
  filiere: string;
  tonnage: number;
  nbr_ligne: number;
  mois_annee: string;
  contenant: string;
  code_dr: string;
  valorisation: string;
  tri: string;
  rep: string;
  remplissage: number;
  source: string;
}

export interface AnalysisResponse {
  denominateur: Denominators;
  data: GroupedDataItem[];
}

export type ChartType = 'bar' | 'bar_grouped' | 'pie' | 'table';

export interface ChartConfig {
  id: string;
  title: string;
  type: ChartType;
  xFamily: Family; // ignored for pie
  segmentFamily: Family; // slice/category (ignored for table)
  yFamily?: Family; // for table rows
  yAxis: YAxis;
  filterFamily?: Family;
  filterValues?: string[];
}

export interface ExportOptionsState {
  includeTitle: boolean;
  includeKPIs: boolean;
  includeTable: boolean;
  includeCharts: boolean;
  includeLinePdfs?: boolean;
  // Ordered list of columns for the register table
  tableColumns?: TableColumnKey[];
}

import type { FilterType } from '@/app/analysis/filterType';

export interface ReportBuilderState {
  selectedSites: string[]; // site names or siret depending on data
  exportOptions: ExportOptionsState;
  charts: ChartConfig[];
  reportTitle: string;
  filterType?: FilterType;
}

export interface SavedReportConfig {
  id: string;
  name: string;
  config: ReportBuilderState;
  createdAt: string;
}

export interface ReportConfigsResponse {
  configs: SavedReportConfig[];
}


// Columns available for the BSD register table in PDF
export type TableColumnKey =
  | 'doc'          // N°BSD ou N°Bon
  | 'date'         // Date BSD ou de création
  | 'site'         // Nom du site (affiché seulement si plusieurs sites dans les données)
  | 'waste'        // Nom du déchet
  | 'ced'          // Code CED
  | 'qty'          // Tonnage
  | 'treatment'    // Opération de traitement
  | 'exutoire'     // Nom exutoire (destinataire)
  | 'exutoire_siret'  // SIRET destinataire
  | 'exutoire_address' // Adresse destinataire
  | 'receipt'      // N° récépissé (transporteur)
  | 'numberPlate'  // Immatriculation transporteur
  | 'containerDescription' // Description contenant
  | 'nBon'         // Numéro de bon
  | 'nFacture'     // Numéro de facture
  | 'site_siret'   // SIRET du site
  | 'transport_name' // Nom du transporteur
  | 'transport_siret' // SIRET du transporteur
  | 'attachments'; // Lien vers pièces jointes (nécessite includeLinePdfs


