import { useState } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { toast } from 'react-hot-toast';
import { BSDCerfa } from './ExtractBSD';
import useSWR from 'swr';
import { useSession } from '@/app/component/SessionProvider';

interface OCRThisBSDProps {
    pdf_id: number;
    pdf_path: string;
    pdf_status?: string;
    onDataExtracted?: (data: Partial<BSDCerfa>) => void;
}

// Types pour les données connues
interface Site {
    nom: string;
    siret: string;
}

interface Prestataire {
    nomBoite: string;
    nomPrenom: string;
    adresse: string;
    siret: string;
    email: string;
    transporteur_ou_destinataire: 'transporteur' | 'destinataire';
}

interface Dechet {
    nom: string;
    codeCED: string;
}

interface KnownData {
    sites: Site[];
    prestataires: Prestataire[];
    dechets: Dechet[];
}

// Fonction pour récupérer les données depuis Supabase
const fetchKnownData = async (entreprise_id: string): Promise<KnownData> => {
    const { data, error } = await supabase
        .from('table_autocompletion')
        .select('*')
        .eq('entreprise_id', entreprise_id);

    if (error) {
        throw new Error(`Erreur lors de la récupération des données: ${error.message}`);
    }

    const sites: Site[] = [];
    const prestataires: Prestataire[] = [];
    const dechets: Dechet[] = [];

    data?.forEach(record => {
        // Sites
        if (record.site) {
            sites.push({
                nom: record.site.nom || '',
                siret: record.site.siret || ''
            });
        }

        // Transporteurs
        if (record.transporteur) {
            prestataires.push({
                nomBoite: record.transporteur.nomBoite || '',
                nomPrenom: record.transporteur.nomPrenom || '',
                adresse: record.transporteur.adresse || '',
                siret: record.transporteur.siret || '',
                email: record.transporteur.email || '',
                transporteur_ou_destinataire: 'transporteur'
            });
        }

        // Destinataires
        if (record.destinataire) {
            prestataires.push({
                nomBoite: record.destinataire.nomBoite || '',
                nomPrenom: record.destinataire.nomPrenom || '',
                adresse: record.destinataire.adresse || '',
                siret: record.destinataire.siret || '',
                email: record.destinataire.email || '',
                transporteur_ou_destinataire: 'destinataire'
            });
        }

        // Déchets
        if (record.dechet) {
            dechets.push({
                nom: record.dechet.nom || '',
                codeCED: record.dechet.codeCED || ''
            });
        }
    });

    return {
        sites,
        prestataires,
        dechets
    };
};

const OCRThisBSD = ({ pdf_id, pdf_path, pdf_status, onDataExtracted }: OCRThisBSDProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingPaddle, setIsLoadingPaddle] = useState(false);
    const { entreprise_id } = useSession();

    // Requête SWR pour récupérer les données connues
    const { data: known_data, error: knownDataError, isLoading: isLoadingKnownData } = useSWR(
        entreprise_id ? `known-data-${entreprise_id}` : null,
        () => fetchKnownData(entreprise_id!),
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false
        }
    );

    const ocr_this_bsd_pdf = async () => {
        if (!known_data) {
            toast.error('Données non disponibles');
            return;
        }
        setIsLoading(true);
        try {
            // Get signed URL for the PDF
            const { data: signedUrlData } = await supabase.storage
                .from('pdfs_bucket')
                .createSignedUrl(pdf_path, 3600);

            if (!signedUrlData?.signedUrl) {
                throw new Error('Failed to get signed URL');
            }

            // Call Python backend to process PDF
            const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_PYTHON}/parse-pdf-and-extract-info/`, {
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

            const data = await response.json();
            
            // Parse the extracted data
            const extractedData = JSON.parse(data.extracted_data);
            console.log('Extracted data:', extractedData);

            // Update parent component with extracted data
            if (onDataExtracted) {
                onDataExtracted(extractedData);
            }

        } catch (error) {
            console.error('Error in OCR process:', error);
            toast.error(error instanceof Error ? error.message : 'Erreur lors de l\'extraction des données');
        } finally {
            setIsLoading(false);
        }
    };

    const ocr_this_bsd_pdf_paddleocr = async () => {
        if (!known_data) {
            toast.error('Données non disponibles');
            return;
        }
        setIsLoadingPaddle(true);
        try {
            // Get signed URL for the PDF
            const { data: signedUrlData } = await supabase.storage
                .from('pdfs_bucket')
                .createSignedUrl(pdf_path, 3600);

            if (!signedUrlData?.signedUrl) {
                throw new Error('Failed to get signed URL');
            }

            // Download the PDF file
            const pdfResponse = await fetch(signedUrlData.signedUrl);
            if (!pdfResponse.ok) {
                throw new Error('Failed to download PDF');
            }

            const pdfBlob = await pdfResponse.blob();
            const pdfFile = new File([pdfBlob], 'document.pdf', { type: 'application/pdf' });

            console.log("known_data", known_data)
            
            // Create FormData for file upload and known_data
            const formData = new FormData();
            formData.append('file', pdfFile);
            formData.append('known_data', JSON.stringify(known_data));
            
            // Ajouter le statut du PDF s'il est disponible
            if (pdf_status) {
                formData.append('pdf_status', pdf_status);
            }
            
            const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_PYTHON}/ocr-enrich-bon`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to process PDF with PaddleOCR');
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            // Get the BSDCerfa data directly
            const bsdCerfaData = data.bsd_cerfa_data;
            const perfect_extract = data.perfect_extract;
            console.log('BSDCerfa data:', bsdCerfaData);
            console.log('Extracted data:', data.extracted_data);
            console.log('Perfect extract:', perfect_extract);

            // Update parent component with BSDCerfa data
            if (onDataExtracted) {
                onDataExtracted(bsdCerfaData);
            }

            // Afficher un toast différent selon le perfect_extract
            if (perfect_extract) {
                toast.success('🎯 Extraction parfaite ! Toutes les données ont été correctement identifiées et validées.', {
                    duration: 5000,
                    style: {
                        background: '#10b981',
                        color: 'white',
                        fontSize: '16px',
                        fontWeight: 'bold'
                    }
                });
            } else {
                toast('⚠️ Extraction partielle. Certaines données n\'ont pas pu être validées automatiquement. Vérifiez les informations extraites.', {
                    duration: 5000,
                    style: {
                        background: '#f59e0b',
                        color: 'white',
                        fontSize: '16px',
                        fontWeight: 'bold'
                    }
                });
            }
        } catch (error) {
            console.error('Error in PaddleOCR process:', error);
            toast.error(error instanceof Error ? error.message : 'Erreur lors de l\'extraction des données avec PaddleOCR');
        } finally {
            setIsLoadingPaddle(false);
        }
    };

    return (
        <div className="flex gap-2">
            <button
                onClick={ocr_this_bsd_pdf}
                disabled={isLoading}
                className={`bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 ${
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
                    'Extraire par Parsing'
                )}
            </button>

            <button
                onClick={ocr_this_bsd_pdf_paddleocr}
                disabled={isLoadingPaddle}
                className={`bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 ${
                    isLoadingPaddle ? 'opacity-50 cursor-not-allowed' : ''
                }`}
            >
                {isLoadingPaddle ? (
                    <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        PaddleOCR en cours...
                    </span>
                ) : (
                    'Extraire par PaddleOCR'
                )}
            </button>
        </div>
    );
};

export default OCRThisBSD;
