import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,
  headers: {
    'ngrok-skip-browser-warning': 'true',
  },
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
export const getHsaExams = () => api.get('/diem-thi/hsa/exams');
export const getHsaRanking = (params) => api.get('/diem-thi/hsa/ranking', { params });
export const getTsaExams = () => api.get('/diem-thi/tsa/exams');
export const getTsaRanking = (params) => api.get('/diem-thi/tsa/ranking', { params });

// Career guidance
export const getCareerOverview = (params) => api.get('/career/overview', params ? { params } : undefined);
export const getCareerScores = () => api.get('/career/scores');
export const saveCareerScores = (scores) => api.put('/career/scores', { scores });
export const getExamScores = () => api.get('/career/exam-scores');
export const getExamScoreOptions = () => api.get('/career/exam-score-options');
export const saveExamScores = (scores) => api.put('/career/exam-scores', { scores });
export const getCareerSelections = () => api.get('/career/selections');
export const getCareerTargetOptions = () => api.get('/career/target-options');
export const addCareerSelection = (selection) => api.post('/career/selections', selection);
export const removeCareerSelection = (id) => api.delete(`/career/selections/${id}`);
export const getCareerMajors = (params) => api.get('/career/majors', { params });
export const getCareerMapData = (params) => api.get('/career/map-data', params ? { params } : undefined);
export const getCareerBenchmark = (params) => api.get('/career/benchmark', { params });
export const getCareerRecommendations = (params) =>
  api.get('/career/recommendations', params ? { params } : undefined);
export const getCareerGroupConfig = () => api.get('/career/group-config');

// Interest discovery
export const getInterestInstrument = () => api.get('/interest/instrument');
export const getInterestAttempt = () => api.get('/interest/attempt');
export const createInterestAttempt = (payload) => api.post('/interest/attempt', payload || {});
export const updateInterestAttempt = (attemptId, payload) =>
  api.patch(`/interest/attempt/${attemptId}`, payload || {});
export const saveInterestResponses = (attemptId, responses) =>
  api.patch(`/interest/attempt/${attemptId}/responses`, { responses });
export const submitInterestAttempt = (attemptId, payload) =>
  api.post(`/interest/attempt/${attemptId}/submit`, payload || {});
export const getInterestLatestResult = () => api.get('/interest/results/latest');
export const getInterestResult = (attemptId) => api.get(`/interest/results/${attemptId}`);
export const deleteInterestAttempt = (attemptId) => api.delete(`/interest/attempt/${attemptId}`);
export const resetInterest = () => api.post('/interest/reset');

// Agent AI
export const getAgentStatus = () => api.get('/agent/status');
export const giveAgentConsent = () => api.post('/agent/consent');
export const getAgentConversations = () => api.get('/agent/conversations');
export const getAgentConversation = (id) => api.get(`/agent/conversations/${id}`);
export const deleteAgentConversation = (id) => api.delete(`/agent/conversations/${id}`);

export async function streamAgentChat({
  message,
  conversationId,
  onStatus,
  onArtifact,
  onMessage,
  onDone,
  onError,
  signal,
}) {
  try {
    const response = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      credentials: 'include',
      body: JSON.stringify({ message, conversationId }),
      signal,
    });

    if (!response.ok) {
      let errJson = null;
      try {
        errJson = await response.json();
      } catch {}
      const error = new Error(errJson?.error || 'Đã xảy ra lỗi khi kết nối với Trợ lý AI.');
      error.code = errJson?.code;
      error.status = response.status;
      throw error;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        const lines = part.split('\n');
        let event = 'message';
        let dataStr = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            event = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            dataStr = line.slice(6).trim();
          }
        }
        if (!dataStr) continue;
        let parsed;
        try {
          parsed = JSON.parse(dataStr);
        } catch {
          continue;
        }

        if (event === 'status') onStatus?.(parsed);
        else if (event === 'artifact') onArtifact?.(parsed);
        else if (event === 'message') onMessage?.(parsed);
        else if (event === 'done') onDone?.(parsed);
        else if (event === 'error') onError?.(parsed);
      }
    }
  } catch (err) {
    if (signal?.aborted) return;
    onError?.({ error: err.message || 'Lỗi kết nối tới máy chủ.' });
    throw err;
  }
}

// Curriculum (Chương trình học)
export const getCurriculums = (params) => api.get('/chuong-trinh-hoc', { params });
export const getCurriculumSchools = () => api.get('/chuong-trinh-hoc/schools');
export const getCurriculumMajors = (school) => api.get('/chuong-trinh-hoc/majors', { params: { school } });
export const getCurriculumById = (id) => api.get(`/chuong-trinh-hoc/${id}`);
export const getCurriculumDetail = (school, major) => api.get('/chuong-trinh-hoc/detail', { params: { school, major } });

export default api;
