import React from "react";

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
            <div className="mt-auto pt-4 border-t border-base-300">
                <p className="text-sm text-base-content/70">Connecté en tant que :</p>
                <p className="font-semibold">{userNames.first_name} {userNames.last_name}</p>
            </div>
        )}
        <div className='flex items-center justify-between'>
            <button className="mt-2 p-1 text-white bg-red-300 rounded-lg duration-300 active:scale-90" onClick={handleLogout}>Déconnexion</button>
            <button onClick={handleParameterPage} className='mt-2 mr-4 text-4xl font-bold text-gray-400'>⚙</button>
        </div>
    </div>
    )
}

export default DetailsSideBar;