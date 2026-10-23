const DATA_TABLES = [
  {
    table: 'khoi_thi',
    label: 'Khối thi',
    primaryKey: 'id',
    searchColumns: ['ma_khoi', 'mon_thi'],
    defaultSort: 'id',
    columns: [
      { name: 'id', type: 'integer', readOnly: true, sortable: true },
      { name: 'ma_khoi', type: 'string', required: true, nullable: false, maxLength: 32, sortable: true, unique: true },
      { name: 'mon_thi', type: 'string', nullable: true, maxLength: 255, sortable: true },
      { name: 'so_truong', type: 'integer', nullable: true, min: 0, max: 1000000, sortable: true },
    ],
  },
  {
    table: 'truong',
    label: 'Trường',
    primaryKey: 'id',
    searchColumns: ['ma_truong', 'ten_truong'],
    defaultSort: 'id',
    columns: [
      { name: 'id', type: 'integer', readOnly: true, sortable: true },
      { name: 'ma_truong', type: 'string', required: true, nullable: false, maxLength: 32, sortable: true, unique: true },
      { name: 'ten_truong', type: 'string', required: true, nullable: false, maxLength: 255, sortable: true },
    ],
  },
  {
    table: 'diem_chuan',
    label: 'Điểm chuẩn',
    primaryKey: 'id',
    searchColumns: ['ma_truong', 'truong', 'nganh', 'to_hop_mon', 'phuong_thuc'],
    defaultSort: 'id',
    columns: [
      { name: 'id', type: 'integer', readOnly: true, sortable: true },
      { name: 'ma_truong', type: 'string', nullable: true, maxLength: 32, sortable: true },
      { name: 'truong', type: 'string', required: true, nullable: false, maxLength: 255, sortable: true },
      { name: 'nganh', type: 'string', required: true, nullable: false, maxLength: 512, sortable: true },
      { name: 'to_hop_mon', type: 'string', nullable: true, maxLength: 255, sortable: true },
      { name: 'diem_chuan', type: 'real', nullable: true, min: -1000, max: 1000, sortable: true },
      { name: 'ghi_chu', type: 'string', nullable: true, maxLength: 2000, sortable: false },
      { name: 'nam', type: 'integer', nullable: true, min: 2000, max: 2100, sortable: true },
      { name: 'phuong_thuc', type: 'string', nullable: true, maxLength: 64, sortable: true },
    ],
  },
  {
    table: 'diem_thi_thptqg',
    label: 'Điểm thi THPTQG',
    primaryKey: 'id',
    searchColumns: ['sbd', 'tinh'],
    defaultSort: 'id',
    columns: [
      { name: 'id', type: 'integer', readOnly: true, sortable: true },
      { name: 'sbd', type: 'string', required: true, nullable: false, maxLength: 32, sortable: true, unique: true },
      { name: 'tinh', type: 'string', nullable: true, maxLength: 64, sortable: true },
      { name: 'toan', type: 'real', nullable: true, min: 0, max: 100, sortable: true },
      { name: 'van', type: 'real', nullable: true, min: 0, max: 100, sortable: true },
      { name: 'ly', type: 'real', nullable: true, min: 0, max: 100, sortable: true },
      { name: 'hoa', type: 'real', nullable: true, min: 0, max: 100, sortable: true },
      { name: 'sinh', type: 'real', nullable: true, min: 0, max: 100, sortable: true },
      { name: 'su', type: 'real', nullable: true, min: 0, max: 100, sortable: true },
      { name: 'dia', type: 'real', nullable: true, min: 0, max: 100, sortable: true },
      { name: 'gd_kt_pl', type: 'string', nullable: true, maxLength: 64, sortable: true },
      { name: 'tin_hoc', type: 'real', nullable: true, min: 0, max: 100, sortable: true },
      { name: 'cong_nghe', type: 'real', nullable: true, min: 0, max: 100, sortable: true },
      { name: 'ngoai_ngu', type: 'real', nullable: true, min: 0, max: 100, sortable: true },
    ],
  },
  {
    table: 'de_an_tuyen_sinh',
    label: 'Đề án tuyển sinh',
    primaryKey: 'id',
    searchColumns: ['ma_truong', 'ten_truong', 'nguon'],
    defaultSort: 'id',
    columns: [
      { name: 'id', type: 'integer', readOnly: true, sortable: true },
      { name: 'ma_truong', type: 'string', nullable: true, maxLength: 32, sortable: true },
      { name: 'ten_truong', type: 'string', nullable: true, maxLength: 255, sortable: true },
      { name: 'noi_dung', type: 'text', nullable: true, maxLength: 1000000, sortable: false, listOmit: true },
      { name: 'nguon', type: 'string', nullable: true, maxLength: 512, sortable: true },
    ],
  },
];

function getTableMeta(tableName) {
  return DATA_TABLES.find((table) => table.table === tableName) || null;
}

function getColumnMeta(tableMeta, columnName) {
  return tableMeta.columns.find((column) => column.name === columnName) || null;
}

function getPublicTableMeta(tableMeta) {
  return {
    table: tableMeta.table,
    label: tableMeta.label,
    primaryKey: tableMeta.primaryKey,
    defaultSort: tableMeta.defaultSort,
    searchColumns: tableMeta.searchColumns,
    columns: tableMeta.columns.map((column) => ({ ...column })),
  };
}

module.exports = {
  DATA_TABLES,
  getTableMeta,
  getColumnMeta,
  getPublicTableMeta,
};
