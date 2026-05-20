import { Hono } from 'hono'
import { auth, db } from './lib/auth'
import { logger } from 'hono/logger'
import { swaggerUI } from '@hono/swagger-ui'
import { cors } from 'hono/cors'

const app = new Hono()

app.use(logger())
app.use(cors({
  origin: (origin) => origin,
  allowHeaders: ['Content-Type', 'Authorization', 'x-admin-secret'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}))

app.get('/', (c) => {
  return c.text('FIBEX Auth Server is running. Visit /ui for API Documentation.')
})

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  })
})

app.get('/ui', swaggerUI({ url: '/api/auth/open-api/generate-schema' }))

app.get('/api/access/validate', async (c) => {
  const appId = c.req.query('appId')
  
  if (!appId) {
    return c.json({ authorized: false, message: 'appId is required' }, 400)
  }

  const session = await auth.api.getSession({ headers: c.req.raw.headers })

  if (!session) {
    return c.json({ authorized: false, message: 'No active session' }, 401)
  }

  const user = session.user as any
  
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

app.all("/api/auth/**", async (c) => {
  const authHeader = c.req.header('Authorization');
  const adminSecretHeader = c.req.header('x-admin-secret');
  const expectedSecret = process.env.ADMIN_SECRET;
  if (!expectedSecret) {
    return c.json({ error: "ADMIN_SECRET not configured" }, 500);
  }
  const isSecretMatch = authHeader === `Bearer ${expectedSecret}` || adminSecretHeader === expectedSecret;
  
  if (isSecretMatch) {
    if (c.req.path.endsWith('/admin/create-user')) {
      try {
        const body = await c.req.json();
        
        const result = await auth.api.signUpEmail({ 
          body: {
            email: body.email,
            password: body.password,
            name: body.name
          }
        });
        
        if (body.role) {
          await db.query('UPDATE "user" SET role = $1 WHERE email = $2', [body.role, body.email]);
          if ('user' in result) {
            (result.user as any).role = body.role;
          }
        }
        
        return c.json(result);
      } catch (error: any) {
        console.error("[Create User Bypass Error]", error);
        return c.json({ error: error.message || "Failed to create user via bypass" }, 400);
      }
    }
    if (c.req.path.endsWith('/admin/list-users')) {
      const result = await db.query('SELECT id, name, email, role, banned, "createdAt" FROM "user" LIMIT 100');
      return c.json({ users: result.rows });
    }
    if (c.req.path.endsWith('/admin/get-user')) {
      const id = c.req.query('id');
      if (id) {
        const result = await db.query('SELECT id, name, email, role, banned, "createdAt", "updatedAt", "emailVerified" FROM "user" WHERE id = $1', [id]);
        return c.json({ user: result.rows[0] });
      }
    }
  }
  
  return auth.handler(c.req.raw);
});

export default {
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
  hostname: "0.0.0.0",
  fetch: app.fetch,
}