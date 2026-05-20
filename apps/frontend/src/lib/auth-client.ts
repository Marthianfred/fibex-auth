import { createAuthClient } from 'better-auth/react'
import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { dashboardClientPlugin } from "better-auth-dashboard";

export const authClient = createAuthClient({
    baseURL: import.meta.env.VITE_BETTER_AUTH_URL || 'http://localhost:3000',
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
