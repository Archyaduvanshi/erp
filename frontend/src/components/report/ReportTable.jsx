import { ArrowDownUp, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

const pageSizes = [10, 25, 50, 100];

export default function ReportTable({ rows, columns, title, pagination, onPageChange, onPageSizeChange }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: columns[0]?.key, direction: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const serverPaged = Boolean(pagination);
  const currentPageSize = serverPaged ? Number(pagination.size || pageSize) : pageSize;

  const filteredRows = useMemo(() => {
    const text = query.trim().toLowerCase();
    const searched = text
      ? rows.filter((row) => columns.some((column) => String(row[column.key] ?? '').toLowerCase().includes(text)))
      : rows;

    if (!sort.key) return searched;
    return [...searched].sort((a, b) => {
      const left = a[sort.key];
      const right = b[sort.key];
      const leftNumber = Number(left);
      const rightNumber = Number(right);
      const compare = Number.isFinite(leftNumber) && Number.isFinite(rightNumber)
        ? leftNumber - rightNumber
        : String(left ?? '').localeCompare(String(right ?? ''));
      return sort.direction === 'asc' ? compare : -compare;
    });
  }, [columns, query, rows, sort]);

  const totalRecords = serverPaged ? Number(pagination.totalElements || rows.length) : filteredRows.length;
  const totalPages = serverPaged ? Number(pagination.totalPages || 1) : Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = serverPaged ? Number(pagination.number || 0) + 1 : Math.min(page, totalPages);
  const visibleRows = serverPaged ? filteredRows : filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const updateSort = (key) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h2>
          <p className="mt-1 text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">{totalRecords} records</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (serverPaged) {
                onPageChange?.(0);
              } else {
                setPage(1);
              }
            }}
            placeholder="Search table"
            className="h-10 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="whitespace-nowrap px-4 py-3">
                  <button type="button" onClick={() => updateSort(column.key)} className="inline-flex items-center gap-1">
                    {column.label}
                    <ArrowDownUp className="h-3.5 w-3.5" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((row, index) => (
              <tr key={row.id || `${safePage}-${index}`} className="hover:bg-cyan-50/45">
                {columns.map((column) => (
                  <td key={column.key} className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">
                    {column.render ? column.render(row[column.key], row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <select
          value={currentPageSize}
          onChange={(event) => {
            const nextSize = Number(event.target.value);
            if (serverPaged) {
              onPageSizeChange?.(nextSize);
            } else {
              setPageSize(nextSize);
              setPage(1);
            }
          }}
          className="h-9 w-28 rounded-md border border-slate-200 bg-white px-2 text-sm font-bold"
        >
          {pageSizes.map((size) => <option key={size} value={size}>{size} rows</option>)}
        </select>
        <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
          Page {safePage} of {totalPages}
          <button
            type="button"
            onClick={() => {
              if (serverPaged) {
                onPageChange?.(Math.max(0, safePage - 2));
              } else {
                setPage((value) => Math.max(1, value - 1));
              }
            }}
            className="rounded-md border border-slate-200 p-2 disabled:opacity-40"
            disabled={safePage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (serverPaged) {
                onPageChange?.(Math.min(totalPages - 1, safePage));
              } else {
                setPage((value) => Math.min(totalPages, value + 1));
              }
            }}
            className="rounded-md border border-slate-200 p-2 disabled:opacity-40"
            disabled={safePage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
