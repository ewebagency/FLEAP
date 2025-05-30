import { useAnalysis } from "@/app/analysis/AnalysisProvider";
import { Facture } from "../types";
import { DynamicCharts } from '../../MetaComponent/ChartWrapper';
import { tailwindToRgb } from '../../MetaComponent/Colours';
import { getMappingTableFiliere } from '@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Context } from 'chartjs-plugin-datalabels';
import { ChartOptions } from 'chart.js';
import { useEffect, useState } from "react";
import { useSession } from "@/app/component/SessionProvider";
import { useFilterContext } from '@/app/FilterContext';

const { Bar } = DynamicCharts;

const ced_REP = [
    {
      "filiere": "Emballages ménagers",
      "codes_ced": ["15 01 01", "15 01 02", "15 01 04", "15 01 05", "15 01 06", "15 01 07", "15 01 09"]
    },
    {
      "filiere": "Déchets d'Équipements Électriques et Électroniques (DEEE)",
      "codes_ced": ["16 02 13", "16 02 14", "20 01 35", "20 01 36"]
    },
    {
      "filiere": "Piles et accumulateurs",
      "codes_ced": ["16 06 01*", "16 06 02*", "16 06 04"]
    },
    {
      "filiere": "Papiers graphiques",
      "codes_ced": ["20 01 01", "03 03 08", "03 03 10"]
    },
    {
      "filiere": "Textiles",
      "codes_ced": ["20 01 10", "20 01 11"]
    },
    {
      "filiere": "Meubles (DEA)",
      "codes_ced": ["20 03 07", "15 01 03", "20 01 38", "20 01 39"]
    },
    {
      "filiere": "Déchets du bâtiment (PMCB)",
      "codes_ced": ["17 01 01", "17 01 07", "17 02 01", "17 02 03", "17 06 04", "17 09 04", "17 05 04"]
    },
    {
      "filiere": "Jouets, articles de sport, bricolage et jardin",
      "codes_ced": ["20 01 39", "20 01 40", "20 01 38", "20 03 01"]
    }
  ];
  

const RepComponent = ({factures, financier_or_tonnage}: {factures: Facture[], financier_or_tonnage: "financier" | "tonnage"}) => {
  const { bsds } = useAnalysis();
  const {entreprise_id} = useSession();
  const { filieres } = useFilterContext();
  const [mappingTable, setMappingTable] = useState<{ced: string, filiere: string}[]>([]);

  // Fonction utilitaire pour normaliser les codes CED
  const normalizeCedCode = (code: string) => {
    return code.replaceAll(' ', '').replace('*', '').trim();
  };

  useEffect(() => {
    const fetchMappingTable = async () => {
        if (entreprise_id) {
            const mapping = await getMappingTableFiliere(entreprise_id);
            setMappingTable(mapping || []);
        }
    };
    fetchMappingTable();
  }, [entreprise_id]);

  const all_ced_rep = ced_REP.flatMap((filiere) => filiere.codes_ced);
  
  const bsds_theorique_in_rep = bsds.filter((bsd) => {
    const bsdCode = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code;
    return bsdCode && all_ced_rep.some(ced => normalizeCedCode(ced) === normalizeCedCode(bsdCode));
  });
  const tonnage_theorique_in_rep = bsds_theorique_in_rep.reduce((acc, bsd) => acc + bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity, 0);

  const bsds_realise_in_rep = bsds.filter((bsd) => {
    const bsdCode = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code;
    return bsdCode && all_ced_rep.some(ced => normalizeCedCode(ced) === normalizeCedCode(bsdCode)) && bsd.other_infos?.rep?.sent_to_rep;
  });
  const tonnage_realise_in_rep = bsds_realise_in_rep.reduce((acc, bsd) => acc + bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity, 0);

  const part_realise_in_rep = tonnage_theorique_in_rep > 0 ? tonnage_realise_in_rep / tonnage_theorique_in_rep : 0;

  const lines_factures = factures.flatMap((facture) => facture.infos_json.departs);
  const lines_in_rep = lines_factures.filter((line) => 
    all_ced_rep.some(ced => normalizeCedCode(ced) === normalizeCedCode(line.line_header.code_dechet))
  );
  const montant_financier_theorique_in_rep = lines_in_rep.reduce((acc, line) => acc + line.line_body.filter((l) => l.type_operation === "Traitement").reduce((acc, l) => acc + l.montant_ht, 0), 0);

  const montant_financier_realise_in_rep = montant_financier_theorique_in_rep * part_realise_in_rep;

  // Calculate data by filière
  const dataByFiliere = all_ced_rep.map(ced => {
    const bsds_theorique = bsds.filter(bsd => {
      const bsdCode = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code;
      return bsdCode && normalizeCedCode(ced) === normalizeCedCode(bsdCode);
    });
    const bsds_realise = bsds.filter(bsd => {
      const bsdCode = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code;
      return bsdCode && normalizeCedCode(ced) === normalizeCedCode(bsdCode) && bsd.other_infos?.rep?.sent_to_rep;
    });

    const tonnage_theorique = bsds_theorique.reduce((acc, bsd) => 
      acc + (bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity || 0), 0
    );
    const tonnage_realise = bsds_realise.reduce((acc, bsd) => 
      acc + (bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity || 0), 0
    );

    // Calculate financial data
    const lines_factures = factures.flatMap(facture => facture.infos_json.departs);
    const lines_in_rep = lines_factures.filter(line => 
      ced.includes(line.line_header.code_dechet)
    );
    
    const montant_theorique = lines_in_rep.reduce((acc, line) => 
      acc + line.line_body.filter(l => l.type_operation === "Traitement")
        .reduce((sum, l) => sum + l.montant_ht, 0), 0
    );
    
    const part_realise = tonnage_theorique > 0 ? tonnage_realise / tonnage_theorique : 0;
    const montant_realise = montant_theorique * part_realise;

    // Get the mapped filière from the CED code
    const mappedFiliere = mappingTable.find(m => 
      m.ced.replaceAll(' ', '').replace('*', '').trim() === 
      ced.replaceAll(' ', '').replace('*', '').trim()
    )?.filiere || 'Autres';

    return {
      filiere: mappedFiliere,
      ced: ced,
      tonnage_theorique,
      tonnage_realise,
      montant_theorique,
      montant_realise
    };
  });

  
  const tonnageChartData = {
    labels: ['Atteignable', 'Réalisé'],
    datasets: dataByFiliere.map(d => {
      const filiereColor = filieres.find(f => f.name === d.filiere)?.color || '#000000';
      const color = tailwindToRgb(filiereColor);
      return {
        label: d.filiere,
        data: [d.tonnage_theorique, d.tonnage_realise],
        backgroundColor: color,
        borderRadius: 4
      };
    })
  };

  const financierChartData = {
    labels: ['Atteignable', 'Réalisé'],
    datasets: dataByFiliere.map(d => {
      const filiereColor = filieres.find(f => f.name === d.filiere)?.color || '#000000';
      const color = tailwindToRgb(filiereColor);
      return {
        label: d.filiere,
        data: [d.montant_theorique, d.montant_realise],
        backgroundColor: color,
        borderRadius: 4
      };
    })
  };

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        display: false
      },
      title: {
        display: true,
        text: financier_or_tonnage === "tonnage" ? 'Tonnage passé par la REP' : 'Montant passé par la REP',
        color: 'gray',
        align: 'center' as const,
        padding: {
          top: 10,
          bottom: 10
        },
        font: {
          size: 14,
          weight: 'normal' as const
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const value = context.raw as number;
            return `${context.dataset.label}: ${financier_or_tonnage === "tonnage" 
              ? `${value.toFixed(2)} T`
              : `${value.toLocaleString('fr-FR')} €`}`;
          }
        }
      },
      datalabels: {
        display(context) {
          // Afficher uniquement pour la barre "Réalisé" et uniquement pour le premier dataset
          if (context.dataIndex === 1 && context.datasetIndex === 0) {
            const datasets = context.chart.data.datasets;
            const totalAtteignable = datasets.reduce((sum, dataset) => sum + (dataset.data[0] as number), 0);
            const totalRealise = datasets.reduce((sum, dataset) => sum + (dataset.data[1] as number), 0);
            const difference = totalAtteignable - totalRealise;
            
            if (difference > 0) {
              return true;
            }
          }
          return false;
        },
        color: 'black',
        font: {
          weight: 'normal' as const,
          size: 14
        },
        formatter(value: number, context) {
          const datasets = context.chart.data.datasets;
          const totalAtteignable = datasets.reduce((sum, dataset) => sum + (dataset.data[0] as number), 0);
          const totalRealise = datasets.reduce((sum, dataset) => sum + (dataset.data[1] as number), 0);
          const difference = totalAtteignable - totalRealise;
          
          const text = financier_or_tonnage === "tonnage"
            ? `${difference.toFixed(2)} T restantes en passant par la REP`
            : `${difference.toLocaleString('fr-FR')} € restants en passant par la REP`;

          // Diviser le texte en plusieurs lignes si nécessaire
          const maxLength = 12;
          if (text.length > maxLength) {
            const words = text.split(' ');
            const lines = [];
            let currentLine = '';
            
            words.forEach(word => {
              if ((currentLine + ' ' + word).length <= maxLength) {
                currentLine += (currentLine ? ' ' : '') + word;
              } else {
                lines.push(currentLine);
                currentLine = word;
              }
            });
            if (currentLine) {
              lines.push(currentLine);
            }
            return lines;
          }
          
          return text;
        },
        anchor: 'end',
        align: 'top',
        offset: 90,
        textAlign: 'center'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: financier_or_tonnage === "tonnage" ? 'Tonnes' : 'Euros'
        },
        stacked: true
      },
      x: {
        stacked: true
      }
    }
  };

  return (
    <div className="mt-5">
      <div style={{ height: '300px' }}>
        <Bar 
          data={financier_or_tonnage === "tonnage" ? tonnageChartData : financierChartData} 
          options={chartOptions} 
          plugins={[ChartDataLabels]} 
        />
      </div>
    </div>
  );
};

export default RepComponent;