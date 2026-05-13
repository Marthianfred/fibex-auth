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
  
  // Early return: Validate appId before session lookup to avoid unnecessary DB/Redis calls
  if (!appId) {
    return c.json({ authorized: false, message: 'appId is required' }, 400)
  }

  const session = await auth.api.getSession({ headers: c.req.raw.headers })

  if (!session) {
    return c.json({ authorized: false, message: 'No active session' }, 401)
  }

  const user = session.user as any
  
  // Performance win: Check admin role first to skip string processing for admins
  if (user.role === 'admin') {
    return c.json({
      authorized: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    })
  }

  // Optimized string check: use some() to stop at the first match and avoid map() overhead
  const isAuthorized = (user.allowedApps as string || '')
    .split(',')
    .some(s => s.trim() === appId)

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
 * Using app.all is more efficient for the router than app.on with multiple methods
 */
app.all("/api/auth/**", (c) => {
  // Diagnostic: Log if Auth header is present (only for debugging 401s)
  if (c.req.path.includes('/admin/')) {
    console.log(`[Admin Request] ${c.req.path} - Auth Header: ${c.req.header('Authorization') ? 'Present' : 'Missing'}`);
  }
  return auth.handler(c.req.raw);
});

export default app