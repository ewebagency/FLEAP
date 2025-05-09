'use client'
import React, { Suspense } from "react";
import ImportPDF from "./ImportComponents/ImportPDF";
import BandeauAPI from "./BandeauAPI";
import TableImportedFilesFunctional from "./ImportComponents/TableImportedFilesFunctional";
import { ImportProvider } from "./ImportComponents/ImportContext";
import ButtonImportFacture from "./FactureImport/ButtonImportFacture";
import ImportsFiltre from "./ImportComponents/ImportsFiltre";
import DownloadFactureForMe from "./FactureImport/DownloadFactureForMe";
import { cofounders_user_id } from "../component/SideBar";
import { useSession } from "@/app/component/SessionProvider";

const ImportPage = () => {
    const {user_id} = useSession();
    return (
        <ImportProvider>
            <div className='m-5'>
                <Suspense fallback={<div>Chargement...</div>}>
                    <BandeauAPI/>
                </Suspense>

                <div className="h3 mb-0">Importez vos bordereaux de suivi et vos factures</div>
                <div className="text-xs text-gray-400 mb-4">Automatisez la saisie des informations de vos documents PDF à votre registre des déchets grâce à notre fonctionnalité de lecture par intelligence artificielle</div>
                <ButtonImportFacture/>
                {cofounders_user_id(user_id) && <DownloadFactureForMe/>}
                <ImportPDF/>

                <div className="flex flex-row justify-start items-end gap-4 my-3">
                    <div className="text-sm text-gray-500 font-medium">Documents importés</div>
                    <ImportsFiltre />
                </div>

                <div>
                    <TableImportedFilesFunctional/>  
                </div>

            </div>
        </ImportProvider>
    )
}

export default ImportPage