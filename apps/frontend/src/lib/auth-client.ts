import { createAuthClient } from 'better-auth/react'
import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { dashboardClientPlugin } from "better-auth-dashboard";

export const authClient = createAuthClient({
    baseURL: import.meta.env.VITE_BETTER_AUTH_URL || 'https://better-auth-server-production-76d3.up.railway.app',
    fetchOptions: {
        credentials: 'include',
    },
    plugins: [
        adminClient(),
        dashboardClientPlugin(),
        inferAdditionalFields({
            user: {
                allowedApps: {
                    type: "string",
                },
            },
        }),
    ],
})
