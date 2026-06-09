// Run with: node --experimental-strip-types app/src/lib/routeCanvas.test.ts
import { drawTripRoute } from './routeCanvas.ts'

type Call = [string, ...unknown[]]

function makeCtx() {
  const calls: Call[] = []
  const ctx = {
    calls,
    setTransform: (...a: number[]) => calls.push(['setTransform', ...a]),
    clearRect: (...a: number[]) => calls.push(['clearRect', ...a]),
    beginPath: () => calls.push(['beginPath']),
    moveTo: (x: number, y: number) => calls.push(['moveTo', x, y]),
    lineTo: (x: number, y: number) => calls.push(['lineTo', x, y]),
    stroke: () => calls.push(['stroke']),
    set strokeStyle(v: string) { calls.push(['strokeStyle', v]) },
    set lineWidth(v: number) { calls.push(['lineWidth', v]) },
    set lineCap(v: string) { calls.push(['lineCap', v]) },
    set lineJoin(v: string) { calls.push(['lineJoin', v]) },
  }
  return ctx
}

function makeCanvas(ctx: unknown) {
  return {
    offsetWidth: 400,
    offsetHeight: 600,
    width: 0,
    height: 0,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement
}

let failures = 0
function assert(cond: boolean, msg: string) {
  if (!cond) { failures++; console.error('  ✗ ' + msg) }
  else console.log('  ✓ ' + msg)
}
function eq(a: unknown, b: unknown, msg: string) {
  assert(JSON.stringify(a) === JSON.stringify(b), `${msg}  (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`)
}

const project = ([lng, lat]: [number, number]) => ({ x: lng * 10, y: lat * 10 })

// --- Test 1: draws casing + green line through projected points -----------
{
  console.log('Test 1: full route renders both strokes through projected points')
  const ctx = makeCtx()
  const canvas = makeCanvas(ctx)
  const coords: [number, number][] = [[1, 2], [3, 4], [5, 6]]
  const drew = drawTripRoute(canvas, project, coords, 2)

  assert(drew === true, 'returns true when a line is drawn')
  eq(canvas.width, 800, 'canvas pixel width = offsetWidth(400) × dpr(2)')
  eq(canvas.height, 1200, 'canvas pixel height = offsetHeight(600) × dpr(2)')

  const moveTos = ctx.calls.filter(c => c[0] === 'moveTo')
  const lineTos = ctx.calls.filter(c => c[0] === 'lineTo')
  const strokes = ctx.calls.filter(c => c[0] === 'stroke')
  eq(moveTos.length, 2, 'two moveTo calls (casing + green)')
  eq(lineTos.length, 4, 'four lineTo calls (2 segments × 2 passes)')
  eq(strokes.length, 2, 'two stroke calls')

  // projected first point of each pass = (1*10, 2*10)
  eq(moveTos[0], ['moveTo', 10, 20], 'casing starts at projected first point')
  eq(lineTos[0], ['lineTo', 30, 40], 'casing line to projected second point')
  eq(lineTos[1], ['lineTo', 50, 60], 'casing line to projected third point')

  const styles = ctx.calls.filter(c => c[0] === 'strokeStyle').map(c => c[1])
  eq(styles, ['rgba(255,255,255,0.85)', '#10b981'], 'white casing under, green line on top')

  const widths = ctx.calls.filter(c => c[0] === 'lineWidth').map(c => c[1])
  eq(widths, [9, 5], 'casing wider (9) than line (5)')

  // setTransform applies dpr; clearRect uses CSS size
  assert(ctx.calls.some(c => c[0] === 'setTransform' && c[1] === 2), 'setTransform uses dpr=2')
  assert(ctx.calls.some(c => JSON.stringify(c) === JSON.stringify(['clearRect', 0, 0, 400, 600])), 'clearRect uses CSS size')
}

// --- Test 2: fewer than 2 coords clears but draws nothing ------------------
{
  console.log('Test 2: single coord clears only, no stroke')
  const ctx = makeCtx()
  const canvas = makeCanvas(ctx)
  const drew = drawTripRoute(canvas, project, [[1, 2]], 1)
  assert(drew === false, 'returns false with <2 coords')
  assert(ctx.calls.some(c => c[0] === 'clearRect'), 'still clears the canvas')
  assert(!ctx.calls.some(c => c[0] === 'moveTo'), 'no moveTo / no line drawn')
}

// --- Test 3: empty coords (route closed) clears the overlay ----------------
{
  console.log('Test 3: empty coords clears overlay')
  const ctx = makeCtx()
  const canvas = makeCanvas(ctx)
  const drew = drawTripRoute(canvas, project, [], 1)
  assert(drew === false, 'returns false with no coords')
  assert(!ctx.calls.some(c => c[0] === 'stroke'), 'nothing stroked')
}

// --- Test 4: zero-sized canvas bails safely -------------------------------
{
  console.log('Test 4: zero-sized canvas is a safe no-op')
  const ctx = makeCtx()
  const canvas = makeCanvas(ctx)
  ;(canvas as unknown as { offsetWidth: number }).offsetWidth = 0
  const drew = drawTripRoute(canvas, project, [[1, 2], [3, 4]], 1)
  assert(drew === false, 'returns false when canvas has no size')
  assert(ctx.calls.length === 0, 'no drawing calls on a 0-size canvas')
}

console.log('')
if (failures > 0) { console.error(`FAILED: ${failures} assertion(s)`); process.exit(1) }
console.log('ALL TESTS PASSED')
