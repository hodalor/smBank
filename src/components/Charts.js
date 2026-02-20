import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);

const gh = (n) => Number(n || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });

export function SavingsLine({ series, height = 56 }) {
  const labels = series.map(s => s.date);
  const data = {
    labels,
    datasets: [
      { label: 'Deposits', data: series.map(s => s.deposits), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.2)', tension: 0.3 },
      { label: 'Withdrawals', data: series.map(s => s.withdrawals), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.2)', tension: 0.3 }
    ]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${gh(ctx.parsed.y)}` } } },
    scales: { y: { grid: { lineWidth: 0.4 }, ticks: { callback: (v) => gh(v) } } },
    layout: { padding: 8 }
  };
  return <div style={{ height: 240 }}><Line data={data} options={options} height={height} /></div>;
}

export function LoansBar({ months, height = 56 }) {
  const labels = months.map(m => m.month);
  const data = {
    labels,
    datasets: [
      { label: 'Disbursed', data: months.map(m => m.disbursed), backgroundColor: '#3b82f6' },
      { label: 'Repaid', data: months.map(m => m.repaid), backgroundColor: '#22c55e' },
      ...(months.some(m => typeof m.writtenOff === 'number') ? [{ label: 'Written Off', data: months.map(m => m.writtenOff || 0), backgroundColor: '#f59e0b' }] : [])
    ]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${gh(ctx.parsed.y)}` } } },
    scales: { y: { grid: { lineWidth: 0.4 }, ticks: { callback: (v) => gh(v) } } },
    layout: { padding: 8 }
  };
  return <div style={{ height: 240 }}><Bar data={data} options={options} height={height} /></div>;
}

export function LoanStatusDoughnut({ counts, height = 56 }) {
  const labels = Object.keys(counts);
  const values = Object.values(counts);
  const data = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: ['#f59e0b', '#2563eb', '#22c55e', '#64748b', '#ef4444']
    }]
  };
  const options = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } };
  return <div style={{ height: 220 }}><Doughnut data={data} options={options} height={height} /></div>;
}
