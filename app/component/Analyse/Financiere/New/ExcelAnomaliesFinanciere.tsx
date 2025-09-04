'use client'
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { useSession } from '@/app/component/SessionProvider';
import { cofounders_user_id } from '@/app/component/SideBar';
import { toast } from 'react-hot-toast';

interface ExcelFile {
    nom_path: string;
    nom_clean: string;
}

const ExcelAnomaliesFinanciere: React.FC = () => {
    const { entreprise_id, user_id } = useSession();
    const [excelFiles, setExcelFiles] = useState<ExcelFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Vérifier si l'utilisateur est un cofounder
    const isCofounder = cofounders_user_id(user_id);
    
    // Debug des permissions
    useEffect(() => {
        console.log('User permissions:', { user_id, isCofounder, entreprise_id });
    }, [user_id, isCofounder, entreprise_id]);

    // Charger les fichiers Excel depuis la base de données
    const loadExcelFiles = useCallback(async () => {
        if (!entreprise_id) {
            console.log('No entreprise_id, skipping load');
            return;
        }

        try {
            console.log('Loading excel files for entreprise_id:', entreprise_id);
            const { data, error } = await supabase
                .from('entreprise')
                .select('excel_anomalies')
                .eq('id', entreprise_id)
                .single();

            console.log('Load result:', { data, error });

            if (error) throw error;

            const files = data?.excel_anomalies || [];
            console.log('Files loaded:', files);
            setExcelFiles(Array.isArray(files) ? files : []);
        } catch (error) {
            console.error('Erreur lors du chargement des fichiers Excel:', error);
            toast.error('Erreur lors du chargement des fichiers Excel');
        }
    }, [entreprise_id]);

    useEffect(() => {
        loadExcelFiles();
    }, [entreprise_id, loadExcelFiles]);

    // Générer un nom clean à partir du nom de fichier original
    const generateCleanName = (originalName: string): string => {
        // Garder le nom original sans l'extension
        const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
        return nameWithoutExt;
    };

    // Générer un nom de path unique pour le storage
    const generatePathName = (originalName: string): string => {
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 8);
        const extension = originalName.split('.').pop() || 'xlsx';
        return `excel_${timestamp}_${randomId}.${extension}`;
    };

    // Gérer l'upload d'un fichier Excel
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !entreprise_id) {
            console.log('No file selected or no entreprise_id:', { file: !!file, entreprise_id });
            return;
        }

        console.log('File selected:', { name: file.name, type: file.type, size: file.size });

        // Vérifier que c'est bien un fichier Excel
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/excel'
        ];
        
        if (!allowedTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
            console.log('Invalid file type:', file.type);
            toast.error('Veuillez sélectionner un fichier Excel (.xlsx ou .xls)');
            return;
        }

        setUploading(true);

        try {
            const nomClean = generateCleanName(file.name);
            const nomPath = generatePathName(file.name);

            console.log('Uploading file:', { nomClean, nomPath });

            // Upload du fichier vers le bucket pdfs_bucket (même bucket que les PDFs)
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('excels')
                .upload(nomPath, file, {
                    contentType: file.type,
                    cacheControl: '3600'
                });

            console.log('Upload result:', { uploadData, uploadError });

            if (uploadError) throw uploadError;

            // Ajouter le nouveau fichier à la liste
            const newFile: ExcelFile = { nom_path: nomPath, nom_clean: nomClean };
            const updatedFiles = [...excelFiles, newFile];

            // Mettre à jour la colonne excel_anomalies dans la table entreprise
            console.log('Updating entreprise table:', { entreprise_id, updatedFiles });
            const { data: updateData, error: updateError } = await supabase
                .from('entreprise')
                .update({ excel_anomalies: updatedFiles })
                .eq('id', entreprise_id)
                .select();

            console.log('Update result:', { updateData, updateError });

            if (updateError) throw updateError;

            setExcelFiles(updatedFiles);
            toast.success('Fichier Excel importé avec succès');
            
            // Réinitialiser l'input file
            event.target.value = '';

        } catch (error) {
            console.error('Erreur lors de l\'upload:', error);
            toast.error('Erreur lors de l\'import du fichier Excel');
        } finally {
            setUploading(false);
        }
    };

    // Ouvrir un fichier Excel dans une nouvelle fenêtre
    const handleOpenExcel = async (file: ExcelFile) => {
        try {
            setLoading(true);

            // Récupérer le fichier depuis le storage
            const { data, error } = await supabase.storage
                .from('excels')
                .download(file.nom_path);

            if (error) throw error;

            // Créer un blob URL et ouvrir dans une nouvelle fenêtre
            const url = URL.createObjectURL(data);
            window.open(url, '_blank');

            // Nettoyer l'URL après un délai
            setTimeout(() => URL.revokeObjectURL(url), 1000);

        } catch (error) {
            console.error('Erreur lors de l\'ouverture du fichier:', error);
            toast.error('Erreur lors de l\'ouverture du fichier Excel');
        } finally {
            setLoading(false);
        }
    };

    // Supprimer un fichier Excel
    const handleDeleteExcel = async (file: ExcelFile) => {
        if (!entreprise_id) return;

        try {
            // Supprimer le fichier du storage
            const { error: deleteError } = await supabase.storage
                .from('excels')
                .remove([file.nom_path]);

            if (deleteError) throw deleteError;

            // Mettre à jour la liste des fichiers
            const updatedFiles = excelFiles.filter(f => f.nom_path !== file.nom_path);

            // Mettre à jour la base de données
            const { error: updateError } = await supabase
                .from('entreprise')
                .update({ excel_anomalies: updatedFiles })
                .eq('id', entreprise_id);

            if (updateError) throw updateError;

            setExcelFiles(updatedFiles);
            toast.success('Fichier Excel supprimé avec succès');

        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
            toast.error('Erreur lors de la suppression du fichier Excel');
        }
    };

    if (!entreprise_id) {
        return (
            <div className="text-center p-4 text-gray-500">
                Aucune entreprise sélectionnée
            </div>
        );
    }


    return (
        <div className="p-4 bg-white rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 hidden">
                Anomalies
            </h3>

            {/* Bouton d'import visible uniquement pour les cofounders */}
            {isCofounder && (
                <div className="mb-4">
                    <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        {uploading ? 'Import en cours...' : 'Importer un Excel'}
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileUpload}
                            disabled={uploading}
                            className="hidden"
                        />
                    </label>
                </div>
            )}

            {/* Liste des fichiers Excel */}
            <div className="space-y-2">
                {excelFiles.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Aucun fichier Excel importé
                    </div>
                ) : (
                    excelFiles.map((file, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors"
                        >
                            <div className="flex items-center space-x-3">
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="text-sm font-medium text-gray-800">
                                    {file.nom_clean}
                                </span>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => handleOpenExcel(file)}
                                    disabled={loading}
                                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
                                >
                                    {loading ? 'Ouverture...' : 'Ouvrir'}
                                </button>
                                
                                {isCofounder && (
                                    <button
                                        onClick={() => handleDeleteExcel(file)}
                                        className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                    >
                                        Supprimer
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ExcelAnomaliesFinanciere;
