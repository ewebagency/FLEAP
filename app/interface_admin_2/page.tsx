"use client";
import { useEffect, useState } from "react";
import { useSession } from "../component/SessionProvider";
import PdfDisplayer from "./InterfaceAdmin2/PdfDisplayer";
import { supabase } from "../database/supabaseClient";
import FormulaireDisplayer from "./InterfaceAdmin2/FormulaireDisplayer";
import FormulaireManoJson from "./InterfaceAdmin2/FormulaireManoJson";
import DisplayInfosPython from "./DisplayInfosPython";

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

    const fetchCurrentPdfPath = async () => {
        if(session && session.user?.id){
            const user_id = session.user.id;
            try {
                setLoading(true);
                const res = await fetch('/api/interface_admin_2/fetch_current_pdf', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ user_id: user_id }),
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

    return (
    <div>
        <div className="container mx-auto h-screen flex">
            {loading ? (
                <div className="flex justify-center items-center w-full">
                    <div className="loader">Chargement...</div>
                </div>
            ) : currentPdfId ? (
                <div className="flex w-full m-5">
                    <div className="w-3/5 pr-1">
                        {currentPdfPath && <PdfDisplayer pdfUrl={currentPdfUrl} />}
                    </div>
                    <div className="w-2/5 pl-1 bg-gray-100 rounded-lg mt-2 mr-2 overflow-y-auto">
                        {/*infosJsonFromPdf && <FormulaireDisplayer infosJsonFromPdf={infosJsonFromPdf} currentPdfId={currentPdfId} onNextPdf={handleNextPdf} />*/}
                        <FormulaireManoJson currentPdfId={currentPdfId} onNextPdf={handleNextPdf} />
                    </div>
                </div>
            ) : (
                <div className="m-60 flex w-full m-5 justify-center items-center bg-green-600 text-xl border-2 border-white rounded-xl text-white font-bold">
                    Tous les PDF ont été traités.
                </div>
            )}
        </div>
        {currentPdfBlob && <DisplayInfosPython currentPdfBlob={currentPdfBlob} />}
    </div>
    )
}

export default InterfaceAdmin2;
