import React from "react";

const AnalOpBordereau = () => {
    return (
        <div className="flex justify-between bg-gray-200 p-3 rounded-lg">
            <div className="block ml-4">
                <div className="text-sm text-gray-600 font-thin">Tonnage total</div>
                <div className="flex items-center mt-2" >
                    <div className="font-bold text-xl ml-4">408 T</div>
                    <div className="badge bg-green-300 ml-8 text-xs">- 1%</div>
                </div>
            </div>
            <div className="block mr-10 text-center">
                <div className="text-sm text-gray-600 font-thin">Déclassement</div>
                <div className="font-bold text-xl text-orange-300 mt-2">1</div>
            </div>

            
        </div>
    )
}
export default AnalOpBordereau