import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export default function ReportChart({ title, type = 'bar', data, xKey = 'label', yKey = 'value', xLabel, yLabel, onPointClick }) {
  if (!data?.length) return null;

  const commonAxis = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
      <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: '#475569' }} label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -4, fill: '#64748b', fontSize: 12 } : undefined} />
      <YAxis tick={{ fontSize: 12, fill: '#475569' }} label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 } : undefined} />
      <Tooltip />
    </>
  );

  const renderChart = () => {
    if (type === 'line') {
      return (
        <LineChart data={data} margin={{ top: 20, right: 24, left: 12, bottom: 24 }} onClick={(event) => event?.activePayload?.[0] && onPointClick?.(event.activePayload[0].payload)}>
          {commonAxis}
          <Line type="monotone" dataKey={yKey} stroke="#0891b2" strokeWidth={3} dot={{ r: 4 }} />
        </LineChart>
      );
    }
    if (type === 'area') {
      return (
        <AreaChart data={data} margin={{ top: 20, right: 24, left: 12, bottom: 24 }} onClick={(event) => event?.activePayload?.[0] && onPointClick?.(event.activePayload[0].payload)}>
          {commonAxis}
          <Area type="monotone" dataKey={yKey} stroke="#0891b2" fill="#cffafe" strokeWidth={3} />
        </AreaChart>
      );
    }
    if (type === 'donut') {
      return (
        <PieChart onClick={(event) => event?.payload && onPointClick?.(event.payload)}>
          <Pie data={data} dataKey={yKey} nameKey={xKey} innerRadius={58} outerRadius={95} paddingAngle={2}>
            {data.map((entry, index) => <Cell key={`${entry.label}-${index}`} fill={entry.fill || '#0891b2'} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      );
    }
    return (
      <BarChart data={data} layout={type === 'horizontal' ? 'vertical' : 'horizontal'} margin={{ top: 20, right: 24, left: type === 'horizontal' ? 72 : 12, bottom: 24 }} onClick={(event) => event?.activePayload?.[0] && onPointClick?.(event.activePayload[0].payload)}>
        {type === 'horizontal' ? (
          <>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 12, fill: '#475569' }} label={yLabel ? { value: yLabel, position: 'insideBottom', offset: -4, fill: '#64748b', fontSize: 12 } : undefined} />
            <YAxis type="category" dataKey={xKey} tick={{ fontSize: 12, fill: '#475569' }} width={90} />
            <Tooltip />
          </>
        ) : commonAxis}
        <Bar dataKey={yKey} radius={[6, 6, 0, 0]}>
          {data.map((entry, index) => <Cell key={`${entry.label}-${index}`} fill={entry.fill || '#0891b2'} />)}
        </Bar>
      </BarChart>
    );
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h2>
      <div className="mt-4 h-80 w-full">
        <ResponsiveContainer>{renderChart()}</ResponsiveContainer>
      </div>
    </section>
  );
}
