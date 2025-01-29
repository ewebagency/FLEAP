"use client"
export const dynamic = 'force-dynamic';
import React from "react";
import FiltreFilieres from "../component/FiltreFilieres";
import TableBSD from "./TableBSD";
import { Toaster } from "react-hot-toast";
import ImportRegisterButton from "./ImportRegisterButton";
import ModalSource from "./RegisterComponents/Modal/FormulaireFull/ModalSource";
import DisplayCard from "./RegisterComponents/Modal/DisplayModifyOnTable/DisplayCard";
import ModifyCard from "./RegisterComponents/Modal/DisplayModifyOnTable/ModifyCard";
import EnrichImportedDataButton from "./EnrichImportedDataButton";
import ConnectedToTrack from "../component/ConnectedToTrack";
import ExportRegisterButton from "./ExportRegisterButton";
import BordereauxRegister from "./RegisterComponents/BordereauxRegister";
import CreateBSDLine from "./RegisterComponents/CreateBSDLineButton";
import FiltreSiteEtablissement from "../import_page/FiltreSiteEtablissement";

const RegisterPage = () => {
    return (
        <div className='m-4'>
            <Toaster position="top-right"/>
            <div className="mb-0">
                <div className="text-xl font-bold mb-2 hidden">Registre</div>
                <div className="hidden md:flex justify-between items-center mb-0">
                    <FiltreFilieres/>
                    <ConnectedToTrack/>
                </div>
                <div className="md:hidden mb-2">
                    <FiltreSiteEtablissement />
                </div>
                <BordereauxRegister />
                <div className="hidden md:flex justify-between items-center mb-0">
                    <h3 className="text-md text-gray-500 mb-0">Registre des déchets</h3>
                    <div className="flex gap-2 mr-[-8px] justify-end">
                        <CreateBSDLine/>
                        <ImportRegisterButton/>
                        <ExportRegisterButton/>
                        <EnrichImportedDataButton/>
                    </div>
                </div>
                <div className="flex md:hidden justify-end items-center mb-0">
                    <CreateBSDLine/>
                </div>
            </div>
            <div className="mt-2">
                <TableBSD/>
            </div>
            <ModalSource/>
            <DisplayCard/>
            <ModifyCard/>
        </div>
    )
}

export default RegisterPage
