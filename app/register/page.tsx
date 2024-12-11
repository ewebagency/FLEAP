"use client"
import React, { useState } from "react";
import FiltreFilieres from "../component/FiltreFilieres";
//import TableRegistre from "./TableRegistre";
import TableBSD from "./TableBSD";
import { Toaster } from "react-hot-toast";
import ExportRegisterButton from "./ExportRegisterButton";
import ImportRegisterButton from "./ImportRegisterButton";
import { ModalProviderNew } from "./RegisterComponents/Modal/ContextModal";
import ModalSource from "./RegisterComponents/Modal/ModalSource";
import { BoutonOpenModal } from "./RegisterComponents/Modal/BoutonOpenModal";
import DisplayCard from "./RegisterComponents/Modal/DisplayCard";
import ModifyCard from "./RegisterComponents/Modal/ModifyCard";
import EnrichImportedDataButton from "./EnrichImportedDataButton";
import ConnectedToTrack from "../component/ConnectedToTrack";

const RegisterPage = () => {

    return (
        <div className='m-5'>
            <ModalProviderNew>
                <Toaster position="top-right"/>
                {/*<ModalProvider>*/}
                    <div className="flex justify-between items-center">
                        <div className="text-md font-bold">Registre</div>
                        <div className="flex justify-center items-center">
                            {/*<CollecteDemande/>-----Deprecated*/}
                            <BoutonOpenModal/>
                            {/*<div className="flex justify-between items-center bg-gray-300 rounded-xl px-2 mx-1">
                                <div className="text-white bg-green-600 mr-2 my-[3px] rounded-full px-2 font-thin">+</div>
                                <div className="text-black font-thin text-xs">Ajouter une filière</div>
                            </div>*/}
                            <ExportRegisterButton/>
                            <ImportRegisterButton/>
                            <EnrichImportedDataButton/>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <FiltreFilieres/>
                        {/*<div className="flex justify-center items-center py-1 px-2 rounded-xl border-[1px] border-gray-600 bg-white text-gray-600 text-xs">
                            <div className="mr-2">🖍</div>
                            <div>Détails filières</div>
                        </div>*/}
                        <ConnectedToTrack/>
                    </div>
                    <div>
                        {/*<TableRegistre/>----Deprecated*/}
                        <TableBSD/>
                    </div>
                {/*</ModalProvider>*/}
                <ModalSource/>
                <DisplayCard/>
                <ModifyCard/>
            </ModalProviderNew>
        </div>
    )
}

export default RegisterPage
