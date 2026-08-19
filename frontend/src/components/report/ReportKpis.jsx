export default function ReportKpis({ items }) {
  if (!items?.length) return null;

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
          <p className="mt-2 font-serif text-2xl font-black italic tracking-tight text-slate-950">{item.value}</p>
          {item.note ? <p className="mt-1 text-xs font-semibold text-slate-500">{item.note}</p> : null}
        </div>
      ))}
    </section>
  );
}
