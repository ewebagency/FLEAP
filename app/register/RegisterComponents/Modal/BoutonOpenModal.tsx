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
                    className="bg-[var(--green-medium)] hover:bg-[var(--green-dark)] text-white px-4 py-2 ml-2 rounded-lg flex items-center space-x-2 text-lg font-medium transition-colors duration-200"
                >
                <BoxIcon name='truck' type='solid' color='white' size="24px" />
                <span>Demander une collecte</span>
                </button>
            </div>
        </div>
    );
}