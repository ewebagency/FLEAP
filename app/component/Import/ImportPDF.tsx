'use client'
import React, { useState, useCallback } from 'react';

const YourComponent = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            setSelectedFile(file);
            console.log("Fichier PDF sélectionné:", file);
        } else {
            alert("Veuillez sélectionner un fichier PDF.");
        }
    };

    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            setSelectedFile(file);
            console.log("Fichier PDF déposé:", file);
        } else {
            alert("Veuillez déposer un fichier PDF.");
        }
    }, []);

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault(); // Nécessaire pour permettre le drop
    };

    return (
        <div className="flex flex-col items-center w-full">
            <div 
                className="border-2 border-dashed border-gray-400 p-4 rounded-md w-full text-center cursor-pointer"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
                <label className="btn btn-success text-white h-8 px-2 flex items-center mx-auto max-w-[400px]">
                    {selectedFile ? selectedFile.name : "Sélectionner ou déposer un fichier PDF"}
                    <input 
                        type="file" 
                        accept="application/pdf" 
                        onChange={handleFileChange} 
                        className="hidden" // Masque l'input
                    />
                </label>
            </div>
        </div>
    );
};

export default YourComponent;