import { ALL_VALUE } from '../../utils/report/reportFormatters';

const dateRanges = [
  { value: ALL_VALUE, label: 'All Dates' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'previousMonth', label: 'Previous Month' },
];

export default function ReportFilters({ filters, values, options, onChange, onReset }) {
  if (!filters.length) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {filters.map((filter) => (
          <label key={filter.key} className="flex flex-col gap-2.5 text-xs font-black uppercase tracking-[0.18em] text-slate-700">
            {filter.label}
            {filter.type === 'number' ? (
              <input
                type="number"
                value={values[filter.key] ?? filter.defaultValue ?? ''}
                onChange={(event) => onChange(filter.key, event.target.value)}
                className="h-11 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              />
            ) : (
              <select
                value={values[filter.key] ?? ALL_VALUE}
                onChange={(event) => onChange(filter.key, event.target.value)}
                className="h-11 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              >
                {(filter.key === 'dateRange' ? dateRanges : [{ value: ALL_VALUE, label: 'All' }, ...(options[filter.key] || [])]).map((option) => {
                  const normalizedOption = typeof option === 'string' ? { value: option, label: option } : option;
                  return (
                    <option key={normalizedOption.value} value={normalizedOption.value}>{normalizedOption.label}</option>
                  );
                })}
              </select>
            )}
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {filters
          .filter((filter) => values[filter.key] && values[filter.key] !== ALL_VALUE)
          .map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => onChange(filter.key, ALL_VALUE)}
              className="rounded-full bg-cyan-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-800"
            >
              {filter.label}: {values[filter.key]} x
            </button>
          ))}
        <button type="button" onClick={onReset} className="ml-auto text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 hover:text-slate-950">
          Reset Filters
        </button>
      </div>
    </section>
  );
}
