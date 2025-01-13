import React, { Suspense } from "react";
import ImportPDF from "./ImportComponents/ImportPDF";
import BandeauAPI from "./BandeauAPI";
import TableImportedFilesFunctional from "./ImportComponents/TableImportedFilesFunctional";
import { ImportProvider } from "./ImportComponents/ImportContext";
import ButtonImportFacture from "./FactureImport/ButtonImportFacture";

const ImportPage = () => {

    return (
        <ImportProvider>
            <div className='m-5'>
                <Suspense fallback={<div>Chargement...</div>}>
                    <BandeauAPI/>
                </Suspense>

                <div className="h3 mb-0">Importez vos bordereaux de suivi et vos factures</div>
                <div className="text-xs text-gray-400 mb-4">Automatisez la saisi des informations de vos documents PDF à votre registre des déchets grâce à notre foncitonnalité de lecture par intelligence artificielle</div>
                <ButtonImportFacture/>
                
                <ImportPDF/>

                
                <div className="text-sm text-gray-500 mt-4 font-medium">Documents importés</div>
                

                <div>
                    <TableImportedFilesFunctional/>  
                </div>

            </div>
        </ImportProvider>
    )
}

export default ImportPage