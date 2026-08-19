export const ALL_VALUE = 'all';

export const normalize = (value) => String(value ?? '').trim().toLowerCase();

export const compactNumber = (value) => new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(Number(value) || 0);

export const formatCurrency = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

export const formatPercent = (value) => `${Math.round(Number(value) || 0)}%`;

export const fullName = (person) => `${person?.firstName || ''} ${person?.lastName || ''}`.trim() || person?.name || 'Unnamed';

export const dateKey = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
};

export const monthKey = (value) => {
  const text = String(value || '');
  const matched = text.match(/\d{4}-\d{2}/);
  return matched?.[0] || dateKey(value).slice(0, 7);
};

export const uniqueSorted = (values) => [...new Set(values.filter(Boolean).map(String))].sort((a, b) => a.localeCompare(b));

export const sumBy = (rows, key) => rows.reduce((sum, row) => sum + (Number(row?.[key]) || 0), 0);

export const countBy = (rows, getKey) => rows.reduce((map, row) => {
  const key = getKey(row) || 'Not Added';
  map.set(key, (map.get(key) || 0) + 1);
  return map;
}, new Map());

export const mapToChartRows = (map, limit = 14) => [...map.entries()]
  .map(([label, value]) => ({ label, value }))
  .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
  .slice(0, limit);

export const withColors = (rows) => rows.map((row, index) => ({
  ...row,
  fill: CHART_COLORS[index % CHART_COLORS.length],
}));

export const inDateRange = (value, range) => {
  if (!range || range === ALL_VALUE) return true;
  const key = dateKey(value);
  if (!key) return false;
  const date = new Date(`${key}T00:00:00`);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysAgo = (days) => new Date(startOfToday.getTime() - days * 86400000);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const previousMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  if (range === 'today') return date.getTime() === startOfToday.getTime();
  if (range === 'yesterday') return date.getTime() === daysAgo(1).getTime();
  if (range === 'last7') return date >= daysAgo(7) && date <= startOfToday;
  if (range === 'last30') return date >= daysAgo(30) && date <= startOfToday;
  if (range === 'thisMonth') return date >= startOfMonth;
  if (range === 'previousMonth') return date >= previousMonthStart && date <= previousMonthEnd;
  if (range === 'academicSession') return true;
  return true;
};

export const CHART_COLORS = ['#0891b2', '#0f172a', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6'];
