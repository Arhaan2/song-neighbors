import { useEffect, useState, useSyncExternalStore } from 'react'
import { createRecommendationClient } from '../recommend/browser.ts'
import { createSongNeighborsController } from './controller.ts'

export function useSongNeighbors() {
  // Construction does not start a worker; the effect owns its lifetime, including
  // StrictMode's setup → cleanup → setup and abandoned concurrent renders.
  const [controller] = useState(() => createSongNeighborsController(createRecommendationClient))
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  useEffect(() => {
    controller.start()
    return () => controller.dispose()
  }, [controller])
  return { ...snapshot, ...controller.actions }
}
