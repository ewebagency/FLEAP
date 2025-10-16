import { NextResponse } from 'next/server';
import { supabase } from '@/app/database/supabaseClient';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Facture {
    id: string;
    user_id: string;
    entreprise_id: string;
    created_at: string;
    infos_json: {
        footer: {
            total_ht: number;
        };
        header: {
            num_facture: string;
            date_facture: string;
            prestataire_nom: string;
            prestataire_siret: string;
            prestataire_num_client: string;
            prestataire_description: string;
        };
        departs: Array<{
            line_body: Array<{
                unite: string;
                quantite: number;
                montant_ht: number;
                prix_unitaire: number;
                type_operation: string;
            }>;
            line_header: {
                filiere: string;
                site_nom: string;
                bon_pesee: string;
                site_siret: string;
                code_dechet: string;
                date_depart: string;
                num_dossier: string;
                type_dechet: string;
                bon_intention: string;
                site_description: string;
                site_num_affaire: string;
                dechet_description: string;
            };
            linked_to_bsd: boolean;
        }>;
    };
}

interface MappingCedFiliere {
    ced: string;
    filiere: string;
}

interface MappingNomFiliere {
    nom: string;
    filiere: string;
}

interface PrixUnitaireData {
    prix_unitaire: number;
    montant_ht_total: number;
    nb_occurrences: number;
    prestations: Map<string, number>; // Compteur des prestations pour ce prix unitaire
}

interface MailleData {
    site_siret: string;
    site_nom: string;
    filiere: string;
    prestation: string;
    prix_unitaires: Map<number, PrixUnitaireData>;
}

interface ExportDataSite {
    'Site SIRET': string;
    'Site Nom': string;
    'Prix Unitaire (€)': number;
    'Prestation Majoritaire': string;
    'Montant HT Total (€)': number;
    'Nb Occurrences': number;
}

interface ExportDataSiteFiliere {
    'Site SIRET': string;
    'Site Nom': string;
    'Filière': string;
    'Prix Unitaire (€)': number;
    'Prestation Majoritaire': string;
    'Montant HT Total (€)': number;
    'Nb Occurrences': number;
}

interface ExportDataSiteFilierePresta {
    'Site SIRET': string;
    'Site Nom': string;
    'Filière': string;
    'Prestation': string;
    'Prix Unitaire (€)': number;
    'Montant HT Total (€)': number;
    'Nb Occurrences': number;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const entreprise_id = searchParams.get('entreprise_id');

        if (!entreprise_id) {
            return NextResponse.json(
                { message: 'entreprise_id est requis' },
                { status: 400 }
            );
        }

        console.log('Début de l\'export factures pour entreprise_id:', entreprise_id);

        // 1. Récupérer les mappings
        const { data: entrepriseData, error: entrepriseError } = await supabase
            .from('entreprise')
            .select('name, mapping_ced_filiere, mapping_nom_filiere')
            .eq('id', entreprise_id)
            .single();

        if (entrepriseError) {
            console.error('Erreur lors de la récupération de l\'entreprise:', entrepriseError);
            return NextResponse.json(
                { message: 'Erreur lors de la récupération des données entreprise' },
                { status: 500 }
            );
        }

        const mappingCed: MappingCedFiliere[] = (entrepriseData?.mapping_ced_filiere || []) as MappingCedFiliere[];
        const mappingNom: MappingNomFiliere[] = (entrepriseData?.mapping_nom_filiere || []) as MappingNomFiliere[];
        
        console.log('Mappings récupérés - CED:', mappingCed.length, 'NOM:', mappingNom.length);

        // 2. Récupérer toutes les factures avec pagination
        let allFactures: Facture[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('facture')
                .select('*')
                .eq('entreprise_id', entreprise_id)
                .range(page * pageSize, (page + 1) * pageSize - 1);
            
            if (error) {
                console.error('Error fetching factures:', error);
                break;
            }

            if (data && data.length > 0) {
                allFactures = [...allFactures, ...data as Facture[]];
                page++;
            } else {
                hasMore = false;
            }
        }

        console.log(`Total factures récupérées: ${allFactures.length}`);

        // 3. Créer les mailles et agréger les données
        const maillesMapSite = new Map<string, MailleData>();
        const maillesMapSiteFiliere = new Map<string, MailleData>();
        const maillesMapSiteFilierePresta = new Map<string, MailleData>();

        allFactures.forEach((facture) => {
            try {
                facture.infos_json.departs.forEach((depart) => {
                    const header = depart.line_header;
                    
                    // Déterminer la filière
                    let filiere = 'Autres';
                    
                    // D'abord essayer avec le nom du déchet
                    const wasteName = header?.dechet_description || header?.type_dechet;
                    if (wasteName) {
                        const mappingEntry = mappingNom.find(m => m.nom === wasteName);
                        if (mappingEntry) {
                            filiere = mappingEntry.filiere;
                        }
                    }
                    
                    // Si pas trouvé, essayer avec le code CED
                    if (filiere === 'Autres' && header?.code_dechet) {
                        const cleanedCed = header.code_dechet.replaceAll(' ', '').replace('*', '').trim();
                        const mappingEntry = mappingCed.find(m => 
                            m.ced.replaceAll(' ', '').replace('*', '').trim() === cleanedCed
                        );
                        if (mappingEntry) {
                            filiere = mappingEntry.filiere;
                        }
                    }

                    // Traiter chaque ligne du body
                    depart.line_body.forEach((operation) => {
                        const site_siret = header?.site_siret || 'Non renseigné';
                        const site_nom = header?.site_nom || 'Non renseigné';
                        const prestation = operation.type_operation || 'Non renseigné';
                        const prix_unitaire = operation.prix_unitaire || 0;
                        const montant_ht = operation.montant_ht || 0;

                        // Arrondir le prix unitaire à 2 décimales pour éviter les problèmes de précision
                        const prixUnitaireArrondi = Math.round(prix_unitaire * 100) / 100;

                        // ===== MAILLE SITE =====
                        const mailleKeySite = site_siret;
                        if (!maillesMapSite.has(mailleKeySite)) {
                            maillesMapSite.set(mailleKeySite, {
                                site_siret,
                                site_nom,
                                filiere: '',
                                prestation: '',
                                prix_unitaires: new Map()
                            });
                        }
                        const mailleSite = maillesMapSite.get(mailleKeySite)!;
                        if (mailleSite.prix_unitaires.has(prixUnitaireArrondi)) {
                            const existing = mailleSite.prix_unitaires.get(prixUnitaireArrondi)!;
                            existing.montant_ht_total += montant_ht;
                            existing.nb_occurrences += 1;
                            // Incrémenter le compteur de prestation
                            const currentCount = existing.prestations.get(prestation) || 0;
                            existing.prestations.set(prestation, currentCount + 1);
                        } else {
                            const prestationsMap = new Map<string, number>();
                            prestationsMap.set(prestation, 1);
                            mailleSite.prix_unitaires.set(prixUnitaireArrondi, {
                                prix_unitaire: prixUnitaireArrondi,
                                montant_ht_total: montant_ht,
                                nb_occurrences: 1,
                                prestations: prestationsMap
                            });
                        }

                        // ===== MAILLE SITE-FILIERE =====
                        const mailleKeySiteFiliere = `${site_siret}|${filiere}`;
                        if (!maillesMapSiteFiliere.has(mailleKeySiteFiliere)) {
                            maillesMapSiteFiliere.set(mailleKeySiteFiliere, {
                                site_siret,
                                site_nom,
                                filiere,
                                prestation: '',
                                prix_unitaires: new Map()
                            });
                        }
                        const mailleSiteFiliere = maillesMapSiteFiliere.get(mailleKeySiteFiliere)!;
                        if (mailleSiteFiliere.prix_unitaires.has(prixUnitaireArrondi)) {
                            const existing = mailleSiteFiliere.prix_unitaires.get(prixUnitaireArrondi)!;
                            existing.montant_ht_total += montant_ht;
                            existing.nb_occurrences += 1;
                            // Incrémenter le compteur de prestation
                            const currentCount = existing.prestations.get(prestation) || 0;
                            existing.prestations.set(prestation, currentCount + 1);
                        } else {
                            const prestationsMap = new Map<string, number>();
                            prestationsMap.set(prestation, 1);
                            mailleSiteFiliere.prix_unitaires.set(prixUnitaireArrondi, {
                                prix_unitaire: prixUnitaireArrondi,
                                montant_ht_total: montant_ht,
                                nb_occurrences: 1,
                                prestations: prestationsMap
                            });
                        }

                        // ===== MAILLE SITE-FILIERE-PRESTATION =====
                        const mailleKeySiteFilierePresta = `${site_siret}|${filiere}|${prestation}`;
                        if (!maillesMapSiteFilierePresta.has(mailleKeySiteFilierePresta)) {
                            maillesMapSiteFilierePresta.set(mailleKeySiteFilierePresta, {
                                site_siret,
                                site_nom,
                                filiere,
                                prestation,
                                prix_unitaires: new Map()
                            });
                        }
                        const mailleSiteFilierePresta = maillesMapSiteFilierePresta.get(mailleKeySiteFilierePresta)!;
                        if (mailleSiteFilierePresta.prix_unitaires.has(prixUnitaireArrondi)) {
                            const existing = mailleSiteFilierePresta.prix_unitaires.get(prixUnitaireArrondi)!;
                            existing.montant_ht_total += montant_ht;
                            existing.nb_occurrences += 1;
                            // Incrémenter le compteur de prestation
                            const currentCount = existing.prestations.get(prestation) || 0;
                            existing.prestations.set(prestation, currentCount + 1);
                        } else {
                            const prestationsMap = new Map<string, number>();
                            prestationsMap.set(prestation, 1);
                            mailleSiteFilierePresta.prix_unitaires.set(prixUnitaireArrondi, {
                                prix_unitaire: prixUnitaireArrondi,
                                montant_ht_total: montant_ht,
                                nb_occurrences: 1,
                                prestations: prestationsMap
                            });
                        }
                    });
                });
            } catch (error) {
                console.warn('Erreur lors du traitement d\'une facture:', error);
            }
        });

        console.log(`Nombre de mailles créées - Site: ${maillesMapSite.size}, Site-Filière: ${maillesMapSiteFiliere.size}, Site-Filière-Prestation: ${maillesMapSiteFilierePresta.size}`);

        // Fonction helper pour trouver la prestation majoritaire
        const getPrestationMajoritaire = (prestationsMap: Map<string, number>): string => {
            if (prestationsMap.size === 0) return 'Non renseigné';
            
            let maxCount = 0;
            let prestationMajoritaire = '';
            
            prestationsMap.forEach((count, prestation) => {
                if (count > maxCount) {
                    maxCount = count;
                    prestationMajoritaire = prestation;
                }
            });
            
            return prestationMajoritaire;
        };

        // 4. Convertir en format pour Excel - MAILLE SITE
        const exportDataSite: ExportDataSite[] = [];

        maillesMapSite.forEach((maille) => {
            // Détails des prix unitaires - chaque prix unitaire devient une ligne
            const prixUnitairesSorted = Array.from(maille.prix_unitaires.values()).sort((a, b) => 
                a.prix_unitaire - b.prix_unitaire
            );
            prixUnitairesSorted.forEach((prixData) => {
                exportDataSite.push({
                    'Site SIRET': maille.site_siret,
                    'Site Nom': maille.site_nom,
                    'Prix Unitaire (€)': parseFloat(prixData.prix_unitaire.toFixed(2)),
                    'Prestation Majoritaire': getPrestationMajoritaire(prixData.prestations),
                    'Montant HT Total (€)': parseFloat(prixData.montant_ht_total.toFixed(2)),
                    'Nb Occurrences': prixData.nb_occurrences
                });
            });
        });

        // Trier
        exportDataSite.sort((a, b) => {
            if (a['Site Nom'] !== b['Site Nom']) return a['Site Nom'].localeCompare(b['Site Nom']);
            return a['Prix Unitaire (€)'] - b['Prix Unitaire (€)'];
        });

        // 5. Convertir en format pour Excel - MAILLE SITE-FILIERE
        const exportDataSiteFiliere: ExportDataSiteFiliere[] = [];

        maillesMapSiteFiliere.forEach((maille) => {
            // Détails des prix unitaires - chaque prix unitaire devient une ligne
            const prixUnitairesSorted = Array.from(maille.prix_unitaires.values()).sort((a, b) => 
                a.prix_unitaire - b.prix_unitaire
            );
            prixUnitairesSorted.forEach((prixData) => {
                exportDataSiteFiliere.push({
                    'Site SIRET': maille.site_siret,
                    'Site Nom': maille.site_nom,
                    'Filière': maille.filiere,
                    'Prix Unitaire (€)': parseFloat(prixData.prix_unitaire.toFixed(2)),
                    'Prestation Majoritaire': getPrestationMajoritaire(prixData.prestations),
                    'Montant HT Total (€)': parseFloat(prixData.montant_ht_total.toFixed(2)),
                    'Nb Occurrences': prixData.nb_occurrences
                });
            });
        });

        // Trier
        exportDataSiteFiliere.sort((a, b) => {
            if (a['Site Nom'] !== b['Site Nom']) return a['Site Nom'].localeCompare(b['Site Nom']);
            if (a['Filière'] !== b['Filière']) return a['Filière'].localeCompare(b['Filière']);
            return a['Prix Unitaire (€)'] - b['Prix Unitaire (€)'];
        });

        // 6. Convertir en format pour Excel - MAILLE SITE-FILIERE-PRESTATION
        const exportDataSiteFilierePresta: ExportDataSiteFilierePresta[] = [];

        maillesMapSiteFilierePresta.forEach((maille) => {
            // Détails des prix unitaires - chaque prix unitaire devient une ligne
            const prixUnitairesSorted = Array.from(maille.prix_unitaires.values()).sort((a, b) => 
                a.prix_unitaire - b.prix_unitaire
            );
            prixUnitairesSorted.forEach((prixData) => {
                exportDataSiteFilierePresta.push({
                    'Site SIRET': maille.site_siret,
                    'Site Nom': maille.site_nom,
                    'Filière': maille.filiere,
                    'Prestation': maille.prestation,
                    'Prix Unitaire (€)': parseFloat(prixData.prix_unitaire.toFixed(2)),
                    'Montant HT Total (€)': parseFloat(prixData.montant_ht_total.toFixed(2)),
                    'Nb Occurrences': prixData.nb_occurrences
                });
            });
        });

        // Trier
        exportDataSiteFilierePresta.sort((a, b) => {
            if (a['Site Nom'] !== b['Site Nom']) return a['Site Nom'].localeCompare(b['Site Nom']);
            if (a['Filière'] !== b['Filière']) return a['Filière'].localeCompare(b['Filière']);
            if (a['Prestation'] !== b['Prestation']) return a['Prestation'].localeCompare(b['Prestation']);
            return a['Prix Unitaire (€)'] - b['Prix Unitaire (€)'];
        });

        console.log(`Nombre de lignes d'export - Site: ${exportDataSite.length}, Site-Filière: ${exportDataSiteFiliere.length}, Site-Filière-Prestation: ${exportDataSiteFilierePresta.length}`);

        // 7. Générer le fichier Excel
        return exportToExcel(
            exportDataSite,
            exportDataSiteFiliere,
            exportDataSiteFilierePresta,
            entrepriseData?.name ?? 'Entreprise'
        );

    } catch (error) {
        console.error('Erreur générale:', error);
        return NextResponse.json(
            {
                message: 'Erreur lors de l\'export',
                error: error instanceof Error ? error.message : 'Erreur inconnue'
            },
            { status: 500 }
        );
    }
}

const exportToExcel = (
    detailDataSite: ExportDataSite[],
    detailDataSiteFiliere: ExportDataSiteFiliere[],
    detailDataSiteFilierePresta: ExportDataSiteFilierePresta[],
    entrepriseName: string
) => {
    try {
        const workbook = XLSX.utils.book_new();
        const today = format(new Date(), 'dd MMMM yyyy HH:mm', { locale: fr });

        // Styles
        const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "2B5797" } },
            alignment: { horizontal: "center", vertical: "center" }
        };

        const greyRowStyle = {
            fill: { fgColor: { rgb: "F2F2F2" } }
        };

        const totalRowStyle = {
            font: { bold: true },
            fill: { fgColor: { rgb: "FFD700" } },
            alignment: { horizontal: "right" }
        };

        // Fonction helper pour créer un onglet
        type SheetData = ExportDataSite | ExportDataSiteFiliere | ExportDataSiteFilierePresta;
        
        const createSheet = (data: SheetData[], title: string, sheetName: string, colWidths: number[]) => {
            if (data.length === 0) return;

            const worksheet = XLSX.utils.aoa_to_sheet([]);
            const subtitle = `Export réalisé le ${today}`;
            const numCols = Object.keys(data[0] || {}).length;

            worksheet['!merges'] = [
                { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
                { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } }
            ];

            XLSX.utils.sheet_add_aoa(worksheet, [[title], [subtitle]], { origin: 'A1' });
            XLSX.utils.sheet_add_json(worksheet, data, { origin: 'A4' });

            // Calculer les totaux
            const totalRow: Record<string, string | number> = {};
            const keys = Object.keys(data[0]);
            keys.forEach((key, idx) => {
                if (idx === 0) {
                    totalRow[key] = 'TOTAL';
                } else if (key.includes('Montant') || key.includes('Nb ') || key.includes('Nombre')) {
                    totalRow[key] = data.reduce((sum, row) => sum + ((row as unknown as Record<string, number>)[key] || 0), 0);
                    if (key.includes('€')) {
                        totalRow[key] = parseFloat((totalRow[key] as number).toFixed(2));
                    }
                } else {
                    totalRow[key] = '';
                }
            });

            const totalRowIndex = data.length + 4;
            XLSX.utils.sheet_add_json(worksheet, [totalRow], { origin: `A${totalRowIndex}`, skipHeader: true });

            // Appliquer les styles
            const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
            
            // En-têtes
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddress = XLSX.utils.encode_cell({ r: 3, c: C });
                if (worksheet[cellAddress]) {
                    worksheet[cellAddress].s = headerStyle;
                }
            }

            // Lignes de données
            for (let R = 4; R <= range.e.r; ++R) {
                const isTotal = R === totalRowIndex - 1;
                const isGrey = (R - 4) % 2 === 1;
                
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                    
                    if (!worksheet[cellAddress]) {
                        worksheet[cellAddress] = { v: '', t: 's' };
                    }
                    
                    if (isTotal) {
                        worksheet[cellAddress].s = totalRowStyle;
                    } else if (isGrey) {
                        worksheet[cellAddress].s = greyRowStyle;
                    }
                }
            }

            worksheet['!cols'] = colWidths.map(wch => ({ wch }));
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        };

        // ============ ONGLET 1: Site ============
        createSheet(
            detailDataSite,
            `Analyse Prix Unitaires - Site - ${entrepriseName}`,
            "Site",
            [20, 30, 18, 30, 20, 20]
        );

        // ============ ONGLET 2: Site-Filière ============
        createSheet(
            detailDataSiteFiliere,
            `Analyse Prix Unitaires - Site-Filière - ${entrepriseName}`,
            "Site-Filière",
            [20, 30, 25, 18, 30, 20, 20]
        );

        // ============ ONGLET 3: Site-Filière-Prestation ============
        createSheet(
            detailDataSiteFilierePresta,
            `Analyse Prix Unitaires - Site-Filière-Prestation - ${entrepriseName}`,
            "Site-Filière-Prestation",
            [20, 30, 25, 30, 18, 20, 20]
        );

        // Générer le fichier Excel
        const buffer = XLSX.write(workbook, {
            type: 'buffer',
            bookType: 'xlsx',
            bookSST: false
        });

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="analyse_factures_prix_unitaires_${format(new Date(), 'yyyy-MM-dd')}.xlsx"`,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
        });
    } catch (error) {
        console.error('Erreur lors de la création du fichier Excel:', error);
        throw error;
    }
};

