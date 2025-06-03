import React from "react";
import AnalOpBordereau from "./AnalOpBordereau";
import AnalOpMainChart from "./AnalOpMainChart";
import AnalOpTable from "./AnalOpTable";
import AnalOpPieChart from "./AnalOpPieChart";
import RepComponent from "../Financiere/New/RepComponent";

const OperationalAnalyse = ({active}: {active: boolean}) => {

    return (
        <div>
            { active &&
                <div className="rounded-br rounded-bl">
                    <div className="pt-5 mb-5 ml-5 mr-5">
                        <AnalOpBordereau/>
                        <div className="flex justify-between gap-2 my-4">
                            <div className="w-[80%]">
                                <AnalOpMainChart/>
                            </div>
                            <div className="w-[20%]">
                                <RepComponent factures={[]} financier_or_tonnage="tonnage"/>
                            </div>
                        </div>
                        <div className="flex justify-between gap-2 my-4">
                            <div className="w-[60%]">
                                <AnalOpTable/>
                            </div>
                            <div className="w-[40%]">
                                <AnalOpPieChart/>
                            </div>
                        </div>
                        
                    </div>
                </div>  
            }
        </div>
    )

}

export default OperationalAnalyse
