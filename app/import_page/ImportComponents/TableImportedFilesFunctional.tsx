'use client'
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/app/database/supabaseClient'; // Import Supabase client
import { useSession } from '../../component/SessionProvider';
import TableImportedFiles, { PdfInfo } from './TableImportedFiles';
import { SessionMore } from '../../component/SessionProvider';
import { useImport } from './ImportContext';
import { toast } from 'react-hot-toast';


const TableImportedFilesFunctional: React.FC = () => {
    const [pdfInfos, setPdfInfos] = useState<PdfInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { entreprise_id } = useSession();
    const { importReload, documentTypeFilter } = useImport();

    const fetchPdfInfos = useCallback(async () => {
        if (!entreprise_id) {
            setLoading(false);
            return;
        }
        
        setLoading(true);
        setError(null);
        
        try {
            const { data, error } = await supabase
                .from('pdf_infos')
                .select('*')
                .eq('entreprise_id', entreprise_id);

            if (error) throw error;

            setPdfInfos(data || []);
        } catch (error) {
            console.error("Erreur lors de la récupération des informations PDF:", error);
            setError("Erreur lors du chargement des fichiers");
            toast.error("Erreur lors du chargement des fichiers");
        } finally {
            setLoading(false);
        }
    }, [entreprise_id]);

    useEffect(() => {
        fetchPdfInfos();
    }, [entreprise_id, fetchPdfInfos, importReload]);

    const handleDelete = async (pdfPath: string, id: number) => {
        try {
            const { error: deleteError } = await supabase.storage
                .from('pdfs_bucket') 
                .remove([pdfPath]);

            if (deleteError) throw deleteError;

            const { error: deleteInfoError } = await supabase
                .from('pdf_infos')  // Nom correct de la table
                .delete()
                .eq('id', id);

            if (deleteInfoError) throw deleteInfoError;

            toast.success("Fichier supprimé avec succès");
            fetchPdfInfos();
        } catch (error) {
            console.error("Erreur lors de la suppression:", error);
            toast.error("Erreur lors de la suppression du fichier");
        }
    };

    // Filter pdfInfos based on documentTypeFilter
    const filteredPdfInfos = documentTypeFilter 
        ? documentTypeFilter === 'null'
            ? pdfInfos.filter(pdf => pdf.document_type === null || pdf.document_type === undefined)
            : pdfInfos.filter(pdf => pdf.document_type === documentTypeFilter)
        : pdfInfos;

    if (loading && !entreprise_id) {
        return <div className="flex justify-center p-4">
            <div className="loading loading-spinner loading-lg"></div>
        </div>;
    }

    if (!entreprise_id) {
        return <div className="text-center p-4">
            Aucune entreprise sélectionnée
        </div>;
    }

    if (error) {
        return <div className="text-center text-red-500 p-4">
            {error}
        </div>;
    }

    if (loading) {
        return <div className="flex justify-center p-4">
            <div className="loading loading-spinner loading-lg"></div>
        </div>;
    }

    return (
        <div>
            <TableImportedFiles pdfInfos={filteredPdfInfos} onDelete={handleDelete} />
        </div>
    );
};

export default TableImportedFilesFunctional;
