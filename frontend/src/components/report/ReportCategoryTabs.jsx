export default function ReportCategoryTabs({ categories, activeCategory, onChange }) {
  return (
    <div className="sticky top-[116px] z-40 overflow-x-auto border-b border-slate-200 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl gap-2 px-4 py-3 sm:px-6 lg:px-8">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onChange(category.id)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] transition ${
              activeCategory === category.id
                ? 'bg-slate-950 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-cyan-50 hover:text-cyan-800'
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>
    </div>
  );
}
