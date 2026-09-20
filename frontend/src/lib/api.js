import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// Diem Chuan
export const getDiemChuan = (params) => api.get('/diem-chuan', { params });
export const getDiemChuanByTruong = (truong) => api.get(`/diem-chuan/truong/${truong}`);
export const getDiemChuanStats = () => api.get('/diem-chuan/stats');
export const getPhuongThuc = () => api.get('/diem-chuan/phuong-thuc');
export const getNhomNganh = () => api.get('/diem-chuan/nhom-nganh');

// De An
export const getDeAn = (params) => api.get('/de-an', { params });
export const getDeAnByMaTruong = (maTruong) => api.get(`/de-an/${maTruong}`);

// Khoi Thi
export const getKhoiThi = (params) => api.get('/khoi-thi', { params });
export const getKhoiThiByMaKhoi = (maKhoi) => api.get(`/khoi-thi/ma-khoi/${maKhoi}`);
export const getKhoiThiByTruong = (maTruong) => api.get(`/khoi-thi/truong/${maTruong}`);
export const getDanhSachKhoiThi = () => api.get('/khoi-thi/danh-sach');

// Diem Thi
export const getRanking = (params) => api.get('/diem-thi/ranking', { params });
export const getDiemThiStats = () => api.get('/diem-thi/stats');

export default api;
