import React from "react";

interface Props {
    active:boolean;
}

const EnvAnalyse = ({active}:Props) => {

    return (
        <div>
            { active &&
                <div className="border-b border-r border-l border-gray-200 rounded-br rounded-bl">
                    <div className="pt-5 mb-5 ml-5 mr-5">
                        La ptite planète
                    </div>
                </div>  
            }
        </div>
    )

}

export default EnvAnalyse