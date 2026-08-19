export const exportRows = (format, fileName, rows, columns) => {
  if (format === 'print') {
    window.print();
    return;
  }

  if (!rows.length) return;
  if (format === 'excel') {
    downloadBlob(`${fileName}.xls`, buildExcelHtml(rows, columns), 'application/vnd.ms-excel');
    return;
  }
  if (format === 'pdf') {
    window.print();
    return;
  }
  downloadBlob(`${fileName}.csv`, buildCsv(rows, columns), 'text/csv;charset=utf-8;');
};

const buildCsv = (rows, columns) => [
  columns.map((column) => column.label).join(','),
  ...rows.map((row) => columns.map((column) => escapeCsv(row[column.key])).join(',')),
].join('\n');

const buildExcelHtml = (rows, columns) => `
  <table>
    <thead><tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column.key])}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
`;

const downloadBlob = (fileName, content, type) => {
  const blob = new Blob([content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
};

const escapeCsv = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (match) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[match]));
