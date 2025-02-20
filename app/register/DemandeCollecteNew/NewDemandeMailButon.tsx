/*import { useState } from "react";
import { useModalContextNew } from "../RegisterComponents/Modal/ContextModal";
import BoxIcon from "@/app/component/BoxIconWrapper";
import NewFormulaireDemande from "./NewFormulaireDemande";

const NewDemandeMailButon = () => {
    const [displayNewDemandeMail, setDisplayNewDemandeMail] = useState(false);

    const handleClick = () => {
        setDisplayNewDemandeMail(true);
    };

    return (
        <div>
            <button
                onClick={handleClick}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
                <BoxIcon name="plus-circle" type="regular" className="w-5 h-5" />
                <span>Nouvelle demande de collecte</span>
            </button>
            {displayNewDemandeMail && <NewFormulaireDemande setDisplayThis={setDisplayNewDemandeMail}/>}
        </div>
    );
};

export default NewDemandeMailButon;
*/