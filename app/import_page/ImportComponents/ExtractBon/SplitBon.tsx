import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { supabase } from "@/app/database/supabaseClient";
import { toast } from 'react-hot-toast';
import { BonCerfa } from './utils';

interface SplitBonProps {
    pdf_id: number;
    pdf_path: string;
    onClose: () => void;
    currentFormData?: Partial<BonCerfa>; // Données actuelles du formulaire
    entreprise_id?: string;
    user_id?: string;
}

const SplitBon = ({ pdf_id, pdf_path, onClose, currentFormData, entreprise_id, user_id }: SplitBonProps) => {
    const [isLoading, setIsLoading] = useState(false);

    const splitPDF = async () => {
        setIsLoading(true);
        try {
            // 1. Récupérer le PDF original depuis le storage
            const { data: pdfData, error: pdfError } = await supabase.storage
                .from('pdfs_bucket')
                .download(pdf_path);

            if (pdfError) throw new Error('Erreur lors de la récupération du PDF');
            if (!pdfData) throw new Error('PDF non trouvé');

            // 2. Charger le PDF avec pdf-lib
            const pdfBytes = await pdfData.arrayBuffer();
            const pdfDoc = await PDFDocument.load(pdfBytes);
            const pageCount = pdfDoc.getPageCount();

            // 3. Récupérer les informations du PDF original
            const { data: originalPdfInfo, error: infoError } = await supabase
                .from('pdf_infos')
                .select('*')
                .eq('id', pdf_id)
                .single();

            if (infoError) throw new Error('Erreur lors de la récupération des informations du PDF');
            if (!originalPdfInfo) throw new Error('Informations du PDF non trouvées');

            // 4. Sauvegarder d'abord les données actuelles du formulaire si elles existent
            let originalBonData = null;
            if (currentFormData && entreprise_id && user_id) {
                const { data: savedData, error: saveError } = await supabase
                    .from('bon_pdf')
                    .upsert({
                        pdf_id: pdf_id,
                        entreprise_id: entreprise_id,
                        user_id: user_id,
                        infos: currentFormData,
                        created_at: new Date().toISOString()
                    }, {
                        onConflict: 'pdf_id'
                    })
                    .select()
                    .single();

                if (saveError) {
                    console.warn('Erreur lors de la sauvegarde des données actuelles:', saveError);
                } else {
                    originalBonData = savedData;
                }
            }

            // 5. Si pas de données actuelles, récupérer les données existantes
            if (!originalBonData) {
                const { data: existingBonData, error: bonError } = await supabase
                    .from('bon_pdf')
                    .select('*')
                    .eq('pdf_id', pdf_id)
                    .single();

                if (bonError && bonError.code !== 'PGRST116') {
                    throw new Error('Erreur lors de la récupération des données du bon');
                }
                originalBonData = existingBonData;
            }

            // 6. Pour chaque page, créer un nouveau PDF
            for (let i = 0; i < pageCount; i++) {
                // Créer un nouveau PDF avec une seule page
                const newPdfDoc = await PDFDocument.create();
                const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [i]);
                newPdfDoc.addPage(copiedPage);

                // Convertir en bytes avec les options de sauvegarde appropriées
                const newPdfBytes = await newPdfDoc.save({
                    useObjectStreams: false,
                    addDefaultPage: false
                });

                // Générer un nouveau nom de fichier
                const originalName = originalPdfInfo.name_pdf || 'document';
                const newFileName = `${originalName}_page_${i + 1}.pdf`;
                const newPath = newFileName;

                // Uploader le nouveau PDF
                const { error: uploadError } = await supabase.storage
                    .from('pdfs_bucket')
                    .upload(newPath, newPdfBytes, {
                        contentType: 'application/pdf',
                        cacheControl: '3600'
                    });

                if (uploadError) throw new Error(`Erreur lors de l'upload de la page ${i + 1}`);

                // Vérifier l'URL signée immédiatement après l'upload
                const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                    .from('pdfs_bucket')
                    .createSignedUrl(newPath, 3600);

                console.log('URL signée générée:', signedUrlData?.signedUrl);
                console.log('Erreur URL signée:', signedUrlError);

                // Créer une nouvelle entrée dans pdf_infos avec toutes les colonnes copiées
                const { data: newPdfInfo, error: insertPdfError } = await supabase
                    .from('pdf_infos')
                    .insert({
                        user_id: originalPdfInfo.user_id,
                        pdf_path: newPath,
                        name_pdf: newFileName,
                        name_pdf_in_bucket: newFileName,
                        status: 'splitted',
                        file_size: newPdfBytes.byteLength / 1024, // Taille en KB
                        site_siret: originalPdfInfo.site_siret,
                        document_type: originalPdfInfo.document_type,
                        provider: originalPdfInfo.provider,
                        entreprise_id: originalPdfInfo.entreprise_id,
                        site_siret_plus: originalPdfInfo.site_siret_plus
                    })
                    .select()
                    .single();

                if (insertPdfError) throw new Error(`Erreur lors de l'insertion de la page ${i + 1} dans pdf_infos`);

                // Si des données de bon existaient, les copier vers le nouveau PDF
                if (originalBonData && newPdfInfo) {
                    const { error: insertBonError } = await supabase
                        .from('bon_pdf')
                        .insert({
                            pdf_id: newPdfInfo.id, // Utiliser l'ID du nouveau PDF
                            entreprise_id: originalBonData.entreprise_id,
                            user_id: originalBonData.user_id,
                            infos: originalBonData.infos, // Copier toutes les données du bon
                            created_at: new Date().toISOString()
                        });

                    if (insertBonError) throw new Error(`Erreur lors de l'insertion des données du bon pour la page ${i + 1}`);
                }
            }

            // 7. Supprimer l'ancien PDF du storage
            const { error: deleteError } = await supabase.storage
                .from('pdfs_bucket')
                .remove([pdf_path]);

            if (deleteError) throw new Error('Erreur lors de la suppression de l\'ancien PDF');

            // 8. Supprimer l'ancienne entrée dans bon_pdf si elle existait
            if (originalBonData) {
                const { error: deleteBonError } = await supabase
                    .from('bon_pdf')
                    .delete()
                    .eq('pdf_id', pdf_id);

                if (deleteBonError) throw new Error('Erreur lors de la suppression de l\'ancienne entrée bon_pdf');
            }

            // 9. Supprimer l'ancienne entrée dans pdf_infos
            const { error: deleteInfoError } = await supabase
                .from('pdf_infos')
                .delete()
                .eq('id', pdf_id);

            if (deleteInfoError) throw new Error('Erreur lors de la suppression de l\'ancienne entrée pdf_infos');

            toast.success(`PDF divisé en ${pageCount} pages avec succès`);
        } catch (error) {
            console.error('Erreur lors de la division du PDF:', error);
            toast.error('Erreur lors de la division du PDF');
        } finally {
            setIsLoading(false);
            alert("PDF divisé avec succès, rechargez la page pour voir les nouveaux PDFs");
            onClose();
        }
    };

    return (
        <button
            onClick={splitPDF}
            disabled={isLoading}
            className={`bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
        >
            {isLoading ? (
                <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Division en cours...
                </span>
            ) : (
                'Diviser le PDF'
            )}
        </button>
    );
};

export default SplitBon;
