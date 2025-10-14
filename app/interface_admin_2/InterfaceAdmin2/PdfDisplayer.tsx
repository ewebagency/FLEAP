import { useEffect, useState } from 'react';

interface PdfDisplayerProps {
    pdfUrl: string | null;
    onError?: (error: Error | string) => void;
}

const PdfDisplayer = ({ pdfUrl, onError }: PdfDisplayerProps) => {
    const [hasError, setHasError] = useState(false);

    const sendPdfToServer = async (url: string) => {
        try {
            // Fetch the PDF file
            const response = await fetch(url);
            const blob = await response.blob();
            
            // Create FormData and append the PDF
            const formData = new FormData();
            formData.append('file', blob, 'document.pdf');

            // Send to Python backend
            const apiResponse = await fetch(`${process.env.NEXT_PUBLIC_SERVER_PYTHON}/treat-pdf/`, {
                method: 'POST',
                body: formData,
            });

            const result = await apiResponse.json();
            console.log('Server response:', result);
            
        } catch (error) {
            console.error('Error sending PDF to server:', error);
        }
    };

    // Send PDF when URL changes
    /*useEffect(() => {
        if (pdfUrl) {
            sendPdfToServer(pdfUrl);
        }
    }, [pdfUrl]);*/

    // Vérifier les erreurs de chargement du PDF
    useEffect(() => {
        if (!pdfUrl || !onError) return;

        const checkPdfUrl = async () => {
            try {
                const response = await fetch(pdfUrl, { method: 'HEAD' });
                if (!response.ok) {
                    const errorText = await response.text();
                    setHasError(true);
                    onError(errorText || `HTTP Error: ${response.status}`);
                }
            } catch (error) {
                setHasError(true);
                onError(error instanceof Error ? error : String(error));
            }
        };

        void checkPdfUrl();
    }, [pdfUrl, onError]);

    // Reset error state when URL changes
    useEffect(() => {
        setHasError(false);
    }, [pdfUrl]);

    return (
        <div style={{ 
            marginRight: '5px',
            border: '2px solid gray',
            borderRadius: '10px',
            overflow: 'hidden',
            height: '95vh',
            flex: '1',
            display: 'flex'
        }}>
            {pdfUrl && !hasError && <iframe
                src={pdfUrl}
                style={{ 
                    border: 'none',
                    width: '100%',
                    height: '100%',
                    display: 'block'
                }}
                title="Mon PDF"
                onError={(e) => {
                    console.error('Erreur iframe:', e);
                    setHasError(true);
                    if (onError) {
                        onError('Erreur de chargement du PDF dans l\'iframe');
                    }
                }}
            />}
        </div>
    );
};

export default PdfDisplayer;
