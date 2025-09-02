'use client';

import React, { useState } from 'react';
import BoxIcon from '@/app/component/BoxIconWrapper';
import LoopStarter from './LoopStarter';

interface LoopStarterButtonProps {
    className?: string;
    children?: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'outline';
    size?: 'sm' | 'md' | 'lg';
}

const LoopStarterButton: React.FC<LoopStarterButtonProps> = ({ 
    className = '', 
    children,
    variant = 'primary',
    size = 'md'
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const baseClasses = "inline-flex items-center justify-center font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";
    
    const variantClasses = {
        primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
        secondary: "bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500",
        outline: "border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-blue-500"
    };

    const sizeClasses = {
        sm: "px-3 py-1.5 text-sm",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-base"
    };

    const buttonClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className={buttonClasses}
            >
                <BoxIcon name="bx-play-circle" className="mr-2" />
                {children || 'Extraction en boucle'}
            </button>

            <LoopStarter 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
            />
        </>
    );
};

export default LoopStarterButton;
