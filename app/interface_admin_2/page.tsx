"use client";
import { useEffect, useState } from "react";
import { useSession } from "../component/SessionProvider";
import PdfDisplayer from "./InterfaceAdmin2/PdfDisplayer";
import { supabase } from "../database/supabaseClient";
import FormulaireDisplayer from "./InterfaceAdmin2/FormulaireDisplayer";
import FormulaireMano from "./InterfaceAdmin2/FormulaireMano";
import DisplayInfosPython from "./DisplayInfosPython";
//import FormulaireMano from "./InterfaceAdmin2/FormulaireMano";
import { AccessOtherAccountProvider, useAccessOtherAccount } from "./AccessOtherAccounts/AccessOtherAccountContext";
import { AccountSelector } from "./AccessOtherAccounts/AccountSelector";

interface InfosJsonFromPdf {
    [key: string]: string | number | boolean; // Removed object type
}

const InterfaceAdmin2 = () => {
    const session = useSession();
    const [currentPdfPath, setCurrentPdfPath] = useState<string | null>(null);
    const [currentPdfBlob, setCurrentPdfBlob] = useState<Blob | null>(null);
    const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(null);
    //const [infosJsonFromPdf, setInfosJsonFromPdf] = useState<InfosJsonFromPdf | null>(null);
    const [currentPdfId, setCurrentPdfId] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const { selectedAccounts } = useAccessOtherAccount();

    const fetchCurrentPdfPath = async () => {
        if(selectedAccounts.length > 0){
            try {
                setLoading(true);
                const user_ids = selectedAccounts.map(account => account.user_id);
                const res = await fetch('/api/interface_admin_2/fetch_current_pdf', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ user_ids: user_ids }),
                });
                const { something_to_treat, pdf_id, pdf_path } = await res.json();
                if(something_to_treat){
                    setCurrentPdfPath(pdf_path);
                    setCurrentPdfId(pdf_id);
                } else {
                    setCurrentPdfPath(null);
                    setCurrentPdfId(null);
                }
            } catch (error) {
                console.error('Erreur lors de la requête POST :', error);
            } finally {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        fetchCurrentPdfPath();
    }, [session]);

    useEffect(() => {
        const getPdfBlobAndUrl = async () => {
            if(currentPdfPath){
                try {
                    setLoading(true);
                    const { data, error } = await supabase.storage.from('pdfs_bucket').download(encodeURIComponent(currentPdfPath));
                    if (error) {
                        console.error('Error downloading PDF:', error);
                        return;
                    }
                    const url = URL.createObjectURL(data);
                    setCurrentPdfUrl(url);
                    setCurrentPdfBlob(data);
                } finally {
                    setLoading(false);
                }
            }
        };
        getPdfBlobAndUrl();
    }, [currentPdfPath]);

    /*useEffect(() => {
        const sendBlobPdfToPythonServer = async () => {
            if(currentPdfBlob){
                const formData = new FormData();
                formData.append('file', currentPdfBlob);
                try {
                    setLoading(true);
                    console.log('Envoi du PDF au serveur Python');
                    const url_server_python_dyn = `${process.env.NEXT_PUBLIC_SERVER_PYTHON}/treat-pdf/`.toString();
                    const response = await fetch(url_server_python_dyn, {
                        method: 'POST',
                        body: formData,
                    });
                    if (!response.ok) {
                        throw new Error('Erreur lors de l\'envoi du PDF au serveur');
                    }
                    const result = await response.json();
                    console.log("Réception du JSON du serveur Python");
                    setInfosJsonFromPdf(result);
                } catch (error) {
                    console.error('Erreur lors de l\'envoi du PDF:', error);
                } finally {
                    setLoading(false);
                }
            }
        };
        sendBlobPdfToPythonServer();
    }, [currentPdfBlob]);*/

    const handleNextPdf = () => {
        setCurrentPdfPath(null);
        setCurrentPdfBlob(null);
        setCurrentPdfUrl(null);
        //setInfosJsonFromPdf(null);
        setCurrentPdfId(null);
        fetchCurrentPdfPath();
    };

    const handleResetSkipped = async () => {
        if(session && session.user_id){
            try {
                setLoading(true);
                const response = await fetch('/api/interface_admin_2/reset_skipped_pdf', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ user_id: session.user_id }),
                });
                
                if (!response.ok) throw new Error('Erreur lors de la réinitialisation');
                
                // Rafraîchir après réinitialisation
                fetchCurrentPdfPath();
            } catch (error) {
                console.error('Erreur lors de la réinitialisation des PDFs skipped:', error);
            } finally {
                setLoading(false);
            }
        }
    };

    console.log(selectedAccounts, currentPdfId, currentPdfPath);
    return (
    <div>
        
            <div className="h-screen w-full">
                <AccountSelector />
                {loading ? (
                    <div className="flex justify-center items-center w-full">
                        <div className="loader">Chargement...</div>
                    </div>
                ) : currentPdfId ? (
                    <div className="w-full">
                        <div className="flex w-full">
                            <div className="flex-1">
                                {currentPdfPath && <PdfDisplayer pdfUrl={currentPdfUrl} />}
                            </div>
                            <div className="w-[400px] bg-gray-100 rounded-lg overflow-y-auto">
                                <FormulaireMano currentPdfId={currentPdfId} onNextPdf={handleNextPdf} />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center w-full">
                        <div className="m-4 bg-green-600 text-xl border-2 border-white rounded-xl text-white font-bold p-4">
                            Tous les PDF ont été traités ou skipped.
                        </div>
                        <button
                            onClick={handleResetSkipped}
                            disabled={loading}
                            className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                        >
                            Réinitialiser les PDFs skipped
                        </button>
                    </div>
                )}
            </div>
            {currentPdfBlob && <DisplayInfosPython currentPdfBlob={currentPdfBlob} />}

    </div>
    )
}

export default InterfaceAdmin2;
