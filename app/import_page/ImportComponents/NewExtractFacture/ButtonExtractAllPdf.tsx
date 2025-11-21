'use client';

import { useState } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { toast } from 'react-hot-toast';
import { getEntrepriseNameById } from '../ExtractMetaDoc/utils/bdd';

interface BddRagRow {
    id: string;
    pdf_infos_id: string;
    document_type: string;
    entreprise_id: number;
}

interface PdfInfoRow {
    id: string;
    name_pdf: string;
    name_pdf_in_bucket: string;
    provider: {
        name?: string;
        siret?: string;
        is_transporter?: boolean;
        is_destination?: boolean;
    } | null;
}

const ButtonExtractAllPdf = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    // Fonction pour normaliser les noms de fichiers (enlever caractères spéciaux)
    const normalizeFileName = (name: string): string => {
        return name
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/_{2,}/g, '_')
            .trim();
    };

    // Fonction pour télécharger un fichier
    const downloadFile = (blob: Blob, fileName: string) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    };

    const handleExtractAll = async () => {
        setIsLoading(true);
        setProgress({ current: 0, total: 0 });

        try {
            // 1. Récupérer toutes les lignes de bdd_rag
            const { data: ragData, error: ragError } = await supabase
                .from('bdd_rag')
                .select('id, pdf_infos_id, document_type, entreprise_id');

            if (ragError) {
                throw new Error(`Erreur lors de la récupération des données RAG: ${ragError.message}`);
            }

            if (!ragData || ragData.length === 0) {
                toast.error('Aucune donnée trouvée dans bdd_rag');
                setIsLoading(false);
                return;
            }

            const total = ragData.length;
            setProgress({ current: 0, total });

            // 2. Créer un cache pour les noms d'entreprises (éviter les requêtes multiples)
            const entrepriseNameCache: Record<number, string> = {};

            // 3. Traiter chaque ligne
            for (let i = 0; i < ragData.length; i++) {
                const ragRow = ragData[i] as BddRagRow;
                setProgress({ current: i + 1, total });

                try {
                    // Récupérer le PDF depuis pdf_infos
                    const { data: pdfData, error: pdfError } = await supabase
                        .from('pdf_infos')
                        .select('id, name_pdf, name_pdf_in_bucket, provider')
                        .eq('id', ragRow.pdf_infos_id)
                        .single();

                    if (pdfError || !pdfData) {
                        console.warn(`PDF non trouvé pour pdf_infos_id: ${ragRow.pdf_infos_id}`);
                        continue;
                    }

                    const pdfInfo = pdfData as PdfInfoRow;

                    // Récupérer le nom de l'entreprise (avec cache)
                    let entrepriseName = entrepriseNameCache[ragRow.entreprise_id];
                    if (!entrepriseName) {
                        const { data: entrepriseData, error: entrepriseError } = await getEntrepriseNameById(ragRow.entreprise_id);
                        if (entrepriseError || !entrepriseData?.name) {
                            console.warn(`Entreprise non trouvée pour entreprise_id: ${ragRow.entreprise_id}`);
                            entrepriseName = 'Unknown';
                        } else {
                            entrepriseName = entrepriseData.name;
                            entrepriseNameCache[ragRow.entreprise_id] = entrepriseName;
                        }
                    }

                    // Construire le nom du fichier : doc_type_presta_nom_entreprise_name
                    const docType = ragRow.document_type || 'unknown';
                    const prestaName = pdfInfo.provider?.name || 'no_presta';
                    const normalizedEntrepriseName = normalizeFileName(entrepriseName);
                    const normalizedPrestaName = normalizeFileName(prestaName);
                    const pdfName = pdfInfo.name_pdf ? normalizeFileName(pdfInfo.name_pdf.replace('.pdf', '')) : 'unknown';
                    
                    const fileName = `${docType}_${normalizedPrestaName}_${normalizedEntrepriseName}_${pdfName}.pdf`;

                    // Télécharger le PDF depuis le storage
                    if (!pdfInfo.name_pdf_in_bucket) {
                        console.warn(`name_pdf_in_bucket manquant pour PDF: ${pdfInfo.id}`);
                        continue;
                    }

                    const { data: pdfBlob, error: downloadError } = await supabase.storage
                        .from('pdfs_bucket')
                        .download(pdfInfo.name_pdf_in_bucket);

                    if (downloadError || !pdfBlob) {
                        console.warn(`Erreur lors du téléchargement du PDF: ${pdfInfo.name_pdf_in_bucket}`, downloadError);
                        continue;
                    }

                    // Télécharger le fichier
                    downloadFile(pdfBlob, fileName);

                    // Petit délai pour éviter de surcharger le navigateur
                    await new Promise(resolve => setTimeout(resolve, 100));

                } catch (error) {
                    console.error(`Erreur lors du traitement de la ligne ${i + 1}:`, error);
                    continue;
                }
            }

            toast.success(`${total} PDF(s) téléchargé(s) avec succès`);
        } catch (error) {
            console.error('Erreur lors de l\'extraction:', error);
            toast.error(`Erreur lors de l'extraction: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        } finally {
            setIsLoading(false);
            setProgress({ current: 0, total: 0 });
        }
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <button
                onClick={handleExtractAll}
                disabled={isLoading}
                className="bg-purple-800 text-xs text-white px-4 py-2 rounded-lg hover:bg-purple-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isLoading ? `Extraction... (${progress.current}/${progress.total})` : 'Extract All PDF'}
            </button>
            {isLoading && progress.total > 0 && (
                <div className="text-xs text-gray-600">
                    Progression: {progress.current}/{progress.total}
                </div>
            )}
        </div>
    );
};

export default ButtonExtractAllPdf;

