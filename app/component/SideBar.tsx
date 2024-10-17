import React from 'react';

interface SideBarProps {
    className_props : string;
}

const SideBar = (props:SideBarProps) => {
    return (
        <div className={`menu h-screen bg-base-200 w-60 p-4 space-y-2 ${props.className_props}`}>
            <h1 className="font-bold text-xl mb-4">Menu</h1>
            <ul>
                <li><a href="/analysis" className="menu-item">Analyses</a></li>
                <li><a href="/register" className="menu-item">Registre</a></li>
                <li><a href="/import_page" className="menu-item">Importer</a></li>
                <li><a href="/interface_admin" className="menu-item">Vérification de factures</a></li>
            </ul>
        </div>
    )
}

export default SideBar