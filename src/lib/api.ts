import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('tbs_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('tbs_token')
      localStorage.removeItem('tbs_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
