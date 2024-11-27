"use client"
import React, { useState, useEffect } from "react";
import TabBarAnalyses from "../component/Analyse/TabBarAnalyses";
import FiltreFilieres from "../component/FiltreFilieres";
import { useSession } from "../component/SessionProvider";
import { supabase } from "../database/supabaseClient";
import { useFilterContext } from "../FilterContext";

//Juste to remove the vercel toolbar do a git push
// Créer le contexte
interface MaterialType {
    valueChain: string;
    selectedMaterials: { id: number; checked: boolean; color: string; label: string; }[];
    serverData : { labels: string[]; datasets: DatasetInterface[] }
}
interface DatasetInterface {
    id: number;
    label: string;
    data: number[];  // Tableau de données numériques
    backgroundColor: string;
    borderColor: string;
    fill: boolean;
    remplissage: number[];  // Tableau de pourcentages ou de valeurs numériques
    declassement: number;   // Valeur numérique
  }

const AnalysisPage = () => {
    
    const { filieres_ou_prestataires, setFilieresOuPrestataires } = useFilterContext();
    const session = useSession();

    const handleRadioValueChainChange = (event :React.ChangeEvent<HTMLInputElement>) => {
      setFilieresOuPrestataires({ nom: event.target.value as 'filiere' | 'prestataire' }); // Mise à jour du state avec la valeur sélectionnée
      console.log('laaaaa',filieres_ou_prestataires);
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

      const getFilieres = async (user_id:string) => {
        const { data, error } = await supabase
        .from('bsd')
        .select('infos_json')
        .eq('user_id', user_id);
        if(error) console.error("Error fetching filieres:", error);
        const filieres = data?.map((bsd) => bsd.infos_json.dataSupplementaire?.filiere);
        const filieres_unique = Array.from(new Set(filieres));
        const colors = ['bg-blue-300', 'bg-blue-400', 'bg-blue-500', 'bg-green-300', 'bg-green-500', 'bg-purple-300', 'bg-purple-500', 'bg-purple-700', 'bg-orange-300', 'bg-orange-500', 'bg-orange-700'];
        const this_materials = [];
        let autres = false;
        for(let i=0; i<filieres_unique.length; i++){
          if(filieres_unique[i]===undefined){
            autres = true;
          }else{
            this_materials.push({ id: i, checked: false, color:colors[i], label: filieres_unique[i]});
          }
        }
        if(autres) this_materials.push({ id: filieres_unique.length, checked: false, color:'bg-red-300', label: 'Autres'});
        return this_materials;
      }

      useEffect(() => {
        if(session?.user?.id) getFilieres(session?.user?.id).then((filieres) => setSelectedMaterials(filieres));
      }, [session]);
    
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


      const [serverData, setServerData] = useState<{ labels: string[]; datasets: DatasetInterface[] }>({ labels: [], datasets: [] });
      const [loading, setLoading] = useState(true);
      //const [error, setError] = useState(null);
  
      useEffect(() => {
          const fetchData = async () => {
              try {
                  const response = await fetch('/api/analysis');
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



    if (!session) return <p>Chargement de vos id de connexion...</p>;
    return (
            <div className='m-5'>
                <div className="flex justify-between items-center">
                    <div className="text-xl">Analyse</div>
                    <div className="join">
                        <input className="join-item btn btn-xs text-xs font-normal" type="radio" name="options_value_chaine" aria-label="Filières" value="filiere" checked={filieres_ou_prestataires.nom == 'filiere'} onChange={handleRadioValueChainChange}/>
                        <input className="join-item btn btn-xs text-xs font-normal" type="radio" name="options_value_chaine" aria-label="Prestataires" value="prestataire" checked={filieres_ou_prestataires.nom=='prestataire'} onChange={handleRadioValueChainChange} />
                    </div>
                </div>

                <FiltreFilieres/>
                {loading && <div>Loading</div>}
                <TabBarAnalyses/>
            </div>
    )
}

export default AnalysisPage


//PArtie correcte !!
