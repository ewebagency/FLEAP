import React, { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { SessionProvider, useSession } from '../../SessionProvider';
import { supabase } from '@/app/database/supabaseClient';
import { useAnalysis } from '@/app/analysis/AnalysisProvider';
import { useFilterContext } from '@/app/FilterContext';
import { formatNumber } from '@/app/utils/formatNumber';

interface Site {
  nom: string;
  siret: string;
}

interface Jalons {
  date: string;
  tonnage: string;
}

interface ObjectifSite {
  startDate: string;
  endDate: string;
  tonnage: string;
  jalons: Jalons[];
}

// Fonction utilitaire pour formater les dates en 'Mmm YY'
function formatMonthYear(dateStr: string | Date) {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

const ObjectifTonnage = () => {
  // Dates fictives pour la jauge (à remplacer plus tard par des données dynamiques)
  const startDate = new Date('2024-01-25');
  const endDate = new Date('2024-09-25');
  const today = new Date();

  // Calcul de la position du curseur (en pourcentage)
  const totalDuration = endDate.getTime() - startDate.getTime();
  const elapsed = Math.max(0, Math.min(today.getTime() - startDate.getTime(), totalDuration));
  const cursorPosition = (elapsed / totalDuration) * 100;

  // State pour le modal (sera utilisé plus tard)
  const [openModal, setOpenModal] = useState(false);

  const { user_id, entreprise_id } = useSession();
  

  const [sites, setSites] = useState<Site[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [objectifs, setObjectifs] = useState<{ [siret: string]: ObjectifSite }>({});

  const { bsds } = useAnalysis();
  const { sites: filterSites } = useFilterContext();
  const selectedSites = filterSites.filter(site => site.checked).map(site => site.orgId);
  
  const siret_dans_les_objectifs = Object.entries(objectifs).filter(([_, v]) => v.startDate && v.endDate).map(([k, _]) => k);
  console.log('siret_dans_les_objectifs', siret_dans_les_objectifs);

  
  // 1. Calcul du tonnage réel total pour les sites sélectionnés
  const tonnageReelTotal = selectedSites.filter(siret => siret_dans_les_objectifs.includes(siret)).reduce((sum, siret) => {
    const bsdsForSite = bsds.filter(bsd => {
      const siretBsd = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret;
      return siretBsd === siret;
    });
    const totalQuantity = bsdsForSite.reduce(
      (siteSum, bsd) => siteSum + (Number(String(bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity)) || 0),
      0
    );
    return sum + totalQuantity;
  }, 0);

  // 2. Calcul du tonnage optimal total à la date du jour (interpolation linéaire)
  function interpolateJalons(jalons: { date: string; tonnage: number }[], date: Date) {
    if (!jalons || jalons.length === 0) return 0;
    // Chercher les deux jalons encadrant la date
    let prev = jalons[0];
    let next = jalons[jalons.length - 1];
    for (let i = 0; i < jalons.length - 1; i++) {
      const d1 = new Date(jalons[i].date);
      const d2 = new Date(jalons[i + 1].date);
      if (d1 <= date && date <= d2) {
        prev = jalons[i];
        next = jalons[i + 1];
        break;
      }
    }
    const dPrev = new Date(prev.date).getTime();
    const dNext = new Date(next.date).getTime();
    const dCurrent = date.getTime();
    if (dNext === dPrev) return Number(prev.tonnage);
    // Interpolation linéaire
    const t = (dCurrent - dPrev) / (dNext - dPrev);
    return Number(prev.tonnage) + t * (Number(next.tonnage) - Number(prev.tonnage));
  }

  const todayDate = new Date();
  const tonnageOptimalTotal = selectedSites.reduce((sum, siret) => {
    const obj = objectifs[siret];
    if (!obj || !obj.startDate || !obj.endDate) return sum;
    // On construit la liste des jalons : début (0), ...jalons, fin
    const jalons = [
      { date: obj.startDate, tonnage: 0 },
      ...obj.jalons.map(j => ({ date: j.date, tonnage: Number(j.tonnage) })),
      { date: obj.endDate, tonnage: Number(obj.tonnage) },
    ];
    const optimal = interpolateJalons(jalons, todayDate);
    return sum + optimal;
  }, 0);

  // 3. Calcul de la progression réelle
  const progression = tonnageOptimalTotal > 0 ? tonnageReelTotal / tonnageOptimalTotal : 0;
  // La progression peut dépasser 1 (100%)

  // 4. Calcul de la position du curseur (date du jour entre date de début min et date de fin max)
  const allDates = selectedSites.flatMap(siret => {
    const obj = objectifs[siret];
    if (!obj || !obj.startDate || !obj.endDate) return [];
    return [obj.startDate, obj.endDate];
  });
  const minDate = allDates.length > 0 ? new Date(Math.min(...allDates.map(d => new Date(d).getTime()))) : startDate;
  const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => new Date(d).getTime()))) : endDate;
  let cursorPos = 0;
  if (todayDate <= minDate) cursorPos = 0;
  else if (todayDate >= maxDate) cursorPos = 100;
  else cursorPos = ((todayDate.getTime() - minDate.getTime()) / (maxDate.getTime() - minDate.getTime())) * 100;

  // 5. Largeur de la jauge colorée (progression réelle)
  const coloredWidth = Math.max(0, Math.min(progression * cursorPos, 200)); // Peut dépasser le curseur

  // Couleur de la jauge selon la progression
  let gaugeColor = '';
  if (progression <= 0.8) {
    gaugeColor = 'bg-green-700';
  } else if (progression <= 0.9) {
    gaugeColor = 'bg-green-400';
  } else if (progression <= 1) {
    gaugeColor = 'bg-orange-500';
  } else if (progression <= 1.1) {
    gaugeColor = 'bg-red-500';
  } else {
    gaugeColor = 'bg-black';
  }

  // DEBUG LOGS
  //console.log('Sites sélectionnés (SIRET):', selectedSites);
  selectedSites.forEach(siret => {
    const bsdsForSite = bsds.filter(bsd => {
      const siretBsd = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret;
      return siretBsd === siret;
    });
    //console.log(`siret des BSDs pour le site ${siret}:`, bsdsForSite.map(bsd => bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret));
  });
  console.log('Tonnage réel total:', tonnageReelTotal);

  selectedSites.forEach(siret => {
    const obj = objectifs[siret];
    if (!obj || !obj.startDate || !obj.endDate) return;
    const jalons = [
      { date: obj.startDate, tonnage: 0 },
      ...obj.jalons.map(j => ({ date: j.date, tonnage: Number(j.tonnage) })),
      { date: obj.endDate, tonnage: Number(obj.tonnage) },
    ];
    //console.log(`Jalons pour le site ${siret}:`, jalons);
    const optimal = interpolateJalons(jalons, todayDate);
    //console.log(`Tonnage optimal interpolé pour le site ${siret} à la date du jour:`, optimal);
  });
  //console.log('Tonnage optimal total à la date du jour:', tonnageOptimalTotal);
  console.log('Progression réelle (peut dépasser 1):', progression);

  React.useEffect(() => {
    const fetchSites = async () => {
      if (!user_id) return;
      setLoadingSites(true);
      // 1. Récupérer site_access pour le user
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('site_access')
        .eq('user_id', user_id)
        .single();

      // 2. Récupérer les sites dont le siret est dans site_access
      const { data: siteRows, error: siteError } = await supabase
        .from('table_autocompletion')
        .select('site')
        .eq('entreprise_id', entreprise_id);

      const siretList = profile?.site_access;
      let filteredSiteRows = [];
      if (siteRows) {
        // On extrait { nom, siret } de chaque site
        const mappedSites = siteRows
          //.filter(row => row.site!==null)
          .map(row => row.site)
          .filter(site => site && site.nom && site.siret);

        if (siretList && siretList.length > 0) {
          filteredSiteRows = mappedSites.filter(site => siretList.includes(site.siret));
        } else {
          filteredSiteRows = mappedSites;
        }
      }
      setSites(filteredSiteRows);
      setLoadingSites(false);
    };
    fetchSites();
  }, [user_id, entreprise_id]);

  // Initialiser les objectifs quand les sites changent
  React.useEffect(() => {
    if (sites.length > 0) {
      setObjectifs((prev) => {
        const newObj = { ...prev };
        sites.forEach((site) => {
          if (!newObj[site.siret]) {
            newObj[site.siret] = {
              startDate: '',
              endDate: '',
              tonnage: '',
              jalons: [],
            };
          }
        });
        // Nettoyer les objectifs des sites qui ne sont plus accessibles
        Object.keys(newObj).forEach((siret) => {
          if (!sites.find((site) => site.siret === siret)) {
            delete newObj[siret];
          }
        });
        return newObj;
      });
    }
  }, [sites]);

  // Pré-remplissage des objectifs depuis la table objectifs
  React.useEffect(() => {
    const fetchObjectifs = async () => {
      if (!entreprise_id || sites.length === 0) return;
      const sirets = sites.map(site => site.siret);
      const { data: objectifsRows, error } = await supabase
        .from('objectifs')
        .select('siret_site, name_site, objectif_tonnage')
        .eq('entreprise_id', entreprise_id)
        .in('siret_site', sirets);
      if (error) return;
      setObjectifs(prev => {
        const newObj = { ...prev };
        objectifsRows.forEach(row => {
          const objTonnage = row.objectif_tonnage || [];
          if (objTonnage.length > 0) {
            // Premier = date début, dernier = date fin, le reste = jalons
            const start = objTonnage[0];
            const end = objTonnage[objTonnage.length - 1];
            const jalons = objTonnage.slice(1, objTonnage.length - 1);
            newObj[row.siret_site] = {
              startDate: start.date,
              endDate: end.date,
              tonnage: end.tonnage,
              jalons: jalons.map((j: { date: string; tonnage: string }) => ({ date: j.date, tonnage: j.tonnage })),
            };
          }
        });
        return newObj;
      });
    };
    fetchObjectifs();
  }, [entreprise_id, sites]);

  return (
    <div className="w-[800px] flex justify-between items-center py-4">
      {/* Jauge */}
      <div className="relative flex-1 mr-4" style={{ minWidth: 300 }}>
        {/* Dates de début et de fin au-dessus de la barre */}
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{formatMonthYear(minDate)}</span>
          <span>{formatMonthYear(maxDate)}</span>
        </div>
        {/* Barre de jauge */}
        <div className="h-4 bg-white rounded-full w-full relative overflow-hidden">
          {/* Jauge colorée (progression réelle, max jusqu'au curseur) */}
          <div
            className={`absolute top-0 left-0 h-4 ${progression > 1 ? '' : 'rounded-md'} ${gaugeColor}`}
            style={{ width: `${Math.min(progression, 1) * cursorPos}%`, zIndex: 1, transition: 'width 0.5s' }}
          />
          {/* Dépassement (si progression > 1) */}
          {progression > 1 && (
            <div
              className="absolute top-0 h-4 rounded-md rounded-l-none bg-black"
              style={{
                left: `${cursorPos}%`,
                width: `${(progression - 1) * cursorPos}%`,
                zIndex: 2,
                transition: 'width 0.5s',
              }}
            />
          )}
          {/* Trait noir (curseur théorique) */}
          <div
            className="absolute top-0 h-4"
            style={{
              left: `calc(${cursorPos}% - 1px)`,
              width: '2px',
              background: 'black',
              zIndex: 3,
            }}
          />
        </div>
        {/* Pin Google Maps (point rouge) centré sur le curseur */}
        <div
          className="absolute"
          style={{
            left: `calc(${cursorPos}% - 8px)`,
            top: '5px',
            zIndex: 5,
            pointerEvents: 'none',
          }}
        >
          <div className="flex flex-col items-center">
            {/* Tête du pin */}
            <div className="w-4 h-4 bg-red-500 rounded-full shadow" />
          </div>
        </div>
        {/* Labels de dates et tonnage */}
        <div className="flex justify-between text-xs text-gray-500 mt-1 items-end">
          <div className="flex flex-col items-center">
            <span className="font-semibold text-gray-900 text-xs">{formatNumber(tonnageReelTotal)} tonnes</span>
            <div className="group relative text-gray-500">
                aujourd&apos;hui
                <span className="absolute hidden group-hover:block text-gray-500 w-[500px] mt-1">
                    Sur les sites avec objectifs seulement / Enlevez les filtres autres que les sites
                </span>
            </div>
          </div>
          <div className="flex flex-col items-center" style={{ position: 'absolute', top: '40px', left: `calc(${cursorPos}% - 40px)`, width: '80px', zIndex: 10 }}>
            <span className="font-semibold text-gray-900 text-xs">{formatNumber(tonnageOptimalTotal)} tonnes</span>
            <span className="text-xs text-gray-500">en théorie</span>
          </div>
          <span></span>
        </div>
      </div>
      {/* Bouton Modifier l&apos;objectif */}
      <button
        className="text-gray-500 text-md px-3 py-1 rounded hover:text-gray-700 transition"
        onClick={() => setOpenModal(true)}
      >
        <p className='mt-[-15px]'>Modifier l&apos;objectif</p>
      </button>
      {/* Modal centré */}
      {openModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 min-w-[350px] max-w-lg w-full relative max-h-[70vh] mt-[10%] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4 text-center">Définir les objectifs par site</h2>
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl"
              onClick={() => setOpenModal(false)}
              aria-label="Fermer le modal"
            >
              ×
            </button>
            {/* Liste des sites accessibles */}
            {loadingSites ? (
              <div className="text-center text-gray-400">Chargement des sites...</div>
            ) : sites.length === 0 ? (
              <div className="text-center text-gray-400">Aucun site accessible</div>
            ) : (
              <div className="space-y-4">
                {sites.map((site) => (
                  <div key={site.siret} className="border rounded p-3 flex flex-col gap-2 relative">
                    <span className="font-medium">{site.nom}</span>
                    <span className="text-xs text-gray-500 mb-2">SIRET : {site.siret}</span>
                    {/* Bouton suppression objectif */}
                    <button
                      className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-xs"
                      onClick={() => {
                        setObjectifs((prev) => {
                          const newObj = { ...prev };
                          delete newObj[site.siret];
                          return newObj;
                        });
                      }}
                    >
                      Supprimer objectif
                    </button>
                    {/* Formulaire objectif */}
                    <div className="flex flex-col gap-2 mt-2">
                      <label className="text-xs">Date de début
                        <input
                          type="date"
                          className="border rounded px-2 py-1 ml-2"
                          value={objectifs[site.siret]?.startDate || ''}
                          onChange={e => setObjectifs(prev => ({
                            ...prev,
                            [site.siret]: {
                              ...prev[site.siret],
                              startDate: e.target.value,
                            },
                          }))}
                        />
                      </label>
                      <label className="text-xs">Date de fin
                        <input
                          type="date"
                          className="border rounded px-2 py-1 ml-2"
                          value={objectifs[site.siret]?.endDate || ''}
                          onChange={e => setObjectifs(prev => ({
                            ...prev,
                            [site.siret]: {
                              ...prev[site.siret],
                              endDate: e.target.value,
                            },
                          }))}
                        />
                      </label>
                      <label className="text-xs">Tonnage de fin
                        <input
                          type="number"
                          className="border rounded px-2 py-1 ml-2"
                          value={objectifs[site.siret]?.tonnage || ''}
                          onChange={e => setObjectifs(prev => ({
                            ...prev,
                            [site.siret]: {
                              ...prev[site.siret],
                              tonnage: e.target.value,
                            },
                          }))}
                        />
                      </label>
                      {/* Jalons dynamiques */}
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold">Jalons</span>
                          <button
                            className="text-blue-500 text-xs hover:underline"
                            onClick={() => setObjectifs(prev => ({
                              ...prev,
                              [site.siret]: {
                                ...prev[site.siret],
                                jalons: [
                                  ...prev[site.siret].jalons,
                                  { date: '', tonnage: '' },
                                ],
                              },
                            }))}
                          >
                            + Ajouter un jalon
                          </button>
                        </div>
                        <div className="flex flex-col gap-2">
                          {objectifs[site.siret]?.jalons.map((jalon, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="date"
                                className="border rounded px-2 py-1"
                                value={jalon.date}
                                onChange={e => setObjectifs(prev => {
                                  const newJalons = [...prev[site.siret].jalons];
                                  newJalons[idx] = { ...newJalons[idx], date: e.target.value };
                                  return {
                                    ...prev,
                                    [site.siret]: {
                                      ...prev[site.siret],
                                      jalons: newJalons,
                                    },
                                  };
                                })}
                              />
                              <input
                                type="number"
                                className="border rounded px-2 py-1"
                                placeholder="Tonnage"
                                value={jalon.tonnage}
                                onChange={e => setObjectifs(prev => {
                                  const newJalons = [...prev[site.siret].jalons];
                                  newJalons[idx] = { ...newJalons[idx], tonnage: e.target.value };
                                  return {
                                    ...prev,
                                    [site.siret]: {
                                      ...prev[site.siret],
                                      jalons: newJalons,
                                    },
                                  };
                                })}
                              />
                              <button
                                className="text-red-500 text-xs hover:underline"
                                onClick={() => setObjectifs(prev => {
                                  const newJalons = prev[site.siret].jalons.filter((_, i) => i !== idx);
                                  return {
                                    ...prev,
                                    [site.siret]: {
                                      ...prev[site.siret],
                                      jalons: newJalons,
                                    },
                                  };
                                })}
                              >
                                Supprimer
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Bouton enregistrer */}
                      <button
                        className="mt-4 bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 transition self-end"
                        onClick={async () => {
                          const obj = objectifs[site.siret];
                          if (!obj || !obj.startDate || !obj.endDate) return;
                          const objectif_tonnage = [
                            { date: obj.startDate, tonnage: 0 },
                            ...obj.jalons.map(j => ({ date: j.date, tonnage: Number(j.tonnage) })),
                            { date: obj.endDate, tonnage: Number(obj.tonnage) },
                          ];
                          await supabase
                            .from('objectifs')
                            .upsert([
                              {
                                entreprise_id,
                                siret_site: site.siret,
                                name_site: site.nom,
                                objectif_tonnage,
                              },
                            ], { onConflict: 'entreprise_id,siret_site' });
                        }}
                      >
                        Enregistrer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ObjectifTonnage;
