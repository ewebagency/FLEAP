import { useState } from "react";
import { useSite } from "./context/SiteContext";

const FiltreSite = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { sites, selectedSites, toggleSite, isLoading } = useSite();

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    if (isLoading) {
        return <div>Chargement...</div>;
    }

    return (
        <div className="m-4 relative">
            <div className="btn flex justify-between mb-1" onClick={toggleDropdown}>
                <h1 className="text-lg font-semibold">Sites</h1>
                <button className="text-lg">{isOpen ? '▲' : '▼'}</button>
            </div>
            {isOpen && (
                <div className="absolute top-full left-0 z-10 mt-1 border border-gray-300 rounded-md p-4 bg-white shadow-md">
                    {sites.map((site) => (
                        <label key={site} className="flex items-center mb-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedSites.includes(site)}
                                onChange={() => toggleSite(site)}
                                className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="ml-2 text-gray-700">{site}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}

export default FiltreSite;