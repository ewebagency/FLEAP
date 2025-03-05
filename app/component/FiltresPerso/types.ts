//import { BSDD_TrackDechets } from '@/app/register/interface/BSD_Interface';
import { TYPE_table_bsd } from './FiltresPersoProvider';
import { CommonBSD } from "@/app/register/FiltreFunctionnal";

export type FilterField = {
  label: string;
  supabase_column: string;
  json_path: string;
};

export type FilterValue = {
  value: string;
  checked: boolean;
  mostFrequentName?: string;
};

export type FilterData = {
  [key: string]: FilterValue[];
};

export type FilterFunction = (data: CommonBSD[]) => CommonBSD[];

export interface Filter {
    id: string;
    name: string;
    function: FilterFunction;
}

export type FilterContextType = {
  filterFields: FilterField[];
  filterData: FilterData;
  filterFunctions: FilterFunction[];
  updateFilterValue: (fieldLabel: string, value: string, checked: boolean) => void;
  updateAllFilterValues: (fieldLabel: string, checked: boolean) => void;
  clearFilters: () => void;
  applyFilters: (data: TYPE_table_bsd[]) => TYPE_table_bsd[];
  isLoading: boolean;
};

export const FILTER_FIELDS: FilterField[] = [
  {
    label: "Déchet Dangereux",
    supabase_column: "infos_json",
    json_path: "formAPI.createFormInput.wasteDetails.isDangerous"
  },
  {
    label: "Code de traitement",
    supabase_column: "infos_json",
    json_path: "formAPI.createFormInput.recipient.processingOperation"
  },
  {
    label: "Code CED",
    supabase_column: "infos_json",
    json_path: "formAPI.createFormInput.wasteDetails.code"
  },
  /*{
    label: "Nom Déchet",
    supabase_column: "infos_json",
    json_path: "formAPI.createFormInput.wasteDetails.name"
  },*/ //=> ne fonctionne pas
  /*{
    label: "Quantité réelle/estimée",
    supabase_column: "infos_json",
    json_path: "formAPI.createFormInput.wasteDetails.quantityType"
  },*/
  /*{
    label: "Contenant",
    supabase_column: "other_infos",
    json_path: "containerDescription"
  },
  {
  {
    label: "Contact Producteur",
    supabase_column: "infos_json",
    json_path: "formAPI.createFormInput.emitter.company.contact"
  },
  {
    label: "Transporteur (nom)",
    supabase_column: "infos_json",
    json_path: "formAPI.createFormInput.transporter.company.name"
  },
  {
    label: "Destinataire (nom)",
    supabase_column: "infos_json",
    json_path: "formAPI.createFormInput.recipient.company.name"
  },*/
  {
    label: "Transporteur (siret)",
    supabase_column: "infos_json",
    json_path: "formAPI.createFormInput.transporter.company.siret"
  },
  {
    label: "Destinataire (siret)",
    supabase_column: "infos_json",
    json_path: "formAPI.createFormInput.recipient.company.siret"
  },
  /*{
    label: "Sur Track Déchets",
    supabase_column: "on_track_dechets",
    json_path: ""
  },
  {
    label: "Créé sur Fleap",
    supabase_column: "created_on_fleap",
    json_path: ""
  },*/

]; 