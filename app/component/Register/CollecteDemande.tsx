import React, { useState } from 'react';
import ModalCollecteDemande from './ModalCollecteDemande';

const CollecteDemande = () => {

    const [isOpen, setIsOpen] = useState(false);
    const toggleModal = () => setIsOpen(!isOpen);
    

    return (
        <div>
            <button onClick={toggleModal} className="flex justify-between items-center bg-green-600 rounded-xl px-2 mx-1 cursor-pointer duration-300 focus:px-3 focus:py-1 active:scale-95 ">
                <div className="text-white mr-2 mb-1">🚚</div>
                <div className="text-white font-thin text-xs">Demander une collecte</div>
            </button>

            <ModalCollecteDemande isOpen={isOpen} setIsOpen={setIsOpen} onClose={toggleModal}/>

        </div>
        
    )
                    
}

export default CollecteDemande;
