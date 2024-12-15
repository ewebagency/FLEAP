"use client"
import React from "react";
import FiltreFilieres from "../component/FiltreFilieres";
import TableBSD from "./TableBSD";
import { Toaster } from "react-hot-toast";
import ImportRegisterButton from "./ImportRegisterButton";
import ModalSource from "./RegisterComponents/Modal/ModalSource";
import { BoutonOpenModal } from "./RegisterComponents/Modal/BoutonOpenModal";
import DisplayCard from "./RegisterComponents/Modal/DisplayCard";
import ModifyCard from "./RegisterComponents/Modal/ModifyCard";
import EnrichImportedDataButton from "./EnrichImportedDataButton";
import ConnectedToTrack from "../component/ConnectedToTrack";

const RegisterPage = () => {
    return (
        <div className='m-5'>
            <Toaster position="top-right"/>
            <div className="flex justify-between items-center">
                <div className="text-md font-bold">Registre</div>
                <div className="flex justify-center items-center">
                    <BoutonOpenModal/>
                    <ImportRegisterButton/>
                    <EnrichImportedDataButton/>
                </div>
            </div>
            <div className="flex justify-between items-center">
                <FiltreFilieres/>
                <ConnectedToTrack/>
            </div>
            <div>
                <TableBSD/>
            </div>
            <ModalSource/>
            <DisplayCard/>
            <ModifyCard/>
        </div>
    )
}

export default RegisterPage
