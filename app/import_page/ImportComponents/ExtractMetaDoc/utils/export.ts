import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PdfInfo } from '../interface/pdf_interface';
import { getPdfInfoById, getParamsMappingByEntreprise } from './bdd';
import { candidats_BDD, ProposeActionAuto, ParamsMapping, normalizePdfData } from './link';
import { create_in_bdd_preview, translateByMapping } from './link_or_create_bdd';
import { supabase } from '@/app/database/supabaseClient';
import { LinkConfig } from './default_auto_link_params';

// Interface pour les données d'export
type ExportRow = {
    "Nom PDF": string | null;
    "Index déchet": number | null;
    "Action": string | null;
    "ID FLEAP": string | null;
    "Code CED": string | null;
    "Nom Déchet": string | null;
    "Date": string | null;
    "N° BSD": string | null;
    "N° Bon": string | null;
    "N° Facture": string | null;
    "Nom du Site": string | null;
    "N° du Site": string | null;
    "Nom Transporteur": string | null;
    "SIRET transporteur": string | null;
    "Récipissé Transporteur": string | null;
    "Immatriculation": string | null;
    "SIRET Exutoire": string | null;
    "Nom Exutoire": string | null;
    "Adresse Exutoire": string | null;
    "Récipissé Exutoire": string | null;
    "Code de traitement": string | null;
    "Poids (tonne)": string | null;
    "Contenant": string | null;
    "Nombre de contenants": string | null;
    "ADR": string | null;
    "Code ONU": string | null;
    "CAP": string | null;
};

/**
 * Exporte les lignes BSD qui seraient créées/linkées pour les PDFs sélectionnés
 */
export const exportPdfsToExcel = async (
    pdfIds: string[],
    entrepriseId: number,
    userId: string | undefined,
    linkConfig: LinkConfig
): Promise<void> => {
    if (pdfIds.length === 0) {
        throw new Error('Aucun PDF sélectionné');
    }

    // Récupérer les mappings
    const { data: mappings, error: mappingError } = await getParamsMappingByEntreprise(entrepriseId);
    if (mappingError || !mappings) {
        throw new Error('Impossible de récupérer les mappings');
    }

    const exportRows: ExportRow[] = [];

    // Traiter chaque PDF
    for (const pdfId of pdfIds) {
        const pdfName = pdfId; // Nom par défaut
        try {
            // Récupérer les infos du PDF
            const { data: pdfInfo, error: pdfError } = await getPdfInfoById(pdfId, entrepriseId);
            if (pdfError || !pdfInfo) {
                console.error(`[export] Erreur PDF ${pdfId}:`, pdfError);
                // Exporter quand même une ligne d'erreur
                exportRows.push({
                    "Nom PDF": pdfId,
                    "Index déchet": null,
                    "Action": "Erreur: PDF introuvable",
                    "ID FLEAP": null,
                    "Code CED": null,
                    "Nom Déchet": null,
                    "Date": null,
                    "N° BSD": null,
                    "N° Bon": null,
                    "N° Facture": null,
                    "Nom du Site": null,
                    "N° du Site": null,
                    "Nom Transporteur": null,
                    "SIRET transporteur": null,
                    "Récipissé Transporteur": null,
                    "Immatriculation": null,
                    "SIRET Exutoire": null,
                    "Nom Exutoire": null,
                    "Adresse Exutoire": null,
                    "Récipissé Exutoire": null,
                    "Code de traitement": null,
                    "Poids (tonne)": null,
                    "Contenant": null,
                    "Nombre de contenants": null,
                    "ADR": null,
                    "Code ONU": null,
                    "CAP": null,
                });
                continue;
            }

            const pdf = pdfInfo as PdfInfo;
            const pdfName = pdf.name_pdf || pdfId;
            const infosRaw = pdf.infos_raw || {};
            const dechets = Array.isArray(infosRaw.dechet) ? infosRaw.dechet : [];

            // Si aucun déchet, créer au moins une ligne avec le nom du PDF
            if (dechets.length === 0) {
                exportRows.push({
                    "Nom PDF": pdfName,
                    "Index déchet": null,
                    "Action": "Aucun déchet",
                    "ID FLEAP": null,
                    "Code CED": null,
                    "Nom Déchet": null,
                    "Date": null,
                    "N° BSD": null,
                    "N° Bon": null,
                    "N° Facture": null,
                    "Nom du Site": null,
                    "N° du Site": null,
                    "Nom Transporteur": null,
                    "SIRET transporteur": null,
                    "Récipissé Transporteur": null,
                    "Immatriculation": null,
                    "SIRET Exutoire": null,
                    "Nom Exutoire": null,
                    "Adresse Exutoire": null,
                    "Récipissé Exutoire": null,
                    "Code de traitement": null,
                    "Poids (tonne)": null,
                    "Contenant": null,
                    "Nombre de contenants": null,
                    "ADR": null,
                    "Code ONU": null,
                    "CAP": null,
                });
                continue; // Passer au PDF suivant
            }

            // Récupérer les candidats BSD (fenêtre large)
            const pdfDate = dechets.length > 0 && dechets[0] && typeof dechets[0] === 'object'
                ? (dechets[0] as Record<string, unknown>).date as string | undefined
                : undefined;
            
            const candidates = await candidats_BDD(
                entrepriseId,
                pdfDate || new Date().toISOString(),
                200
            );

            // Traiter chaque déchet
            for (let index = 0; index < dechets.length; index++) {
                try {
                    // Déterminer l'action (to_link, to_create, to_check_by_user)
                    const proposeResult = ProposeActionAuto(
                        infosRaw,
                        candidates,
                        mappings as ParamsMapping,
                        linkConfig.params,
                        index
                    );

                    type BsdData = {
                        infos_json?: {
                            formAPI?: {
                                createFormInput?: {
                                    emitter?: { company?: { name?: string; siret?: string }; workSite?: { name?: string; address?: string } };
                                    recipient?: { company?: { name?: string; siret?: string }; processingOperation?: string };
                            transporter?: { company?: { name?: string; siret?: string; address?: string }; receipt?: string; numberPlate?: string };
                                    wasteDetails?: { code?: string; name?: string; quantity?: number };
                                    takenOverAt?: string;
                                };
                            };
                        };
                        other_infos?: {
                            numeroBon?: string;
                            numeroFacture?: string;
                            containerDescription?: string;
                            mentionAdr?: string;
                            codeBale?: string;
                        };
                        readable_id_track_dechets?: string;
                        created_at?: string;
                    };

                    let bsdData: BsdData | null = null;
                    let bsdId: string | null = null;
                    let actionLabel = 'Non traité';

                    if (proposeResult.action === 'to_link' && proposeResult.id_candidat) {
                        // Récupérer les données du BSD existant
                        bsdId = proposeResult.id_candidat;
                        actionLabel = 'Lier';
                        const { data: existingBsd, error: bsdError } = await supabase
                            .from('bsd')
                            .select('infos_json, other_infos, readable_id_track_dechets, created_at')
                            .eq('id', bsdId)
                            .eq('entreprise_id', entrepriseId)
                            .maybeSingle();
                        
                        if (!bsdError && existingBsd) {
                            bsdData = {
                                infos_json: existingBsd.infos_json as BsdData['infos_json'],
                                other_infos: existingBsd.other_infos as BsdData['other_infos'],
                                readable_id_track_dechets: existingBsd.readable_id_track_dechets,
                                created_at: existingBsd.created_at
                            };
                        }
                    } else {
                        // Pour to_create, to_check_by_user, ou aucune action, essayer create_in_bdd_preview
                        actionLabel = proposeResult.action === 'to_create' ? 'Créer' 
                            : proposeResult.action === 'to_check_by_user' ? 'À vérifier'
                            : 'Non traité';
                        
                        try {
                            const previewResult = await create_in_bdd_preview(
                                entrepriseId,
                                pdfId,
                                index,
                                userId
                            );
                            
                            if (previewResult && typeof previewResult === 'object' && 'preview' in previewResult) {
                                const preview = previewResult.preview as {
                                    infos_json?: unknown;
                                    other_infos?: unknown;
                                    readable_id_track_dechets?: string;
                                    created_at?: string;
                                };
                                bsdData = {
                                    infos_json: preview.infos_json as BsdData['infos_json'],
                                    other_infos: preview.other_infos as BsdData['other_infos'],
                                    readable_id_track_dechets: preview.readable_id_track_dechets,
                                    created_at: preview.created_at
                                };
                                bsdId = proposeResult.action === 'to_create' ? 'À créer' 
                                    : proposeResult.action === 'to_check_by_user' ? 'À vérifier'
                                    : 'Non traité';
                            }
                        } catch (previewError) {
                            console.warn(`[export] create_in_bdd_preview échoué pour PDF ${pdfId}, déchet ${index}, extraction depuis infos_raw:`, previewError);
                        }
                    }

                    // Si bsdData est toujours null, extraire directement depuis infos_raw
                    if (!bsdData) {
                        const dechet = dechets[index] as Record<string, unknown> | undefined;
                        if (dechet) {
                            // Normaliser les données depuis infos_raw avec les mappings
                            const normalized = normalizePdfData(
                                infosRaw,
                                mappings.params_mapping_site || {},
                                mappings.params_mapping_presta || {},
                                index
                            );

                            // Extraire les données du déchet
                            const date = (dechet.date as string) || normalized.date || '';
                            const ced = (dechet.ced as string) || normalized.ced || '';
                            const nom = (dechet.nom as string) || normalized.waste_name || '';
                            const tonnage = parseFloat(String((dechet.tonnage as string) || '').replace(',', '.')) || 0;
                            const numBon = (dechet.num_bon as string) || normalized.num_bon || '';
                            const numBsd = (dechet.num_bsd as string) || normalized.num_bsd || '';
                            const contenant = (dechet.contenant as string) || (dechet.nom_contenant as string) || '';
                            
                            // Traduire site et prestataire avec les mappings
                            const siteRaw = (dechet.nom_site as string) || (infosRaw.site_raw as string) || normalized.site || '';
                            const prestaRaw = (infosRaw.presta_raw as string) || normalized.prestataire || '';
                            const siteTranslated = translateByMapping(siteRaw, mappings.params_mapping_site || {});
                            const prestaTranslated = translateByMapping(prestaRaw, mappings.params_mapping_presta || {});
                            const immatriculation = (dechet.immatriculation as string) || (infosRaw as { immatriculation?: string })?.immatriculation || '';

                            // Construire un bsdData minimal depuis infos_raw
                            bsdData = {
                                infos_json: {
                                    formAPI: {
                                        createFormInput: {
                                            emitter: {
                                                company: {
                                                    name: siteTranslated.name || siteRaw,
                                                    siret: siteTranslated.siret || ''
                                                }
                                            },
                                            recipient: {
                                                company: {
                                                    name: prestaTranslated.name || prestaRaw,
                                                    siret: prestaTranslated.siret || ''
                                                },
                                                processingOperation: (dechet.d_r as string) || ''
                                            },
                                            transporter: {
                                                company: {
                                                    name: prestaTranslated.name || prestaRaw,
                                                    siret: prestaTranslated.siret || ''
                                                },
                                                numberPlate: immatriculation
                                            },
                                            wasteDetails: {
                                                code: ced,
                                                name: nom,
                                                quantity: tonnage
                                            },
                                            takenOverAt: date
                                        }
                                    }
                                },
                                other_infos: {
                                    numeroBon: numBon,
                                    numeroFacture: (infosRaw.num_facture as string) || '',
                                    containerDescription: contenant
                                },
                                readable_id_track_dechets: numBsd || '',
                                created_at: date || new Date().toISOString()
                            };
                            if (!bsdId) {
                                bsdId = 'Données brutes';
                            }
                        }
                    }

                    // Construire la ligne d'export
                    const formInput = bsdData?.infos_json?.formAPI?.createFormInput;
                    const otherInfos = bsdData?.other_infos;
                    const emitter = formInput?.emitter;
                    const recipient = formInput?.recipient;
                    const transporter = formInput?.transporter;
                    const wasteDetails = formInput?.wasteDetails;
                    const workSite = emitter?.workSite;

                    const dateValue = formInput?.takenOverAt || bsdData?.created_at || null;

                    const row: ExportRow = {
                        "Nom PDF": pdfName,
                        "Index déchet": index + 1,
                        "Action": actionLabel,
                        "ID FLEAP": bsdId,

                        "Date": dateValue 
                            ? format(new Date(dateValue), 'dd/MM/yyyy', { locale: fr })
                            : null,
                        "N° BSD": bsdData?.readable_id_track_dechets || null,
                        "N° Bon": (otherInfos as { numeroBon?: string } | undefined)?.numeroBon || null,
                        "N° Facture": (otherInfos as { numeroFacture?: string } | undefined)?.numeroFacture || null,
                        
                        "Nom du Site": emitter?.company?.name || null,
                        "N° du Site": emitter?.company?.siret || null,
                        
                        "Nom Transporteur": transporter?.company?.name || null,
                        "SIRET transporteur": transporter?.company?.siret || null,

                        "Nom Exutoire": recipient?.company?.name || null,
                        "SIRET Exutoire": recipient?.company?.siret || null,
                        
                        "Adresse Exutoire": null, // Pas disponible dans createFormInput.recipient
                        "Récipissé Exutoire": null, // Pas disponible dans createFormInput
                        "Immatriculation": (transporter as { numberPlate?: string } | undefined)?.numberPlate || null,                        
                        "Récipissé Transporteur": transporter?.receipt || null,

                        "Nom Déchet": wasteDetails?.name || null,
                        "Code CED": wasteDetails?.code || null,
                        "Poids (tonne)": wasteDetails?.quantity ? String(wasteDetails.quantity) : null,

                        "Code de traitement": recipient?.processingOperation || null,
                        "Contenant": (otherInfos as { containerDescription?: string } | undefined)?.containerDescription || null,
                        "Nombre de contenants": null, // Pas disponible directement
                        "ADR": (otherInfos as { mentionAdr?: string } | undefined)?.mentionAdr || null,
                        "Code ONU": null, // Pas disponible dans createFormInput
                        "CAP": null, // Pas disponible directement
                    };

                    exportRows.push(row);
                } catch (error) {
                    console.error(`[export] Erreur déchet ${index} du PDF ${pdfId}:`, error);
                    // Ajouter une ligne d'erreur
                    exportRows.push({
                        "Nom PDF": pdfName,
                        "Index déchet": index + 1,
                        "Action": "Erreur",
                        "ID FLEAP": null,
                        "Code CED": null,
                        "Nom Déchet": null,
                        "Date": null,
                        "N° BSD": null,
                        "N° Bon": null,
                        "N° Facture": null,
                        "Nom du Site": null,
                        "N° du Site": null,
                        "Nom Transporteur": null,
                        "SIRET transporteur": null,
                        "Récipissé Transporteur": null,
                        "Immatriculation": null,
                        "SIRET Exutoire": null,
                        "Nom Exutoire": null,
                        "Adresse Exutoire": null,
                        "Récipissé Exutoire": null,
                        "Code de traitement": null,
                        "Poids (tonne)": null,
                        "Contenant": null,
                        "Nombre de contenants": null,
                        "ADR": null,
                        "Code ONU": null,
                        "CAP": null,
                    });
                }
            }
        } catch (error) {
            console.error(`[export] Erreur PDF ${pdfId}:`, error);
            // Exporter quand même une ligne d'erreur pour ce PDF
            exportRows.push({
                "Nom PDF": pdfName,
                "Index déchet": null,
                "Action": `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
                "ID FLEAP": null,
                "Code CED": null,
                "Nom Déchet": null,
                "Date": null,
                "N° BSD": null,
                "N° Bon": null,
                "N° Facture": null,
                "Nom du Site": null,
                "N° du Site": null,
                "Nom Transporteur": null,
                "SIRET transporteur": null,
                "Récipissé Transporteur": null,
                "Immatriculation": null,
                "SIRET Exutoire": null,
                "Nom Exutoire": null,
                "Adresse Exutoire": null,
                "Récipissé Exutoire": null,
                "Code de traitement": null,
                "Poids (tonne)": null,
                "Contenant": null,
                "Nombre de contenants": null,
                "ADR": null,
                "Code ONU": null,
                "CAP": null,
            });
        }
    }

    // Générer le fichier Excel
    if (exportRows.length === 0) {
        throw new Error('Aucune donnée à exporter');
    }

    // Déterminer quelles colonnes ont au moins une valeur non-null
    const columnKeys = Object.keys(exportRows[0]) as Array<keyof ExportRow>;
    const columnsWithData = columnKeys.filter(key => {
        return exportRows.some(row => row[key] !== null && row[key] !== undefined && row[key] !== '');
    });

    // Filtrer les lignes pour ne garder que les colonnes avec des données
    const filteredRows: Array<Record<string, string | number | null>> = exportRows.map(row => {
        const filtered: Record<string, string | number | null> = {};
        for (const key of columnsWithData) {
            const value = row[key];
            filtered[key] = value === null || value === undefined ? null : value;
        }
        return filtered;
    });

    const worksheet = XLSX.utils.json_to_sheet(filteredRows);
    const workbook = XLSX.utils.book_new();
    
    // Ajuster la largeur des colonnes (seulement pour les colonnes présentes)
    const colWidthMap: Record<string, number> = {
        "Nom PDF": 30,
        "Index déchet": 12,
        "Action": 12,
        "ID FLEAP": 20,
        "Code CED": 15,
        "Nom Déchet": 30,
        "Date": 15,
        "N° BSD": 15,
        "N° Bon": 15,
        "N° Facture": 15,
        "Nom du Site": 30,
        "N° du Site": 20,
        "Nom Transporteur": 30,
        "SIRET transporteur": 20,
        "Récipissé Transporteur": 25,
        "Immatriculation": 18,
        "SIRET Exutoire": 20,
        "Nom Exutoire": 30,
        "Adresse Exutoire": 40,
        "Récipissé Exutoire": 25,
        "Code de traitement": 25,
        "Poids (tonne)": 15,
        "Contenant": 20,
        "Nombre de contenants": 18,
        "ADR": 15,
        "Code ONU": 15,
        "CAP": 15,
    };
    
    const colWidths = columnsWithData.map(key => ({ wch: colWidthMap[key] || 15 }));
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Export PDFs');

    // Générer le buffer Excel
    const excelBuffer = XLSX.write(workbook, {
        type: 'array',
        bookType: 'xlsx'
    });

    // Télécharger le fichier
    const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = `export_pdfs_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss', { locale: fr })}.xlsx`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
};

