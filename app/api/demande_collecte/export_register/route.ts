export const dynamic = 'force-dynamic';

import { supabase } from "@/app/database/supabaseClient";
import { DataOnSupabase_infos_json, FormInput } from "@/app/register/interface/BSD_Interface";
import { getMappingTableFiliere } from "@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface BSD_Export_Interface {
    "Filière": string | number | null,
    "Code déchet": string | number | null,
    "Nom du déchet": string | number | null,
    "Date de création": string | number | null,
    "N° TrackDéchet": string | number | null,
    "Point de collecte": string | number | null,
    "Adresse de collecte": string | number | null,
    
    "N° Siret du Producteur": string | number | null,
    "Raison sociale du Producteur": string | number | null,

    "N° SIRET du transporteur": string | number | null,
    "Raison sociale du transporteur": string | number | null,
    "N° de récipissé du transporteur": string | number | null,

    "N° SIRET du prestataire final": string | number | null,
    "Raison sociale du prestataire final": string | number | null,
    "Adresse du prestataire final": string | number | null,
    "N° de récipissé du prestataire final": string | number | null,
    "Code de traitement": string | number | null,

    "Date de collecte": string | number | null,
    "Poids (tonne)": string | number | null,
    "Contenant": string | number | null,
    "Nombre de contenants": string | number | null,
    
    "ADR": string | number | null,
    "Code ONU": string | number | null,

    "N° SIRET du courtier": string | number | null,
    "Raison sociale du courtier": string | number | null,
    "N° de récipissé du courtier": string | number | null,

    "N° SIRET du négociant": string | number | null,
    "Raison sociale du négociant": string | number | null,
    "N° de récipissé du négociant": string | number | null
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

export async function GET(request: Request) {
    try {
    const { searchParams } = new URL(request.url);
    const entreprise_id = searchParams.get('entreprise_id');
    const bsdIds = searchParams.get('bsd_ids')?.split(',') || [];
        
        if (!entreprise_id) {
            console.error('Pas d\'entreprise_id fourni');
            return NextResponse.json({ message: 'entreprise_id manquant' }, { status: 400 });
        }
    
    // Récupérer les données BSD
    let query = supabase
        .from('bsd')
        .select('id, infos_json, created_at, facture_treated, facture_infos, readable_id_track_dechets, other_infos')
        .eq('entreprise_id', entreprise_id)
        .order('created_at', { ascending: false });

    // Si des IDs sont fournis, filtrer par ces IDs
    if (bsdIds.length > 0) {
        query = query.in('id', bsdIds);
    }

    const {data: bsdData, error: bsdError} = await query;

        if (bsdError) {
            console.error('Erreur lors de la récupération des BSDs:', bsdError);
            return NextResponse.json({ message: 'Erreur lors de la récupération des BSDs' }, { status: 500 });
        }

        if (!bsdData || bsdData.length === 0) {
            console.log('Aucun BSD trouvé pour cette entreprise');
            return NextResponse.json({ message: 'Aucun BSD trouvé' }, { status: 404 });
        }

    // Récupérer les informations de l'entreprise
    const {data: entrepriseData, error: entrepriseError} = await supabase
    .from('entreprise')
    .select('name')
    .eq('id', entreprise_id)
    .single();

        if (entrepriseError) {
            console.error('Erreur lors de la récupération des infos entreprise:', entrepriseError);
            return NextResponse.json({ message: 'Erreur lors de la récupération des infos entreprise' }, { status: 500 });
    }

        const mapping_filiere = await getMappingTableFiliere(entreprise_id);
        console.log('Mapping filière récupéré:', mapping_filiere);

        try {
    const var_to_export = formatBSDData(bsdData, mapping_filiere) as BSD_Export_Interface[];
            console.log('Données formatées avec succès, nombre d\'entrées:', var_to_export.length);
    
    return exportToExcel(
        var_to_export, 
        'export_register',
        entrepriseData?.name ?? 'Entreprise'
    );
        } catch (formatError) {
            console.error('Erreur lors du formatage des données:', formatError);
            return NextResponse.json({ 
                message: 'Erreur lors du formatage des données',
                error: formatError instanceof Error ? formatError.message : 'Erreur inconnue'
            }, { status: 500 });
        }

    } catch (error) {
        console.error('Erreur générale:', error);
        return NextResponse.json({ 
            message: 'Erreur lors de l\'export',
            error: error instanceof Error ? error.message : 'Erreur inconnue'
        }, { status: 500 });
    }
}

const formatBSDData = (data: {
    infos_json: {formAPI: {createFormInput: FormInput}}, 
    created_at: string,
    facture_treated: boolean, 
    facture_infos: Facture_Info_Interface,
    readable_id_track_dechets: string,
    other_infos: {
        containerDescription: string
    },
    id: string
}[], mapping_filiere: {ced: string, filiere: string}[]) => {
    try {
        return data.map((item, index) => {
            try {
        const getValue = (accessor: () => string|number|boolean|null, defaultValue: string = ''): string|number|null => {
            try {
                const value = accessor();
                if (typeof value === 'boolean') {
                    return value.toString();
                }
                return value ?? defaultValue;
                    } catch (error) {
                        console.error(`Erreur lors de l'accès à une valeur, index ${index}:`, error);
                return defaultValue;
            }
        };

        const filiere = mapping_filiere.find(mapping => mapping.ced?.replaceAll(' ', '').replace('*', '') === item.infos_json.formAPI.createFormInput.wasteDetails.code?.replaceAll(' ', '').replace('*', ''));
        
        return {
            "Filière": getValue(() => filiere ? filiere.filiere : ''),
            "Code déchet": getValue(() => item.infos_json.formAPI.createFormInput.wasteDetails.code),
            "Nom du déchet": getValue(() => item.infos_json.formAPI.createFormInput.wasteDetails.name),
            "Date de création": getValue(() => format(new Date(item.created_at), 'dd/MM/yyyy', { locale: fr })),
            "N° TrackDéchet": getValue(() => null, ["Ligne demandée", "Ligne validée", "Ligne automatique", "Ligne créée", "ID non disponible"].includes(item.readable_id_track_dechets) ? "ID FLEAP : " + item.id : item.readable_id_track_dechets),
            "Point de collecte": getValue(() => {
                const workSite = item.infos_json.formAPI.createFormInput.emitter.workSite;
                return workSite?.name ?? '';
            }),
            "Adresse de collecte": getValue(() => {
                const workSite = item.infos_json.formAPI.createFormInput.emitter.workSite;
                if (!workSite) return '';
                return `${workSite.address ?? ''} ${workSite.postalCode ?? ''} ${workSite.city ?? ''}`.trim() || 'Non renseigné';
            }),
            
            "N° Siret du Producteur": getValue(() => item.infos_json.formAPI.createFormInput.emitter.company.siret),
            "Raison sociale du Producteur": getValue(() => item.infos_json.formAPI.createFormInput.emitter.company.name),

            "N° SIRET du transporteur": getValue(() => item.infos_json.formAPI.createFormInput.transporter.company.siret),
            "Raison sociale du transporteur": getValue(() => item.infos_json.formAPI.createFormInput.transporter.company.name),
            "N° de récipissé du transporteur": getValue(() => null, item.infos_json.formAPI.createFormInput.transporter.receipt ?? ''),

            "N° SIRET du prestataire final": getValue(() => item.infos_json.formAPI.createFormInput.recipient.company.siret),
            "Raison sociale du prestataire final": getValue(() => item.infos_json.formAPI.createFormInput.recipient.company.name),
            "Adresse du prestataire final": getValue(() => item.infos_json.formAPI.createFormInput.recipient.company.address),
            //"N° de récipissé du prestataire final": getValue(() => null, ''),
            
        
            "Date de collecte": getValue(() => item.infos_json.formAPI.createFormInput.takenOverAt ? format(new Date(item.infos_json.formAPI.createFormInput.takenOverAt), 'dd/MM/yyyy', { locale: fr }) : ''),
            "Poids (tonne)": getValue(() => item.infos_json.formAPI.createFormInput.wasteDetails.quantity),
            "Contenant": getValue(() => item.other_infos.containerDescription),
            "Nombre de contenants": getValue(() => item.infos_json.formAPI.createFormInput.wasteDetails.packagingInfos.map(packaging => packaging.quantity===0 ? 1 : packaging.quantity).join(', ')),
            "Code de traitement": getValue(() => null, item.infos_json.formAPI.createFormInput.recipient.processingOperation?.toString() ?? ''),

            "Code ONU": getValue(() => item.infos_json.formAPI.createFormInput.wasteDetails.onuCode),
            //"ADR": getValue(() => item.infos_json.formAPI.createFormInput.wasteDetails.isSubjectToADR ?? '')

            "N° SIRET du courtier": getValue(() => item.infos_json.formAPI.createFormInput.broker?.company?.siret ?? null),
            "Raison sociale du courtier": getValue(() => item.infos_json.formAPI.createFormInput.broker?.company?.name ?? null),
            "N° de récipissé du courtier": getValue(() => null, item.infos_json.formAPI.createFormInput.broker?.receipt ?? ''),

            "N° SIRET du négociant": getValue(() => item.infos_json.formAPI.createFormInput.trader?.company?.siret ?? null),
            "Raison sociale du négociant": getValue(() => item.infos_json.formAPI.createFormInput.trader?.company?.name ?? null),
            //"Adresse du négociant": getValue(() => item.infos_json.formAPI.createFormInput.trader?.company?.address ?? null),
            "N° de récipissé du négociant": getValue(() => null, item.infos_json.formAPI.createFormInput.trader?.receipt ?? ''),
        };
            } catch (error) {
                console.error(`Erreur lors du traitement de l'item ${index}:`, error);
                throw error;
            }
    });
    } catch (error) {
        console.error('Erreur dans formatBSDData:', error);
        throw error;
    }
};

const exportToExcel = (data: BSD_Export_Interface[], fileName: string, entrepriseName: string) => {
    try {
    // Créer une nouvelle feuille de calcul
    const worksheet = XLSX.utils.aoa_to_sheet([]);
    const workbook = XLSX.utils.book_new();

    // Ajouter le titre et la date
    const today = format(new Date(), 'dd MMMM yyyy HH:mm', { locale: fr });
    const title = `Registre des déchets - ${entrepriseName}`;
    const subtitle = `Export réalisé le ${today}`;

    // Définir les styles
    const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "2B5797" } },
        alignment: { horizontal: "center" }
    };

    const titleStyle = {
        font: { bold: true, size: 16 },
        alignment: { horizontal: "center" }
    };

    const subtitleStyle = {
        font: { italic: true, size: 12 },
        alignment: { horizontal: "center" }
    };

    // Ajouter le titre et sous-titre
    worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: Object.keys(data[0]).length - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: Object.keys(data[0]).length - 1 } }
    ];

    XLSX.utils.sheet_add_aoa(worksheet, [[title], [subtitle]], { origin: 'A1' });

    // Ajouter les données à partir de la ligne 4
    XLSX.utils.sheet_add_json(worksheet, data, { origin: 'A4' });

    // Appliquer les styles aux en-têtes de colonnes
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + '4';
        if (!worksheet[address]) continue;
        worksheet[address].s = headerStyle;
    }

    // Ajuster la largeur des colonnes
    const columnWidths = Object.keys(data[0]).map(key => ({
        wch: Math.max(20, key.length * 1.2)
    }));
    worksheet['!cols'] = columnWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, "Registre BSD");

    // Générer le fichier Excel
    const buffer = XLSX.write(workbook, { 
        type: 'buffer', 
        bookType: 'xlsx',
        bookSST: false
    });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
            'Content-Disposition': `attachment; filename="${fileName}_${format(new Date(), 'yyyy-MM-dd')}.xlsx"`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
    });
    } catch (error) {
        console.error('Erreur lors de la création du fichier Excel:', error);
        throw error;
    }
};
