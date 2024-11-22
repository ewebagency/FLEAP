import React, { useState } from 'react';
import ModalCollecteDemande from './ModalCollecteDemande';

const CollecteDemande = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [ready, setReady] = useState(false);
    const toggleModal = () => setIsOpen(!isOpen);

    return (
        <div>
            <button 
                onClick={toggleModal} 
                disabled={!ready}
                className={`flex justify-between items-center 
                    ${ready ? 'bg-green-600 active:scale-95' : 'bg-gray-400'} 
                    rounded-xl px-2 mx-1 cursor-pointer duration-300 
                    focus:px-3 focus:py-1`}
            >
                <div className="text-white mr-2 mb-1">🚚</div>
                <div className="text-white font-thin text-xs">Demander une collecte</div>
            </button>

            <ModalCollecteDemande 
                isOpen={isOpen} 
                setIsOpen={setIsOpen} 
                onClose={toggleModal}
                ready={ready}
                setReady={setReady}
            />
        </div>
    )
}

export default CollecteDemande;
