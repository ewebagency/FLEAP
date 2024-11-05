'use client'
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/app/database/supabaseClient'; // Import Supabase client
import { useSession } from '../SessionProvider';
import TableImportedFiles from './TableImportedFiles';
import { Session } from '@supabase/supabase-js';

interface PdfInfoInterface {
    id: number;
    name_pdf: string;
    name_pdf_in_bucket: string;
    pdf_path: string;
    created_at: string;
    url: string;
}

const TableImportedFilesFunctional: React.FC = () => {
    const [pdfInfos, setPdfInfos] = useState<PdfInfoInterface[]>([]); // État pour stocker les informations des PDF
    const [loading, setLoading] = useState(true); // État pour gérer le chargement
    const session = useSession() as Session | null; // Récupérer la session utilisateur
    const user_id = session?.user.id; // Récupérer l'ID de l'utilisateur

    const fetchPdfInfos = useCallback(async () => { // Wrap in useCallback
        setLoading(true); // Démarrer le chargement
        const { data, error } = await supabase
            .from('pdf_infos') // Remplacez par le nom de votre table
            .select('*')
            .eq('user_id', user_id); // Filtrer par user_id

        if (error) {
            console.error("Erreur lors de la récupération des informations PDF:", error);
        } else if (data) {
            // Ajouter l'URL pour chaque PDF
            const pdfInfosWithUrls = await Promise.all(data.map(async (pdf) => {
                const { data: urlData } = await supabase
                    .storage
                    .from('pdfs_bucket')
                    .createSignedUrl(pdf.name_pdf_in_bucket, 3600); // URL valide pendant 1 heure

                return {
                    ...pdf,
                    url: urlData?.signedUrl || ''
                };
            }));
            setPdfInfos(pdfInfosWithUrls);
        }
        setLoading(false); // Arrêter le chargement
    }, [user_id]); // Add user_id as a dependency

    useEffect(() => {
        if (user_id) {
            fetchPdfInfos(); // Appeler la fonction pour récupérer les informations
        }
    }, [user_id, fetchPdfInfos]);

    const handleDelete = async (pdfPath: string, id: number) => {
        // Supprimer le fichier du stockage
        const { error: deleteError } = await supabase.storage
            .from('pdfs_bucket') // Remplacez par le nom de votre bucket
            .remove([pdfPath]); // Chemin du fichier à supprimer

        if (deleteError) {
            alert("Erreur lors de la suppression du fichier: " + deleteError.message);
            return;
        }

        // Supprimer l'entrée de la table 'pdf_infos'
        const { error: deleteInfoError } = await supabase
            .from('pdf_infos') // Remplacez par le nom de votre table
            .delete()
            .eq('id', id); // Identifier l'entrée à supprimer

        if (deleteInfoError) {
            alert("Erreur lors de la suppression des informations du fichier: " + deleteInfoError.message);
        } else {
            console.log("Fichier et informations supprimés avec succès.");
            // Récupérer à nouveau les informations après la suppression
            fetchPdfInfos();
        }
    };

    console.log(pdfInfos);

    if (loading) {
        return <p>Chargement des fichiers PDF...</p>; // Message de chargement
    }

    return (
        <div>
            <TableImportedFiles pdfInfos={pdfInfos} onDelete={handleDelete} />
        </div>
    );
};

export default TableImportedFilesFunctional;
