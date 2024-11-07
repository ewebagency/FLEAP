//api/demande_collecte/infos_form_autocompletion
import { NextResponse } from 'next/server';
/*import path from 'path';
import * as XLSX from 'xlsx';
import { promises as fs } from 'fs';
import _ from 'lodash';*/

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const site = searchParams.get('site');
    
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_PYTHON}/get-table-demande-collecte/?userId=${userId}&site=${site}`);
        const data = await response.json(); // Convertir la réponse en JSON une seule fois
        
        return NextResponse.json(data); // Renvoyer les données
    } catch (error) {
        console.error("Erreur lors de la récupération des données:", error);
        return NextResponse.json(
            { error: "Erreur lors de la récupération des données" }, 
            { status: 500 }
        );
    }
}


/*async function getTableFormulaireFromDataPython(data: any) {
    const { informations_site, data: tableData } = data;
    
    // Créer le mapping comme dans votre version précédente
    const mapping = _.reduce(tableData, (acc, row) => {
        const filiere = row['Filière'] || row['Filière_'];
        const dechet = row['Déchet'] || row['Déchet_'];
        
        if (!filiere) return acc;

        if (!acc[filiere]) {
            acc[filiere] = {};
        }
        if (!acc[filiere][informations_site.nom_site]) {
            acc[filiere][informations_site.nom_site] = [];
        }

        acc[filiere][informations_site.nom_site].push({
            dechet: dechet,
            // Ajoutez d'autres champs selon vos besoins
        });

        return acc;
    }, {} as any);

    return {
        informations_site,
        data: tableData,
        mapping
    };
}*/



/*
async function getTableFormulaireFromUserId(userId: string) { //depreciated
    try {
        const excelPath = path.join(
            process.cwd(), 
            'backend-python', 
            'extract_info_xlsx_autocompletion', 
            'wienerberger_table_parametrage.xlsx'
        );

        // Lire le fichier Excel
        const buffer = await fs.readFile(excelPath);
        const workbook = XLSX.read(buffer);
        const worksheet = workbook.Sheets["Site N°1"];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });

        //console.log("worksheet", worksheet);

        // Extraire les informations de base (ligne 3)
        const infoRow = rawData[2] as any[];
        const nomSite = infoRow[2];
        const siret = infoRow[7];
        const adresseSite = infoRow[10];

        // Obtenir les en-têtes (lignes 6 et 7)
        const headers1 = rawData[5] as string[];
        const headers2 = rawData[6] as string[];

        // Combiner les en-têtes
        const combinedHeaders = _.map(headers1, (header, index) => {
            return `${header || headers1[index-1] || ''}_${headers2[index] || ''}`.trim();
        });

        // Extraire les données principales (à partir de la ligne 8)
        const mainData = _.slice(rawData, 7);

        // Convertir les données en tableau d'objets avec les en-têtes
        const processedData = _.map(mainData, row => {
            return _.reduce(combinedHeaders, (acc, header, index) => {
                acc[header] = (row as any[])[index];
                return acc;
            }, {} as any);
        });

        // Forward fill pour les cellules vides
        const filledData = _.reduce(processedData, (acc, row, index) => {
            if (index === 0) {
                acc.push(row);
                return acc;
            }

            const filledRow = _.mapValues(row, (value, key) => {
                return value || acc[index - 1][key];
            });

            acc.push(filledRow);
            return acc;
        }, [] as any[]);

        // Obtenir les filières uniques
        const filieres = _(filledData)
            .map('Filière')
            .uniq()
            .filter(Boolean)
            .value();

        // Créer le mapping
        const mapping = _.reduce(filledData, (acc, row) => {
            if (!row.Filière) return acc;

            if (!acc[row.Filière]) {
                acc[row.Filière] = {};
            }
            if (!acc[row.Filière][nomSite]) {
                acc[row.Filière][nomSite] = [];
            }

            acc[row.Filière][nomSite].push({
                dechet: row.Déchet,
                // Ajoutez d'autres champs selon vos besoins
            });

            return acc;
        }, {} as any);

        return {
            informations_site: {
                nom: nomSite,
                siret: siret,
                adresse: adresseSite
            },
            data: filledData,
            options_globales: {
                filieres: filieres,
                sites: [nomSite]
            },
            mapping: mapping
        };

    } catch (error) {
        console.error('Erreur lors de la lecture du fichier Excel:', error);
        throw error;
    }
}*/