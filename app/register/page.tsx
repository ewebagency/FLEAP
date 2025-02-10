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
import { useRouter } from 'next/navigation';
import { supabase } from '../database/supabaseClient';
import BoxIcon from '../component/BoxIconWrapper';

const RegisterPage = () => {
    const router = useRouter();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/auth/signin');
    };

    return (
        <div className='m-4'>
            <Toaster position="top-right"/>
            <div className="mb-0">
                <div className="text-xl font-bold mb-2 hidden">Registre</div>
                <div className="hidden md:flex justify-between items-center mb-0">
                    <FiltreFilieres/>
                    <ConnectedToTrack/>
                </div>
                <div className="md:hidden flex items-center gap-2 mb-2">
                    <div className="flex-[5]">
                        <FiltreSiteEtablissement />
                    </div>
                    <button 
                        onClick={handleLogout}
                        className="flex-1 px-1 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-all duration-200"
                    >
                        <BoxIcon name='log-out' size="24px" color="#666666" />
                    </button>
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
