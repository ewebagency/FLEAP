import { useEffect, useState } from "react";
import { DataOnSupabase_infos_json } from "../register/interface/BSD_Interface";

interface DisplayInfosPythonProps {
    currentPdfBlob: Blob;
}

const DisplayInfosPython = ({ currentPdfBlob }: DisplayInfosPythonProps) => {
    const [loading, setLoading] = useState(false);
    const [infosJsonFromPdf, setInfosJsonFromPdf] = useState<DataOnSupabase_infos_json | null>(null);

    useEffect(() => {
        const sendBlobPdfToPythonServer = async () => {
            if(currentPdfBlob){
                const formData = new FormData();
                const file = new File([currentPdfBlob], 'document.pdf', { type: 'application/pdf' });
                formData.append('file', file);
                
                try {
                    setLoading(true);
                    console.log('Envoi du PDF au serveur Python');
                    const url_server_python_dyn = `${process.env.NEXT_PUBLIC_SERVER_PYTHON}/extract-text-only/`;
                    const response = await fetch(url_server_python_dyn, {
                        method: 'POST',
                        body: formData,
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        console.error('Erreur détaillée:', errorData);
                        throw new Error(`Erreur lors de l'envoi du PDF: ${response.status}`);
                    }
                    
                    const result = await response.json();
                    console.log("Réception du JSON du serveur Python");
                    setInfosJsonFromPdf(result);
                    console.log(result);
                } catch (error) {
                    console.error('Erreur lors de l\'envoi du PDF:', error);
                } finally {
                    setLoading(false);
                }
            }
        };
        sendBlobPdfToPythonServer();
    }, [currentPdfBlob]);

    return (
        <div>
            <h1>DisplayInfosPython</h1>
            {loading && <p>Chargement en cours...</p>}
            {infosJsonFromPdf && <pre>{JSON.stringify(infosJsonFromPdf, null, 2)}</pre>}
        </div>
    );
};

export default DisplayInfosPython;