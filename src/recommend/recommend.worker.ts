import { createWorkerHandler } from './worker-runtime.ts'
import type { WorkerResponse } from './protocol.ts'

// Structural scope avoids including conflicting DOM and WebWorker global declarations.
const scope = globalThis as unknown as {
  postMessage(message: WorkerResponse): void
  onmessage: ((event: MessageEvent<unknown>) => void) | null
}
const handle = createWorkerHandler((message) => scope.postMessage(message))
scope.onmessage = (event) => { void handle(event.data) }
