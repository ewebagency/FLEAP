import { supabase } from "@/app/database/supabaseClient";
import { DataOnSupabase_infos_json } from "@/app/register/interface/BSD_Interface";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

interface BSD_Export_Interface {
    "Code déchet": string | number | null,
    "Nom du déchet": string | number | null,
    "Volume estimé": string | number | null,
    "Code de convention Bâle": string | number | null,
    "Date de collecte": string | number | null,
    "N° BSD": string | number | null,
    "N° TrackDéchet": string | number | null,
    "Date de confirmation par le transporteur": string,

    "Adresse de collecte": string | number | null,
    
    "N° Siret du Producteur": string | number | null,
    "Raison sociale du Producteur": string | number | null,
    "Adresse du siège social du Producteur": string | number | null,

    "N° SIRET du transporteur": string|number|null,
    "Raison sociale du transporteur": string | number | null,
    "N° de récipissé du transporteur": string | number | null,

    "N° SIRET du prestataire final": string |number | null,
    "Raison sociale du prestataire final": string |number | null,
    "Adresse du prestataire final": string | number | null,
    "N° de récipissé du prestataire final": string | number | null,
    "Qualification de traitement": string | number | null,
    "Code de traitement": string | number | null,
    
    "N° SIRET de l'installation intermédiaire": string | number | null,
    "Raison sociale de l'installation intermédiaire": string | number | null,
    "N° de récipissé de l'installation intermédiaire": string | number | null,

    "N° SIRET de l'Eco-organisme": string | number | null,
    "Raison sociale de l'Eco-organisme": string | number | null,
    "Adresse de l'Eco-organisme": string | number | null,

    // Informations financières
    "Montant TTC": string | number | null,
    "Coûts de préparation HT": string | number | null,
    "Coûts de transport HT": string | number | null,
    "Coûts de traitement HT": string | number | null,
    "Coûts HT/tonne": string | number | null,
    "TVA": string | number | null,
    "Coûts TTC": string | number | null
}

interface Facture_Info_Interface {
    ligne_compta_tgap: {
        tva: string,
        titre: string,
        unite: string,
        pu_net: number,
        quantite: number,
        montant_ht: number
    },
    infos_pour_filtrer: {
        bsd_id: null,
        code_ced: string,
        date_collecte: string,
        linked_to_bsd: boolean,
        description_dechet: string,
        description_adresse_site: string
    },
    ligne_compta_contenant: {
        tva: string,
        titre: string,
        unite: string,
        pu_net: number,
        quantite: number,
        montant_ht: number
    },
    ligne_compta_transport: {
        tva: string,
        titre: string,
        unite: string,
        pu_net: number,
        quantite: number,
        montant_ht: number
    },
    ligne_compta_traitement: {
        tva: string,
        titre: string,
        unite: string,
        pu_net: number,
        quantite: number,
        montant_ht: number
    },
    ligne_compta_preparation: {
        tva: string,
        titre: string,
        unite: string,
        pu_net: number,
        quantite: number,
        montant_ht: number
    },
    ligne_compta_rachat_matiere: {
        tva: string,
        titre: string,
        unite: string,
        pu_net: number,
        quantite: number,
        montant_ht: number
    }
}
/*
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    const {data, error} = await supabase
    .from('bsd')
    .select('infos_json, facture_treated, facture_infos, readable_id_track_dechets')
    .eq('user_id', user_id); //Attention à terme filtrer sur la  boite et pas le user id !!!! ⚠⚠⚠⚠⚠

    if(error) {
        return NextResponse.json({ message: 'Erreur lors de l\'export' }, {status: 500});
    } else {
        return exportToExcel(formatBSDData(data), 'export_register');
        //return NextResponse.json({ message: 'Export réussi' }, {status: 200});
    }
}

const formatBSDData = (data: {
    infos_json: DataOnSupabase_infos_json, 
    facture_treated: boolean, 
    facture_infos: Facture_Info_Interface,
    readable_id_track_dechets: string
}[]) => {
    return data.map((item) => {
        const getValue = (accessor: () => string|number|boolean|null, defaultValue: string = 'Non trouvé') => {
            try {
                const value = accessor()
                return value ?? defaultValue;
            } catch {
                return defaultValue;
            }
        };

        return {
            "Code déchet": getValue(() => item.infos_json.formAPI.createFormInput.wasteDetails.code),
            "Nom du déchet": getValue(() => ''),
            "Volume estimé": getValue(() => ''),
            "Code de convention Bâle": getValue(() => null, 'Pas encore disponible'),
            "Date de collecte": getValue(() => ''),
            "N° BSD": getValue(() => null, item.readable_id_track_dechets),
            "N° TrackDéchet": getValue(() => null, 'Pas encore disponible'),
            "Date de confirmation par le transporteur": getValue(() => null, 'Pas encore disponible').toString(),

            "Adresse de collecte": getValue(() => item.infos_json.formAPI.createFormInput.emitter.workSite.address + ' ' + item.infos_json.formAPI.createFormInput.emitter.workSite.postalCode + ' ' + item.infos_json.formAPI.createFormInput.emitter.workSite.city),
            
            "N° Siret du Producteur": getValue(() => item.infos_json.formAPI.createFormInput.emitter.company.siret),
            "Raison sociale du Producteur": getValue(() => item.infos_json.formAPI.createFormInput.emitter.company.name),
            "Adresse du siège social du Producteur": getValue(() => item.infos_json.formAPI.createFormInput.emitter.company.address),

            "N° SIRET du transporteur": getValue(() => item.infos_json.formAPI.createFormInput.transporter.company.siret),
            "Raison sociale du transporteur": getValue(() => item.infos_json.formAPI.createFormInput.transporter.company.name),
            "N° de récipissé du transporteur": getValue(() => null, 'Pas encore disponible'),

            "N° SIRET du prestataire final": getValue(() => item.infos_json.formAPI.createFormInput.recipient.company.siret),
            "Raison sociale du prestataire final": getValue(() => item.infos_json.formAPI.createFormInput.recipient.company.name),
            "Adresse du prestataire final": getValue(() => item.infos_json.formAPI.createFormInput.recipient.company.address),
            "N° de récipissé du prestataire final": getValue(() => null, 'Pas encore disponible'),
            "Qualification de traitement": getValue(() => null, 'Pas encore disponible'),
            "Code de traitement": getValue(() => null, item.infos_json.formAPI.createFormInput.recipient.processingOperation.toString()),
            
            "N° SIRET de l'installation intermédiaire": getValue(() => item.infos_json.formAPI.createFormInput.intermediary.company.siret),
            "Raison sociale de l'installation intermédiaire": getValue(() => item.infos_json.formAPI.createFormInput.intermediary.company.name),
            "N° de récipissé de l'installation intermédiaire": getValue(() => null, 'Pas encore disponible'),

            "N° SIRET de l'Eco-organisme": getValue(() => item.infos_json.formAPI.createFormInput.ecoOrganism.company.siret),
            "Raison sociale de l'Eco-organisme": getValue(() => item.infos_json.formAPI.createFormInput.ecoOrganism.company.name),
            "Adresse de l'Eco-organisme": getValue(() => item.infos_json.formAPI.createFormInput.ecoOrganism.company.address),

            // Informations financières
            "Montant TTC": item.facture_treated ? "Bientôt disponible" : "Pas encore disponible",
            "Coûts de préparation HT": item.facture_treated ? 
                getValue(() => item.facture_infos.ligne_compta_preparation.montant_ht.toString()) : 
                "Pas encore disponible",
            "Coûts de transport HT": item.facture_treated ? 
                getValue(() => item.facture_infos.ligne_compta_transport.montant_ht.toString()) : 
                "Pas encore disponible",
            "Coûts de traitement HT": item.facture_treated ? 
                getValue(() => item.facture_infos.ligne_compta_traitement.montant_ht.toString()) : 
                "Pas encore disponible",
            "Coûts HT/tonne": item.facture_treated ? 
                getValue(() => item.facture_infos.ligne_compta_traitement.montant_ht.toString()) : 
                "Pas encore disponible",
            "TVA": item.facture_treated ? "Bientôt disponible" : "Pas encore disponible",
            "Coûts TTC": item.facture_treated ? "Bientôt disponible" : "Pas encore disponible"
        };
    });
};

const exportToExcel = (data : BSD_Export_Interface[], fileName: string) => {
    // Convertir le JSON en feuille de calcul
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  
    // Générer le fichier Excel en mémoire
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  // Configurer la réponse HTTP pour le téléchargement
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Disposition': `attachment; filename="${fileName}.xlsx"`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
    });
};
*/