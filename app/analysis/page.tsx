"use client"
import React, { useState, useEffect } from "react";
import TabBarAnalyses from "../component/Analyse/TabBarAnalyses";
import FiltreFilieresSwitcher from "../component/FiltreFilieresSwitcher";
import { useSession } from "../component/SessionProvider";
import { supabase } from "../database/supabaseClient";
import { useFilterContext, Filiere, PointCollecte, Site } from "../FilterContext";
import { getFiliere, getMappingTableFiliere } from "../register/RegisterComponents/Modal/FormulaireFull/utils_new";
import { getColors } from "../component/Analyse/MetaComponent/Colours";
import { AnalysisProvider } from './AnalysisProvider';
import AnalOpPieChart from "../component/Analyse/Operationelle/AnalOpPieChart";
import AnalOpTable from "../component/Analyse/Operationelle/AnalOpTable";
import AnalOpMainChart from "../component/Analyse/Operationelle/AnalOpMainChart";
import { FormInput } from '../register/interface/BSD_Interface';

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
    data: number[];
    backgroundColor: string;
    borderColor: string;
    fill: boolean;
    totalWeight: number;
    monthlyAverage: number;
    trend: number;
}

const getColorForFiliere = (filiere: string): string => {
    // Enlever le préfixe 'bg-' pour chart.js
    return getColors(1)[0].replace('bg-', '');
};

const calculateTrend = (data: number[]): number => {
    // Calculer la tendance sur les 3 derniers mois
    const lastThreeMonths = data.slice(-3);
    if (lastThreeMonths.length < 2) return 0;
    
    const firstValue = lastThreeMonths[0];
    const lastValue = lastThreeMonths[lastThreeMonths.length - 1];
    
    if (firstValue === 0) return 0;
    return ((lastValue - firstValue) / firstValue) * 100;
};

const calculateOverallTrend = (datasets: DatasetInterface[]): number => {
    // Calculer la tendance globale en sommant les poids par mois
    const monthlyTotals = Array(12).fill(0);
    datasets.forEach(dataset => {
        dataset.data.forEach((value: number, index: number) => {
            monthlyTotals[index] += value;
        });
    });
    
    return calculateTrend(monthlyTotals);
};

const AnalysisPage = () => {
    
    const { 
        filieres_ou_prestataires, 
        setFilieresOuPrestataires,
        filieres,
        points_collecte,
        sites 
    } = useFilterContext();
    const {entreprise_id, display_features} = useSession();
    const [mappingTable, setMappingTable] = useState<{ ced: string, filiere: string }[]>([]);
    const [serverData, setServerData] = useState<{ 
        labels: string[]; 
        datasets: DatasetInterface[];
        totalWeight: number;
        monthlyAverage: number;
        yearlyTrend: number;
    }>({ 
        labels: [], 
        datasets: [],
        totalWeight: 0,
        monthlyAverage: 0,
        yearlyTrend: 0
    });
    //const [loading, setLoading] = useState(true);

    const handleRadioValueChainChange = (event :React.ChangeEvent<HTMLInputElement>) => {
      setFilieresOuPrestataires({ nom: event.target.value as 'filiere' | 'filiere_nom' }); // Mise à jour du state avec la valeur sélectionnée
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

    /*const [selectedMaterials, setSelectedMaterials] = useState([
        { id: 1, checked: false, color:'bg-blue-300', label: 'DIB'},
        { id: 2, checked: false, color:'bg-blue-400', label: 'Dangereux'},
        { id: 3, checked: false, color:'bg-blue-500', label: 'Verre'},
        { id: 4, checked: true, color:'bg-green-300', label: 'Carton & Papier',},
        { id: 5, checked: false, color:'bg-green-500', label: 'Plastiques'},
        { id: 6, checked: false, color:'bg-purple-300', label: 'DEE'},
        { id: 7, checked: false, color:'bg-purple-500', label: 'Matériaux'},
        { id: 8, checked: false, color:'bg-purple-700', label: 'Bois'},
      ]);*/

      /*const getFilieres = async (user_id:string) => {
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
      }*/

      /*useEffect(() => {
        if(session?.user_id) getFilieres(session?.user_id).then((filieres) => setSelectedMaterials(filieres));
      }, [session]);*/
    
      // Fonction pour gérer les changements de checkbox
      /*const handleMaterialsChange = (id:number) => {
        // Mettre à jour l'état en fonction de la checkbox sélectionnée
        setSelectedMaterials((prevMaterials) =>
          prevMaterials.map((checkbox) =>
            checkbox.id === id
              ? { ...checkbox, checked: !checkbox.checked } // Inverser l'état
              : checkbox
          )
        );
      };*/


    /*const fetchAnalysisData = async () => {
        if (!entreprise_id) return;

        const checkedFilieres = filieres.filter(f => f.checked).map(f => f.name);
        const checkedPointsCollecte = points_collecte.filter(pc => pc.checked).map(pc => pc.name);
        const checkedSites = sites.filter(site => site.checked).map(site => site.orgId);

        if (checkedFilieres.length === 0 || checkedPointsCollecte.length === 0) {
            return;
        }

        let query = supabase
            .from('bsd')
            .select('*')
            .eq('entreprise_id', entreprise_id);

        // Appliquer les filtres de sites
        if (checkedSites.length > 0) {
            let or_condition = ``;
            if (checkedSites.includes('autres')) {
                or_condition = `infos_json->formAPI->createFormInput->emitter->company->>siret.eq.""`;
                if (checkedSites.length > 1) {
                    or_condition += `,infos_json->formAPI->createFormInput->emitter->company->>siret.in.(${checkedSites.join(',')})`;
                }
            } else {
                or_condition = `infos_json->formAPI->createFormInput->emitter->company->>siret.in.(${checkedSites.join(',')})`;
            }
            query = query.or(or_condition);
        }

        // Appliquer les filtres de points de collecte
        if (checkedPointsCollecte.length > 0) {
            if (!checkedPointsCollecte.includes("Non renseigné")) {
                query = query.filter('infos_json->formAPI->createFormInput->emitter->workSite->>name', 'in', `(${checkedPointsCollecte.join(',')})`);
            } else {
                query = query.or(
                    `infos_json->formAPI->createFormInput->emitter->>workSite.is.null,` +
                    `infos_json->formAPI->createFormInput->emitter->workSite->>name.eq."",` +
                    `infos_json->formAPI->createFormInput->emitter->workSite->>name.in.(${checkedPointsCollecte.filter(pc => pc !== "Non renseigné").join(',')})`
                );
            }
        }

        const { data: bsds, error } = await query;

        if (error) {
            console.error("Error fetching BSDs:", error);
            return;
        }

        // Traiter les données pour l'analyse
        const processedData = processAnalysisData(bsds);
        setServerData(processedData);
    };*/

    /*const processAnalysisData = (bsds: {created_at:string, infos_json:{formAPI:{createFormInput:FormInput}}}[]) => {
        const monthLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
        const datasets: Array<{
            id: number;
            label: string;
            data: number[];
            backgroundColor: string;
            borderColor: string;
            fill: boolean;
            totalWeight: number;
            monthlyAverage: number;
            trend: number;
        }> = [];
        const weightsByFiliere: {
            [key: string]: {
                monthlyData: number[];
                total: number;
            };
        } = {};
        let totalWeight = 0;

        // Grouper les poids par filière et par mois
        bsds.forEach(bsd => {
            const quantity = bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity || 0;
            const filiere = getFiliere(bsd.infos_json.formAPI.createFormInput.wasteDetails.code, mappingTable);
            const date = new Date(bsd.created_at);
            const month = date.getMonth();

            if (!weightsByFiliere[filiere]) {
                weightsByFiliere[filiere] = {
                    monthlyData: Array(12).fill(0),
                    total: 0
                };
            }

            weightsByFiliere[filiere].monthlyData[month] += quantity;
            weightsByFiliere[filiere].total += quantity;
            totalWeight += quantity;
        });

        // Créer les datasets
        Object.entries(weightsByFiliere).forEach(([filiere, data], index) => {
            const monthlyAverage = data.total / 12;
            const trend = calculateTrend(data.monthlyData);

            datasets.push({
                id: index,
                label: filiere,
                data: data.monthlyData,
                backgroundColor: getColorForFiliere(filiere),
                borderColor: getColorForFiliere(filiere),
                fill: false,
                totalWeight: data.total,
                monthlyAverage,
                trend
            });
        });

        return {
            labels: monthLabels,
            datasets: datasets as DatasetInterface[],
            totalWeight,
            monthlyAverage: totalWeight / 12,
            yearlyTrend: calculateOverallTrend(datasets)
        };
    };*/

    /*useEffect(() => {
        if (entreprise_id && mappingTable.length > 0) {
            setLoading(true);
            fetchAnalysisData().finally(() => setLoading(false));
        }
    }, [entreprise_id, filieres, points_collecte, sites, mappingTable]);*/

    useEffect(() => {
        const loadMappingTable = async () => {
            if (entreprise_id) {
                const mapping = await getMappingTableFiliere(entreprise_id);
                setMappingTable(mapping || []);
            }
        };
        loadMappingTable();
    }, [entreprise_id]);

    if (!entreprise_id) return <p>Chargement de vos id de connexion...</p>;
    return (
        <AnalysisProvider>
            <div className='mx-5 mt-2'>
                <div className="flex justify-between items-center">
                    <FiltreFilieresSwitcher/>
                    <div className="join hidden">
                        <input 
                            className="join-item btn btn-xs text-xs font-normal" 
                            type="radio" 
                            name="options_value_chaine" 
                            aria-label="Filières" 
                            value="filiere" 
                            checked={filieres_ou_prestataires.nom == 'filiere'} 
                            onChange={handleRadioValueChainChange}
                        />
                        <input 
                            className="join-item btn btn-xs text-xs font-normal" 
                            type="radio" 
                            name="options_value_chaine" 
                            aria-label="Filières par nom" 
                            value="filiere_nom" 
                            checked={filieres_ou_prestataires.nom=='filiere_nom'} 
                            onChange={handleRadioValueChainChange} 
                        />
                    </div>
                </div>

                {/*loading && <div>Loading</div>*/}
                <TabBarAnalyses/>
            </div>
        </AnalysisProvider>
    )
}

export default AnalysisPage


//PArtie correcte !!
