import React from "react";
import AnalOpBordereau from "./AnalOpBordereau";
import AnalOpMainChart from "./AnalOpMainChart";
import AnalOpTable from "./AnalOpTable";
import AnalOpPieChart from "./AnalOpPieChart";
import RepComponent from "../Financiere/New/RepComponent";
import { cofounders_user_id } from "../../SideBar";
import { useSession } from "../../SessionProvider";
import ExportAnalysisButton from "./ExportAnalysisButton";

const OperationalAnalyse = ({active}: {active: boolean}) => {
    const {user_id} = useSession()

    return (
        <div>
            { active &&
                <div className="rounded-br rounded-bl">
                    <div className="pt-5 mb-5 ml-5 mr-5">
                        <AnalOpBordereau/>

                        {(cofounders_user_id(user_id) && false) ?
                        <div className="flex justify-between gap-2 my-4">
                            <div className="w-[80%]">
                                <AnalOpMainChart/>
                            </div>
                            <div className="w-[20%]">
                                <RepComponent factures={[]} financier_or_tonnage="tonnage"/>
                            </div>
                        </div>
                        :
                        <div className="flex justify-between gap-2 my-4">
                            <div className="w-[100%]">
                                <AnalOpMainChart/>
                            </div>
                        </div>
                        }


                        <div className="flex justify-between gap-2 my-4">
                            <div className="w-[60%]">
                                <AnalOpTable/>
                            </div>
                            <div className="w-[40%]">
                                <AnalOpPieChart/>
                            </div>
                        </div>

                    {/* Bouton d'export Excel pour les cofounders */}
                    {cofounders_user_id(user_id) && (
                        <div className="mt-4">
                            <ExportAnalysisButton />
                        </div>
                    )}
            
                        
                    </div>
                </div>  
            }
        </div>
    )

}

export default OperationalAnalyse
