export default function ReportInsights({ insights }) {
  if (!insights?.length) return null;

  return (
    <section className="grid gap-3 md:grid-cols-3">
      {insights.map((insight, index) => (
        <div key={`${insight.title || 'insight'}-${index}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-700">{insight.title}</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">{insight.text}</p>
        </div>
      ))}
    </section>
  );
}
