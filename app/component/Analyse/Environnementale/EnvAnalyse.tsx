import React from "react";
import EnvBarChart from "./EnvBarChart";
import EnvBordereau from "./EnvBordereau";

interface Props {
    active: boolean;
}

const EnvAnalyse = ({active}: Props) => {
    return (
        <div>
            { active &&
                <div className="border-b border-r border-l border-gray-200 rounded-br rounded-bl">
                    <div className="pt-5 mb-5 ml-5 mr-5">
                        <h2 className="text-xl font-semibold mb-4">Analyse Environnementale</h2>
                        <EnvBordereau />
                        <EnvBarChart />
                    </div>
                </div>  
            }
        </div>
    )
}

export default EnvAnalyse;