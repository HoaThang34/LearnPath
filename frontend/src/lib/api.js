import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// Diem Chuan
export const getDiemChuan = (params) => api.get('/diem-chuan', { params });
export const getDiemChuanStats = () => api.get('/diem-chuan/stats');
export const getPhuongThuc = () => api.get('/diem-chuan/phuong-thuc');
export const compareDiemChuan = (ids) => api.get('/diem-chuan/compare', { params: { ids: ids.join(',') } });

// Khoi Thi
export const getKhoiThiList = () => api.get('/khoi-thi');
export const getKhoiThiById = (maKhoi) => api.get(`/khoi-thi/${maKhoi}`);
export const getKhoiThiTruong = (maKhoi, maTruong) => api.get(`/khoi-thi/${maKhoi}/truong/${maTruong}`);
export const getDanhSachKhoiThi = () => api.get('/khoi-thi');

// Nhom Nganh
export const getNhomNganh = () => api.get('/diem-chuan/nhom-nganh');

// De An
export const getDeAn = (params) => api.get('/de-an', { params });
export const getDeAnByMaTruong = (maTruong) => api.get(`/de-an/${maTruong}`);

// Diem Thi
export const getRanking = (params) => api.get('/diem-thi/ranking', { params });

export default api;
