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
      >
        <Drawer.Portal>
          <Drawer.Content
            className="fixed bottom-0 left-0 right-0 z-20 flex flex-col rounded-t-2xl shadow-2xl outline-none overflow-hidden"
            style={{
              background: 'var(--paper)',
              color: 'var(--ink)',
              height: `${Math.max(...snapPoints) * 100}vh`,
            }}
          >
            {children}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </SheetContext.Provider>
  )
}
