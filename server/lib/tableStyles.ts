export const TABLE_STYLES = {
  headerBg: '#2c3e50',
  headerText: '#ffffff',
  headerFont: 'font-weight: bold; font-size: 10pt; font-family: Arial, sans-serif;',

  evenRowBg: '#ffffff',
  oddRowBg: '#f8f9fa',

  border: '1px solid #dee2e6',
  headerBorder: '1px solid #2c3e50',

  cellPadding: 'padding: 8px 12px;',

  tableBase: 'width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; font-family: Arial, sans-serif;',

  totalRowBg: '#f0f0f0',
};

export interface StyledColumn {
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface StyledRow {
  cells: string[];
  isBold?: boolean;
  isTotal?: boolean;
}

export function buildStyledTable(options: {
  columns: StyledColumn[];
  rows: StyledRow[];
  caption?: string;
}): string {
  const { columns, rows, caption } = options;

  const headerCells = columns.map(col => {
    const width = col.width ? `width: ${col.width};` : '';
    const align = col.align ? `text-align: ${col.align};` : 'text-align: left;';
    return `<th style="background-color: ${TABLE_STYLES.headerBg}; color: ${TABLE_STYLES.headerText}; ${TABLE_STYLES.headerFont} ${TABLE_STYLES.cellPadding} ${width} ${align} border-bottom: 2px solid ${TABLE_STYLES.headerBg}; border: ${TABLE_STYLES.headerBorder};">${col.header}</th>`;
  }).join('');

  const bodyRows = rows.map((row, idx) => {
    const bgColor = row.isTotal
      ? TABLE_STYLES.totalRowBg
      : idx % 2 === 0 ? TABLE_STYLES.evenRowBg : TABLE_STYLES.oddRowBg;
    const fontWeight = (row.isBold || row.isTotal) ? 'font-weight: bold;' : '';
    const borderStyle = row.isTotal ? TABLE_STYLES.headerBorder : TABLE_STYLES.border;
    const cells = row.cells.map((cell, colIdx) => {
      const align = columns[colIdx]?.align ? `text-align: ${columns[colIdx].align};` : 'text-align: left;';
      const width = columns[colIdx]?.width ? `width: ${columns[colIdx].width};` : '';
      return `<td style="background-color: ${bgColor}; ${TABLE_STYLES.cellPadding} ${fontWeight} ${align} ${width} border-bottom: ${borderStyle}; border-left: ${borderStyle}; border-right: ${borderStyle};">${cell}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  let html = '';
  if (caption) {
    html += `<p style="font-weight: bold; font-size: 11pt; margin-bottom: 4px;">${caption}</p>`;
  }
  html += `<table style="${TABLE_STYLES.tableBase}">`;
  html += `<thead><tr>${headerCells}</tr></thead>`;
  html += `<tbody>${bodyRows}</tbody>`;
  html += `</table>`;
  return html;
}

export function buildSignatureBlock(options: {
  leftTitle: string;
  rightTitle: string;
  companyName: string;
  clientName?: string;
  clientSignerName?: string;
  clientTitle?: string;
  compact?: boolean;
}): string {
  const { leftTitle, rightTitle, companyName, clientName, clientSignerName, clientTitle, compact } = options;
  const lineStyle = 'border-bottom: 1px solid #000; margin-bottom: 4pt; height: 20pt;';
  const labelStyle = 'font-size: 9pt; color: #666; margin-bottom: 2pt;';
  const spacing = compact ? 'padding: 8pt;' : 'padding: 12pt;';

  return `
    <div class="signature-section" style="margin-top: 48pt; page-break-inside: avoid;">
      <table style="width: 100%; border: none; margin-top: 24pt;">
        <tr>
          <td style="width: 47%; border: none; vertical-align: top; ${spacing}">
            <div style="font-weight: bold; color: #1a73e8; margin-bottom: 8pt;">${leftTitle}</div>
            <div style="font-weight: bold; margin-bottom: 24pt;">${companyName}</div>
            <div style="${lineStyle}"></div>
            <div style="${labelStyle}">Signature</div>
            <div style="margin-top: 16pt; ${lineStyle}"></div>
            <div style="${labelStyle}">Name (Print)</div>
            <div style="margin-top: 16pt; ${lineStyle}"></div>
            <div style="${labelStyle}">Title</div>
            <div style="margin-top: 16pt; ${lineStyle}"></div>
            <div style="${labelStyle}">Date</div>
          </td>
          <td style="width: 6%; border: none;"></td>
          <td style="width: 47%; border: none; vertical-align: top; ${spacing}">
            <div style="font-weight: bold; color: #1a73e8; margin-bottom: 8pt;">${rightTitle}</div>
            <div style="font-weight: bold; margin-bottom: 24pt;">${clientName || ''}</div>
            <div style="${lineStyle}"></div>
            <div style="${labelStyle}">Signature</div>
            <div style="margin-top: 16pt; ${lineStyle}"></div>
            <div style="${labelStyle}">Name (Print)${clientSignerName ? ': ' + clientSignerName : ''}</div>
            <div style="margin-top: 16pt; ${lineStyle}"></div>
            <div style="${labelStyle}">Title${clientTitle ? ': ' + clientTitle : ''}</div>
            <div style="margin-top: 16pt; ${lineStyle}"></div>
            <div style="${labelStyle}">Date</div>
          </td>
        </tr>
      </table>
    </div>`;
}
