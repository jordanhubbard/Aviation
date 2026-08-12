#!/usr/bin/env node
// Validate that every committed npm lockfile describes a tree whose peer
// dependencies are actually satisfiable.
//
// The container builds (apps/*/Dockerfile) install with `npm ci`, which
// refuses to install a tree containing a conflicting peer dependency. A
// dependency bump that lands in package.json without bumping the peer it
// requires therefore turns green locally (node_modules is already present)
// and red only inside the Docker build, where the failure is expensive to
// read. This check reproduces that rejection offline, from the lockfile
// alone, with no registry access and no third-party modules.
//
// Usage: node scripts/check-lockfile-peers.mjs [lockfile ...]
// Exits non-zero and prints every conflict when a peer range is violated.

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const DEFAULT_LOCKFILES = [
  'package-lock.json',
  'apps/aviation-accident-tracker/frontend/package-lock.json',
  'apps/flight-planner/frontend/package-lock.json',
  'apps/foreflight-dashboard/frontend/package-lock.json',
  'apps/g1000-simulator/frontend/package-lock.json',
]

// Conflicts that are already known, already tracked, and too broad to fix as a
// side effect of this check. They are reported as warnings so the guard stays
// useful for everything else instead of being switched off wholesale.
export const KNOWN_CONFLICTS = [
  {
    lockfile: 'package-lock.json',
    dependent: /^packages\/ui-framework\/node_modules\/(react-leaflet|@react-leaflet\/core)/,
    peer: /^react(-dom)?$/,
    reason:
      'packages/ui-framework declares peer react ^18 but depends on react-leaflet ^5, which requires react 19. ' +
      'Resolving it means either a React 19 migration or a react-leaflet downgrade plus a root relock.',
  },
]

function isKnown(lockfileLabel, conflict) {
  return KNOWN_CONFLICTS.find(
    (k) =>
      k.lockfile === lockfileLabel &&
      k.dependent.test(conflict.dependent) &&
      k.peer.test(conflict.peer),
  )
}

// ---------------------------------------------------------------------------
// Minimal semver range matching. Supports the comparator forms that appear in
// peerDependencies: `*`, `x`, `^`, `~`, `>=`, `>`, `<=`, `<`, `=`, bare
// versions, space-separated AND, and `||` OR. Unparseable ranges are reported
// as skipped rather than failed, so a novel syntax never produces a false
// alarm.
// ---------------------------------------------------------------------------

class UnsupportedRange extends Error {}

function parseVersion(raw) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(raw.trim())
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
  }
}

function comparePrerelease(a, b) {
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0) return 1 // a release outranks a prerelease
  if (b.length === 0) return -1
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i]
    const y = b[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const xNum = /^\d+$/.test(x)
    const yNum = /^\d+$/.test(y)
    if (xNum && yNum) {
      if (Number(x) !== Number(y)) return Number(x) < Number(y) ? -1 : 1
    } else if (xNum !== yNum) {
      return xNum ? -1 : 1
    } else if (x !== y) {
      return x < y ? -1 : 1
    }
  }
  return 0
}

function compareVersions(a, b) {
  for (const part of ['major', 'minor', 'patch']) {
    if (a[part] !== b[part]) return a[part] < b[part] ? -1 : 1
  }
  return comparePrerelease(a.prerelease, b.prerelease)
}

// Expand a partial version ("8", "8.4", "8.4.0", "11.0.0-rc.0") into
// lower/upper bounds.
function partialBounds(raw) {
  const cleaned = raw.trim().replace(/^v/, '')

  // A fully-qualified version (including prerelease/build metadata) is exact.
  const exactVersion = parseVersion(cleaned)
  if (exactVersion) return { exact: exactVersion }

  const parts = cleaned.split('.')
  if (parts.length === 0 || parts.length > 3) throw new UnsupportedRange(raw)
  const wildcard = (p) => p === undefined || p === '' || p === 'x' || p === 'X' || p === '*'

  if (wildcard(parts[0])) return { lower: null, upper: null }

  const numeric = parts.map((p) => (wildcard(p) ? null : p))
  if (!/^\d+$/.test(numeric[0])) throw new UnsupportedRange(raw)
  const major = Number(numeric[0])

  if (numeric.length === 1 || numeric[1] === null) {
    return {
      lower: { major, minor: 0, patch: 0, prerelease: [] },
      upper: { major: major + 1, minor: 0, patch: 0, prerelease: [] },
    }
  }
  if (!/^\d+$/.test(numeric[1])) throw new UnsupportedRange(raw)
  const minor = Number(numeric[1])

  if (numeric.length === 2 || numeric[2] === null) {
    return {
      lower: { major, minor, patch: 0, prerelease: [] },
      upper: { major, minor: minor + 1, patch: 0, prerelease: [] },
    }
  }
  const exact = parseVersion(cleaned)
  if (!exact) throw new UnsupportedRange(raw)
  return { exact }
}

function caretUpper(v) {
  if (v.major > 0) return { major: v.major + 1, minor: 0, patch: 0, prerelease: [] }
  if (v.minor > 0) return { major: 0, minor: v.minor + 1, patch: 0, prerelease: [] }
  return { major: 0, minor: 0, patch: v.patch + 1, prerelease: [] }
}

// A single comparator -> predicate over a parsed version.
function comparatorPredicate(token) {
  const operatorMatch = /^(\^|~>?|>=|<=|>|<|=)?\s*(.+)$/.exec(token)
  if (!operatorMatch) throw new UnsupportedRange(token)
  const operator = operatorMatch[1] || '='
  const operand = operatorMatch[2].trim()

  if (operand === '*' || operand === 'x' || operand === 'X' || operand === '') return () => true

  const bounds = partialBounds(operand)

  if (operator === '^' || operator === '~' || operator === '~>') {
    const lower = bounds.exact ?? bounds.lower
    if (!lower) return () => true
    let upper
    if (operator === '^') {
      // `^18.0` widens to <19.0.0, while `^0.4` stays at <0.5.0 — so a caret
      // over a partial version must still apply the caret rule to its major.
      if (bounds.exact) upper = caretUpper(bounds.exact)
      else if (lower.major > 0) upper = { major: lower.major + 1, minor: 0, patch: 0, prerelease: [] }
      else upper = bounds.upper
    } else if (bounds.exact) {
      upper = { major: bounds.exact.major, minor: bounds.exact.minor + 1, patch: 0, prerelease: [] }
    } else {
      upper = bounds.upper
    }
    return (v) => compareVersions(v, lower) >= 0 && (!upper || compareVersions(v, upper) < 0)
  }

  if (operator === '=') {
    if (bounds.exact) return (v) => compareVersions(v, bounds.exact) === 0
    return (v) =>
      compareVersions(v, bounds.lower) >= 0 && (!bounds.upper || compareVersions(v, bounds.upper) < 0)
  }

  // Inequalities compare against the partial version's natural edge.
  const lower = bounds.exact ?? bounds.lower
  const upper = bounds.exact ?? bounds.upper
  if (!lower) return () => true

  switch (operator) {
    case '>=':
      return (v) => compareVersions(v, lower) >= 0
    case '>':
      return (v) => compareVersions(v, upper ?? lower) >= (bounds.exact ? 1 : 0)
    case '<=':
      return (v) => (bounds.exact ? compareVersions(v, lower) <= 0 : compareVersions(v, upper) < 0)
    case '<':
      return (v) => compareVersions(v, lower) < 0
    default:
      throw new UnsupportedRange(token)
  }
}

export function satisfies(versionString, range) {
  const version = parseVersion(versionString)
  if (!version) throw new UnsupportedRange(versionString)
  const trimmed = range.trim()
  if (trimmed === '' || trimmed === '*' || trimmed === 'x') return true
  if (trimmed.includes(' - ')) throw new UnsupportedRange(range) // hyphen ranges are unused here
  return trimmed.split('||').some((clause) => {
    // `>= 4.11` is one comparator, not two — glue operators to their operand
    // before splitting on whitespace.
    const glued = clause.trim().replace(/(\^|~>?|>=|<=|>|<|=)\s+/g, '$1')
    const comparators = glued.split(/\s+/).filter(Boolean)
    if (comparators.length === 0) return true
    return comparators.every((c) => comparatorPredicate(c)(version))
  })
}

// ---------------------------------------------------------------------------
// Lockfile walking
// ---------------------------------------------------------------------------

// Resolve `name` from `fromPath` the way node does: walk up the directory
// chain looking for `<dir>/node_modules/<name>` in the lockfile's package map.
function resolveFrom(packages, fromPath, name) {
  const segments = fromPath === '' ? [] : fromPath.split('/')
  for (let i = segments.length; i >= 0; i -= 1) {
    const prefix = segments.slice(0, i).join('/')
    const candidate = prefix ? `${prefix}/node_modules/${name}` : `node_modules/${name}`
    if (Object.prototype.hasOwnProperty.call(packages, candidate)) {
      return { path: candidate, entry: packages[candidate] }
    }
  }
  return null
}

export function checkLock(lock) {
  const packages = lock.packages
  const conflicts = []
  const skipped = []

  if (!packages) {
    skipped.push({ reason: `lockfileVersion ${lock.lockfileVersion} has no "packages" map` })
    return { conflicts, skipped, checked: 0 }
  }

  let checked = 0
  for (const [path, entry] of Object.entries(packages)) {
    const peers = entry.peerDependencies
    if (!peers || entry.link) continue
    const meta = entry.peerDependenciesMeta || {}

    for (const [peerName, range] of Object.entries(peers)) {
      if (meta[peerName] && meta[peerName].optional) continue
      const resolved = resolveFrom(packages, path, peerName)
      // npm installs missing non-optional peers itself; a peer absent from the
      // tree is not the conflict this check is looking for.
      if (!resolved || !resolved.entry.version) continue

      checked += 1
      try {
        if (!satisfies(resolved.entry.version, range)) {
          conflicts.push({
            dependent: path || '(root project)',
            dependentVersion: entry.version || '',
            peer: peerName,
            required: range,
            found: resolved.entry.version,
            foundAt: resolved.path,
          })
        }
      } catch (error) {
        if (!(error instanceof UnsupportedRange)) throw error
        skipped.push({ reason: `${path || '(root)'} peer ${peerName}@"${range}" (unsupported range syntax)` })
      }
    }
  }

  return { conflicts, skipped, checked }
}

export function checkLockfile(lockPath) {
  return checkLock(JSON.parse(readFileSync(lockPath, 'utf8')))
}

function describe(c) {
  return (
    `${c.dependent}${c.dependentVersion ? `@${c.dependentVersion}` : ''} requires peer ` +
    `${c.peer}@"${c.required}" but the lockfile pins ${c.peer}@${c.found} (${c.foundAt}).`
  )
}

export function main(argv = process.argv.slice(2)) {
  const targets = (argv.length > 0 ? argv : DEFAULT_LOCKFILES).map((p) => resolve(REPO_ROOT, p))

  let failed = false
  let totalChecked = 0

  for (const lockPath of targets) {
    const label = relative(REPO_ROOT, lockPath)
    if (!existsSync(lockPath)) {
      // A lockfile can legitimately disappear when an app moves to pnpm.
      console.log(`  ⏭  ${label} (not present)`)
      continue
    }

    const { conflicts, skipped, checked } = checkLockfile(lockPath)
    totalChecked += checked

    const known = []
    const fresh = []
    for (const c of conflicts) (isKnown(label, c) ? known : fresh).push(c)

    if (fresh.length === 0) {
      console.log(`  ✅ ${label} (${checked} peer constraints satisfied)`)
    } else {
      failed = true
      console.log(`  ❌ ${label}`)
      for (const c of fresh) console.log(`      ${describe(c)}`)
      console.log('      `npm ci` rejects this tree; fix the version range in package.json and relock.')
    }

    for (const c of known) {
      console.log(`      ⚠️  known: ${describe(c)}`)
      console.log(`          ${isKnown(label, c).reason}`)
    }
    for (const s of skipped) console.log(`      ℹ️  skipped: ${s.reason}`)
  }

  if (failed) {
    process.exitCode = 1
    return false
  }
  console.log(`✅ Lockfile peer dependencies consistent (${totalChecked} constraints checked).`)
  return true
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
