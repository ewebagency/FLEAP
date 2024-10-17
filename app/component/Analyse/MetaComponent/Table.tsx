import React from "react";


const Table = () => {

    const colonnes = [
        {titre: 'Type de déchets', unite: ''}, 
        {titre:'EUR (HT) /tonne', unite: '€'},
        {titre: 'Contenants total HT', unite: '€'}, 
        {titre: 'Total HT', unite : '€'}
        ];
    const data = [
        { type: 'DIB', collecte: 15, remplissage: '80%', declassement: 5 },
        { type: 'Dangereux', collecte: 10, remplissage: '75%', declassement: 3 },
        { type: 'Verre', collecte: 20, remplissage: '85%', declassement: 2 },
        { type: 'Carton & Papier', collecte: 25, remplissage: '90%', declassement: 4 },
        { type: 'Plastiques', collecte: 18, remplissage: '60%', declassement: 6 },
      ];
      //Voir après comment mettre bien les unités
    
    return (
        <div className="text-center">
            <div className="text-gray-300 text-sm">Nombre de collecte de filière par mois</div>
                <table className="border-collapse border border-gray-300 text-xs w-32">
                    <thead>
                    <tr>
                        {colonnes.map((row, index) => (
                            <th key={index} className="border border-gray-300 px-2 py-1">{row.titre}</th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {data.map((row, index) => (
                        <tr key={index} className="odd:bg-gray-100 even:bg-white">
                        <td className="border border-gray-300 px-2 py-1">{row.type}</td>
                        <td className="border border-gray-300 px-2 py-1">{row.collecte}</td>
                        <td className="border border-gray-300 px-2 py-1">{row.remplissage}</td>
                        <td className="border border-gray-300 px-2 py-1">{row.declassement}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
    )
}

export default Table