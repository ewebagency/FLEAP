import { toast } from "react-hot-toast";
import { Gouv, Anything, FormInput } from "../../../interface/BSD_Interface";
import { supabase } from "@/app/database/supabaseClient";


export const extractSiret = (number: string | number | boolean | null): string | null => {
    //console.error('extractSiret', number);
    // Convert input to string and check if it exists
    if (!number) return null;
    const numberStr = number.toString().replaceAll(' ', '');

    // Vérifie si le numéro est un SIRET (14 chiffres consécutifs)
    const siretPattern = /^\d{14}$/;
    if (siretPattern.test(numberStr)) {
        return numberStr;
    }

    // Vérifie si le numéro est un numéro de TVA
    const tvaPattern = /^FR\d{2}(\d{9})$/;
    const matchTva = numberStr.match(tvaPattern);
    if (matchTva) {
        return matchTva[1] + '00000';
    }

    console.error('Siret non reconnu', number);
    return null;
}
  
export const getRaisonSocial = async (siret_tva: string|number|boolean|null): Promise<Gouv|null> => {
  const siret = extractSiret(String(siret_tva).replaceAll(' ', ''));
  const raison_null = {
    raison: {first: ""},
    adresse: {first: ""}

  }
    if (!siret) {
        //console.log("siret non trouvé", siret_tva);
        return null;
    }

    try {
        const response = await fetch(`/api/demande_collecte/infos_siren?siret=${siret}`);
        if (!response.ok) {
            //console.log('response non ok', response);
            return null;
        }
        
        const data = await response.json();
        //console.log('gouuv', data);
        return data; // L'API renvoie déjà le bon format
        
    } catch (error) {
        console.error('Erreur getRaisonSocial:', error);
        return null;
    }
};


export const parseAddress = (address: string) : {street: string; postalCode: string; city: string} => {
    try {
        const regex = /^(.*)\s(\d{5})\s(.*)$/;
        const match = address.match(regex);
  
    if (match) {
      const street = match[1].trim();
      const postalCode = match[2];
      const city = match[3].trim();
  
      const result = {
        street: street,
        postalCode: postalCode,
        city: city,
      };

      return result;
    } else {
      console.log("The address does not match the expected format : ", address);
      return  {
        street: address,
        postalCode: '',
        city: '',
      };
        }
    } catch (error) {
        console.error('Erreur parseAddress:', error);
        return {street: address, postalCode: '', city: ''};
    }
}
  
const int = (value: number | string | boolean) => {
    return parseInt(String(value));
}

const API_Format = async (data_meta: {json_row: FormInput}) => {
    const data = data_meta.json_row;        
    return data as FormInput;
};

export const API_Format_Array = async (data: {json_row: FormInput}[]) => {
    const dataFormAPI_Array = <FormInput[]>[];
    for (const item of data) {
        dataFormAPI_Array.push(await API_Format(item));
    }
    return dataFormAPI_Array;
}

export const getAllCEDS = async (entreprise_id:string, filiere:string) => {
  const result = await supabase
    .from('entreprise')
    .select('mapping_ced_filiere')
    .eq('id', entreprise_id)
    .single();
  return result.data?.mapping_ced_filiere.filter((mapping: {filiere: string}) => mapping.filiere === filiere).map((mapping: {ced: string}) => mapping.ced);
}

export const getDataAutocompletion = async (entreprise_id:string, site?:string, filiere?:string, dechet_code?:string) => {
  const {data: data_get, error} = await supabase
  .from('table_parametrage')
  .select('*')
  .eq('entreprise_id', entreprise_id)
  .order('created_at', { ascending: false }); 
  //.limit(3);
  let data = data_get;
  if (error) {
      toast.error(error.message);
  } else if(data){
      if(site) {
          const FilteredData = data.filter((item) => item.json_row.emitter.workSite.name === site);
          if(FilteredData.length >= 1) {
            data = FilteredData;
          }
      }
      if(filiere) {
        const ceds = await getAllCEDS(entreprise_id, filiere);
          const FilteredData = data.filter((item) => ceds.includes(item.json_row.wasteDetails.code.replaceAll(" ", "").replace('*', ''))); //Aller chercher la filière dans la map
          if(FilteredData.length >= 1) {
            data = FilteredData;
          }
      }
      if(dechet_code) {
          const FilteredData = data.filter((item) => item.json_row.wasteDetails.code === dechet_code);
          if(FilteredData.length >= 1) {
            data = FilteredData;
          }
      }

      const dataFormAPI = await API_Format_Array(data);
      dataFormAPI.forEach(item => {
        item.emitter.workSite.fullAddress = `${item.emitter.workSite.address} ${item.emitter.workSite.postalCode} ${item.emitter.workSite.city}`;
      });
      return dataFormAPI;
  }
};

export const getDataAutocompletionVertical = async (entreprise_id: string, site?: string, filiere?: string, dechet_code?: string, name?: string, value?: string) => {
  
  const mapping: { [key: string]: string } = {
    "workSiteName":"json_row->emitter->workSite->>name",
    //"pickupAddress":"json_row->emitter->workSite->>address",
    "contactPerson":"json_row->emitter->>contact",
    //"wasteStream":"json_row->wasteDetails->>code",
    //"wasteType":"json_row->wasteDetails->>name",
    //"packagingType":"json_row->packaging->>type",
    //"packagingQuantity":"json_row->packaging->>quantity",
    "transporterName":"json_row->transporter->>company->>name",
    "recipientName":"json_row->recipient->company->>name",
    "transporterContact":"json_row->transporter->>company->>contact",
    "recipientContact":"json_row->recipient->company->>contact",
  };

  const { data:data_first, count:count_first, error:error_first} = await supabase
    .from('table_parametrage')
    .select('*', { count: 'exact' })
    .eq('entreprise_id', entreprise_id);

  let data = data_first;
  console.log('data_first', data);
  if(site) {
    const { data:data_second, count:count_second, error:error_second} = await supabase
      .from('table_parametrage')
      .select('*', { count: 'exact' })
      .eq('entreprise_id', entreprise_id)
      .eq('json_row->emitter->workSite->>name', site);
    if(count_second && count_second > 0) {
      data = data_second;
      console.log('data_second', data);
    }
  }
  if(filiere) {
    const ceds_from_filiere = await getAllCEDS(entreprise_id, filiere);
    const {data:data_third, count:count_third, error:error_third} = await supabase
      .from('table_parametrage')
      .select('*', { count: 'exact' })
      .eq('entreprise_id', entreprise_id)
      .eq('json_row->emitter->workSite->>name', site)
      .in('json_row->wasteDetails->>code', ceds_from_filiere);
    if(count_third && count_third > 0) {
      data = data_third;
      console.log('data_third', data);
    }
  }
  if(dechet_code) {
    const {data:data_fourth, count:count_fourth, error:error_fourth} = await supabase
      .from('table_parametrage')
      .select('*', { count: 'exact' })
      .eq('entreprise_id', entreprise_id)
      .eq('json_row->emitter->workSite->>name', site)
      .eq('json_row->wasteDetails->>code', dechet_code);
    if(count_fourth && count_fourth > 0) {
      data = data_fourth;
      console.log('data_fourth', data);
    }
  }
  if(name) {
    const {data:data_fifth, count:count_fifth, error:error_fifth} = await supabase
    .from('table_parametrage')
    .select('*', { count: 'exact' })
    .eq('entreprise_id', entreprise_id)
    .eq('json_row->emitter->workSite->>name', site)
    .eq('json_row->wasteDetails->>code', dechet_code)
    .eq(mapping[name], value);
    if(count_fifth && count_fifth > 0) {
      data = data_fifth;
      console.log('data_fifth', data);
    }
  }

  console.log('dataCompletionVertical', data ? data[0].json_row : null);
  return data ? data[0].json_row : null;
}

export const formatText = (text: Anything) => {
  if (!text) return ''; // Gérer les cas où le texte est vide ou null
  return String(text).charAt(0).toUpperCase() + String(text).slice(1).toLowerCase();
}


export const sendData_to_Cloud = async (data: FormInput, user_id: string, entreprise_id: string, isDraft: boolean = false, nonDangereux: boolean = false) => {
  console.log('data utils new', data);
  
  try {
    const response = await fetch('/api/demande_collecte/creation_bsdd', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
      },
      body: JSON.stringify({
          user_id: user_id, 
          entreprise_id: entreprise_id,
          data: {formAPI: {createFormInput: data}},
          isDraft: isDraft,
          nonDangereux: nonDangereux
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false, 
        message: errorData.message || "Erreur lors de la sauvegarde"
      };
    }
    
    const result = await response.json();
    if (!result.success) {
      return {success: false, message: result.message};
    }
    
    return {
      success: true, 
      message: isDraft ? "Brouillon sauvegardé avec succès" : "BSD créé avec succès dans TrackDéchets"
    };
    
  } catch (error) {
    console.error("Erreur dans l'envoi du formulaire:", error);
    return {
      success: false, 
      message: isDraft ? "Erreur lors de la sauvegarde du brouillon" : "Erreur inconnue dans l'envoi du formulaire"
    };
  }
}


const getWeightEstimation = (
  volume: string,        // Volume exprimé en L ou m3 (ex: '200L' ou '15m3')
  consistance: string, // Consistance ('Solide' ou 'Liquide')
  nbBacs: number         // Nombre de bacs
): number => {
  // Masse volumique en kg/L pour chaque type de déchet
  const density = consistance === "Solide" ? 0.8 : 1;  // Solide = 0.8 kg/L, Liquide = 1 kg/L (approximation)

  // Convertir le volume en L si c'est en m3
  const volumeInLiters = volume.includes('m3')
    ? parseFloat(volume) * 1000  // Conversion m3 en L
    : parseFloat(volume);        // Si volume est déjà en L
  
  // Poids estimé par bac
  const totalWeight = volumeInLiters * density * nbBacs / 1000;  // Poids total estimé en tonnes

  return totalWeight;
};

const getVolumeEstimation = (unitaire: string, indicatif: number) => {
    let type = "L";
    if (unitaire.includes("m3")) {
        type = "m3";
    }
    const unitaire_number = Number(unitaire.replace(type, ""));
    const multiplier = type === "m3" ? 1000 : 1;
    return unitaire_number*indicatif*multiplier;
}

export const getMappingTableFiliere = async (entreprise_id: string) => {
  const result = await supabase
    .from('entreprise')
    .select('mapping_ced_filiere')
    .eq('id', entreprise_id)
    .single();
  return result.data?.mapping_ced_filiere;
}

export const getFiliere = (code: string, mapping_table: { ced: string, filiere: string }[]) => {
  const code_clean = code.replaceAll(" ", "").replace('*', '');
  const result = mapping_table.find((item:{ced: string, filiere: string}) => item.ced === code_clean)?.filiere;
  return result ? result : '';
}


export const pushOnTableParametrage = async (user_id: string, entreprise_id: string, data: {formAPI: {createFormInput: FormInput}}) => {

  const formData = data.formAPI.createFormInput;

  // Conditions pour vérifier les entrées de l'utilisateur
  const data_condition_1 = formData.emitter.company.siret.length >= 7;
  const data_condition_2 = formData.recipient.company.siret.length >= 7;
  const data_condition_3 = formData.transporter.company.siret.length >= 7;
  //const data_condition_4 = formData.wasteDetails.code.length >= 6;
  const data_condition_5 = formData.emitter.workSite.name.length >= 2;
  const data_condition_6 = formData.recipient.company.name.length >= 2;
  const data_condition_7 = formData.transporter.company.name.length >= 2;
  const data_condition_8 = formData.wasteDetails.name.length >= 2;
  const data_condition_9 = formData.recipient.processingOperation?true:false; // Vérification du CAP
  const data_condition_10 = formData.recipient.company.mail.length > 0; // Vérification de l'email du destinataire
  const data_condition_11 = formData.transporter.company.mail.length > 0; // Vérification de l'email du transporteur
  const data_condition_12 = formData.emitter.company.mail.length > 0; // Vérification de l'email de l'émetteur
  //const data_condition_13 = formData.wasteDetails.onuCode.length > 0; // Vérification du code ONU

  // Vérification que toutes les conditions sont remplies
  console.log('import parametrage data_condition_1 - emitter siret', data_condition_1);
  console.log('import parametrage data_condition_2 - recipient siret', data_condition_2);
  console.log('import parametrage data_condition_3 - transporter siret', data_condition_3);
  //console.log('import parametrage data_condition_4 - wasteDetails code', data_condition_4);
  console.log('import parametrage data_condition_5 - emitter workSite name', data_condition_5);
  console.log('import parametrage data_condition_6 - recipient company name', data_condition_6);
  console.log('import parametrage data_condition_7 - transporter company name', data_condition_7);
  //console.log('import parametrage data_condition_8 - wasteDetails name', data_condition_8);
  console.log('import parametrage data_condition_9 - recipient processingOperation', data_condition_9);
  console.log('import parametrage data_condition_10 - recipient company mail', data_condition_10);
  console.log('import parametrage data_condition_11 - transporter company mail', data_condition_11);
  console.log('import parametrage data_condition_12 - emitter company mail', data_condition_12);
  //console.log('import parametrage data_condition_13 - wasteDetails onuCode', data_condition_13);
  //const condition_completude = (data_condition_1 && data_condition_2 && data_condition_3);
      /*data_condition_5 && data_condition_6 &&
      data_condition_7 && data_condition_8 && data_condition_9 &&
      data_condition_10 && data_condition_11 && data_condition_12);*/
    const condition_completude = true;

  try {
    const formData = data.formAPI.createFormInput;
    
    
    // Création des critères de filtrage basés sur les champs importants
    const filterCriteria = {
      'formAPI.createFormInput.emitter.workSite.name': formData.emitter.workSite.name,
      'formAPI.createFormInput.emitter.company.siret': formData.emitter.company.siret,
      'formAPI.createFormInput.recipient.company.siret': formData.recipient.company.siret,
      'formAPI.createFormInput.transporter.company.siret': formData.transporter.company.siret,
      'formAPI.createFormInput.wasteDetails.code': formData.wasteDetails.code,
    };

    /*
    const test = await supabase
    .from('table_parametrage')
    .select('json_row->emitter->company->>siret, json_row->recipient->company->>siret, json_row->wasteDetails->>code')
    .eq('entreprise_id', entreprise_id);

    console.log('test', test);
    console.log('filterCriteria', filterCriteria);*/

    const { data: existingForm, error: searchError } = await supabase
      .from('table_parametrage')
      .select('json_row')
      .eq('entreprise_id', entreprise_id)
      .eq('json_row->emitter->workSite->>name', filterCriteria['formAPI.createFormInput.emitter.workSite.name'])
      .eq('json_row->emitter->company->>siret', filterCriteria['formAPI.createFormInput.emitter.company.siret'])
      .eq('json_row->recipient->company->>siret', filterCriteria['formAPI.createFormInput.recipient.company.siret'])
      .eq('json_row->transporter->company->>siret', filterCriteria['formAPI.createFormInput.transporter.company.siret'])
      .eq('json_row->wasteDetails->>code', filterCriteria['formAPI.createFormInput.wasteDetails.code'])
      .single();

    if (searchError && searchError.code !== 'PGRST116') {
      console.error('Erreur lors de la recherche:', searchError);
      return {success: false, message: 'Erreur lors de la recherche dans la table de paramétrage'};
    }
    
    // Si le formulaire n'existe pas, on l'ajoute
    if (!existingForm && condition_completude) {
      const { error: insertError } = await supabase
        .from('table_parametrage')
        .insert({user_id: user_id, entreprise_id: entreprise_id, json_row: formData});

      if (insertError) {
        console.error('Erreur lors de l\'insertion:', insertError);
        return {success: false, message: 'Erreur lors de l\'insertion dans la table de paramétrage'};
      } else {
          console.log('Nouveau formulaire détecté, table de paramétrage mise à jour');
        return {success: true, message: 'Nouveau formulaire détecté, table de paramétrage mise à jour'};
      }
    }

    if(existingForm){
      console.log('Formulaire déjà existant dans la table de paramétrage');
      return {success: true, message: 'Formulaire déjà existant dans la table de paramétrage'};
    }
    if(!condition_completude){
      return {success: true, message: 'Les données du formulaire ne sont pas complètes'};
    }

  } catch (error) {
    console.error('Erreur générale:', error);
    return {success: false, message: 'Erreur inconnue'};
  }
}