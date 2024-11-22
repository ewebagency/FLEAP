import React from "react";
import ImportPDF from "./ImportComponents/ImportPDF";
import BandeauAPI from "./BandeauAPI";
import TableImportedFilesFunctional from "./ImportComponents/TableImportedFilesFunctional";
import { ImportProvider } from "./ImportComponents/ImportContext";

const ImportPage = () => {

    return (
        <ImportProvider>
            <div className='m-5'>
                <div className="text-xl font-bold">Importer</div>
                
                <div className="h3 my-2">Importez vos bordereaux de suivi et vos factures</div>
                <div className="text-xs text-gray-400 my-2">Automatisez la saisi des informations de vos documents PDF à votre registre des déchets grâce à notre foncitonnalité de lecture par intelligence artificielle</div>
                
                <BandeauAPI/>

                <ImportPDF/>

                <div className="flex justify-between items-center mt-5">
                    <div className="text-md font-bold">Documents importés</div>
                    <div className="flex px-2 bg-green-700 items-center justify-center h-6 rounded-md">
                        <div className="text-white text-[14px]">Exporter</div>
                    </div>
                </div>

                <div>
                    <TableImportedFilesFunctional/>  
                </div>

            </div>
        </ImportProvider>
    )
}

export default ImportPage