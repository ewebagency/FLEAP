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

export type ChartType = 'bar' | 'pie' | 'table';

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
}

export interface ReportBuilderState {
  selectedSites: string[]; // site names or siret depending on data
  exportOptions: ExportOptionsState;
  charts: ChartConfig[];
  reportTitle: string;
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


