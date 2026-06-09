import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Drawer } from 'vaul'
import { useIsMobile } from '../hooks/useIsMobile'

interface SheetCtx { closeSheet: () => void }
const SheetContext = createContext<SheetCtx>({ closeSheet: () => {} })
export const useSheet = () => useContext(SheetContext)

interface Props {
  onClose: () => void
  /** Snap point fractions [peek, expanded]. Default: [0.12, 0.65] */
  snapPoints?: number[]
  /** Classes applied to the wrapper div on desktop */
  desktopClassName: string
  children: ReactNode
}

export function BottomSheet({ onClose, snapPoints = [0.12, 0.65], desktopClassName, children }: Props) {
  const isMobile = useIsMobile()
  // Start closed so the tap-event that triggered mounting doesn't land on vaul's drag handlers
  const [open, setOpen] = useState(false)
  const [snap, setSnap] = useState<number | string | null>(snapPoints[snapPoints.length - 1])

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const closeSheet = useCallback(() => {
    if (isMobile) {
      setOpen(false)
    } else {
      onClose()
    }
  }, [isMobile, onClose])

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.offsetTop - vv.height)
      document.documentElement.style.setProperty('--vv-bottom-inset', `${inset}px`)
    }
    vv.addEventListener('resize', update)
    update()
    return () => vv.removeEventListener('resize', update)
  }, [])

  if (!isMobile) {
    return (
      <SheetContext.Provider value={{ closeSheet }}>
        <div className={desktopClassName} style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
          {children}
        </div>
      </SheetContext.Provider>
    )
  }

  return (
    <SheetContext.Provider value={{ closeSheet }}>
      <Drawer.Root
        open={open}
        onOpenChange={o => { if (!o) onClose() }}
        snapPoints={snapPoints}
        activeSnapPoint={snap}
        setActiveSnapPoint={setSnap}
        modal={false}
        noBodyStyles
      >
        <Drawer.Portal>
          {/*
           * pointer-events: none on the content element lets map touches pass through
           * the invisible translated portion of the sheet. Events from the inner div
           * (pointer-events: auto) still bubble up so vaul's drag handlers fire normally.
           * noBodyStyles prevents vaul from setting position:fixed on body, which
           * would freeze MapLibre's coordinate system on iOS Safari.
           */}
          <Drawer.Content
            className="fixed bottom-0 left-0 right-0 z-20 rounded-t-2xl shadow-2xl outline-none"
            style={{
              background: 'var(--paper)',
              color: 'var(--ink)',
              height: `${Math.max(...snapPoints) * 100}dvh`,
              pointerEvents: 'none',
            }}
          >
            {/*
             * overflow-hidden is intentionally on the inner div rather than Drawer.Content.
             * On WebKit/iOS Safari, overflow:hidden on a CSS-transformed parent clips child
             * hit-test areas to the *untransformed* layout box, not the visual position —
             * so at any non-maximum snap point the hit area would extend upward into the
             * visible map area and swallow taps. Placing overflow-hidden on the child (which
             * moves with the transform) gives the correct clipped hit region.
             */}
            <div className="flex flex-col h-full overflow-hidden rounded-t-2xl" style={{ pointerEvents: 'auto' }}>
              {children}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </SheetContext.Provider>
  )
}
