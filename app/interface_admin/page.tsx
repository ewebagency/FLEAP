"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '../database/supabaseClient';
import { useSession } from '../component/SessionProvider';
//import DisplayPdfAndInfosPython from './DisplayPdfAndInfosPython';

interface PdfInterf {id: string, name_pdf_in_bucket: string}

async function getPdfFromDB(user_id: string) {
    const { data, error } = await supabase
        .from('pdf_infos')
        .select('id, name_pdf_in_bucket') // Ajout de l'ID dans la sélection
        .eq('user_id', user_id);

    if (error) {
        console.error("Erreur lors de la récupération des PDF du bucket:", error);
        return { pdfUrls: [], pdfIds: [] }; // Retourne un objet avec des tableaux vides
    }

    // Récupérer les fichiers PDF directement depuis le bucket
    const pdfUrls = await Promise.all(data.map(async (pdf: PdfInterf) => {
        console.log("nom", pdf);
        const { data: fileData, error } = await supabase
            .storage
            .from('pdfs_bucket') // Remplacez par le nom de votre bucket
            .download(encodeURIComponent(pdf.name_pdf_in_bucket));

        if (error) {
            console.error("Erreur lors du téléchargement du PDF:", error);
            return null; // Gérer l'erreur en retournant null
        }

        return URL.createObjectURL(fileData); // Convertir le contenu en URL
    }));

    const pdfIds = data.map(pdf => pdf.id); // Récupérer les IDs des PDF

    return { pdfUrls: pdfUrls.filter(url => url !== null), pdfIds }; // Retourner les URLs et les IDs
}

const InterfaceAdminPage = () => { 
    const session = useSession();
    const [pdfFiles, setPdfFiles] = useState<string[]>([]);
    const [pdfIds, setPdfIds] = useState<string[]>([]); // État pour les IDs des PDF
    const [loading, setLoading] = useState<boolean>(true); // État pour le chargement

    useEffect(() => {
        const fetchPdfFiles = async () => {
            if (session && session.user?.id) {
                setLoading(true); // Démarrer le chargement
                const files = await getPdfFromDB(session.user.id);
                setPdfFiles(files.pdfUrls);
                setPdfIds(files.pdfIds); // Mettre à jour les IDs des PDF
                setLoading(false); // Fin du chargement
            }
        };
        fetchPdfFiles();
    }, [session]);

    //console.log("mes pdfs", pdfFiles.length);

    return (
        <div>
            {/*<DisplayPdfAndInfosPython pdfFiles={pdfFiles} pdfIds={pdfIds} session_user_id={session?.user.id ?? null} />*/}
            <h1>interface admin</h1>
    
        </div>
    );
};

export default InterfaceAdminPage;