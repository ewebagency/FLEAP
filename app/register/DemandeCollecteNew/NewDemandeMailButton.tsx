import { useState } from "react";
import { useModalContextNew } from "../RegisterComponents/Modal/ContextModal";
import BoxIcon from "@/app/component/BoxIconWrapper";
import NewFormulaireDemande from "./NewFormulaireDemande";

const NewDemandeMailButon = () => {
    const [displayNewDemandeMail, setDisplayNewDemandeMail] = useState(false);

    const handleClick = () => {
        setDisplayNewDemandeMail(true);
    };

    return (
        <>
        {/* Version Desktop */}
        <div className="hidden md:block">
            <button
                onClick={handleClick}
                className="bg-[var(--green-medium)] hover:bg-[var(--green-dark)] text-white px-4 py-2 ml-2 rounded-lg flex items-center space-x-2 text-lg font-medium transition-colors duration-200"
                >
                <BoxIcon name='truck' type='solid' color='white' size="24px" />
                <span>Demander des collectes</span>
            </button>
            {displayNewDemandeMail && <NewFormulaireDemande setDisplayThis={setDisplayNewDemandeMail}/>}
        </div>
        {/* Version Mobile */}
        <div className="block md:hidden">
            <button
                onClick={handleClick}
                className="bg-[var(--green-medium)] hover:bg-[var(--green-dark)] text-white px-4 py-2 ml-2 rounded-lg flex items-center space-x-2 text-lg font-medium transition-colors duration-200"
                >
                <BoxIcon name='truck' type='solid' color='white' size="24px" />
                <span>Faire une demande</span>
            </button>
            {displayNewDemandeMail && <NewFormulaireDemande setDisplayThis={setDisplayNewDemandeMail}/>}
        </div>
        </>
    );
};

export default NewDemandeMailButon;
