/*import React, { useState, useMemo } from 'react';
import { useAnalysis } from '@/app/analysis/AnalysisProvider';
import { BSD } from '@/app/analysis/AnalysisProvider';
import { DynamicCharts } from '../MetaComponent/ChartWrapper';
import { getFiliere } from '@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new';
import { tailwindToRgb } from '../MetaComponent/Colours';
import { useFilterContext } from '@/app/FilterContext';

const { Line, Bar } = DynamicCharts;

interface AnalysisConfig {
    valueType: 'price' | 'pricePerWeight' | 'volume' | 'weightPerVolume' | 'pricePerVolume';
    comparisonAxes: [string, string];
    visualizationType: '1D' | '2D' | 'distribution';
}

interface LineOperation {
    unite: string;
    quantite: number;
    montant_ht: number;
    prix_unitaire: number;
    type_operation: string;
}

interface DistributionData {
    value: number;
    count: number;
    gaussianValue: number;
}

const OptiTab = ({ active }: { active: boolean }) => {
    const { bsds, loading, mappingTable, siretToName } = useAnalysis();
    const { filieres_ou_prestataires } = useFilterContext();
    const [config, setConfig] = useState<AnalysisConfig>({
        valueType: 'price',
        comparisonAxes: ['date', 'prestataire'],
        visualizationType: '1D'
    });

    const processedData = useMemo(() => {
        return bsds.map(bsd => {
            const formInput = bsd.infos_json.formAPI.createFormInput;
            const otherInfos = bsd.other_infos;
            const factureInfos = bsd.facture_infos;
            const wasteDetails = formInput.wasteDetails;
            const quantity = wasteDetails.quantity || 0;
            const volume = otherInfos.volume || 0;

            // Calculate costs from facture data
            let transportCost = 0;
            let treatmentCost = 0;
            let managementCost = 0;
            let taxCost = 0;

            if (factureInfos?.departs) {
                factureInfos.departs.forEach(depart => {
                    depart.line_body.forEach((line: LineOperation) => {
                        switch (line.type_operation) {
                            case 'Transport':
                                transportCost += line.montant_ht;
                                break;
                            case 'Traitement':
                                treatmentCost += line.montant_ht;
                                break;
                            case 'Gestion globale':
                                managementCost += line.montant_ht;
                                break;
                            case 'TGAP':
                                taxCost += line.montant_ht;
                                break;
                        }
                    });
                });
            }

            const totalPrice = factureInfos?.footer.total_ht || 0;

            return {
                date: new Date(bsd.created_at),
                weight: quantity,
                volume,
                price: totalPrice,
                transportCost,
                treatmentCost,
                managementCost,
                taxCost,
                wasteCode: wasteDetails.code,
                emitterSiret: formInput.emitter.company.siret,
                emitterAddress: formInput.emitter.company.address,
                transporterSiret: formInput.transporter.company.siret,
                recipientSiret: formInput.recipient.company.siret,
                treatmentCode: formInput.recipient.processingOperation,
                filiere: getFiliere(wasteDetails.code, mappingTable)
            };
        });
    }, [bsds, mappingTable]);

    const getValueForType = (data: typeof processedData[0], type: AnalysisConfig['valueType']): number => {
        switch (type) {
            case 'price':
                return data.price;
            case 'pricePerWeight':
                return data.weight ? data.price / Number(data.weight) : 0;
            case 'volume':
                return Number(data.volume);
            case 'weightPerVolume':
                return data.volume ? Number(data.weight) / Number(data.volume) : 0;
            case 'pricePerVolume':
                return data.volume ? data.price / Number(data.volume) : 0;
            default:
                return 0;
        }
    };

    const getComparisonValue = (data: typeof processedData[0], axis: string): string => {
        switch (axis) {
            case 'date':
                return data.date.toISOString();
            case 'prestataire':
                return siretToName[data.recipientSiret] || data.recipientSiret;
            case 'codeTraitement':
                return data.treatmentCode || '';
            case 'codeCED':
                return data.wasteCode || '';
            case 'filiere':
                return data.filiere || '';
            case 'siteEmetteur':
                return `${siretToName[data.emitterSiret] || data.emitterSiret} (${data.emitterAddress})`;
            case 'siteTransporteur':
                return siretToName[data.transporterSiret] || data.transporterSiret;
            case 'siteDestinataire':
                return siretToName[data.recipientSiret] || data.recipientSiret;
            default:
                return '';
        }
    };

    const chartData = useMemo(() => {
        // Group data by both comparison axes
        const groupedData = processedData.reduce((acc, data) => {
            const axis1Value = getComparisonValue(data, config.comparisonAxes[0]);
            const axis2Value = getComparisonValue(data, config.comparisonAxes[1]);
            
            if (!acc[axis1Value]) {
                acc[axis1Value] = {};
            }
            
            if (!acc[axis1Value][axis2Value]) {
                acc[axis1Value][axis2Value] = {
                    values: []
                };
            }
            
            acc[axis1Value][axis2Value].values.push(getValueForType(data, config.valueType));
            return acc;
        }, {} as Record<string, Record<string, { values: number[] }>>);

        // Calculate averages for each group
        return Object.entries(groupedData).map(([axis1Value, axis2Groups]) => ({
            axis1Value,
            axis2Data: Object.entries(axis2Groups).map(([axis2Value, group]) => ({
                axis2Value,
                value: group.values.reduce((a, b) => a + b, 0) / group.values.length
            }))
        }));
    }, [processedData, config]);

    const heatmapData = useMemo(() => {
        const uniqueAxis1Values = Array.from(new Set(chartData.map(d => d.axis1Value)));
        const uniqueAxis2Values = Array.from(new Set(chartData.flatMap(d => d.axis2Data.map(d2 => d2.axis2Value))));
        
        return uniqueAxis1Values.map(axis1Value => ({
            axis1Value,
            values: uniqueAxis2Values.map(axis2Value => {
                const dataPoint = chartData.find(d => d.axis1Value === axis1Value)
                    ?.axis2Data.find(d2 => d2.axis2Value === axis2Value);
                return dataPoint?.value || 0;
            })
        }));
    }, [chartData]);

    const calculateDistribution = (values: number[]): DistributionData[] => {
        if (values.length === 0) return [];

        // Calculate mean and standard deviation
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        // Create histogram bins
        const binCount = 20;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const binWidth = (max - min) / binCount;
        
        // Handle case where all values are the same
        if (binWidth === 0) {
            return [{
                value: min,
                count: values.length,
                gaussianValue: values.length
            }];
        }

        const bins = Array(binCount).fill(0).map((_, i) => ({
            start: min + i * binWidth,
            end: min + (i + 1) * binWidth,
            count: 0
        }));

        // Fill bins
        values.forEach(value => {
            let binIndex = Math.floor((value - min) / binWidth);
            // Handle edge case where value equals max
            if (value === max) {
                binIndex = binCount - 1;
            }
            // Ensure binIndex is within bounds
            binIndex = Math.max(0, Math.min(binIndex, binCount - 1));
            bins[binIndex].count++;
        });

        // Calculate Gaussian curve
        return bins.map(bin => {
            const binCenter = (bin.start + bin.end) / 2;
            const gaussianValue = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * 
                Math.exp(-Math.pow(binCenter - mean, 2) / (2 * variance)) * 
                values.length * binWidth;
            
            return {
                value: binCenter,
                count: bin.count,
                gaussianValue
            };
        });
    };

    const distributionData = useMemo(() => {
        if (config.visualizationType !== 'distribution') return null;

        // Group data by the selected comparison axis
        const groupedData = processedData.reduce((acc, data) => {
            const axisValue = getComparisonValue(data, config.comparisonAxes[0]);
            if (!acc[axisValue]) {
                acc[axisValue] = [];
            }
            acc[axisValue].push(getValueForType(data, config.valueType));
            return acc;
        }, {} as Record<string, number[]>);

        // Calculate distribution for each group
        return Object.entries(groupedData).map(([axisValue, values]) => ({
            axisValue,
            distribution: calculateDistribution(values)
        }));
    }, [processedData, config]);

    if (!active) return null;

    return (
        <div className="p-4">
            <div className="mb-4">
                <h2 className="text-xl font-bold mb-4">Analyse d&apos;Optimisation</h2>
                
                {/* Configuration Controls
                <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Type de valeur</label>
                        <select 
                            className="select select-bordered w-full"
                            value={config.valueType}
                            onChange={(e) => setConfig(prev => ({ ...prev, valueType: e.target.value as AnalysisConfig['valueType'] }))}
                        >
                            <option value="price">Prix</option>
                            <option value="pricePerWeight">Prix/Poids</option>
                            <option value="volume">Volume</option>
                            <option value="weightPerVolume">Poids/Volume</option>
                            <option value="pricePerVolume">Prix/Volume</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Type de visualisation</label>
                        <select 
                            className="select select-bordered w-full"
                            value={config.visualizationType}
                            onChange={(e) => setConfig(prev => ({ ...prev, visualizationType: e.target.value as '1D' | '2D' | 'distribution' }))}
                        >
                            <option value="1D">Graphique 1D</option>
                            <option value="2D">Heatmap 2D</option>
                            <option value="distribution" disabled={true}>Distribution</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Axe de comparaison 1</label>
                        <select 
                            className="select select-bordered w-full"
                            value={config.comparisonAxes[0]}
                            onChange={(e) => setConfig(prev => ({ 
                                ...prev, 
                                comparisonAxes: [e.target.value, prev.comparisonAxes[1]]
                            }))}
                        >
                            <option value="date">Date</option>
                            <option value="prestataire">Prestataire</option>
                            <option value="codeTraitement">Code de traitement</option>
                            <option value="codeCED">Code CED</option>
                            <option value="filiere">Filière</option>
                            <option value="siteEmetteur">Site émetteur</option>
                            <option value="siteTransporteur">Site transporteur</option>
                            <option value="siteDestinataire">Site destinataire</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Axe de comparaison 2</label>
                        <select 
                            className="select select-bordered w-full"
                            value={config.comparisonAxes[1]}
                            onChange={(e) => setConfig(prev => ({ 
                                ...prev, 
                                comparisonAxes: [prev.comparisonAxes[0], e.target.value]
                            }))}
                        >
                            <option value="date">Date</option>
                            <option value="prestataire">Prestataire</option>
                            <option value="codeTraitement">Code de traitement</option>
                            <option value="codeCED">Code CED</option>
                            <option value="filiere">Filière</option>
                            <option value="siteEmetteur">Site émetteur</option>
                            <option value="siteTransporteur">Site transporteur</option>
                            <option value="siteDestinataire">Site destinataire</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Chart Display
            <div className="bg-white p-4 rounded-lg shadow">
                {config.visualizationType === '1D' && (
                    <Bar
                        data={{
                            labels: chartData.map(d => d.axis1Value),
                            datasets: chartData[0]?.axis2Data.map((_, index) => ({
                                label: chartData[0].axis2Data[index].axis2Value,
                                data: chartData.map(d => d.axis2Data[index]?.value || 0),
                                backgroundColor: tailwindToRgb(`blue-${(index + 1) * 100}`)
                            })) || []
                        }}
                        options={{
                            responsive: true,
                            plugins: {
                                title: {
                                    display: true,
                                    text: `Analyse par ${config.comparisonAxes.join(' - ')}`
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true
                                }
                            }
                        }}
                    />
                )}

                {config.visualizationType === '2D' && (
                    <div className="overflow-x-auto">
                        <table className="table table-bordered">
                            <thead>
                                <tr>
                                    <th>{config.comparisonAxes[0]}</th>
                                    {Array.from(new Set(chartData.flatMap(d => d.axis2Data.map(d2 => d2.axis2Value)))).map(axis2Value => (
                                        <th key={axis2Value}>{axis2Value}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {heatmapData.map(row => (
                                    <tr key={row.axis1Value}>
                                        <td>{row.axis1Value}</td>
                                        {row.values.map((value, index) => (
                                            <td 
                                                key={index}
                                                style={{
                                                    backgroundColor: `rgba(59, 130, 246, ${Math.min(value / Math.max(...heatmapData.flatMap(r => r.values)), 1)})`
                                                }}
                                            >
                                                {value.toFixed(2)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {config.visualizationType === 'distribution' && distributionData && (
                    <div className="space-y-8">
                        {distributionData.map(({ axisValue, distribution }) => (
                            <div key={axisValue} className="border-b pb-8">
                                <h3 className="text-lg font-semibold mb-4">{axisValue}</h3>
                                <Bar
                                    data={{
                                        labels: distribution.map(d => d.value.toFixed(2)),
                                        datasets: [
                                            {
                                                label: 'Distribution',
                                                data: distribution.map(d => d.count),
                                                backgroundColor: tailwindToRgb('blue-500'),
                                                type: 'bar' as const
                                            },
                                            {
                                                label: 'Courbe de Gauss',
                                                data: distribution.map(d => d.gaussianValue),
                                                borderColor: tailwindToRgb('red-500'),
                                                backgroundColor: 'transparent',
                                                type: 'bar' as const,
                                                barPercentage: 0
                                            }
                                        ]
                                    }}
                                    options={{
                                        responsive: true,
                                        plugins: {
                                            title: {
                                                display: true,
                                                text: `Distribution des valeurs pour ${axisValue}`
                                            }
                                        },
                                        scales: {
                                            y: {
                                                beginAtZero: true
                                            }
                                        }
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default OptiTab;
*/