// The plugin's own checks, which the repository's scripts/check.mjs runs: the shark's mesh in hooks/sea.ts must be
// the one the paths in hooks/scene.ts give.
import { spawnSync } from 'node:child_process'

const result = spawnSync(process.execPath, [new URL('mesh.mjs', import.meta.url).pathname, '--check'], { stdio: 'inherit' })
process.exit(result.status ?? 1)
