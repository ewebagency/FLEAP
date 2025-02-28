import { useModalContextNew } from "./ContextModal";
import BoxIcon from '@/app/component/BoxIconWrapper';
//import 'boxicons';

export const BoutonOpenModal = () => {
    const { setDisplayFormulaire, setModalType } = useModalContextNew();
    const handleOpenModal = () => {
        setDisplayFormulaire(true);
        setModalType('');
    };
    return (
        <div>
            <div className="flex items-center space-x-4">
                <button 
                    onClick={handleOpenModal} 
                    className="border-[2px] border-solid border-green hover:border-green text-black hover:text-gray-600 py-1 px-2 ml-2 rounded-lg flex items-center space-x-2 text-lg font-medium transition-colors duration-200"
                >
                <BoxIcon name='trash' type='solid' color='green' size="28px" />
                <div className="flex flex-col items-start">
                    <span className="text-sm">Collecte</span>
                    <span className="text-xs">TrackDéchets</span>
                </div>
                </button>
            </div>
        </div>
    );
}