import React from "react";
import Assistance from "./Assistance";

const DetailsSideBar = ({
  session,
  userNames,
  handleParameterPage,
  handleLogout
}: {
  session: boolean;
  userNames: { first_name: string; last_name: string };
  handleParameterPage: () => void;
  handleLogout: () => void;
}) => {

return (
    <div>
        {session && (
            <div className="mt-auto pt-4">
                <p className="text-sm text-gray-500 hidden">Connecté :</p>
                <p className="font-medium text-gray-700 hidden">{userNames.first_name} {userNames.last_name}</p>
            </div>
        )}
        <div className='flex flex-col gap-0 mt-1'>
            <Assistance />
            <button 
                onClick={handleParameterPage} 
                className='w-full px-1 py-1 text-sm text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-400 transition-colors duration-200 flex items-center gap-2'
            >
                <box-icon name='cog' size="sm" color="currentColor"></box-icon>
                <div className="ml-2">Paramètres</div>
            </button>
            <div className="flex justify-between items-center">

            </div>
            <button 
                className={`w-full px-1 py-1 text-sm text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-400 transition-colors duration-200 flex items-center gap-2 ${userNames.last_name==='Pouzargue' ? '' : 'hidden'}`} 
                onClick={handleLogout}
            >
                <box-icon name='log-out' size="sm" color="currentColor"></box-icon>
                <div className="ml-2">Déconnexion</div>
            </button>
        </div>
    </div>
    )
}

export default DetailsSideBar;