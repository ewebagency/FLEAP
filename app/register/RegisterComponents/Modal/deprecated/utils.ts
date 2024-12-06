/*import { toast } from "react-hot-toast";
import { Gouv, DataParametrageInterface, Form_API_Interface_New, Anything, DataSupplementaireInterface, DataTotalInterface, BSDD_TrackDechets } from "../../../interface/BSD_Interface";
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


export const parseAddress = (address: string) : {fullAddress:string, street: string; postalCode: string; city: string} => {
    try {
        const regex = /^(.*)\s(\d{5})\s(.*)$/;
        const match = address.match(regex);
  
    if (match) {
      const street = match[1].trim();
      const postalCode = match[2];
      const city = match[3].trim();
  
      const result = {
        fullAddress: address,
        street: street,
        postalCode: postalCode,
        city: city,
      };

      return result;
    } else {
      console.log("The address does not match the expected format : ", address);
      return  {
        fullAddress: address,
        street: '',
        postalCode: '',
        city: '',
      };
        }
    } catch (error) {
        console.error('Erreur parseAddress:', error);
        return {fullAddress: address, street: '', postalCode: '', city: ''};
    }
}
  
const int = (value: number | string | boolean) => {
    return parseInt(String(value));
}

const API_Format = async (data_meta: {json_row: DataParametrageInterface}) => {
    const data = data_meta.json_row;
    //const emitter_raison = await getRaisonSocial(data.site_siret);
    //const emitter_nom = emitter_raison.raison.first;
    //const emitter_adresse = emitter_raison.adresse.first;

    //const recipient_raison = await getRaisonSocial(data.prestataire_final_siret);
    //const recipient_nom = recipient_raison.raison.first;
    //const recipient_adresse = recipient_raison.adresse.first;

    //const transporter_raison = await getRaisonSocial(data.transporteur_siret);
    //const transporter_nom = transporter_raison.raison.first;
    //const transporter_adresse = transporter_raison.adresse.first;
    const emitter_nom = data.producteur_nom;
    const emitter_adresse = data.site_adresse; //attention site_adresse != adresse du siège social trouvé par api mais trop long pour l'instant  
    const recipient_nom = data.prestataire_final_nom;
    const recipient_adresse = data.prestataire_final_adresse;
    const transporter_nom = data.transporteur_nom;
    const transporter_adresse = data.transporteur_adresse;

    //console.log('emitter_nom', emitter_nom, data.site_siret);
    //console.log('transporter_nom', transporter_nom, data.transporteur_siret);
    //console.log('recipient_nom', recipient_nom, data.prestataire_final_siret);
    
    const dataFormAPI : {formAPI: {createFormInput: BSDD_TrackDechets}} = {
        "formAPI": {
          "createFormInput": {
            "emitter": {
              "type": "PRODUCER",
              "company": {
                "mail": data.producteur_personne_email,
                "name": emitter_nom,
                "phone": data.producteur_personne_tel,
                "siret": extractSiret(data.site_siret)?? "",
                "orgId": data.site_siret.toString(),
                "country": "FRANCE",
                "address": emitter_adresse,
                "contact": data.producteur_personne_firstname + " " + data.producteur_personne_lastname
              },
              "workSite": {
                "name": data.site_nom,
                "city": parseAddress(String(emitter_adresse)).city,
                "address": parseAddress(String(emitter_adresse)).street,
                "postalCode": parseAddress(String(emitter_adresse)).postalCode
              }
            },
            "recipient": {
              "cap": data.cap,
              "company": {
                "mail": data.prestataire_final_personne_email,
                "name": recipient_nom,
                "phone": data.prestataire_final_personne_tel,
                "siret": data.prestataire_final_siret,
                "address": recipient_adresse,
                "contact": data.prestataire_final_personne_firstname + " " + data.prestataire_final_personne_lastname
              },
              "processingOperation": data.prestataire_final_code_traitement
            },
            "transporter": {
              "company": {
                "mail": data.transporteur_personne_email,
                "name": transporter_nom,
                "phone": data.transporteur_personne_tel,
                "siret": data.transporteur_siret,
                "address": transporter_adresse,
                "contact": data.transporteur_personne_firstname + " " + data.transporteur_personne_lastname
              }
            },
            "wasteDetails": {
              "code": data.ced,
              "name": data.description_ced,
              "onuCode": "UN " + data.onu,
              "quantity": int(data.contenant_nombre_indicatif) * int(data.contenant_volume_unitaire),
              "consistence": data.consistance,
              "quantityType": "REAL",
              "packagingInfos": [
                {
                  "type": data.contenant_code,
                  "quantity": data.contenant_nombre_indicatif,
                  //"description": data.contenant_description
                }
              ]
            }
          }
        }
      }

    const dataSupplementaire : DataSupplementaireInterface = {
        "site": data.site_nom,
        "filiere": data.filiere_nom,
        "description": data.contenant_description,
        "unitVolume": data.contenant_volume_unitaire
    }
        
    return {dataFormAPI, dataSupplementaire} as DataTotalInterface;
};

export const API_Format_Array = async (data: {json_row: DataParametrageInterface}[]) => {
    const dataFormAPI_Array = <DataTotalInterface[]>[];
    for (const item of data) {
        dataFormAPI_Array.push(await API_Format(item));
    }
    return dataFormAPI_Array;
}

export const getDataAutocompletion = async (user_id:string, site?:string, filiere?:string, dechet_code?:string) => {
  const {data: data_get, error} = await supabase
  .from('table_parametrage')
  .select('*')
  .eq('user_id', user_id)
  //.limit(3);
  let data = data_get;
  if (error) {
      toast.error(error.message);
  } else if(data){

      if(site) {
          const FilteredData = data.filter((item) => item.json_row.site_nom === site);
          if(FilteredData.length >= 1) {
            data = FilteredData;
          }
      }
      if(filiere) {
          const FilteredData = data.filter((item) => item.json_row.filiere_nom === filiere);
          if(FilteredData.length >= 1) {
            data = FilteredData;
          }
      }
      if(dechet_code) {
          const FilteredData = data.filter((item) => item.json_row.ced === dechet_code);
          if(FilteredData.length >= 1) {
            data = FilteredData;
          }
      }

      const dataFormAPI = await API_Format_Array(data);
      return dataFormAPI;
  }
};



export const formatText = (text: Anything) => {
  if (!text) return ''; // Gérer les cas où le texte est vide ou null
  return String(text).charAt(0).toUpperCase() + String(text).slice(1).toLowerCase();
}


export const sendData_to_Cloud = async (data: DataTotalInterface, user_id: string) => {

  //TODO : ajouter le poids et le volume estimé

  //Aller chercher les raisons sociales
  const emitter_raison: Gouv = await getRaisonSocial(data.dataFormAPI.formAPI.createFormInput.emitter.company.siret) || {raison: {first: String(data.dataFormAPI.formAPI.createFormInput.emitter.company.name)}, adresse: {first: String(data.dataFormAPI.formAPI.createFormInput.emitter.company.address)}};
  const recipient_raison: Gouv = await getRaisonSocial(data.dataFormAPI.formAPI.createFormInput.recipient.company.siret) || {raison: {first: String(data.dataFormAPI.formAPI.createFormInput.recipient.company.name)}, adresse: {first: String(data.dataFormAPI.formAPI.createFormInput.recipient.company.address)}};
  const transporter_raison: Gouv = await getRaisonSocial(data.dataFormAPI.formAPI.createFormInput.transporter.company.siret) || {raison: {first: String(data.dataFormAPI.formAPI.createFormInput.transporter.company.name)}, adresse: {first: String(data.dataFormAPI.formAPI.createFormInput.transporter.company.address)}};
  const emitter_adresse:string = emitter_raison.adresse.first;
  const recipient_adresse:string = recipient_raison.adresse.first;
  const transporter_adresse:string = transporter_raison.adresse.first;
  const emitter_nom:string = emitter_raison.raison.first;
  const recipient_nom:string = recipient_raison.raison.first;
  const transporter_nom:string = transporter_raison.raison.first;

  data.dataFormAPI.formAPI.createFormInput.emitter.company.address = emitter_adresse;
  data.dataFormAPI.formAPI.createFormInput.recipient.company.address = recipient_adresse;
  data.dataFormAPI.formAPI.createFormInput.transporter.company.address = transporter_adresse;
  data.dataFormAPI.formAPI.createFormInput.emitter.company.name = emitter_nom;
  data.dataFormAPI.formAPI.createFormInput.recipient.company.name = recipient_nom;
  data.dataFormAPI.formAPI.createFormInput.transporter.company.name = transporter_nom;
  //Récupérer le siret bien commme il faut
  data.dataFormAPI.formAPI.createFormInput.emitter.company.siret = extractSiret(data.dataFormAPI.formAPI.createFormInput.emitter.company.siret) || "";
  data.dataFormAPI.formAPI.createFormInput.recipient.company.siret = extractSiret(data.dataFormAPI.formAPI.createFormInput.recipient.company.siret) || "";
  data.dataFormAPI.formAPI.createFormInput.transporter.company.siret = extractSiret(data.dataFormAPI.formAPI.createFormInput.transporter.company.siret) || "";

  //Il faut que le siret envoyé sur trackdéchets corresponde au token envoyé lors de la demande
  const my_company = await getInfosFromMyCompany();
  data.dataFormAPI.formAPI.createFormInput.emitter.company.siret = my_company.siret;
  data.dataFormAPI.formAPI.createFormInput.emitter.company.name = my_company.nom;


  //Envoyer sur l'api
  try {
    const response = await fetch('/api/demande_collecte/creation_bsdd', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
      },
      body: JSON.stringify({
          user_id: user_id, 
          data: {formAPI: data.dataFormAPI.formAPI, dataSupplementaire: data.dataSupplementaire}
      }),
    });
    const result = await response.json();
    if (!result.success) {
      return {success: false, message: result.message};
    }
    return {success: true, message: "BSD créé avec succès dans TrackDéchets"};
  } catch (error) {
    console.error("Erreur dans l'envoie du formulaire:", error);
    return {success: false, message: "Erreur inconnue dans l'envoie du formulaire"};
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

const getInfosFromMyCompany = async () => {
  return {siret: "00000063963334", nom: "TestCompany"};
}
*/