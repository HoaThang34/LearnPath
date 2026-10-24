import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';

    if (status === 401 && !url.startsWith('/auth/') && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    return Promise.reject(error);
  }
);

// Auth
export const registerUser = (payload) => api.post('/auth/register', payload);
export const loginUser = (payload) => api.post('/auth/login', payload);
export const getCurrentUser = () => api.get('/auth/me');
export const logoutUser = () => api.post('/auth/logout');
export const changePassword = (payload) => api.post('/auth/change-password', payload);
export const getUserProfile = () => api.get('/auth/profile');
export const updateUserProfile = (payload) => api.put('/auth/profile', payload);

// Survey
export const getSurveyQuestions = () => api.get('/auth/survey/questions');
export const submitSurvey = (payload) => api.post('/auth/survey/submit', payload);

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

// Career guidance
export const getCareerOverview = (params) => api.get('/career/overview', params ? { params } : undefined);
export const getCareerScores = () => api.get('/career/scores');
export const saveCareerScores = (scores) => api.put('/career/scores', { scores });
export const getCareerSelections = () => api.get('/career/selections');
export const addCareerSelection = (selection) => api.post('/career/selections', selection);
export const removeCareerSelection = (id) => api.delete(`/career/selections/${id}`);
export const getCareerMajors = (params) => api.get('/career/majors', { params });

export default api;
