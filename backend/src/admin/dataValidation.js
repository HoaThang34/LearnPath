function normalizeNumber(value, column) {
  if (value === null || value === '') return null;

  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed)) {
    throw new Error(`${column.name} phải là số hợp lệ.`);
  }

  if (column.type === 'integer' && !Number.isInteger(parsed)) {
    throw new Error(`${column.name} phải là số nguyên.`);
  }

  if (column.min !== undefined && parsed < column.min) {
    throw new Error(`${column.name} phải lớn hơn hoặc bằng ${column.min}.`);
  }

  if (column.max !== undefined && parsed > column.max) {
    throw new Error(`${column.name} phải nhỏ hơn hoặc bằng ${column.max}.`);
  }

  return parsed;
}

function normalizeString(value, column) {
  if (value === null) {
    if (column.nullable) return null;
    throw new Error(`${column.name} không được để trống.`);
  }

  if (typeof value !== 'string') {
    throw new Error(`${column.name} phải là chuỗi.`);
  }

  const normalized = column.name === 'noi_dung' ? value : value.trim();

  if (normalized.length === 0) {
    if (column.nullable) return null;
    throw new Error(`${column.name} không được để trống.`);
  }

  if (column.maxLength && normalized.length > column.maxLength) {
    throw new Error(
      `${column.name} không được dài quá ${column.maxLength.toLocaleString('vi-VN')} ký tự.`
    );
  }

  return normalized;
}

function validateRow(tableMeta, input, { partial = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Dữ liệu gửi lên không hợp lệ.' };
  }

  const allowed = new Map(tableMeta.columns.map((column) => [column.name, column]));
  const values = {};

  try {
    for (const [key, rawValue] of Object.entries(input)) {
      const column = allowed.get(key);

      if (!column) {
        return { ok: false, error: `Trường ${key} không thuộc bảng ${tableMeta.table}.` };
      }

      if (column.readOnly) {
        return { ok: false, error: `Trường ${key} không được phép sửa.` };
      }

      if (rawValue === undefined) continue;

      if (column.type === 'string' || column.type === 'text') {
        values[key] = normalizeString(rawValue, column);
      } else {
        const parsed = normalizeNumber(rawValue, column);
        if (parsed === null && !column.nullable) {
          return { ok: false, error: `${key} không được để trống.` };
        }
        values[key] = parsed;
      }
    }

    if (!partial) {
      for (const column of tableMeta.columns) {
        if (!column.required) continue;
        if (values[column.name] === undefined || values[column.name] === null) {
          return { ok: false, error: `${column.name} là trường bắt buộc.` };
        }
      }
    } else if (Object.keys(values).length === 0) {
      return { ok: false, error: 'Không có trường nào được cập nhật.' };
    }

    return { ok: true, values };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = { validateRow };
