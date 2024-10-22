'use client'
import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/app/database/supabaseClient'; // Import Supabase client
import { useSession } from '../SessionProvider';
import { Session } from '@supabase/supabase-js';

const YourComponent = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false); // État pour gérer le chargement
    const session = useSession() as Session | null;
    const user_id = session?.user.id;
    


    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            handleFileUpload(file); // Appeler la fonction d'upload
        } else {
            alert("Veuillez sélectionner un fichier PDF.");
        }
    };

    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();  // Stop event propagation
        const file = event.dataTransfer.files?.[0];  // Vérifie si un fichier est présent
        if (file && file.type === 'application/pdf') {
            handleFileUpload(file);  // Appeler la fonction d'upload
        } else {
            alert("Veuillez déposer un fichier PDF.");
        }
    }, []);
    

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault(); // Nécessaire pour permettre le drop
    };

    const handleFileUpload = async (file: File) => {
        if (!user_id) {
            alert("Veuillez importer le PDF plutôt que de le drag and drop."); // je ne comprends pas pourquoi mais il perd la user session quand on drag and drop
            return;
        }else{
        console.log("user_id:", user_id);  // Ajoute cette ligne pour vérifier que l'user_id est défini

        setLoading(true); // Démarrer le chargement
        const filePath = `${file.name}_${Date.now()}_${user_id}`;
        // Upload file to Supabase Storage
        const { data, error: uploadError } = await supabase.storage
            .from('pdfs_bucket') // Replace with your bucket name
            .upload(filePath, file); // Path in storage

        if (uploadError) {
            alert("Erreur lors du téléchargement du fichier: " + uploadError.message + "\nCela peut être du à la présence d'accent(s) sur le nom du fichier");
            setLoading(false); // Arrêter le chargement
            return;
        }

        console.log("Fichier PDF téléchargé:", data);

        
        // Insert file info into the 'pdf_infos' table
        const { error: insertError } = await supabase
            .from('pdf_infos') // Replace with your table name
            .insert([
                {
                    user_id: user_id,
                    name_pdf: file.name,
                    name_pdf_in_bucket: filePath,
                    pdf_path: data.fullPath, // Use the path returned from storage
                    // Add other fields as necessary
                }
            ]);

        if (insertError) {
            alert("Erreur lors de l'ajout des informations du fichier: " + insertError.message);
        } else {
            console.log("Informations du fichier ajoutées à la table 'pdf_infos'.");
        }
        

        setSelectedFile(file); // Mettre à jour l'état avec le fichier sélectionné
        setLoading(false); // Arrêter le chargement
    }
    };



    return (
        <div className="flex flex-col items-center w-full">
            <div 
                className="border-2 border-dashed border-gray-400 p-4 rounded-md w-full text-center cursor-pointer"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
                <label className="btn btn-success text-white h-8 px-2 flex items-center mx-auto max-w-[400px]">
                    {loading ? (
                        <span className="loader"></span> // Icône de chargement
                    ) : (
                        selectedFile ? selectedFile.name : "Sélectionner ou déposer un fichier PDF"
                    )}
                    <input 
                        type="file" 
                        accept="application/pdf" 
                        onChange={handleFileChange} 
                        className="hidden" // Cacher l'input
                    />
                </label>
            </div>
            {loading && <p className="text-gray-500">Chargement en cours...</p>} {/* Message de chargement */}
        </div>
    );
};

export default YourComponent;
