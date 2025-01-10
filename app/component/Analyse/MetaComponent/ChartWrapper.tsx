import dynamic from 'next/dynamic';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement, Filler, ChartTypeRegistry, TooltipItem as BaseTooltipItem} from 'chart.js';

// Enregistrer Chart.js uniquement côté client
if (typeof window !== 'undefined') {
  ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Tooltip,
    Legend,
    Title,
    PointElement,
    LineElement,
    Filler
  );
}

// Exporter ChartJS pour l'utilisation comme valeur
export { ChartJS };

// Exporter tous les types nécessaires
export type {
  Chart,
  ChartOptions,
  ChartData,
  ChartType,
  ChartTypeRegistry,
  TooltipItem as BaseTooltipItem,
  LegendElement,
  Plugin
} from 'chart.js';

// Réexporter TooltipItem avec un type par défaut
export type TooltipItem<TType extends keyof ChartTypeRegistry = keyof ChartTypeRegistry> = BaseTooltipItem<TType>;

// Exporter les composants dynamiques
export const DynamicCharts = {
  Bar: dynamic(() => import('react-chartjs-2').then(mod => mod.Bar), { ssr: false }),
  Line: dynamic(() => import('react-chartjs-2').then(mod => mod.Line), { ssr: false }),
  Pie: dynamic(() => import('react-chartjs-2').then(mod => mod.Pie), { ssr: false }),
  Doughnut: dynamic(() => import('react-chartjs-2').then(mod => mod.Doughnut), { ssr: false })
}; 