'use client'
import { useState } from 'react';
import { useSession } from '@/app/component/SessionProvider';
import { supabase } from '@/app/database/supabaseClient';
import JSZip from 'jszip';
import { toast } from 'react-hot-toast';

interface PdfInfo {
    id: number;
    name_pdf: string;
    name_pdf_in_bucket: string;
    created_at: string;
}

const DownloadFactureForMe = () => {
    const {entreprise_id} = useSession();
    const [isLoading, setIsLoading] = useState(false);

    const downloadAllPdfs = async () => {
        if (!entreprise_id) {
            toast.error('Aucune entreprise sélectionnée');
            return;
        }

        setIsLoading(true);
        try {
            // Récupérer tous les PDFs de l'entreprise
            const { data: pdfInfos, error } = await supabase
                .from('pdf_infos')
                .select('*')
                .eq('entreprise_id', entreprise_id);

            if (error) {
                throw new Error('Erreur lors de la récupération des PDFs');
            }

            if (!pdfInfos || pdfInfos.length === 0) {
                toast.error('Aucun PDF trouvé pour cette entreprise');
                return;
            }

            // Créer un nouveau ZIP
            const zip = new JSZip();

            // Télécharger chaque PDF et l'ajouter au ZIP
            const downloadPromises = pdfInfos.map(async (pdf: PdfInfo) => {
                try {
                    const { data, error: downloadError } = await supabase.storage
                        .from('pdfs_bucket')
                        .download(pdf.name_pdf_in_bucket);

                    if (downloadError) {
                        console.error(`Erreur lors du téléchargement de ${pdf.name_pdf}:`, downloadError);
                        return;
                    }

                    if (data) {
                        zip.file(pdf.name_pdf, data);
                    }
                } catch (error) {
                    console.error(`Erreur lors du traitement de ${pdf.name_pdf}:`, error);
                }
            });

            await Promise.all(downloadPromises);

            // Générer le fichier ZIP
            const content = await zip.generateAsync({ type: 'blob' });

            // Créer un lien de téléchargement
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `factures_${entreprise_id}_${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success('Téléchargement réussi');
        } catch (error) {
            console.error('Erreur lors du téléchargement:', error);
            toast.error('Erreur lors du téléchargement');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={downloadAllPdfs}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isLoading ? 'Téléchargement en cours...' : 'Télécharger toutes les factures'}
        </button>
    );
};

export default DownloadFactureForMe;
