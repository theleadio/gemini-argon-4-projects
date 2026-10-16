import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

function hanziDataPlugin() {
  return {
    name: 'hanzi-data-middleware',
    configureServer(server: any) {
      server.middlewares.use('/hanzi-data', (req: any, res: any, next: any) => {
        try {
          const rawUrl = req.url || ''
          const cleanPath = decodeURIComponent(rawUrl.split('?')[0].replace(/^\/+/, ''))
          if (!cleanPath.endsWith('.json')) {
            return next()
          }
          const filePath = path.resolve(process.cwd(), 'node_modules/hanzi-writer-data', cleanPath)
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.setHeader('Cache-Control', 'public, max-age=86400')
            res.end(fs.readFileSync(filePath, 'utf-8'))
            return
          }
          res.statusCode = 404
          res.end(JSON.stringify({ error: 'Character not found' }))
        } catch (err) {
          next(err)
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), hanziDataPlugin()],
})
