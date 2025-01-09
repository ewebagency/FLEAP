import React from "react";
import AnalOpBordereau from "./AnalOpBordereau";
import AnalOpMainChart from "./AnalOpMainChart";
import AnalOpTable from "./AnalOpTable";
import AnalOpPieChart from "./AnalOpPieChart";

const OperationalAnalyse = ({active}: {active: boolean}) => {

    return (
        <div>
            { active &&
                <div className="border-b border-r border-l border-gray-200 rounded-br rounded-bl">
                    <div className="pt-5 mb-5 ml-5 mr-5">
                        <AnalOpBordereau/>
                        <AnalOpMainChart/>

                        <div className="flex justify-between gap-5 my-4">
                            <AnalOpTable/>
                            <AnalOpPieChart/>
                        </div>
                        
                    </div>
                </div>  
            }
        </div>
    )

}

export default OperationalAnalyse
