import { useModalContextNew } from "./ContextModal";


export const BoutonOpenModal = () => {
    const { setDisplayFormulaire } = useModalContextNew();
    const handleOpenModal = () => setDisplayFormulaire(true);
    return (
        <div>
            <button 
                onClick={handleOpenModal} 
                className={`flex justify-between items-center 
                    bg-green-600 active:scale-95 
                    rounded-xl px-2 mx-1 cursor-pointer duration-300 
                    focus:px-3 focus:py-1`}
            >
                <div className="text-white mr-2 mb-1">🚚</div>
                <div className="text-white font-thin text-xs">Demander une collecte</div>
            </button>
        </div>
    );
}