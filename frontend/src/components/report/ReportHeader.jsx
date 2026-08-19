import { ArrowLeft, Download, Printer, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const exportOptions = [
  { id: 'csv', label: 'CSV' },
  { id: 'excel', label: 'Excel' },
  { id: 'pdf', label: 'PDF' },
  { id: 'print', label: 'Print', icon: Printer },
];

export default function ReportHeader({ title, subtitle, onRefresh, onExport, loading }) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/college')}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-cyan-300 hover:text-cyan-700"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-600">College Dashboard</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{subtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 shadow-sm transition hover:border-cyan-300 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <div className="group relative">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-sm transition hover:bg-cyan-700"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              <div className="invisible absolute right-0 z-20 mt-2 w-36 rounded-lg border border-slate-200 bg-white p-1 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100">
                {exportOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onExport(option.id)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-700 hover:bg-cyan-50 hover:text-cyan-800"
                    >
                      {Icon ? <Icon className="h-4 w-4" /> : <span className="h-4 w-4" />}
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
