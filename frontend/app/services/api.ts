import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api",
  timeout: 30000,
});

// Add auth token to requests
api.interceptors.request.use(
  (config: any) => {
    // ← Tambah type annotation
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: any) => {
    // ← Tambah type annotation
    return Promise.reject(error);
  }
);

// Handle responses
api.interceptors.response.use(
  (response: any) => response, // ← Tambah type annotation
  (error: any) => {
    // ← Tambah type annotation
    if (error.response?.status === 401) {
      localStorage.removeItem("authToken");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
