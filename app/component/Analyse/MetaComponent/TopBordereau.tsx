import React from "react";

interface BordereauProps {
    titre_g1? : string; // Le ? pour dire que c'est optionnel
    titre_g2? : string;
    titre_d1? : string;
    titre_d2? : string;

    chiffre_g1? : number;
    chiffre_g2? : number;
    chiffre_d1? : number;
    chiffre_d2? : number;

    unite_g1? : string;
    unite_g2? : string;
    unite_d1? : string;
    unite_d2? : string;
}

const TopBordereau = (props:BordereauProps) => {
    return (
        <div className="flex justify-between bg-gray-200 p-3 rounded-lg">
            <div className="block ml-4">
                <div className="text-sm text-gray-600 font-thin">{props.titre_g1}</div>
                <div className="flex items-center mt-2" >
                    {props.chiffre_g1 && <div className="font-bold text-xl ml-4">{props.chiffre_g1.toLocaleString('fr-FR')} {props.unite_g1}</div>}
                    { props.chiffre_g2 && <div className="badge bg-green-300 ml-8 text-xs">{props.chiffre_g2} {props.unite_g2}</div>}
                </div>
            </div>
            <div className="flex">
                <div className="block mr-10 text-center">
                    <div className="text-sm text-gray-600 font-thin">{props.titre_d1}</div>
                    { props.chiffre_d1 && <div className="font-bold text-xl text-orange-300 mt-2">{props.chiffre_d1.toLocaleString('fr-FR')} {props.unite_d1}</div>}
                </div>
                <div className="block mr-10 text-center">
                    <div className="text-sm text-gray-600 font-thin">{props.titre_d2}</div>
                    { props.chiffre_d2 && <div className="font-bold text-xl text-orange-300 mt-2">{props.chiffre_d2.toLocaleString('fr-FR')} {props.unite_d2}</div>}
                </div>
            </div>

            
        </div>
    )
}

export default TopBordereau