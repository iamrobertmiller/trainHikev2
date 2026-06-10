// Pure drawing helper for the trip-route polyline overlay.
// Extracted from Map.tsx so the projection→canvas pipeline can be unit-tested
// without a live MapLibre/WebGL context.

export type ProjectFn = (lngLat: [number, number]) => { x: number; y: number }

const CASING_COLOR = 'rgba(255,255,255,0.85)'
const LINE_COLOR = '#10b981'
const CASING_WIDTH = 9
const LINE_WIDTH = 5

/**
 * Draws the station→destination route onto a 2D canvas using map.project()
 * pixel coordinates. Always clears first. Returns true if a line was drawn,
 * false if there was nothing to draw (cleared only).
 */
export function drawTripRoute(
  canvas: HTMLCanvasElement,
  project: ProjectFn,
  coords: [number, number][],
  dpr: number,
): boolean {
  const w = canvas.offsetWidth
  const h = canvas.offsetHeight
  if (w === 0 || h === 0) return false

  // Match the pixel buffer to CSS size × devicePixelRatio for sharp lines.
  const pxW = Math.round(w * dpr)
  const pxH = Math.round(h * dpr)
  if (canvas.width !== pxW || canvas.height !== pxH) {
    canvas.width = pxW
    canvas.height = pxH
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  if (coords.length < 2) return false

  const pts = coords.map(project)

  const trace = () => {
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  }

  // White casing underneath so the line is visible on any basemap colour
  trace()
  ctx.strokeStyle = CASING_COLOR
  ctx.lineWidth = CASING_WIDTH
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()

  // Green route on top
  trace()
  ctx.strokeStyle = LINE_COLOR
  ctx.lineWidth = LINE_WIDTH
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()

  return true
}
