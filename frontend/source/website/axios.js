import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'http://127.0.0.1:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.response.use(
    (response) => {
        if (response.config.url === '/api/update-model') {
            // call the listener if exists
            if (window.onUpdateModelResponse) {
                window.onUpdateModelResponse(response.data);
            }
        }
        return response;
    },
    (error) => Promise.reject(error)
);

export default axiosInstance;
