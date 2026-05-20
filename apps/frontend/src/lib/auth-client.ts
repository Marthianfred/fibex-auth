import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
    baseURL: 'https://better-auth-server-production-76d3.up.railway.app',
    fetchOptions: {
        credentials: 'include',
    },
})
