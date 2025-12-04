'use client'
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/app/database/supabaseClient'; // Import Supabase client
import { useSession } from '../../component/SessionProvider';
import TableImportedFiles, { PdfInfo } from './TableImportedFiles';
import { useImport } from './ImportContext';
import { toast } from 'react-hot-toast';
import { cofounders_user_id } from '@/app/component/SideBar';
import CofounderStatusFilter from './CofounderStatusFilter';
//import ExtractBonProcessor from './JobProcessor/ExtractBonProcessor';
import LoopStarterButton from './ExtractMetaDoc/components/LoopStarterButton';


const TableImportedFilesFunctional: React.FC = () => {
    const [pdfInfos, setPdfInfos] = useState<PdfInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { entreprise_id, user_id, display_features } = useSession();
    const { importReload, documentTypeFilter, statusFilter, setUpdatePdfInfosFunction } = useImport();

    // Vérifier si l'utilisateur est un cofounder
    const isCofounder = cofounders_user_id(user_id);

    const fetchPdfInfos = useCallback(async () => {
        if (!entreprise_id) {
            setLoading(false);
            return;
        }
        
        setLoading(true);
        setError(null);
        
        try {
            const pageSize = 1000;
            let offset = 0;
            const allRows: PdfInfo[] = [];
            
            while (true) {
                const { data, error } = await supabase
                    .from('pdf_infos')
                    .select('*')
                    .eq('entreprise_id', entreprise_id)
                    .order('id', { ascending: true })
                    .range(offset, offset + pageSize - 1);

                if (error) throw error;

                const batch = (data || []) as PdfInfo[];
                allRows.push(...batch);

                if (batch.length < pageSize) break; // no more rows
                offset += pageSize;
            }

            setPdfInfos(allRows);
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

    // Fonction pour mettre à jour localement le statut d'un PDF après liaison
    const handlePdfStatusUpdate = (pdfId: number, newStatus: string) => {
        setPdfInfos(prevPdfInfos => 
            prevPdfInfos.map(pdf => 
                pdf.id === pdfId 
                    ? { ...pdf, status: newStatus }
                    : pdf
            )
        );
    };

    // Fonction pour ajouter un nouveau PDF aux données locales
    const handlePdfInfosUpdate = useCallback((newPdfInfo: PdfInfo) => {
        setPdfInfos(prevPdfInfos => [newPdfInfo, ...prevPdfInfos]);
    }, []);

    // Enregistrer la fonction de mise à jour dans le contexte
    useEffect(() => {
        setUpdatePdfInfosFunction(handlePdfInfosUpdate);
    }, [handlePdfInfosUpdate, setUpdatePdfInfosFunction]);

    // Filter pdfInfos based on documentTypeFilter
    let filteredPdfInfos = documentTypeFilter 
        ? documentTypeFilter === 'null'
            ? pdfInfos.filter(pdf => pdf.document_type === null || pdf.document_type === undefined)
            : pdfInfos.filter(pdf => pdf.document_type === documentTypeFilter)
        : pdfInfos;

    // Fonction helper pour obtenir les statuts correspondant au filtre
    const getStatusesForFilter = (filter: string | null): string[] => {
        switch (filter) {
            case 'read':
                return ['extracted', 'splitted_extracted', 'read'];
            case 'unread':
                return ['unread', 'splitted'];
            case 'linked':
                return ['linked', 'pushed'];
            default:
                return [];
        }
    };

    // Calculer le nombre de documents filtrés par statut (pour les cofounders)
    const getFilteredDocumentsCount = () => {
        if (!isCofounder || !statusFilter) return 0;
        
        // Appliquer d'abord le filtre de type de document
        const tempFiltered = documentTypeFilter 
            ? documentTypeFilter === 'null'
                ? pdfInfos.filter(pdf => pdf.document_type === null || pdf.document_type === undefined)
                : pdfInfos.filter(pdf => pdf.document_type === documentTypeFilter)
            : pdfInfos;
        
        // Puis filtrer par statut avec les statuts multiples
        const statusesToInclude = getStatusesForFilter(statusFilter);
        return tempFiltered.filter(pdf => statusesToInclude.includes(pdf.status)).length;
    };

    // Filter pdfInfos based on statusFilter (only for cofounders)
    if (isCofounder && statusFilter) {
        const statusesToInclude = getStatusesForFilter(statusFilter);
        filteredPdfInfos = filteredPdfInfos.filter(pdf => statusesToInclude.includes(pdf.status));
    }

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
            <div className="flex justify-between items-center w-full"> 
            {/* Afficher le filtre de statut pour les cofounders avec le nombre de documents filtrés */}
                <CofounderStatusFilter 
                    totalDocuments={pdfInfos.length} 
                    filteredDocuments={getFilteredDocumentsCount()}
                />
                <div className="flex justify-end">
                    {display_features?.extract_ocr &&  
                        <div className="flex items-center justify-between">
                            {/*<ExtractBonProcessor />*/}
                            <LoopStarterButton/>
                        </div>                  
                        
                    }            
                </div>
            </div>
            <TableImportedFiles 
                pdfInfos={filteredPdfInfos} 
                onDelete={handleDelete}
                onPdfStatusUpdate={handlePdfStatusUpdate}
                onPdfInfosUpdate={handlePdfInfosUpdate}
            />
        </div>
    );
};

export default TableImportedFilesFunctional;
