'use client'
import { useState } from 'react';
import { useSession } from '@/app/component/SessionProvider';
import { supabase } from '@/app/database/supabaseClient';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';

interface FactureLine {
    id: string;
    created_at: string;
    entreprise_id: string;
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

const DownloadFactureLines = () => {
    const { entreprise_id } = useSession();
    const [isLoading, setIsLoading] = useState(false);

    const downloadFactureLines = async () => {
        if (!entreprise_id) {
            toast.error('Aucune entreprise sélectionnée');
            return;
        }

        setIsLoading(true);
        try {
            // Récupérer toutes les factures de l'entreprise avec pagination
            let allFactures: FactureLine[] = [];
            let from = 0;
            const limit = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data: facturesBatch, error } = await supabase
                    .from('facture')
                    .select('*')
                    .eq('entreprise_id', entreprise_id)
                    .range(from, from + limit - 1);

                if (error) {
                    throw new Error('Erreur lors de la récupération des factures');
                }

                if (!facturesBatch || facturesBatch.length === 0) {
                    break;
                }

                allFactures = [...allFactures, ...facturesBatch];
                from += limit;
                hasMore = facturesBatch.length === limit;
            }

            if (allFactures.length === 0) {
                toast.error('Aucune facture trouvée pour cette entreprise');
                return;
            }

            // Préparer les données pour Excel
            const excelData: Array<Record<string, string | number | boolean>> = [];

            allFactures.forEach((facture: FactureLine) => {
                // Pour chaque départ dans la facture, créer une ligne
                facture.infos_json.departs.forEach((depart, departIndex) => {
                    // Pour chaque ligne de body dans le départ, créer une ligne Excel
                    depart.line_body.forEach((lineBody, lineIndex) => {
                        const row: Record<string, string | number | boolean> = {
                            // Informations de la facture
                            'ID_Facture': facture.id,
                            'Date_Creation_Facture': facture.created_at,
                            'Date_Facture': facture.infos_json.header.date_facture,
                            'Numero_Facture': facture.infos_json.header.num_facture,
                            'Prestataire_Nom': facture.infos_json.header.prestataire_nom,
                            'Prestataire_SIRET': facture.infos_json.header.prestataire_siret,
                            'Prestataire_Num_Client': facture.infos_json.header.prestataire_num_client,
                            'Prestataire_Description': facture.infos_json.header.prestataire_description,
                            'Total_HT_Facture': facture.infos_json.footer.total_ht,
                            
                            // Informations du départ
                            'Index_Depart': departIndex + 1,
                            'Filiere': depart.line_header.filiere,
                            'Site_Nom': depart.line_header.site_nom,
                            'Site_SIRET': depart.line_header.site_siret,
                            'Site_Description': depart.line_header.site_description,
                            'Site_Num_Affaire': depart.line_header.site_num_affaire,
                            'Code_Dechet': depart.line_header.code_dechet,
                            'Type_Dechet': depart.line_header.type_dechet,
                            'Dechet_Description': depart.line_header.dechet_description,
                            'Date_Depart': depart.line_header.date_depart,
                            'Bon_Pesee': depart.line_header.bon_pesee,
                            'Bon_Intention': depart.line_header.bon_intention,
                            'Num_Dossier': depart.line_header.num_dossier,
                            'Linked_To_BSD': depart.linked_to_bsd,
                            
                            // Informations de la ligne
                            'Index_Ligne': lineIndex + 1,
                            'Type_Operation': lineBody.type_operation,
                            'Unite': lineBody.unite,
                            'Quantite': lineBody.quantite,
                            'Prix_Unitaire': lineBody.prix_unitaire,
                            'Montant_HT': lineBody.montant_ht,
                        };
                        
                        excelData.push(row);
                    });
                });
            });

            if (excelData.length === 0) {
                toast.error('Aucune ligne de facture trouvée');
                return;
            }

            // Créer le workbook et worksheet
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.json_to_sheet(excelData);

            // Ajuster la largeur des colonnes
            const columnWidths = [
                { wch: 15 }, // ID_Facture
                { wch: 20 }, // Date_Creation_Facture
                { wch: 20 }, // Date_Facture
                { wch: 15 }, // Numero_Facture
                { wch: 25 }, // Prestataire_Nom
                { wch: 15 }, // Prestataire_SIRET
                { wch: 15 }, // Prestataire_Num_Client
                { wch: 30 }, // Prestataire_Description
                { wch: 15 }, // Total_HT_Facture
                { wch: 10 }, // Index_Depart
                { wch: 20 }, // Filiere
                { wch: 25 }, // Site_Nom
                { wch: 15 }, // Site_SIRET
                { wch: 30 }, // Site_Description
                { wch: 15 }, // Site_Num_Affaire
                { wch: 15 }, // Code_Dechet
                { wch: 15 }, // Type_Dechet
                { wch: 30 }, // Dechet_Description
                { wch: 20 }, // Date_Depart
                { wch: 15 }, // Bon_Pesee
                { wch: 15 }, // Bon_Intention
                { wch: 15 }, // Num_Dossier
                { wch: 10 }, // Linked_To_BSD
                { wch: 10 }, // Index_Ligne
                { wch: 25 }, // Type_Operation
                { wch: 10 }, // Unite
                { wch: 12 }, // Quantite
                { wch: 15 }, // Prix_Unitaire
                { wch: 15 }, // Montant_HT
            ];
            worksheet['!cols'] = columnWidths;

            // Ajouter le worksheet au workbook
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Lignes_Factures');

            // Générer le fichier Excel
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            // Créer un lien de téléchargement
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `lignes_factures_${entreprise_id}_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success(`Téléchargement réussi ! ${excelData.length} lignes exportées`);
        } catch (error) {
            console.error('Erreur lors du téléchargement:', error);
            toast.error('Erreur lors du téléchargement');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={downloadFactureLines}
            disabled={isLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isLoading ? 'Téléchargement en cours...' : 'Télécharger les lignes de facture'}
        </button>
    );
};

export default DownloadFactureLines; 