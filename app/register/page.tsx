"use client"
import React, { useState } from "react";
import FiltreFilieres from "../component/FiltreFilieres";
import CollecteDemande from "../component/Register/CollecteDemande";
//import TableRegistre from "./TableRegistre";
import TableBSD from "./TableBSD";
import { ModalProvider } from "../component/context/ModalReloadcontext";
import ExportRegisterButton from "./ExportRegisterButton";

const RegisterPage = () => {

    const [selectedMaterials, setSelectedMaterials] = useState([
        { id: 1, checked: false, color:'bg-blue-300', label: 'DIB'},
        { id: 2, checked: false, color:'bg-blue-400', label: 'Dangereux'},
        { id: 3, checked: false, color:'bg-blue-500', label: 'Verre'},
        { id: 4, checked: true, color:'bg-green-300', label: 'Carton & Papier',},
        { id: 5, checked: false, color:'bg-green-500', label: 'Plastiques'},
        { id: 6, checked: false, color:'bg-purple-300', label: 'DEE'},
        { id: 7, checked: false, color:'bg-purple-500', label: 'Matériaux'},
        { id: 8, checked: false, color:'bg-purple-700', label: 'Bois'},
      ]);
    
    
      // Fonction pour gérer les changements de checkbox
      const handleMaterialsChange = (id:number) => {
        // Mettre à jour l'état en fonction de la checkbox sélectionnée
        setSelectedMaterials((prevMaterials) =>
          prevMaterials.map((checkbox) =>
            checkbox.id === id
              ? { ...checkbox, checked: !checkbox.checked } // Inverser l'état
              : checkbox
          )
        );
      };

    return (
        <div className='m-5'>
                <ModalProvider>
                <div className="flex justify-between items-center">
                    <div className="text-md font-bold">Registre</div>
                    <div className="flex justify-center items-center">
                        <CollecteDemande/>
                        <div className="flex justify-between items-center bg-gray-300 rounded-xl px-2 mx-1">
                            <div className="text-white bg-green-600 mr-2 my-[3px] rounded-full px-2 font-thin">+</div>
                            <div className="text-black font-thin text-xs">Ajouter une filière</div>
                        </div>
                        <ExportRegisterButton/>
                    </div>
                </div>
                <div className="flex justify-between items-center">
                    <FiltreFilieres 
                        selectedMaterials={selectedMaterials} 
                        onMaterialsChange={handleMaterialsChange} 
                    />
                    <div className="flex justify-center items-center py-1 px-2 rounded-xl border-[1px] border-gray-600 bg-white text-gray-600 text-xs">
                        <div className="mr-2">🖍</div>
                        <div>Détails filières</div>
                    </div>
                </div>
                <div>
                    {/*<TableRegistre/>*/}
                    <TableBSD/>
                </div>
            </ModalProvider>
        </div>
    )
}

export default RegisterPage
