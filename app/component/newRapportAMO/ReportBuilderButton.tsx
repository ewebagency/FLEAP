"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { useSession } from '@/app/component/SessionProvider';
import { useFilterContext } from '@/app/FilterContext';
import { AnalysisResponse, ChartConfig, ReportBuilderState, TypeParam } from './types';
import { ExportOptions } from './components/ExportOptions';
import { SiteSearch } from './components/SiteSearch';
import { GraphConfigurator } from './components/GraphConfigurator';
import { ChartRenderer } from './components/ChartRenderer';
import { PDFPreview } from './components/PDFPreview';
import { ReportConfigManager } from './components/ReportConfigManager';
// Removed dependency on AnalysisProvider; all data comes from API + FilterContext

export default function ReportBuilderButton() {
  const { entreprise_id } = useSession();
  const { sites, segmentDates } = useFilterContext();
  // filterType comes from aggregated data semantics; no context usage here
  const [step, setStep] = useState<'closed' | 'config' | 'sites' | 'builder'>('closed');

  const initialState: ReportBuilderState = useMemo(() => ({
    selectedSites: [],
    exportOptions: { 
      includeTitle: true, 
      includeKPIs: true, 
      includeTable: true, 
      includeCharts: true, 
      includeLinePdfs: false,
      tableColumns: ['doc','nBon','nFacture','date','site','waste','ced','qty','treatment','exutoire','exutoire_siret','exutoire_address','receipt','numberPlate','containerDescription']
    },
    charts: [],
    reportTitle: 'Paramètres perso',
    filterType: 'imported',
  }), []);

  const [state, setState] = useState<ReportBuilderState>(initialState);
  const clearedSitesOnEnterRef = useRef(false);

  const hourBucket = useMemo(() => Math.floor(Date.now() / (60 * 60 * 1000)), []);
  // Loading orchestration phases
  const [phase, setPhase] = useState<'idle' | 'analysis' | 'bsd' | 'attachments' | 'done'>('idle');

  // Only enable analysis fetch when needed and after user starts
  const shouldLoadAnalysis = useMemo(() => {
    if (step === 'closed') return false;
    if (!state.exportOptions.includeCharts) return false;
    return phase === 'analysis' || phase === 'bsd' || phase === 'attachments' || phase === 'done';
  }, [step, state.exportOptions.includeCharts, phase]);

  // Recompute SWR key based on gating
  const gatedKey = useMemo(() => {
    if (!entreprise_id || step === 'closed') return null;
    if (!shouldLoadAnalysis) return null;
    const type: TypeParam = 'bsd';
    const params = new URLSearchParams();
    params.set('entreprise_id', entreprise_id);
    params.set('type', type);
    if (state.filterType) params.set('filterType', state.filterType);
    // Server-side filters
    const startISO = segmentDates?.debut ? new Date(segmentDates.debut).toISOString() : '';
    const endDate = segmentDates?.fin ? new Date(segmentDates.fin) : null;
    const endISO = endDate ? new Date(endDate.setHours(23,59,59,999)).toISOString() : '';
    if (startISO) params.set('dateStart', startISO);
    if (endISO) params.set('dateEnd', endISO);
    if (state.selectedSites && state.selectedSites.length > 0) {
      const nameToSiret = (siteName: string) => {
        const found = sites.find(s => s.name === siteName);
        return found?.orgId || '';
      };
      const sirets = Array.from(new Set(state.selectedSites.map(nameToSiret).filter(Boolean)));
      if (sirets.length > 0) params.set('sites', sirets.join(','));
    }
    const url = `/api/get_data_for_analysis?${params.toString()}`;
    return ['analysis-bsd', entreprise_id, hourBucket, url] as const;
  }, [entreprise_id, step, hourBucket, shouldLoadAnalysis, state.filterType, segmentDates?.debut, segmentDates?.fin, state.selectedSites, sites]);

  const { data: gatedData, error: gatedError, isLoading: gatedIsLoading, mutate: gatedMutate } = useSWR(
    gatedKey,
    ([, , , url]) => fetch(url, { cache: 'no-store' }).then<AnalysisResponse>(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }),
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      shouldRetryOnError: false,
      keepPreviousData: true,
    }
  );

  // Use the gated data instead of always-on SWR
  const analysisData = gatedData;
  // const analysisLoading = gatedIsLoading;
  // const analysisError = gatedError;

  // Data is already filtered server-side by dates and sites
  const finalAnalysisData: AnalysisResponse | undefined = useMemo(() => {
    return analysisData;
  }, [analysisData]);

  const onOpen = useCallback(async () => {
    if (!entreprise_id) return;
    setStep('config');
  }, [entreprise_id]);

  const onClose = useCallback(() => {
    setStep('closed');
    setPhase('idle');
    setShowConfigParams(true);
    setState(initialState);
    setShouldGeneratePdf(false);
  }, []);

  useEffect(() => {
    if (step === 'closed') {
      setState(initialState);
    }
  }, [step, initialState]);

  useEffect(() => {
    if (step === 'builder' && analysisData && state.charts.length === 0) {
      const first: ChartConfig = {
        id: generateId(),
        title: '',
        type: 'bar',
        xFamily: 'mois_annee',
        segmentFamily: 'filiere',
        yAxis: 'tonnage',
        filterFamily: 'site',
        filterValues: state.selectedSites,
      };
      setState(s => ({ ...s, charts: [first] }));
    }
  }, [step, analysisData, state.selectedSites, state.charts.length]);

  // Start button: orchestrate phases
  const onStartLoading = useCallback(async () => {
    if (!entreprise_id) return;
    // Decide first phase depending on charts
    if (state.exportOptions.includeCharts) {
      setPhase('analysis');
      if (!gatedData && !gatedIsLoading && !gatedError && gatedKey) {
        await gatedMutate();
      }
    } else {
      setPhase('bsd');
    }
    setShowConfigParams(false);
  }, [entreprise_id, state.exportOptions.includeCharts, gatedData, gatedIsLoading, gatedError, gatedKey, gatedMutate]);

  // Advance to BSD when analysis is ready
  useEffect(() => {
    if (phase === 'analysis' && analysisData) {
      setPhase('bsd');
    }
  }, [phase, analysisData]);

  // Ensure no sites are preselected when opening the builder for the first time
  useEffect(() => {
    if (step === 'builder' && !clearedSitesOnEnterRef.current) {
      setState(s => ({ ...s, selectedSites: [] }));
      clearedSitesOnEnterRef.current = true;
    }
    if (step === 'closed') {
      clearedSitesOnEnterRef.current = false;
    }
  }, [step]);

  // Keep charts in sync with selected sites when filtering by site
  useEffect(() => {
    setState(s => ({
      ...s,
      charts: s.charts.map(c => (
        c.filterFamily === 'site' ? { ...c, filterValues: [...state.selectedSites] } : c
      )),
    }));
  }, [state.selectedSites]);

  const allSites: string[] = useMemo(() => {
    // Utiliser les sites du FilterContext au lieu de faire des appels supplémentaires
    return sites
      .filter(site => site.activated)
      .map(site => site.name)
      .sort();
  }, [sites]);

  const labelForSite = useCallback((siteName: string) => {
    const denom = finalAnalysisData?.denominateur?.unique_site || [];
    const found = denom.find(d => (d.name && d.name.length > 0 ? d.name : d.siret) === siteName);
    if (!found) return siteName;
    const displayName = found.name && found.name.length > 0 ? found.name : found.siret;
    const siret = found.siret;
    return `${displayName} (${siret})`;
  }, [finalAnalysisData?.denominateur?.unique_site]);

  const extraIndexForSearch = useCallback((siteName: string) => {
    const denom = finalAnalysisData?.denominateur?.unique_site || [];
    const found = denom.find(d => (d.name && d.name.length > 0 ? d.name : d.siret) === siteName);
    if (!found) return [];
    const siret = found.siret || '';
    // Index both raw and spaced formats
    const spaced = siret.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
    return [found.name || '', siret, spaced].filter(Boolean);
  }, [finalAnalysisData?.denominateur?.unique_site]);

  const generateId = () => `chart_${Date.now().toString(36)}_${Math.round(Math.random()*1e9).toString(36)}`;

  const addChart = useCallback(() => {
    const defaultChart: ChartConfig = {
      id: generateId(),
      title: 'Graphique',
      type: 'bar',
      xFamily: 'mois_annee',
      segmentFamily: 'filiere',
      yAxis: 'tonnage',
      filterFamily: 'site',
      filterValues: state.selectedSites,
    };
    setState(s => ({ ...s, charts: [...s.charts, defaultChart] }));
  }, [state.selectedSites]);

  const updateChart = useCallback((id: string, updater: (c: ChartConfig) => ChartConfig) => {
    setState(s => ({ ...s, charts: s.charts.map(c => (c.id === id ? updater(c) : c)) }));
  }, []);

  const removeChart = useCallback((id: string) => {
    setState(s => ({ ...s, charts: s.charts.filter(c => c.id !== id) }));
  }, []);

  const loadConfig = useCallback((config: ReportBuilderState) => {
    setState(config);
  }, []);

  const onConfigSelected = useCallback((config: ReportBuilderState | null) => {
    if (config) {
      setState(config);
      // Si on charge une config existante, masquer les paramètres de configuration
      setShowConfigParams(false);
      setStep('builder');
    } else {
      // Si nouveau, afficher tous les paramètres
      setShowConfigParams(true);
      setStep('builder');
    }
  }, []);

  const [shouldGeneratePdf, setShouldGeneratePdf] = useState(false);
  const [showConfigParams, setShowConfigParams] = useState(true);

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={onOpen}
        disabled={!entreprise_id}
        className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
      >
        Générer un rapport
      </button>

      {/* Step 1: Choix de la configuration */}
      {step === 'config' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <div className="relative bg-white rounded-lg shadow-xl w-96 max-w-[90vw]">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Rapport</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <ReportConfigManager
                    currentState={state}
                    onLoadConfig={onConfigSelected}
                    compact={true}
                  />
                </div>                
                <div className="text-center text-gray-400">ou</div>
                <button
                  onClick={() => onConfigSelected(null)}
                  className="w-full p-4 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <div className="text-blue-600 font-medium">Créer un nouveau type de rapport</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Step 3: Interface complète (seulement si nouveau) */}
      {step === 'builder' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <div className={`relative bg-white rounded shadow-xl flex flex-col ${
            showConfigParams 
              ? 'w-[98vw] max-w-[98vw] max-h-[95vh]' 
              : 'w-[600px] max-w-[90vw] max-h-[80vh]'
          }`}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <input
                className="text-lg font-semibold outline-none w-full max-w-md"
                value={state.reportTitle}
                onChange={e => setState(s => ({ ...s, reportTitle: e.target.value }))}
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowConfigParams(!showConfigParams)}
                  className="px-3 py-1 rounded border text-sm hover:bg-gray-50 w-[200px]"
                >
                  {showConfigParams ? 'Masquer paramètres' : 'Afficher paramètres'}
                </button>
                <button onClick={onClose} className="px-3 py-1 rounded border">Fermer</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Interface complète pour nouveau rapport */}
              {showConfigParams && (
                <>
                  {/* Sites et paramètres d'export */}
                  <div className="grid grid-cols-12 gap-6">
                    <div className="col-span-12 lg:col-span-6">
                      <SiteSearch
                        allSites={allSites}
                        selectedSites={state.selectedSites}
                        onChange={sites => setState(s => ({ ...s, selectedSites: sites }))}
                        labelFor={labelForSite}
                        extraIndexForSearch={extraIndexForSearch}
                      />
                      <div className="mt-2 text-xs text-gray-600">
                        {state.selectedSites.length > 0 ? (
                          <div>
                            <div className="font-medium text-gray-700 mb-1">Sites sélectionnés:</div>
                            <ul className="list-disc list-inside space-y-0.5">
                              {state.selectedSites.map(s => (
                                <li key={s} className="break-words">{labelForSite(s)}</li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <span className="text-gray-400">Tous les sites</span>
                        )}
                      </div>
                      <div className="mt-3">
                        <button
                          onClick={onStartLoading}
                          disabled={!entreprise_id || phase !== 'idle'}
                          className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-60 flex items-center gap-2"
                        >
                          {(phase === 'analysis' || phase === 'bsd') && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          )}
                          {phase === 'idle'
                            ? 'Lancer le chargement des données'
                            : (phase === 'analysis' || phase === 'bsd')
                              ? 'Chargement en cours…'
                              : 'Chargement terminé'}
                        </button>
                        <div className="text-xs text-gray-500 mt-2 hidden">
                          <div><span className="font-medium">Chargement</span> = récupération des lignes BSD (période et sites choisis).</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-12 lg:col-span-6">
                      <ExportOptions
                        value={state.exportOptions}
                        onChange={opts => setState(s => ({ ...s, exportOptions: opts }))}
                      />
                    </div>
                  </div>

                  {/* Configuration et graphiques */}
                  <div className="grid grid-cols-12 gap-6">
                    <div className="col-span-12 lg:col-span-4 space-y-6">
                      <ReportConfigManager
                        currentState={state}
                        onLoadConfig={loadConfig}
                      />

                      <GraphConfigurator
                        denominators={finalAnalysisData?.denominateur}
                        charts={state.charts}
                        onAddChart={addChart}
                        onUpdateChart={updateChart}
                        onRemoveChart={removeChart}
                      />
                    </div>

                    <div className="col-span-12 lg:col-span-8 space-y-6">
                      {state.exportOptions.includeCharts && state.charts.length > 0 && (
                        <div className="space-y-6">
                          {state.charts.map(chart => (
                          <ChartRenderer key={chart.id} config={chart} data={finalAnalysisData} />
                          ))}
                        </div>
                      )}

                      <PDFPreview
                        title={state.reportTitle}
                        data={finalAnalysisData}
                        state={state}
                        // Start BSD loading when phase reaches 'bsd'
                        startLoadingBsd={phase === 'bsd' || phase === 'attachments' || phase === 'done'}
                        autoStartAttachments={false}
                        onBsdFullyLoaded={() => {
                          if (state.exportOptions.includeLinePdfs) {
                            setPhase('attachments');
                          } else {
                            setPhase('done');
                          }
                        }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Interface minimaliste pour config existante - Sites + bouton d'export */}
              {!showConfigParams && (
                <div className="space-y-4">
                  {/* Sélection des sites */}
                  <div className="max-w-2xl mx-auto">
                    <SiteSearch
                      allSites={allSites}
                      selectedSites={state.selectedSites}
                      onChange={sites => setState(s => ({ ...s, selectedSites: sites }))}
                      labelFor={labelForSite}
                      extraIndexForSearch={extraIndexForSearch}
                    />
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <button
                      onClick={onStartLoading}
                      disabled={!entreprise_id || phase !== 'idle'}
                      className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-60 flex items-center gap-2"
                    >
                      {(phase === 'analysis' || phase === 'bsd') && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      )}
                      {phase === 'idle'
                        ? 'Lancer le chargement'
                        : (phase === 'analysis' || phase === 'bsd')
                          ? 'Chargement en cours…'
                          : 'Chargement terminé'}
                    </button>
                    <div className="text-xs text-gray-500 mt-2 text-center hidden">
                      <div><span className="font-medium">Chargement</span> = récupération des lignes BSD (période et sites choisis).</div>
                    </div>
                  </div>
                  
                  {/* Message et bouton d'export */}
                  <div className="flex flex-col items-center justify-center space-y-4">
                    
                    <PDFPreview
                      title={state.reportTitle}
                      data={finalAnalysisData}
                      state={state}
                      startLoadingBsd={phase === 'bsd' || phase === 'attachments' || phase === 'done'}
                        autoStartAttachments={false}
                      onBsdFullyLoaded={() => {
                        if (state.exportOptions.includeLinePdfs) {
                          setPhase('attachments');
                        } else {
                          setPhase('done');
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PDF Generation (hidden) */}
      {shouldGeneratePdf && (
        <div style={{ display: 'none' }}>
          <PDFPreview
            title={state.reportTitle}
            data={finalAnalysisData}
            state={state}
            onExportComplete={() => setShouldGeneratePdf(false)}
            startLoadingBsd={phase === 'bsd' || phase === 'attachments' || phase === 'done'}
          />
        </div>
      )}
    </div>
  );
}


