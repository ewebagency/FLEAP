import React from "react";
import EnvBarChart from "./EnvBarChart";
import EnvBordereau from "./EnvBordereau";
import ButtonNewRapportAMO from "../../newRapportAMO/ButtonNewRapportAMO";
import { cofounders_user_id } from "../../SideBar";
import { useSession } from "../../SessionProvider";

interface Props {
    active: boolean;
}

const EnvAnalyse = ({active}: Props) => {
    const {user_id} = useSession();
    return (
        <div>
            { active &&
                <div className="rounded-br rounded-bl">
                    <div className="p-5">
                        
                        <div className="space-y-6">
                            <EnvBordereau />
                            <EnvBarChart />
                            {cofounders_user_id(user_id) && (
                                <ButtonNewRapportAMO/> //les graphes modulaire
                            )}
                        </div>
                    </div>
                </div>  
            }
        </div>
    )
}

export default EnvAnalyse;