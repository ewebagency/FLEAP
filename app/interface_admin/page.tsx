"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '../database/supabaseClient';
import { useSession } from '../component/SessionProvider';
import DisplayPdfAndInfos from './DisplayPdfAndInfos';

async function getPdfFromDB(user_id: string) {
    const { data, error } = await supabase
        .from('pdf_infos')
        .select('name_pdf_in_bucket')
        .eq('user_id', user_id);

    if (error) {
        console.error("Erreur lors de la récupération des PDF du bucket:", error);
        return [];
    }

    // Récupérer les fichiers PDF directement depuis le bucket
    const pdfUrls = await Promise.all(data.map(async (pdf: any) => {
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

    return pdfUrls.filter(url => url !== null); // Filtrer les URLs nulles
}

const InterfaceAdminPage = () => { 
    const session = useSession();
    const [pdfFiles, setPdfFiles] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(true); // État pour le chargement

    useEffect(() => {
        const fetchPdfFiles = async () => {
            if (session && session.user?.id) {
                setLoading(true); // Démarrer le chargement
                const files = await getPdfFromDB(session.user.id);
                setPdfFiles(files);
                setLoading(false); // Fin du chargement
            }
        };
        fetchPdfFiles();
    }, [session]);

    console.log("mes pdfs", pdfFiles.length);

    return (
        <div>
            <DisplayPdfAndInfos pdfFiles={pdfFiles} />
        </div>
    );
};

export default InterfaceAdminPage;
