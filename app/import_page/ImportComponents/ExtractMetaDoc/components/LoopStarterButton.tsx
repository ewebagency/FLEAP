'use client';

import React, { useState } from 'react';
import BoxIcon from '@/app/component/BoxIconWrapper';
import LoopStarter from './LoopStarter';

interface LoopStarterButtonProps {
    className?: string;
    label?: string;
}

const LoopStarterButton: React.FC<LoopStarterButtonProps> = ({ 
    className = '', 
    label = 'Lancer le traitement'
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const buttonClasses = `
        inline-flex items-center justify-between gap-4 w-full
        px-3 py-3 text-base font-semibold text-white
        rounded-lg shadow-sm transition-all duration-200
        bg-gradient-to-r from-blue-600 to-indigo-600
        hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99]
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
        ${className}
    `;

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className={buttonClasses}
            >
                <BoxIcon size="22px" name="bolt" color="white" type="solid"/>
                {label}
            </button>

            <LoopStarter 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
            />
        </>
    );
};

export default LoopStarterButton;
