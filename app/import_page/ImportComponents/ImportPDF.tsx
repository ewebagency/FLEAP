'use client'
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { SessionMore, useSession } from '../../component/SessionProvider';
import { useImport } from './ImportContext';
import BoxIcon from '@/app/component/BoxIconWrapper';
import { handleExcelUpload } from './ImportExcel';
import {ExcelIcon} from './TableImportedFiles';
import { cofounders_user_id } from '@/app/component/SideBar';

const sanitizeFileName = (fileName: string): string => {
    return fileName
        .replace(/[^a-zA-Z0-9.-]/g, '_') // Remplace les caractères spéciaux par des underscores
        .replace(/_+/g, '_'); // Évite les underscores multiples
};

const ImportPDF = () => {
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
    const [selectedFileType, setSelectedFileType] = useState<'pdf' | 'excel'>('pdf');
    const [showFileTypeMenu, setShowFileTypeMenu] = useState(false);
    const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
    const [duplicateFiles, setDuplicateFiles] = useState<string[]>([]);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const session = useSession() as SessionMore;
    const user_id = session?.user_id;
    const entreprise_id = session?.entreprise_id;
    const { triggerReload } = useImport();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Fermer le menu si on clique en dehors
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowFileTypeMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Fonction pour vérifier les doublons
    const checkDuplicates = async (files: File[]): Promise<string[]> => {
        if (!entreprise_id) return [];

        // Récupérer tous les PDFs existants de l'entreprise
        const { data: existingPdfs, error } = await supabase
            .from('pdf_infos')
            .select('name_pdf')
            .eq('entreprise_id', entreprise_id);

        if (error) {
            console.error('Erreur lors de la récupération des PDFs existants:', error);
            return [];
        }

        const existingFileNames = existingPdfs?.map(pdf => pdf.name_pdf) || [];
        const newFileNames = files.map(file => file.name);
        
        // Trouver les doublons
        const duplicates = newFileNames.filter(fileName => 
            existingFileNames.includes(fileName)
        );

        return duplicates;
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            if (selectedFileType === 'pdf') {
                const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
                if (pdfFiles.length > 0) {
                    handleFilesSelection(pdfFiles);
                } else {
                    alert("Veuillez sélectionner des fichiers PDF.");
                }
            } else if (selectedFileType === 'excel') {
                const excelFiles = Array.from(files).filter(file => 
                    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    file.type === 'application/vnd.ms-excel'
                );
                if (excelFiles.length > 0) {
                    handleFilesUpload(excelFiles);
                } else {
                    alert("Veuillez sélectionner des fichiers Excel.");
                }
            }
        }
        if (event.target) {
            event.target.value = '';
        }
    };

    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const files = Array.from(event.dataTransfer.files);
        if (selectedFileType === 'pdf') {
            const pdfFiles = files.filter(file => file.type === 'application/pdf');
            if (pdfFiles.length > 0) {
                handleFilesSelection(pdfFiles);
            } else {
                alert("Veuillez déposer des fichiers PDF.");
            }
        } else if (selectedFileType === 'excel') {
            const excelFiles = files.filter(file => 
                file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                file.type === 'application/vnd.ms-excel'
            );
            if (excelFiles.length > 0) {
                handleFilesUpload(excelFiles);
            } else {
                alert("Veuillez déposer des fichiers Excel.");
            }
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [selectedFileType]);

    // Nouvelle fonction pour gérer la sélection de fichiers
    const handleFilesSelection = async (files: File[]) => {
        if (!user_id) {
            alert("Veuillez vous connecter pour importer des fichiers.");
            return;
        }
        if (!entreprise_id) {
            alert("Vous devez être associé à une entreprise pour importer des fichiers.");
            return;
        }

        // Vérifier les doublons
        const duplicates = await checkDuplicates(files);
        
        if (duplicates.length > 0) {
            // Afficher l'alerte de doublons
            setDuplicateFiles(duplicates);
            setPendingFiles(files);
            setShowDuplicateAlert(true);
        } else {
            // Pas de doublons, procéder à l'import
            handleFilesUpload(files);
        }
    };

    // Fonction pour confirmer l'import malgré les doublons
    const confirmImportWithDuplicates = () => {
        setShowDuplicateAlert(false);
        handleFilesUpload(pendingFiles);
        setPendingFiles([]);
        setDuplicateFiles([]);
    };

    // Fonction pour annuler l'import
    const cancelImport = () => {
        setShowDuplicateAlert(false);
        setPendingFiles([]);
        setDuplicateFiles([]);
    };

    const handleFilesUpload = async (files: File[]) => {
        if (!user_id) {
            alert("Veuillez vous connecter pour importer des fichiers.");
            return;
        }
        if (!entreprise_id) {
            alert("Vous devez être associé à une entreprise pour importer des fichiers.");
            return;
        }

        setLoading(true);
        const uploadPromises = files.map(async (file) => {
            try {
                if (selectedFileType === 'excel') {
                    return await handleExcelUpload(file, user_id, entreprise_id);
                }

                // Traitement PDF existant
                if (file.size > 50 * 1024 * 1024) {
                    return { 
                        success: false, 
                        file: file.name, 
                        error: 'Le fichier dépasse la taille maximale autorisée (50MB)' 
                    };
                }

                setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
                const sanitizedName = sanitizeFileName(file.name);
                const filePath = `${sanitizedName}_${Date.now()}_${user_id}`;

                const fileTypeCheck = await getFileType(file);
                if (!fileTypeCheck.isPDF) {
                    return { 
                        success: false, 
                        file: file.name, 
                        error: 'Le fichier n\'est pas un PDF valide' 
                    };
                }

                const { data, error: uploadError } = await supabase.storage
                    .from('pdfs_bucket')
                    .upload(filePath, file, {
                        upsert: false,
                        contentType: 'application/pdf'
                    });

                if (uploadError) {
                    console.error(`Erreur lors du téléchargement de ${file.name}:`, uploadError);
                    return { success: false, file: file.name, error: uploadError.message };
                }

                setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));

                const fileSizeInMB = (file.size / (1024 * 1024)).toFixed(2);
                const { error: insertError } = await supabase
                    .from('pdf_infos')
                    .insert([{
                        user_id: user_id,
                        entreprise_id: entreprise_id,
                        name_pdf: file.name,
                        name_pdf_in_bucket: filePath,
                        pdf_path: data.fullPath,
                        file_size: parseFloat(fileSizeInMB)
                    }]);

                if (insertError) {
                    return { success: false, file: file.name, error: insertError.message };
                }

                return { success: true, file: file.name };
            } catch (error: unknown) {
                console.error(`Erreur détaillée pour ${file.name}:`, error);
                const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue';
                return { 
                    success: false, 
                    file: file.name, 
                    error: errorMessage 
                };
            }
        });

        const results = await Promise.all(uploadPromises);

        // Envoyer un email de notification si l'utilisateur n'est pas 1234
        if (cofounders_user_id(user_id) === false) {
            const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', user_id)
            .single();

            if (userError) {
                console.error('Erreur lors de la récupération des informations utilisateur:', userError);
            }

            // Récupérer les informations de l'entreprise
            const { data: entrepriseData, error: entrepriseError } = await supabase
                .from('entreprise')
                .select('name')
                .eq('id', entreprise_id)
                .single();       

            if (entrepriseError) {
                console.error('Erreur lors de la récupération des informations de l\'entreprise:', entrepriseError);
            }

            const successfulUploads = results.filter(result => result.success);
            if (successfulUploads.length > 0) {
                const fileType = selectedFileType === 'pdf' ? 'PDF' : 'Excel';
                const response = await fetch('/api/send_mail', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        to: "asohm@fleap.fr",
                        subject: `Nouveau(x) fichier(s) ${fileType} importé(s) sur Fleap`,
                        text: `${successfulUploads.length} fichier(s) ${fileType} a/ont été importé(s) par l'utilisateur ${userData?.first_name} ${userData?.last_name} de l'entreprise ${entrepriseData?.name} : ${successfulUploads.map(result => result.file).join(', ')}`,
                    }),
                });

                if (!response.ok) {
                    console.error('Erreur lors de l\'envoi de l\'email de notification');
                }
            }
        }

        results.forEach(result => {
            if (result.success) {
                console.log(`${result.file} importé avec succès`);
            } else {
                console.error(`Erreur pour ${result.file}:`, result.error);
                alert(`Erreur lors de l'import de ${result.file}: ${result.error}`);
            }
        });

        setLoading(false);
        setUploadProgress({});
        triggerReload();
    };

    return (
        <div className="flex flex-col items-center w-full">
            {/* Modal d'alerte pour les doublons */}
            {showDuplicateAlert && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold text-red-600 mb-4">
                            Nous voyons des doublons
                        </h3>
                        <p className="text-gray-700 mb-4">
                            Les fichiers suivants existent déjà dans votre entreprise :
                        </p>
                        <ul className="bg-gray-100 p-3 rounded mb-4 max-h-32 overflow-y-auto">
                            {duplicateFiles.map((fileName, index) => (
                                <li key={index} className="text-sm text-gray-600 mb-1">
                                    • {fileName}
                                </li>
                            ))}
                        </ul>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={cancelImport}
                                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={confirmImportWithDuplicates}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                                Importer quand même
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div 
                className="border-[1px] border-dashed border-gray-400 p-4 rounded-md w-full text-center cursor-pointer"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
            >
                {loading ? (
                    <label className="btn bg-[var(--green-medium)] hover:bg-[var(--green-dark)] text-white h-8 px-2 flex items-center mx-auto max-w-[400px]">
                        <span className="loader"></span>
                    </label>
                ) : (
                    <div className="relative">
                        <button 
                            onClick={() => setShowFileTypeMenu(!showFileTypeMenu)}
                            className="btn bg-[var(--green-medium)] hover:bg-[var(--green-dark)] text-white h-8 px-2 flex items-center mx-auto max-w-[400px]"
                        >
                            <div className="flex items-center gap-2">
                                <BoxIcon color='white' name='import' />
                                <p>Sélectionner des fichiers</p>
                            </div>
                        </button>
                        <input 
                            ref={fileInputRef}
                            type="file" 
                            accept=".pdf,.xlsx,.xls"
                            onChange={handleFileChange} 
                            className="hidden"
                            multiple
                        />
                        {showFileTypeMenu && (
                            <div 
                                ref={menuRef}
                                className="absolute left-1/2 transform -translate-x-1/2 mt-2 bg-white rounded-md shadow-lg z-50 py-2 w-40"
                            >
                                <button
                                    onClick={() => {
                                        setSelectedFileType('pdf');
                                        setShowFileTypeMenu(false);
                                        fileInputRef.current?.click();
                                    }}
                                    className="w-full px-2 py-1 text-sm text-gray-700 hover:bg-red-50 flex items-center gap-2"
                                >
                                    <BoxIcon color='red' name='file-pdf' type='solid' />
                                    <span className='ml-2'>PDF</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setSelectedFileType('excel');
                                        setShowFileTypeMenu(false);
                                        fileInputRef.current?.click();
                                    }}
                                    className="w-full px-2 py-1 text-sm text-gray-700 hover:bg-green-50 flex items-center gap-2"
                                >
                                    <ExcelIcon />
                                    <span className='ml-2'>Excel</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {loading && (
                <div className="w-full max-w-md mt-4">
                    {Object.entries(uploadProgress).map(([fileName, progress]) => (
                        <div key={fileName} className="mb-2">
                            <div className="text-sm text-gray-600">{fileName}</div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div 
                                    className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Fonction utilitaire pour vérifier le type de fichier
const getFileType = (file: File): Promise<{ isPDF: boolean }> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = (e) => {
            const arr = new Uint8Array(e.target?.result as ArrayBuffer).subarray(0, 4);
            let header = '';
            for (let i = 0; i < arr.length; i++) {
                header += arr[i].toString(16);
            }
            // Vérifie la signature du fichier PDF (%PDF)
            resolve({ isPDF: header.startsWith('25504446') });
        };
        reader.readAsArrayBuffer(file.slice(0, 4));
    });
};

export default ImportPDF;