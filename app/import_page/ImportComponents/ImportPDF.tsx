'use client'
import React, { useState, useCallback, useRef } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { SessionMore, useSession } from '../../component/SessionProvider';
import { Session } from '@supabase/supabase-js';
import { useImport } from './ImportContext';

const ImportPDF = () => {
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
    const session = useSession() as SessionMore;
    const user_id = session?.user_id;
    const { triggerReload } = useImport();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
            if (pdfFiles.length > 0) {
                handleFilesUpload(pdfFiles);
            } else {
                alert("Veuillez sélectionner des fichiers PDF.");
            }
        }
        if (event.target) {
            event.target.value = '';
        }
    };

    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const files = Array.from(event.dataTransfer.files).filter(file => file.type === 'application/pdf');
        if (files.length > 0) {
            handleFilesUpload(files);
        } else {
            alert("Veuillez déposer des fichiers PDF.");
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    const handleFilesUpload = async (files: File[]) => {
        if (!user_id) {
            alert("Veuillez vous connecter pour importer des fichiers.");
            return;
        }

        setLoading(true);
        const uploadPromises = files.map(async (file) => {
            try {
                setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
                const filePath = `${file.name}_${Date.now()}_${user_id}`;

                const { data, error: uploadError } = await supabase.storage
                    .from('pdfs_bucket')
                    .upload(filePath, file, {
                        upsert: false
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
                        name_pdf: file.name,
                        name_pdf_in_bucket: filePath,
                        pdf_path: data.fullPath,
                        file_size: parseFloat(fileSizeInMB)
                    }]);

                if (insertError) {
                    return { success: false, file: file.name, error: insertError.message };
                }

                return { success: true, file: file.name };
            } catch (error) {
                return { success: false, file: file.name, error: 'Une erreur est survenue' };
            }
        });

        const results = await Promise.all(uploadPromises);

        // Afficher les résultats
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
            <div 
                className="border-[1px] border-dashed border-gray-400 p-4 rounded-md w-full text-center cursor-pointer"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
            >
                <label className="btn bg-[var(--green-medium)] hover:bg-[var(--green-dark)] text-white h-8 px-2 flex items-center mx-auto max-w-[400px]">
                    {loading ? (
                        <span className="loader"></span>
                    ) : (
                        <div className="flex items-center gap-2">
                            <box-icon color='white' name='import'></box-icon>
                            <p>Sélectionner des fichiers PDF</p>
                        </div>
                    )}
                    <input 
                        ref={fileInputRef}
                        type="file" 
                        accept="application/pdf" 
                        onChange={handleFileChange} 
                        className="hidden"
                        multiple // Permet la sélection multiple
                    />
                </label>
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

export default ImportPDF;
