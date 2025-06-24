'use client';

import { useState } from 'react';
import ModalExtractFacture from './ModalExtractFacture';

const ButtonExtractFacture = ({ pdf_id, pdf_path }: { pdf_id: number; pdf_path: string }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleOpenModal = () => {
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    return (
        <>
            <button
                onClick={handleOpenModal}
                className="bg-blue-800 text-xs text-white px-4 py-2 rounded-lg hover:bg-blue-900 transition-colors"
            >
                Extraire Facture
            </button>

            {isModalOpen && (
                <ModalExtractFacture
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    pdf_id={pdf_id}
                    pdf_path={pdf_path}
                />
            )}
        </>
    );
};

export default ButtonExtractFacture;
