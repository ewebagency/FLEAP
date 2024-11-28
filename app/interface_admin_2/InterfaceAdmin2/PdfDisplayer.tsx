import { useEffect } from 'react';

interface PdfDisplayerProps {
    pdfUrl: string | null;
}

const PdfDisplayer = ({ pdfUrl }: PdfDisplayerProps) => {
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
            {pdfUrl && <iframe
                src={pdfUrl}
                style={{ 
                    border: 'none',
                    width: '100%',
                    height: '100%',
                    display: 'block'
                }}
                title="Mon PDF"
            />}
        </div>
    );
};

export default PdfDisplayer;
