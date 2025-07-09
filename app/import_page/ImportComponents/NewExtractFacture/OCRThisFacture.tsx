import { useState, useEffect } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { toast } from 'react-hot-toast';
import { FactureLine } from './type';
import { transformGeminiDataToFormData } from './MatchingFunction';

interface OCRThisFactureProps {
    pdf_id: number;
    pdf_path: string;
    onDataExtracted?: (data: Partial<FactureLine>) => void;
    entreprise_id: string|null;
    user_id: string|null;
    autocompletionOptions?: {
        prestataireOptions: { value: string; isSuggested: boolean }[];
        siretOptions: { value: string; isSuggested: boolean }[];
        siteOptions: { value: string; isSuggested: boolean }[];
        siteSiretOptions: { value: string; isSuggested: boolean }[];
        siteKeywordsOptions: { value: string; isSuggested: boolean }[];
        dechetOptions: { value: string; isSuggested: boolean }[];
        codeCedOptions: { value: string; isSuggested: boolean }[];
        numClientOptions: { value: string; isSuggested: boolean }[];
        contenantOptions: { value: string; isSuggested: boolean }[];
    };
}

const OCRThisFacture = ({ pdf_id, pdf_path, onDataExtracted, entreprise_id, user_id, autocompletionOptions }: OCRThisFactureProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [mindeeExists, setMindeeExists] = useState<boolean | null>(null);
    const [checkingStatus, setCheckingStatus] = useState(true);

    // Vérifier le statut des données Mindee au chargement
    useEffect(() => {
        const checkMindeeStatus = async () => {
            if (!pdf_id || !entreprise_id) {
                setCheckingStatus(false);
                return;
            }

            try {
                const { data: existingPdf, error } = await supabase
                    .from('pdf_infos')
                    .select('mindee_infos')
                    .eq('id', pdf_id)
                    .eq('entreprise_id', entreprise_id)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    console.error('Erreur lors de la vérification:', error);
                }
                console.log('pdf_id', pdf_id);
                console.log('Mindee infos existe pour ce pdf', existingPdf);
                setMindeeExists(!!existingPdf?.mindee_infos);
            } catch (error) {
                console.error('Erreur lors de la vérification du statut:', error);
                setMindeeExists(false);
            } finally {
                setCheckingStatus(false);
            }
        };

        checkMindeeStatus();
    }, [pdf_id, entreprise_id]);

    // Étape 1: Vérifier et extraire les données Mindee si nécessaire
    const checkAndExtractMindee = async (pdf_id: number, pdf_path: string) => {
        try {
            // Vérifier si mindee_infos existe déjà
            const { data: existingPdf, error: checkError } = await supabase
                .from('pdf_infos')
                .select('mindee_infos')
                .eq('id', pdf_id)
                .eq('entreprise_id', entreprise_id)
                .single();

            if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
                throw new Error(`Erreur lors de la vérification: ${checkError.message}`);
            }

            // Si mindee_infos existe et n'est pas vide, l'utiliser
            if (existingPdf?.mindee_infos) {
                console.log('Données Mindee déjà existantes, utilisation des données stockées');
                setMindeeExists(true);
                return existingPdf.mindee_infos;
            }

            // Sinon, faire l'extraction Mindee
            console.log('Extraction des données Mindee...');
            
            // Get signed URL for the PDF
            const { data: signedUrlData } = await supabase.storage
                .from('pdfs_bucket')
                .createSignedUrl(pdf_path, 3600);

            if (!signedUrlData?.signedUrl) {
                throw new Error('Failed to get signed URL');
            }

            // Appel à l'API Python pour parser/OCR
            const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_PYTHON}/parse-or-ocr-facture/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ pdf_url: signedUrlData.signedUrl }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to process PDF');
            }

            const mindeeData = await response.json();
            console.log('Données Mindee extraites:', mindeeData);

            // Debug - Vérifier les valeurs avant update
            console.log('Debug - Valeurs pour update:', {
                pdf_infos_id: pdf_id,
                entreprise_id: Number(entreprise_id),
                type_pdf_id: typeof pdf_id,
                type_entreprise_id: typeof Number(entreprise_id),
                mindeeData: mindeeData
            });

            // Mettre à jour les données Mindee dans la base
            const { data: updateData, error: updateError } = await supabase
                .from('pdf_infos')
                .update({
                    mindee_infos: mindeeData
                })
                .eq('id', pdf_id)
                .eq('entreprise_id', entreprise_id)
                .select('mindee_infos');

            if (updateError) {
                throw new Error(`Erreur lors de la mise à jour: ${updateError.message}`);
            }

            if (!updateData || updateData.length === 0) {
                throw new Error('Aucune ligne mise à jour');
            }

            console.log(`Update réussi: ${updateData.length} ligne(s) affectée(s)`);
            console.log('Données Mindee mises à jour:', updateData);

            
            setMindeeExists(true);
            return mindeeData;

        } catch (error) {
            console.error('Erreur lors de l\'extraction Mindee:', error);
            throw error;
        }
    };

    // Étape 2: Extraire les données structurées avec Gemini
    const extractWithGemini = async (mindeeData: Record<string, unknown>) => {
        try {
            console.log('Extraction des données structurées avec Gemini...');
            
            // Appel à l'API Python pour Gemini
            const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_PYTHON}/extract-facture-with-gemini/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ mindee_data: mindeeData }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to extract with Gemini');
            }

            const structuredData = await response.json();
            console.log('Données Gemini:', structuredData);
            
            return structuredData;

        } catch (error) {
            console.error('Erreur lors de l\'extraction Gemini:', error);
            throw error;
        }
    };

    const ocr_this_facture_pdf = async () => {
        setIsLoading(true);
        try {
            // Étape 1: Vérifier et extraire Mindee si nécessaire
            const mindeeData = await checkAndExtractMindee(pdf_id, pdf_path);
            
            // Étape 2: Extraire avec Gemini
            const structuredData = await extractWithGemini(mindeeData);
            
            // Étape 3: Transformer et mettre à jour le formulaire
            if (onDataExtracted) {
                const transformedData = await transformGeminiDataToFormData(structuredData, autocompletionOptions, entreprise_id || undefined);
                onDataExtracted(transformedData);
            }

            toast.success('Données de facture extraites avec succès');
        } catch (error) {
            console.error('Error in OCR process:', error);
            toast.error(error instanceof Error ? error.message : 'Erreur lors de l\'extraction des données de facture');
        } finally {
            setIsLoading(false);
        }
    };

    // Déterminer le texte et la classe du bouton selon l'état
    const getButtonContent = () => {
        if (checkingStatus) {
            return {
                text: 'Vérification...',
                className: 'bg-gray-400 text-white text-sm px-2 py-1 rounded-lg cursor-not-allowed'
            };
        }

        if (mindeeExists) {
            return {
                text: 'Extraire avec IA (gratuit)',
                className: 'bg-green-600 text-white text-sm px-2 py-1 rounded-lg hover:bg-green-700'
            };
        }

        return {
            text: 'Extraire par Parsing/OCR (payant)',
            className: 'bg-blue-600 text-white text-sm px-2 py-1 rounded-lg hover:bg-blue-700'
        };
    };

    const buttonContent = getButtonContent();

    return (
        <button
            onClick={ocr_this_facture_pdf}
            disabled={isLoading || checkingStatus}
            className={`${buttonContent.className} ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
        >
            {isLoading ? (
                <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Extraction en cours...
                </span>
            ) : (
                buttonContent.text
            )}
        </button>
    );
};

export default OCRThisFacture;
