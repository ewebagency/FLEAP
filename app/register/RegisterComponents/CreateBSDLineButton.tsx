import { useState } from "react";
import { useModalContextNew } from "./Modal/ContextModal";
import BoxIcon from '@/app/component/BoxIconWrapper';

const CreateBSDLine = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('success');

    const { setDisplayFormulaire, setModalType } = useModalContextNew();

    const handleOpenModal = () => {
        setDisplayFormulaire(true);
        setModalType('create_line');
    };

    return (
        <div className="relative">
            <button 
                className="h-[30px] flex justify-between items-center gap-2 bg-gray-100 rounded-md px-2 pb-1 cursor-pointer active:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={handleOpenModal}
                disabled={isLoading}
            >
                <div className="text-[var(--green-light)] rounded-full py-1 font-thin flex">
                    {isLoading ? (
                        <span className="inline-block animate-spin">↻</span>
                    ) : (
                        <BoxIcon name='add-to-queue' color='green' size="18px" className="mt-1" />
                    )}
                </div>
                <div className="text-black font-thin text-xs mt-1">
                    {isLoading ? 'Création en cours...' : 'Créer une ligne'}
                </div>
            </button>
            
            {message && (
                <div className={`absolute top-[-20px] left-0 w-full text-center text-xs ${
                    messageType === 'success' ? 'text-green-500' : 'text-red-500'
                }`}>
                    {message}
                </div>
            )}
        </div>
    );
}

export default CreateBSDLine;