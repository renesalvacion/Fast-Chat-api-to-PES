import axios from 'axios'

export const api = () => {
  const config = useRuntimeConfig()

  return axios.create({
    baseURL: config.public.apiBase,
    withCredentials: true
  })
}