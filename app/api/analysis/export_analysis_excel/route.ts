import { NextResponse } from 'next/server';
import { supabase } from '@/app/database/supabaseClient';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Interface pour les BSD récupérés de Supabase
interface SupabaseBSD {
    id: string;
    entreprise_id: string;
    user_id: string;
    created_at: string;
    status_track_dechets: string;
    readable_id_track_dechets: string;
    emitter: {
        company: {
            siret: string;
            orgId: string;
            name: string;
        };
    };
    wasteDetails: {
        name: string;
        code: string;
        quantity: string;
    };
    quantityReceived: string;
    takenOverAt: string;
    dateCollecteTransporteur: string;
}

// Interface pour les données d'export avec filière
interface ExportRowWithFiliere {
    site_nom: string;
    mois: string;
    date_sort: Date; // Pour le tri chronologique
    filiere: string;
    nb_lignes_demande: number;
    nb_lignes_non_demande: number;
    tonnage_demande: number;
    tonnage_non_demande: number;
    ecart_lignes: number;
    ecart_tonnage: number;
}

// Interface pour les données d'export sans filière (agrégé par site/mois)
interface ExportRowByMonth {
    site_nom: string;
    mois: string;
    date_sort: Date; // Pour le tri chronologique
    nb_lignes_demande: number;
    nb_lignes_non_demande: number;
    tonnage_demande: number;
    tonnage_non_demande: number;
    ecart_lignes: number;
    ecart_tonnage: number;
}

// Statuts considérés comme "demande"
const DEMANDE_STATUSES = [
    "Ligne demandée",
    "Ligne créée",
    "Ligne créée automatiquement",
    "Ligne validée",
    "Traitée",
    "Traité",
    "Collecté",
    "Collecte demandée",
    "Brouillon",
    "Brouillon Local",
    "Accepté"
];

const isDemandeStatus = (status: string): boolean => {
    return DEMANDE_STATUSES.includes(status);
};

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

        console.log('Début de l\'export pour entreprise_id:', entreprise_id);

        // 1. Récupérer le mapping_nom_filiere
        const { data: entrepriseData, error: entrepriseError } = await supabase
            .from('entreprise')
            .select('name, mapping_nom_filiere')
            .eq('id', entreprise_id)
            .single();

        if (entrepriseError) {
            console.error('Erreur lors de la récupération de l\'entreprise:', entrepriseError);
            return NextResponse.json(
                { message: 'Erreur lors de la récupération des données entreprise' },
                { status: 500 }
            );
        }

        const mapping_nom_filiere = (entrepriseData as { name: string; mapping_nom_filiere?: { nom: string; filiere: string }[] }).mapping_nom_filiere || [];
        console.log('Mapping filière récupéré, nombre d\'entrées:', mapping_nom_filiere.length);

        // 2. Récupérer tous les BSDs avec pagination
        let allBSDs: SupabaseBSD[] = [];
        let hasMore = true;
        let lastId: string | null = null;
        let pageCount = 0;

        while (hasMore) {
            pageCount++;
            console.log(`Récupération de la page ${pageCount}...`);

            let query = supabase
                .from('bsd')
                .select(`
                    id,
                    entreprise_id,
                    user_id,
                    created_at,
                    status_track_dechets,
                    readable_id_track_dechets,
                    infos_json->formAPI->createFormInput->emitter,
                    infos_json->formAPI->createFormInput->wasteDetails,
                    infos_json->formAPI->createFormInput->>quantityReceived,
                    infos_json->formAPI->createFormInput->>takenOverAt,
                    infos_json->formAPI->createFormInput->>dateCollecteTransporteur
                `)
                .eq('entreprise_id', entreprise_id)
                .order('id', { ascending: false })
                .limit(1000);

            if (lastId) {
                query = query.lt('id', lastId);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Erreur lors de la récupération des BSDs:', error);
                throw error;
            }

            if (!data || data.length === 0) {
                hasMore = false;
                break;
            }

            console.log(`Page ${pageCount}: ${data.length} BSDs récupérés`);
            allBSDs = [...allBSDs, ...data as unknown as SupabaseBSD[]];
            lastId = data[data.length - 1].id;

            // Vérifier s'il y a plus de données
            const { count } = await supabase
                .from('bsd')
                .select('*', { count: 'exact', head: true })
                .eq('entreprise_id', entreprise_id)
                .lt('id', lastId);

            hasMore = count ? count > 0 : false;
        }

        console.log(`Total BSDs récupérés: ${allBSDs.length}`);

        // 3. Créer les segments et calculer les statistiques
        const segmentMap: Map<string, {
            site_nom: string;
            mois: string;
            date_sort: Date;
            filiere: string;
            demandes: { count: number; tonnage: number };
            non_demandes: { count: number; tonnage: number };
        }> = new Map();

        allBSDs.forEach(bsd => {
            try {
                // Extraire les informations du BSD
                const siteName = bsd.emitter?.company?.name || 'Non renseigné';
                const wasteName = bsd.wasteDetails?.name || 'Non renseigné';
                
                // Déterminer si c'est une demande ou non
                const isDemande = isDemandeStatus(bsd.status_track_dechets);
                
                // Choisir la date selon le type
                let dateStr: string;
                if (isDemande) {
                    // Pour les demandes : dateCollecteTransporteur si disponible, sinon created_at
                    dateStr = bsd.dateCollecteTransporteur || bsd.created_at;
                } else {
                    // Pour les non demandes : created_at
                    dateStr = bsd.created_at;
                }
                
                const date = new Date(dateStr);
                const mois = format(date, 'MMM yy', { locale: fr });

                // Déterminer la filière à partir du mapping_nom_filiere
                const mappingEntry = mapping_nom_filiere.find(
                    m => m.nom && m.nom.trim() === wasteName.trim()
                );
                const filiere = mappingEntry?.filiere || 'Autres';

                // Calculer la quantité
                const quantity = parseFloat(bsd.quantityReceived || bsd.wasteDetails?.quantity || '0') || 0;

                // Créer la clé du segment (nom de site au lieu de SIRET)
                const segmentKey = `${siteName}|${mois}|${filiere}`;

                // Initialiser le segment s'il n'existe pas
                if (!segmentMap.has(segmentKey)) {
                    segmentMap.set(segmentKey, {
                        site_nom: siteName,
                        mois: mois,
                        date_sort: date,
                        filiere: filiere,
                        demandes: { count: 0, tonnage: 0 },
                        non_demandes: { count: 0, tonnage: 0 }
                    });
                }

                const segment = segmentMap.get(segmentKey)!;

                // Ajouter aux bonnes statistiques
                if (isDemande) {
                    segment.demandes.count += 1;
                    segment.demandes.tonnage += quantity;
                } else {
                    segment.non_demandes.count += 1;
                    segment.non_demandes.tonnage += quantity;
                }
            } catch (error) {
                console.warn('Erreur lors du traitement d\'un BSD:', error);
            }
        });

        console.log(`Nombre de segments créés: ${segmentMap.size}`);

        // 4. Convertir en tableau pour l'export avec filière
        const exportDataWithFiliere: ExportRowWithFiliere[] = Array.from(segmentMap.values()).map(segment => ({
            site_nom: segment.site_nom,
            mois: segment.mois,
            date_sort: segment.date_sort,
            filiere: segment.filiere,
            nb_lignes_demande: segment.demandes.count,
            nb_lignes_non_demande: segment.non_demandes.count,
            tonnage_demande: parseFloat(segment.demandes.tonnage.toFixed(3)),
            tonnage_non_demande: parseFloat(segment.non_demandes.tonnage.toFixed(3)),
            ecart_lignes: segment.non_demandes.count - segment.demandes.count,
            ecart_tonnage: parseFloat((segment.non_demandes.tonnage - segment.demandes.tonnage).toFixed(3))
        }));

        // Trier par site, puis chronologiquement, puis filière
        exportDataWithFiliere.sort((a, b) => {
            if (a.site_nom !== b.site_nom) return a.site_nom.localeCompare(b.site_nom);
            if (a.date_sort.getTime() !== b.date_sort.getTime()) return a.date_sort.getTime() - b.date_sort.getTime();
            return a.filiere.localeCompare(b.filiere);
        });

        // 5. Créer l'agrégation par site/mois (sans filière)
        const monthMap: Map<string, {
            site_nom: string;
            mois: string;
            date_sort: Date;
            demandes: { count: number; tonnage: number };
            non_demandes: { count: number; tonnage: number };
        }> = new Map();

        Array.from(segmentMap.values()).forEach(segment => {
            const monthKey = `${segment.site_nom}|${segment.mois}`;
            
            if (!monthMap.has(monthKey)) {
                monthMap.set(monthKey, {
                    site_nom: segment.site_nom,
                    mois: segment.mois,
                    date_sort: segment.date_sort,
                    demandes: { count: 0, tonnage: 0 },
                    non_demandes: { count: 0, tonnage: 0 }
                });
            }

            const monthSegment = monthMap.get(monthKey)!;
            monthSegment.demandes.count += segment.demandes.count;
            monthSegment.demandes.tonnage += segment.demandes.tonnage;
            monthSegment.non_demandes.count += segment.non_demandes.count;
            monthSegment.non_demandes.tonnage += segment.non_demandes.tonnage;
        });

        const exportDataByMonth: ExportRowByMonth[] = Array.from(monthMap.values()).map(segment => ({
            site_nom: segment.site_nom,
            mois: segment.mois,
            date_sort: segment.date_sort,
            nb_lignes_demande: segment.demandes.count,
            nb_lignes_non_demande: segment.non_demandes.count,
            tonnage_demande: parseFloat(segment.demandes.tonnage.toFixed(3)),
            tonnage_non_demande: parseFloat(segment.non_demandes.tonnage.toFixed(3)),
            ecart_lignes: segment.non_demandes.count - segment.demandes.count,
            ecart_tonnage: parseFloat((segment.non_demandes.tonnage - segment.demandes.tonnage).toFixed(3))
        }));

        // Trier par site puis chronologiquement
        exportDataByMonth.sort((a, b) => {
            if (a.site_nom !== b.site_nom) return a.site_nom.localeCompare(b.site_nom);
            return a.date_sort.getTime() - b.date_sort.getTime();
        });

        // 6. Générer le fichier Excel
        return exportToExcel(exportDataByMonth, exportDataWithFiliere, entrepriseData?.name ?? 'Entreprise');

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

const exportToExcel = (dataByMonth: ExportRowByMonth[], dataWithFiliere: ExportRowWithFiliere[], entrepriseName: string) => {
    try {
        const workbook = XLSX.utils.book_new();
        const today = format(new Date(), 'dd MMMM yyyy HH:mm', { locale: fr });

        // Styles
        const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "2B5797" } },
            alignment: { horizontal: "center", vertical: "center" }
        };

        const totalRowStyle = {
            font: { bold: true },
            fill: { fgColor: { rgb: "FFD700" } },
            alignment: { horizontal: "right" }
        };

        const subtotalRowStyle = {
            font: { bold: true },
            fill: { fgColor: { rgb: "E8F4F8" } },
            alignment: { horizontal: "right" }
        };

        const greyRowStyle = {
            fill: { fgColor: { rgb: "F2F2F2" } }
        };

        // ============ ONGLET PIVOT : Par Site avec Filières en colonnes ============
        
        // 1. Récupérer toutes les filières uniques
        const allFilieres = Array.from(new Set(dataWithFiliere.map(d => d.filiere))).sort();
        
        // 2. Créer la structure pivot : Site + Mois en lignes, Filières en colonnes
        interface PivotRow {
            site: string;
            mois: string;
            date_sort: Date;
            filieres: Map<string, {
                nb_demande: number;
                nb_non_demande: number;
                tonnage_demande: number;
                tonnage_non_demande: number;
                ecart_tonnage: number;
            }>;
        }

        const pivotMap = new Map<string, PivotRow>();

        dataWithFiliere.forEach(row => {
            const key = `${row.site_nom}|${row.mois}`;
            
            if (!pivotMap.has(key)) {
                pivotMap.set(key, {
                    site: row.site_nom,
                    mois: row.mois,
                    date_sort: row.date_sort,
                    filieres: new Map()
                });
            }

            const pivotRow = pivotMap.get(key)!;
            pivotRow.filieres.set(row.filiere, {
                nb_demande: row.nb_lignes_demande,
                nb_non_demande: row.nb_lignes_non_demande,
                tonnage_demande: row.tonnage_demande,
                tonnage_non_demande: row.tonnage_non_demande,
                ecart_tonnage: row.ecart_tonnage
            });
        });

        // 3. Trier par site puis chronologiquement
        const pivotRows = Array.from(pivotMap.values()).sort((a, b) => {
            if (a.site !== b.site) return a.site.localeCompare(b.site);
            return a.date_sort.getTime() - b.date_sort.getTime();
        });

        // 4. Créer les en-têtes de colonnes
        const headers1: string[] = ['Site', 'Mois'];
        const headers2: string[] = ['', ''];
        
        allFilieres.forEach((filiere, index) => {
            // Ajouter colonne vide entre filières (sauf avant la première)
            if (index > 0) {
                headers1.push('');
                headers2.push('');
            }
            headers1.push(filiere, '', '', '', '', '');
            headers2.push('Nb Demande', 'Nb Non Dem.', 'T. Demande', 'T. Non Dem.', 'Écart Nb L.', 'Écart T.');
        });

        // 5. Créer les lignes de données avec séparation entre sites et sous-totaux
        const dataRows: (string | number)[][] = [];
        let currentSite = '';
        const siteRows: typeof pivotRows = [];
        
        // Fonction pour créer une ligne de sous-total
        const createSubtotalRow = (siteName: string, rows: typeof pivotRows) => {
            const subtotalRow: (string | number)[] = [`TOTAL ${siteName}`, ''];
            
            allFilieres.forEach((filiere, filiereIndex) => {
                // Ajouter colonne vide entre filières
                if (filiereIndex > 0) {
                    subtotalRow.push('');
                }
                
                let totalNbDemande = 0;
                let totalNbNonDemande = 0;
                let totalTonnageDemande = 0;
                let totalTonnageNonDemande = 0;
                
                rows.forEach(r => {
                    const filiereData = r.filieres.get(filiere);
                    if (filiereData) {
                        totalNbDemande += filiereData.nb_demande;
                        totalNbNonDemande += filiereData.nb_non_demande;
                        totalTonnageDemande += filiereData.tonnage_demande;
                        totalTonnageNonDemande += filiereData.tonnage_non_demande;
                    }
                });
                
                const ecartNbLignes = totalNbNonDemande - totalNbDemande;
                const ecartTonnage = totalTonnageNonDemande - totalTonnageDemande;
                
                subtotalRow.push(
                    totalNbDemande,
                    totalNbNonDemande,
                    parseFloat(totalTonnageDemande.toFixed(3)),
                    parseFloat(totalTonnageNonDemande.toFixed(3)),
                    ecartNbLignes,
                    parseFloat(ecartTonnage.toFixed(3))
                );
            });
            
            return subtotalRow;
        };
        
        pivotRows.forEach((row, index) => {
            // Si on change de site et qu'on n'est pas au début
            if (row.site !== currentSite && currentSite !== '') {
                // Ajouter la ligne de sous-total pour le site précédent
                dataRows.push(createSubtotalRow(currentSite, siteRows));
                
                // Ajouter une ligne vide
                const emptyRow: (string | number)[] = new Array(headers1.length).fill('');
                dataRows.push(emptyRow);
                
                // Réinitialiser pour le nouveau site
                siteRows.length = 0;
            }
            currentSite = row.site;
            siteRows.push(row);
            
            const dataRow: (string | number)[] = [row.site, row.mois];
            
            allFilieres.forEach((filiere, filiereIndex) => {
                // Ajouter colonne vide entre filières (sauf avant la première)
                if (filiereIndex > 0) {
                    dataRow.push('');
                }
                
                const filiereData = row.filieres.get(filiere);
                if (filiereData) {
                    const ecartNbLignes = filiereData.nb_non_demande - filiereData.nb_demande;
                    dataRow.push(
                        filiereData.nb_demande,
                        filiereData.nb_non_demande,
                        filiereData.tonnage_demande,
                        filiereData.tonnage_non_demande,
                        ecartNbLignes,
                        filiereData.ecart_tonnage
                    );
                } else {
                    dataRow.push(0, 0, 0, 0, 0, 0);
                }
            });
            
            dataRows.push(dataRow);
            
            // Si c'est la dernière ligne, ajouter le sous-total du dernier site
            if (index === pivotRows.length - 1) {
                dataRows.push(createSubtotalRow(currentSite, siteRows));
            }
        });

        // 6. Créer une ligne vide avant le total général
        const emptyRowBeforeTotal: (string | number)[] = new Array(headers1.length).fill('');
        dataRows.push(emptyRowBeforeTotal);
        
        // 7. Créer la ligne de total général
        const totalRow: (string | number)[] = ['TOTAL GÉNÉRAL', ''];
        
        allFilieres.forEach((filiere, filiereIndex) => {
            // Ajouter colonne vide entre filières (sauf avant la première)
            if (filiereIndex > 0) {
                totalRow.push('');
            }
            
            let totalNbDemande = 0;
            let totalNbNonDemande = 0;
            let totalTonnageDemande = 0;
            let totalTonnageNonDemande = 0;
            
            pivotRows.forEach(row => {
                const filiereData = row.filieres.get(filiere);
                if (filiereData) {
                    totalNbDemande += filiereData.nb_demande;
                    totalNbNonDemande += filiereData.nb_non_demande;
                    totalTonnageDemande += filiereData.tonnage_demande;
                    totalTonnageNonDemande += filiereData.tonnage_non_demande;
                }
            });
            
            const ecartNbLignesTotal = totalNbNonDemande - totalNbDemande;
            const ecartTonnageTotal = totalTonnageNonDemande - totalTonnageDemande;
            totalRow.push(
                totalNbDemande,
                totalNbNonDemande,
                parseFloat(totalTonnageDemande.toFixed(3)),
                parseFloat(totalTonnageNonDemande.toFixed(3)),
                ecartNbLignesTotal,
                parseFloat(ecartTonnageTotal.toFixed(3))
            );
        });

        // 8. Créer la worksheet pivot
        const worksheetPivot = XLSX.utils.aoa_to_sheet([]);
        const titlePivot = `Analyse BSD par Site/Mois (Filières en colonnes) - ${entrepriseName}`;
        const subtitlePivot = `Export réalisé le ${today}`;

        // Ajouter titre et sous-titre
        const numColsPivot = headers1.length;
        
        // Construire les merges
        const titleMerges = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: numColsPivot - 1 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: numColsPivot - 1 } }
        ];
        
        // Fusionner les en-têtes de filières (en tenant compte des colonnes vides)
        const filiereMerges = allFilieres.map((_, index) => {
            // Chaque filière prend 6 colonnes + 1 colonne vide entre chaque (sauf la première)
            const startCol = 2 + (index * 7); // 6 colonnes de données + 1 vide
            return {
                s: { r: 3, c: startCol },
                e: { r: 3, c: startCol + 5 }
            };
        });
        
        worksheetPivot['!merges'] = [...titleMerges, ...filiereMerges];

        XLSX.utils.sheet_add_aoa(worksheetPivot, [[titlePivot], [subtitlePivot]], { origin: 'A1' });
        XLSX.utils.sheet_add_aoa(worksheetPivot, [headers1, headers2], { origin: 'A4' });
        XLSX.utils.sheet_add_aoa(worksheetPivot, dataRows, { origin: 'A6' });
        XLSX.utils.sheet_add_aoa(worksheetPivot, [totalRow], { origin: `A${6 + dataRows.length}` });

        // Appliquer les styles
        const rangePivot = XLSX.utils.decode_range(worksheetPivot['!ref'] || 'A1');
        
        // Style centré pour les en-têtes de filières
        const headerCenterStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "2B5797" } },
            alignment: { horizontal: "center", vertical: "center" }
        };
        
        // En-têtes ligne 1 des filières (ligne 4 - index 3)
        for (let C = rangePivot.s.c; C <= rangePivot.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: 3, c: C });
            if (worksheetPivot[cellAddress]) {
                // Centrer les noms de filières
                if (C >= 2 && worksheetPivot[cellAddress].v && worksheetPivot[cellAddress].v !== '') {
                    worksheetPivot[cellAddress].s = headerCenterStyle;
                } else {
                    worksheetPivot[cellAddress].s = headerStyle;
                }
            }
        }
        
        // En-têtes ligne 2 des métriques (ligne 5 - index 4)
        for (let C = rangePivot.s.c; C <= rangePivot.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: 4, c: C });
            if (worksheetPivot[cellAddress]) {
                worksheetPivot[cellAddress].s = headerStyle;
            }
        }

        // Lignes de données + alternance grise + sous-totaux + total général
        const totalRowIndex = 5 + dataRows.length;
        for (let R = 5; R <= rangePivot.e.r; ++R) {
            const rowData = dataRows[R - 5];
            const isTotal = R === totalRowIndex;
            const isSubtotal = rowData && rowData[0] && String(rowData[0]).startsWith('TOTAL ');
            const isEmptyRow = rowData && rowData.every(cell => cell === '');
            const isGrey = !isSubtotal && !isTotal && !isEmptyRow && (R - 5) % 2 === 1;
            
            for (let C = rangePivot.s.c; C <= rangePivot.e.c; ++C) {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                
                if (!worksheetPivot[cellAddress]) {
                    worksheetPivot[cellAddress] = { v: '', t: 's' };
                }
                
                if (isTotal) {
                    worksheetPivot[cellAddress].s = totalRowStyle;
                } else if (isSubtotal) {
                    worksheetPivot[cellAddress].s = subtotalRowStyle;
                } else if (isGrey) {
                    worksheetPivot[cellAddress].s = greyRowStyle;
                }
            }
        }

        // Largeurs de colonnes
        const colWidths = [
            { wch: 35 }, // Site
            { wch: 12 }  // Mois
        ];
        allFilieres.forEach((_, index) => {
            // Ajouter colonne vide entre filières (sauf avant la première)
            if (index > 0) {
                colWidths.push({ wch: 2 }); // Colonne vide étroite
            }
            colWidths.push(
                { wch: 12 }, // Nb Demande
                { wch: 12 }, // Nb Non Dem
                { wch: 12 }, // T. Demande
                { wch: 13 }, // T. Non Dem
                { wch: 12 }, // Écart Nb L.
                { wch: 11 }  // Écart T.
            );
        });
        worksheetPivot['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(workbook, worksheetPivot, "Vue Pivot par Filières");

        // ============ ONGLET RÉCAP : Uniquement écarts nombre de lignes par site ============
        
        // 1. Créer les en-têtes pour le récap
        const recapHeaders1: string[] = ['Site'];
        const recapHeaders2: string[] = [''];
        
        allFilieres.forEach((filiere, index) => {
            // Ajouter colonne vide entre filières (sauf avant la première)
            if (index > 0) {
                recapHeaders1.push('');
                recapHeaders2.push('');
            }
            recapHeaders1.push(filiere, '');
            recapHeaders2.push('Écart Nb Lignes', 'Taux Écart (%)');
        });
        
        // Ajouter colonne vide et colonne TOTAL à la fin
        recapHeaders1.push('', 'TOTAL SITE');
        recapHeaders2.push('', 'Écart Total');
        
        // 2. Créer les lignes de récap (uniquement les totaux par site)
        const recapRows: (string | number)[][] = [];
        const siteTotalsMap = new Map<string, Map<string, {
            ecart: number;
            nbDemande: number;
            nbNonDemande: number;
        }>>();
        
        // Calculer les totaux par site
        pivotRows.forEach(row => {
            if (!siteTotalsMap.has(row.site)) {
                siteTotalsMap.set(row.site, new Map());
            }
            
            const siteTotals = siteTotalsMap.get(row.site)!;
            
            allFilieres.forEach(filiere => {
                const filiereData = row.filieres.get(filiere);
                if (filiereData) {
                    const currentData = siteTotals.get(filiere) || { ecart: 0, nbDemande: 0, nbNonDemande: 0 };
                    const ecart = filiereData.nb_non_demande - filiereData.nb_demande;
                    siteTotals.set(filiere, {
                        ecart: currentData.ecart + ecart,
                        nbDemande: currentData.nbDemande + filiereData.nb_demande,
                        nbNonDemande: currentData.nbNonDemande + filiereData.nb_non_demande
                    });
                }
            });
        });
        
        // Créer les lignes de récap pour chaque site
        const sortedSites = Array.from(siteTotalsMap.keys()).sort();
        sortedSites.forEach(site => {
            const recapRow: (string | number)[] = [`TOTAL ${site}`];
            const siteTotals = siteTotalsMap.get(site)!;
            let totalEcartSite = 0;
            
            allFilieres.forEach((filiere, index) => {
                // Ajouter colonne vide entre filières
                if (index > 0) {
                    recapRow.push('');
                }
                
                const data = siteTotals.get(filiere);
                if (data) {
                    const moyenne = 2 * Math.max(data.nbDemande, data.nbNonDemande);
                    const tauxEcart = moyenne > 0 ? (data.ecart / moyenne) : 0;
                    recapRow.push(data.ecart, parseFloat(tauxEcart.toFixed(3)));
                    totalEcartSite += data.ecart;
                } else {
                    recapRow.push(0, 0);
                }
            });
            
            // Ajouter le total du site à la fin
            recapRow.push('', totalEcartSite);
            
            recapRows.push(recapRow);
        });
        
        // 3. Créer la ligne de total général pour le récap
        const recapTotalRow: (string | number)[] = ['TOTAL GÉNÉRAL'];
        let totalEcartGeneral = 0;
        
        allFilieres.forEach((filiere, index) => {
            // Ajouter colonne vide entre filières
            if (index > 0) {
                recapTotalRow.push('');
            }
            
            let totalEcart = 0;
            let totalNbDemande = 0;
            let totalNbNonDemande = 0;
            
            sortedSites.forEach(site => {
                const siteTotals = siteTotalsMap.get(site)!;
                const data = siteTotals.get(filiere);
                if (data) {
                    totalEcart += data.ecart;
                    totalNbDemande += data.nbDemande;
                    totalNbNonDemande += data.nbNonDemande;
                }
            });
            
            const moyenneGenerale = 2 * Math.max(totalNbDemande, totalNbNonDemande);
            const tauxEcartGeneral = moyenneGenerale > 0 ? (totalEcart / moyenneGenerale) * 100 : 0;
            
            recapTotalRow.push(totalEcart, parseFloat(tauxEcartGeneral.toFixed(1)));
            totalEcartGeneral += totalEcart;
        });
        
        // Ajouter le total général de tous les écarts
        recapTotalRow.push('', totalEcartGeneral);
        
        // 4. Créer la worksheet récap
        const worksheetRecap = XLSX.utils.aoa_to_sheet([]);
        const titleRecap = `Récapitulatif Écarts par Site - ${entrepriseName}`;
        const subtitleRecap = `Export réalisé le ${today}`;
        
        const numColsRecap = recapHeaders1.length;
        const recapMerges = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: numColsRecap - 1 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: numColsRecap - 1 } }
        ];
        
        // Fusionner les en-têtes de filières (2 colonnes par filière + colonnes vides)
        allFilieres.forEach((_, index) => {
            const startCol = 1 + (index * 3); // 2 colonnes de données + 1 vide
            recapMerges.push({ s: { r: 3, c: startCol }, e: { r: 3, c: startCol + 1 } });
        });
        
        worksheetRecap['!merges'] = recapMerges;
        
        XLSX.utils.sheet_add_aoa(worksheetRecap, [[titleRecap], [subtitleRecap]], { origin: 'A1' });
        XLSX.utils.sheet_add_aoa(worksheetRecap, [recapHeaders1, recapHeaders2], { origin: 'A4' });
        XLSX.utils.sheet_add_aoa(worksheetRecap, recapRows, { origin: 'A6' });
        
        // Ajouter ligne vide avant le total
        const emptyRowRecap: (string | number)[] = new Array(numColsRecap).fill('');
        XLSX.utils.sheet_add_aoa(worksheetRecap, [emptyRowRecap], { origin: `A${6 + recapRows.length}` });
        XLSX.utils.sheet_add_aoa(worksheetRecap, [recapTotalRow], { origin: `A${7 + recapRows.length}` });
        
        // Appliquer les styles au récap
        const rangeRecap = XLSX.utils.decode_range(worksheetRecap['!ref'] || 'A1');
        
        // En-têtes ligne 1 des filières (ligne 4 - index 3)
        for (let C = rangeRecap.s.c; C <= rangeRecap.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: 3, c: C });
            if (worksheetRecap[cellAddress]) {
                if (C >= 1 && worksheetRecap[cellAddress].v && worksheetRecap[cellAddress].v !== '') {
                    worksheetRecap[cellAddress].s = headerCenterStyle;
                } else {
                    worksheetRecap[cellAddress].s = headerStyle;
                }
            }
        }
        
        // En-têtes ligne 2
        for (let C = rangeRecap.s.c; C <= rangeRecap.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: 4, c: C });
            if (worksheetRecap[cellAddress]) {
                worksheetRecap[cellAddress].s = headerStyle;
            }
        }
        
        // Lignes de données du récap
        const totalRecapRowIndex = 6 + recapRows.length;
        for (let R = 5; R <= rangeRecap.e.r; ++R) {
            const rowIndex = R - 5;
            const isTotal = R === totalRecapRowIndex;
            const isEmptyRow = rowIndex === recapRows.length;
            const isGrey = !isTotal && !isEmptyRow && rowIndex % 2 === 1;
            
            for (let C = rangeRecap.s.c; C <= rangeRecap.e.c; ++C) {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                
                if (!worksheetRecap[cellAddress]) {
                    worksheetRecap[cellAddress] = { v: '', t: 's' };
                }
                
                if (isTotal) {
                    worksheetRecap[cellAddress].s = totalRowStyle;
                } else if (!isEmptyRow) {
                    if (isGrey) {
                        worksheetRecap[cellAddress].s = greyRowStyle;
                    } else {
                        worksheetRecap[cellAddress].s = subtotalRowStyle;
                    }
                }
            }
        }
        
        // Largeurs de colonnes pour le récap
        const recapColWidths = [
            { wch: 35 } // Site
        ];
        allFilieres.forEach((_, index) => {
            // Ajouter colonne vide entre filières (sauf avant la première)
            if (index > 0) {
                recapColWidths.push({ wch: 2 }); // Colonne vide étroite
            }
            recapColWidths.push(
                { wch: 16 }, // Écart Nb Lignes
                { wch: 15 }  // Taux Écart (%)
            );
        });
        // Colonnes du total site
        recapColWidths.push(
            { wch: 2 },  // Colonne vide
            { wch: 16 }  // TOTAL SITE
        );
        worksheetRecap['!cols'] = recapColWidths;
        
        XLSX.utils.book_append_sheet(workbook, worksheetRecap, "Récap Écarts");

        // ============ ONGLET 1: Par Site/Mois ============
        const formattedByMonth = dataByMonth.map(row => ({
            'Site': row.site_nom,
            'Mois': row.mois,
            'Lignes Demande': row.nb_lignes_demande,
            'Lignes Non Demande': row.nb_lignes_non_demande,
            'Tonnage Demande (T)': row.tonnage_demande,
            'Tonnage Non Demande (T)': row.tonnage_non_demande,
            'Écart Lignes': row.ecart_lignes,
            'Écart Tonnage (T)': row.ecart_tonnage
        }));

        // Calculer les totaux pour l'onglet 1
        const totalByMonth = {
            'Site': 'TOTAL',
            'Mois': '',
            'Lignes Demande': dataByMonth.reduce((sum, row) => sum + row.nb_lignes_demande, 0),
            'Lignes Non Demande': dataByMonth.reduce((sum, row) => sum + row.nb_lignes_non_demande, 0),
            'Tonnage Demande (T)': parseFloat(dataByMonth.reduce((sum, row) => sum + row.tonnage_demande, 0).toFixed(3)),
            'Tonnage Non Demande (T)': parseFloat(dataByMonth.reduce((sum, row) => sum + row.tonnage_non_demande, 0).toFixed(3)),
            'Écart Lignes': dataByMonth.reduce((sum, row) => sum + row.ecart_lignes, 0),
            'Écart Tonnage (T)': parseFloat(dataByMonth.reduce((sum, row) => sum + row.ecart_tonnage, 0).toFixed(3))
        };

        const worksheetByMonth = XLSX.utils.aoa_to_sheet([]);
        const title1 = `Analyse BSD par Site/Mois - ${entrepriseName}`;
        const subtitle1 = `Export réalisé le ${today}`;

        const numCols1 = Object.keys(formattedByMonth[0] || {}).length;

        worksheetByMonth['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: numCols1 - 1 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: numCols1 - 1 } }
        ];

        XLSX.utils.sheet_add_aoa(worksheetByMonth, [[title1], [subtitle1]], { origin: 'A1' });
        XLSX.utils.sheet_add_json(worksheetByMonth, formattedByMonth, { origin: 'A4' });
        
        // Ajouter la ligne de total
        const totalRow1 = formattedByMonth.length + 4;
        XLSX.utils.sheet_add_json(worksheetByMonth, [totalByMonth], { origin: `A${totalRow1}`, skipHeader: true });

        // Appliquer les styles pour l'onglet 1
        const range1 = XLSX.utils.decode_range(worksheetByMonth['!ref'] || 'A1');
        
        // En-têtes (ligne 4 - index 3)
        for (let C = range1.s.c; C <= range1.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: 3, c: C });
            if (worksheetByMonth[cellAddress]) {
                worksheetByMonth[cellAddress].s = headerStyle;
            }
        }

        // Lignes de données + ligne de total
        for (let R = 4; R <= range1.e.r; ++R) {
            const isTotal = R === totalRow1 - 1; // -1 car XLSX compte à partir de 0
            const isGrey = (R - 4) % 2 === 1; // Ligne sur 2 grise
            
            for (let C = range1.s.c; C <= range1.e.c; ++C) {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                
                // Créer la cellule si elle n'existe pas
                if (!worksheetByMonth[cellAddress]) {
                    worksheetByMonth[cellAddress] = { v: '', t: 's' };
                }
                
                // Appliquer le style approprié
                if (isTotal) {
                    worksheetByMonth[cellAddress].s = totalRowStyle;
                } else if (isGrey) {
                    worksheetByMonth[cellAddress].s = greyRowStyle;
                }
            }
        }

        worksheetByMonth['!cols'] = [
            { wch: 35 }, // Site
            { wch: 12 }, // Mois
            { wch: 18 }, // Lignes Demande
            { wch: 20 }, // Lignes Non Demande
            { wch: 22 }, // Tonnage Demande
            { wch: 24 }, // Tonnage Non Demande
            { wch: 15 }, // Écart Lignes
            { wch: 18 }  // Écart Tonnage
        ];

        XLSX.utils.book_append_sheet(workbook, worksheetByMonth, "Par Site-Mois");

        // ============ ONGLET 2: Par Site/Mois/Filière ============
        const formattedWithFiliere = dataWithFiliere.map(row => ({
            'Site': row.site_nom,
            'Mois': row.mois,
            'Filière': row.filiere,
            'Lignes Demande': row.nb_lignes_demande,
            'Lignes Non Demande': row.nb_lignes_non_demande,
            'Tonnage Demande (T)': row.tonnage_demande,
            'Tonnage Non Demande (T)': row.tonnage_non_demande,
            'Écart Lignes': row.ecart_lignes,
            'Écart Tonnage (T)': row.ecart_tonnage
        }));

        // Calculer les totaux pour l'onglet 2
        const totalWithFiliere = {
            'Site': 'TOTAL',
            'Mois': '',
            'Filière': '',
            'Lignes Demande': dataWithFiliere.reduce((sum, row) => sum + row.nb_lignes_demande, 0),
            'Lignes Non Demande': dataWithFiliere.reduce((sum, row) => sum + row.nb_lignes_non_demande, 0),
            'Tonnage Demande (T)': parseFloat(dataWithFiliere.reduce((sum, row) => sum + row.tonnage_demande, 0).toFixed(3)),
            'Tonnage Non Demande (T)': parseFloat(dataWithFiliere.reduce((sum, row) => sum + row.tonnage_non_demande, 0).toFixed(3)),
            'Écart Lignes': dataWithFiliere.reduce((sum, row) => sum + row.ecart_lignes, 0),
            'Écart Tonnage (T)': parseFloat(dataWithFiliere.reduce((sum, row) => sum + row.ecart_tonnage, 0).toFixed(3))
        };

        const worksheetWithFiliere = XLSX.utils.aoa_to_sheet([]);
        const title2 = `Analyse BSD par Site/Mois/Filière - ${entrepriseName}`;
        const subtitle2 = `Export réalisé le ${today}`;

        const numCols2 = Object.keys(formattedWithFiliere[0] || {}).length;

        worksheetWithFiliere['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: numCols2 - 1 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: numCols2 - 1 } }
        ];

        XLSX.utils.sheet_add_aoa(worksheetWithFiliere, [[title2], [subtitle2]], { origin: 'A1' });
        XLSX.utils.sheet_add_json(worksheetWithFiliere, formattedWithFiliere, { origin: 'A4' });
        
        // Ajouter la ligne de total
        const totalRow2 = formattedWithFiliere.length + 4;
        XLSX.utils.sheet_add_json(worksheetWithFiliere, [totalWithFiliere], { origin: `A${totalRow2}`, skipHeader: true });

        // Appliquer les styles pour l'onglet 2
        const range2 = XLSX.utils.decode_range(worksheetWithFiliere['!ref'] || 'A1');
        
        // En-têtes (ligne 4 - index 3)
        for (let C = range2.s.c; C <= range2.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: 3, c: C });
            if (worksheetWithFiliere[cellAddress]) {
                worksheetWithFiliere[cellAddress].s = headerStyle;
            }
        }

        // Lignes de données + ligne de total
        for (let R = 4; R <= range2.e.r; ++R) {
            const isTotal = R === totalRow2 - 1; // -1 car XLSX compte à partir de 0
            const isGrey = (R - 4) % 2 === 1; // Ligne sur 2 grise
            
            for (let C = range2.s.c; C <= range2.e.c; ++C) {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                
                // Créer la cellule si elle n'existe pas
                if (!worksheetWithFiliere[cellAddress]) {
                    worksheetWithFiliere[cellAddress] = { v: '', t: 's' };
                }
                
                // Appliquer le style approprié
                if (isTotal) {
                    worksheetWithFiliere[cellAddress].s = totalRowStyle;
                } else if (isGrey) {
                    worksheetWithFiliere[cellAddress].s = greyRowStyle;
                }
            }
        }

        worksheetWithFiliere['!cols'] = [
            { wch: 35 }, // Site
            { wch: 12 }, // Mois
            { wch: 25 }, // Filière
            { wch: 18 }, // Lignes Demande
            { wch: 20 }, // Lignes Non Demande
            { wch: 22 }, // Tonnage Demande
            { wch: 24 }, // Tonnage Non Demande
            { wch: 15 }, // Écart Lignes
            { wch: 18 }  // Écart Tonnage
        ];

        XLSX.utils.book_append_sheet(workbook, worksheetWithFiliere, "Par Site-Mois-Filière");

        // Générer le fichier Excel
        const buffer = XLSX.write(workbook, {
            type: 'buffer',
            bookType: 'xlsx',
            bookSST: false
        });

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="analyse_bsd_${format(new Date(), 'yyyy-MM-dd')}.xlsx"`,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
        });
    } catch (error) {
        console.error('Erreur lors de la création du fichier Excel:', error);
        throw error;
    }
};

