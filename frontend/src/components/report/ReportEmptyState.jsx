export default function ReportEmptyState({ title = 'No Data Found', message = 'This report has no saved database records for the selected filters.' }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
      <h3 className="font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h3>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{message}</p>
    </div>
  );
}
