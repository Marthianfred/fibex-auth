import { Hono } from 'hono'
import { auth } from './lib/auth'
import { logger } from 'hono/logger'
import { swaggerUI } from '@hono/swagger-ui'

const app = new Hono()

app.use(logger())

app.get('/', (c) => {
  return c.text('FIBEX Auth Server is running. Visit /ui for API Documentation.')
})

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  })
})

/**
 * Swagger UI for API Documentation and Management
 * Pointing to Better Auth OpenAPI schema
 */
app.get('/ui', swaggerUI({ url: '/api/auth/open-api/generate-schema' }))

/**
 * Validation endpoint for multi-app access
 */
app.get('/api/access/validate', async (c) => {
  const appId = c.req.query('appId')
  const session = await auth.api.getSession({ headers: c.req.raw.headers })

  if (!session) {
    return c.json({ authorized: false, message: 'No active session' }, 401)
  }

  if (!appId) {
    return c.json({ authorized: false, message: 'appId is required' }, 400)
  }

  const user = session.user as any
  const allowedApps = (user.allowedApps as string || '').split(',').map(s => s.trim())

  const isAuthorized = allowedApps.includes(appId) || user.role === 'admin'

  return c.json({
    authorized: isAuthorized,
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    }
  })
})

/**
 * Better Auth routes
 */
app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));

export default app