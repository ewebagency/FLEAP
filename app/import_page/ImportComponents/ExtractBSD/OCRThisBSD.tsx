import { useState } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { toast } from 'react-hot-toast';
import { BSDCerfa } from './ExtractBSD';

interface OCRThisBSDProps {
    pdf_id: number;
    pdf_path: string;
    onDataExtracted?: (data: Partial<BSDCerfa>) => void;
}

const OCRThisBSD = ({ pdf_id, pdf_path, onDataExtracted }: OCRThisBSDProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingPaddle, setIsLoadingPaddle] = useState(false);

    const ocr_this_bsd_pdf = async () => {
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

            toast.success('Données extraites avec succès');
        } catch (error) {
            console.error('Error in OCR process:', error);
            toast.error(error instanceof Error ? error.message : 'Erreur lors de l\'extraction des données');
        } finally {
            setIsLoading(false);
        }
    };

    const ocr_this_bsd_pdf_doctr = async () => {
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

            // Create FormData for file upload
            const formData = new FormData();
            formData.append('file', pdfFile);

            // Call Python backend to process PDF with PaddleOCR
            const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_PYTHON}/extract-bsd-with-doctr`, {
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

            // Parse the extracted data
            const extractedData = JSON.parse(data.extracted_data);
            console.log('Extracted data with PaddleOCR:', extractedData);

            // Update parent component with extracted data
            if (onDataExtracted) {
                onDataExtracted(extractedData);
            }

            toast.success('Données extraites avec PaddleOCR avec succès');
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
                onClick={ocr_this_bsd_pdf_doctr}
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
                        Doctr en cours...
                    </span>
                ) : (
                    'Extraire par Doctr'
                )}
            </button>
        </div>
    );
};

export default OCRThisBSD;
