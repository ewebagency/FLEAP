import { useEffect, useState } from "react";
import { DataOnSupabase_infos_json } from "../register/interface/BSD_Interface";

interface DisplayInfosPythonProps {
    currentPdfBlob: Blob;
}

const DisplayInfosPython = ({ currentPdfBlob }: DisplayInfosPythonProps) => {
    const [loading, setLoading] = useState(false);
    const [infosJsonFromPdf, setInfosJsonFromPdf] = useState<DataOnSupabase_infos_json | null>(null);
    const [isVisible, setIsVisible] = useState(false);

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
            <div className="flex items-center gap-2 mb-2">
                <input
                    type="checkbox"
                    id="toggleInfos"
                    checked={isVisible}
                    onChange={(e) => setIsVisible(e.target.checked)}
                    className="w-4 h-4"
                />
                <label htmlFor="toggleInfos" className="text-lg font-semibold cursor-pointer">
                    Données extraites
                </label>
            </div>
            
            {isVisible && (
                <div className="max-h-[300px] overflow-y-auto">
                    {loading && <p>Chargement en cours...</p>}
                    {infosJsonFromPdf && (
                        <pre className="whitespace-pre-wrap break-words text-sm bg-white p-2 rounded">
                            {JSON.stringify(infosJsonFromPdf, null, 2)}
                        </pre>
                    )}
                </div>
            )}
        </div>
    );
};

export default DisplayInfosPython;