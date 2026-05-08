import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const artRoot = path.resolve(__dirname, '../art')
const areaFolders = [
  'openoffice',
  'yard',
  'arcade',
  'coffee',
  'focus',
  'spawn',
  'study',
]

function getArtAssets() {
  return areaFolders.flatMap((zone) => {
    const zoneRoot = path.join(artRoot, zone)
    const objectRoot = path.join(zoneRoot, 'objects')
    const assets: Array<{
      id: string
      zone: string
      kind: 'floor' | 'object'
      name: string
      sprite: string
      collider: boolean
      width: number
      depth: number
      height: number
    }> = []

    if (fs.existsSync(path.join(zoneRoot, 'floor.png'))) {
      assets.push({
        id: `${zone}-floor`,
        zone,
        kind: 'floor',
        name: 'Floor',
        sprite: `/art/${zone}/floor.png`,
        collider: false,
        width: 1,
        depth: 1,
        height: 0,
      })
    }

    if (fs.existsSync(objectRoot)) {
      for (const fileName of fs.readdirSync(objectRoot)) {
        if (!fileName.toLowerCase().endsWith('.png')) continue

        const name = path.basename(fileName, '.png')
        assets.push({
          id: `${zone}-object-${name}`,
          zone,
          kind: 'object',
          name: name.replace(/[-_]/g, ' '),
          sprite: `/art/${zone}/objects/${fileName}`,
          collider: true,
          width: 1,
          depth: 1,
          height: 40,
        })
      }
    }

    return assets
  })
}

function getContentType(filePath: string) {
  if (filePath.toLowerCase().endsWith('.png')) return 'image/png'
  return 'application/octet-stream'
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'theoffice-art-server',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (!request.url) {
            next()
            return
          }

          if (request.url === '/__art-assets') {
            response.setHeader('Content-Type', 'application/json')
            response.end(JSON.stringify(getArtAssets()))
            return
          }

          if (request.url.startsWith('/art/')) {
            const relativePath = decodeURIComponent(request.url.replace('/art/', ''))
            const filePath = path.resolve(artRoot, relativePath)

            if (!filePath.startsWith(artRoot) || !fs.existsSync(filePath)) {
              next()
              return
            }

            response.setHeader('Content-Type', getContentType(filePath))
            fs.createReadStream(filePath).pipe(response)
            return
          }

          next()
        })
      },
    },
  ],
})
