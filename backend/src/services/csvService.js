/**
 * Pure JS CSV parser and stringifier without heavy external dependencies.
 * Handles quoted cells, commas, newlines, escaping, and column auto-mapping.
 */

function parseCSV(text) {
  const lines = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          cell += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(cell.trim());
        cell = '';
      } else if (char === '\r') {
        // ignore CR in CRLF
      } else if (char === '\n') {
        row.push(cell.trim());
        if (row.some(val => val.length > 0)) {
          lines.push(row);
        }
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }
  }

  // Push trailing cell & row if any
  if (cell || row.length > 0) {
    row.push(cell.trim());
    if (row.some(val => val.length > 0)) {
      lines.push(row);
    }
  }

  return lines;
}

function normalizeHeader(h) {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchHeader(headers) {
  const map = {
    amount: -1,
    date: -1,
    merchant: -1,
    category: -1,
    payment_method: -1,
    notes: -1,
    is_business: -1
  };

  headers.forEach((raw, idx) => {
    const h = normalizeHeader(raw);
    if (['amount', 'cost', 'price', 'total'].includes(h)) map.amount = idx;
    else if (['date', 'transactiondate', 'posteddate', 'datetime'].includes(h)) map.date = idx;
    else if (['merchant', 'vendor', 'payee', 'store', 'description'].includes(h)) map.merchant = idx;
    else if (['category', 'cat', 'type'].includes(h)) map.category = idx;
    else if (['paymentmethod', 'method', 'payment', 'paidvia', 'account'].includes(h)) map.payment_method = idx;
    else if (['notes', 'note', 'memo', 'comments'].includes(h)) map.notes = idx;
    else if (['isbusiness', 'business', 'businessexpense'].includes(h)) map.is_business = idx;
  });

  return map;
}

function validateAndMapRows(parsedRows, userCategories) {
  if (parsedRows.length < 2) {
    return {
      isValid: false,
      error: 'CSV file must have a header row and at least one transaction row.',
      rows: []
    };
  }

  const headers = parsedRows[0];
  const headerMap = matchHeader(headers);

  if (headerMap.amount === -1 || headerMap.date === -1 || headerMap.merchant === -1) {
    return {
      isValid: false,
      error: 'CSV must contain at least Amount, Date, and Merchant columns.',
      rows: []
    };
  }

  const categoryNameMap = {};
  userCategories.forEach(c => {
    categoryNameMap[c.name.toLowerCase().trim()] = c.id;
  });

  const validatedRows = [];
  const errors = [];

  for (let i = 1; i < parsedRows.length; i++) {
    const rawRow = parsedRows[i];
    const rowNum = i + 1;

    // Skip empty lines
    if (!rawRow || rawRow.length === 0 || rawRow.every(c => !c)) continue;

    const rawAmount = headerMap.amount !== -1 ? rawRow[headerMap.amount] : '';
    const rawDate = headerMap.date !== -1 ? rawRow[headerMap.date] : '';
    const rawMerchant = headerMap.merchant !== -1 ? rawRow[headerMap.merchant] : '';
    const rawCategory = headerMap.category !== -1 ? rawRow[headerMap.category] : '';
    const rawPaymentMethod = headerMap.payment_method !== -1 ? rawRow[headerMap.payment_method] : 'Credit Card';
    const rawNotes = headerMap.notes !== -1 ? rawRow[headerMap.notes] : '';
    const rawBiz = headerMap.is_business !== -1 ? rawRow[headerMap.is_business] : '0';

    // Parse amount (strip currency symbols $, commas)
    const cleanAmountStr = String(rawAmount).replace(/[^0-9.-]/g, '');
    const amount = parseFloat(cleanAmountStr);
    const rowErrors = [];

    if (isNaN(amount) || amount <= 0) {
      rowErrors.push(`Invalid amount '${rawAmount}'`);
    }

    // Parse Date (handles YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY)
    let parsedDate = rawDate;
    if (parsedDate) {
      const d = new Date(parsedDate);
      if (isNaN(d.getTime())) {
        rowErrors.push(`Invalid date format '${rawDate}'`);
      } else {
        parsedDate = d.toISOString().substring(0, 10);
      }
    } else {
      rowErrors.push('Date is required');
    }

    if (!rawMerchant || !rawMerchant.trim()) {
      rowErrors.push('Merchant name is required');
    }

    // Match or fallback category
    const catKey = (rawCategory || '').toLowerCase().trim();
    let categoryId = categoryNameMap[catKey];
    let categoryName = rawCategory;
    if (!categoryId) {
      // Fallback to Miscellaneous or first available category
      const miscId = categoryNameMap['miscellaneous'] || userCategories[0]?.id || 1;
      categoryId = miscId;
      categoryName = userCategories.find(c => c.id === miscId)?.name || 'Miscellaneous';
    }

    const isBusiness = ['1', 'true', 'yes', 'y'].includes(String(rawBiz).toLowerCase()) ? 1 : 0;

    validatedRows.push({
      rowNumber: rowNum,
      amount: isNaN(amount) ? 0 : Math.round(amount * 100) / 100,
      date: parsedDate,
      merchant: rawMerchant ? rawMerchant.trim() : 'Unknown',
      category_id: categoryId,
      category_name: categoryName,
      payment_method: rawPaymentMethod || 'Credit Card',
      notes: rawNotes || '',
      is_business: isBusiness,
      isValid: rowErrors.length === 0,
      errors: rowErrors
    });

    if (rowErrors.length > 0) {
      errors.push(`Row ${rowNum}: ${rowErrors.join(', ')}`);
    }
  }

  return {
    isValid: errors.length === 0,
    totalRows: validatedRows.length,
    validRowsCount: validatedRows.filter(r => r.isValid).length,
    errors,
    rows: validatedRows
  };
}

function stringifyCSV(rows, columns) {
  const headerLine = columns.map(c => `"${c.header.replace(/"/g, '""')}"`).join(',');
  const lines = [headerLine];

  rows.forEach(row => {
    const line = columns.map(col => {
      let val = row[col.key];
      if (val === null || val === undefined) val = '';
      if (col.format) val = col.format(val, row);
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',');
    lines.push(line);
  });

  return lines.join('\r\n');
}

module.exports = {
  parseCSV,
  validateAndMapRows,
  stringifyCSV
};
