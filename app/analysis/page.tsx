"use client"
import React, { useState, createContext, useEffect } from "react";
import TabBarAnalyses from "../component/Analyse/TabBarAnalyses";
import FiltreFilieres from "../component/FiltreFilieres";
import { useSession } from "../component/SessionProvider";

// Créer le contexte
interface MaterialType {
    valueChain: string;
    selectedMaterials: { id: number; checked: boolean; color: string; label: string; }[];
}

export const AnalysisContext = createContext<MaterialType>({ valueChain: '', selectedMaterials: [] });

const AnalysisPage = () => {
    const [selectedValueChain, setSelectedValueChain] = useState('Filières');

    const handleRadioValueChainChange = (event :React.ChangeEvent<HTMLInputElement>) => {
      setSelectedValueChain(event.target.value); // Mise à jour du state avec la valeur sélectionnée
    };


    /*//Exemple pour utiliser une API Next
    const [token, setToken] = useState(null);
    useEffect(() => {
      // Appel à l'API pour récupérer la donnée des cookies
      fetch('/api/auth/token')
        .then((response) => response.json())
        .then((result) => setToken(result.data.value))
        .catch((error) => console.error('Error:', error));
    }, []);
    console.log("Token : ", token);*/

    const [selectedMaterials, setSelectedMaterials] = useState([
        { id: 1, checked: false, color:'bg-blue-300', label: 'DIB'},
        { id: 2, checked: false, color:'bg-blue-400', label: 'Dangereux'},
        { id: 3, checked: false, color:'bg-blue-500', label: 'Verre'},
        { id: 4, checked: true, color:'bg-green-300', label: 'Carton & Papier',},
        { id: 5, checked: false, color:'bg-green-500', label: 'Plastiques'},
        { id: 6, checked: false, color:'bg-purple-300', label: 'DEE'},
        { id: 7, checked: false, color:'bg-purple-500', label: 'Matériaux'},
        { id: 8, checked: false, color:'bg-purple-700', label: 'Bois'},
      ]);
    
      // Fonction pour gérer les changements de checkbox
      const handleMaterialsChange = (id:number) => {
        // Mettre à jour l'état en fonction de la checkbox sélectionnée
        setSelectedMaterials((prevMaterials) =>
          prevMaterials.map((checkbox) =>
            checkbox.id === id
              ? { ...checkbox, checked: !checkbox.checked } // Inverser l'état
              : checkbox
          )
        );
      };


      const [serverData, setServerData] = useState<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
      const [loading, setLoading] = useState(true);
      //const [error, setError] = useState(null);
  
      useEffect(() => {
          const fetchData = async () => {
              try {
                  const response = await fetch('http://localhost:3000/api/analysis');
                  if (!response.ok) {
                      throw new Error('Erreur lors de la récupération des données');
                  }
                  const data_all = await response.json();
                  setServerData(data_all); // Assurez-vous que data_all a la structure attendue
              } catch (err) {
                  //console.log(err.message);
              } finally {
                  setLoading(false);
              }
          };
          fetchData();
      }, []);



      //Authentification
      const session = useSession();
    

    if (!session) return <p>Chargement de vos id de connexion...</p>;
    return (
        <AnalysisContext.Provider value={{ valueChain: selectedValueChain, selectedMaterials: selectedMaterials, serverData: serverData }}>
            <div className='m-5'>
                <div className="flex justify-between items-center">
                    <div className="text-xl">Analyse</div>
                    <div className="join">
                        <input className="join-item btn btn-xs text-xs font-normal" type="radio" name="options_value_chaine" aria-label="Filières" value="Filières" checked={selectedValueChain == 'Filières'} onChange={handleRadioValueChainChange}/>
                        <input className="join-item btn btn-xs text-xs font-normal" type="radio" name="options_value_chaine" aria-label="Prestataires" value="Prestataires" checked={selectedValueChain=='Prestataires'} onChange={handleRadioValueChainChange} />
                    </div>
                </div>
                <div className="text-xl">My value chain is {selectedValueChain}</div>

                <FiltreFilieres selectedMaterials={selectedMaterials} onMaterialsChange={handleMaterialsChange} />
                {loading && <div>Loading</div>}
                <TabBarAnalyses/>
            </div>
        </AnalysisContext.Provider>
    )
}

export default AnalysisPage
