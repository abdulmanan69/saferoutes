// Convert an array of objects to CSV and trigger a browser download.
export const downloadCSV = (rows, filename = 'export.csv', columns) => {
    if (!rows || !rows.length) return;
    const cols = columns || Object.keys(rows[0]);
    const escape = (val) => {
        const s = val === null || val === undefined ? '' : String(val);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = cols.map(c => escape(c.label || c.key || c)).join(',');
    const body = rows.map(row =>
        cols.map(c => {
            const key = c.key || c;
            return escape(c.format ? c.format(row[key], row) : row[key]);
        }).join(',')
    ).join('\n');

    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};
