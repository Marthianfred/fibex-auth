import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    baseURL: import.meta.env.VITE_BETTER_AUTH_URL || window.location.origin,
    fetchOptions: {
        credentials: 'include',
    },
    plugins: [
        inferAdditionalFields({
            user: {
                allowedApps: { type: "string" },
                role: { type: "string" },
            },
        }),
    ],
})
