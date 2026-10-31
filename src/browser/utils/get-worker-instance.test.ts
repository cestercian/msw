// @vitest-environment jsdom
import { getWorkerInstance } from './get-worker-instance'

const workerUrl = '/mockServiceWorker.js'
const absoluteWorkerUrl = 'http://localhost/mockServiceWorker.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('resolves when a background worker update rejects', async () => {
  const unhandledRejectionListener = vi.fn()
  process.on('unhandledRejection', unhandledRejectionListener)
  vi.spyOn(console, 'warn').mockImplementation(() => {})

  const worker = {
    scriptURL: absoluteWorkerUrl,
    state: 'activated',
  }
  const updateError = new DOMException(
    'An attempt was made to use an object that is not, or is no longer, usable',
    'InvalidStateError',
  )
  // A plain function, not vi.fn(). Vitest's spies attach a rejection
  // handler to returned promises, which would hide the leak this guards.
  let updateCalls = 0
  const registration = {
    active: worker,
    installing: null,
    waiting: null,
    update: () => {
      updateCalls += 1
      return Promise.reject(updateError)
    },
  }

  vi.stubGlobal('navigator', {
    serviceWorker: {
      controller: worker,
      getRegistrations: vi.fn(async () => [registration]),
      register: vi.fn(),
    },
  })

  try {
    await expect(
      getWorkerInstance(workerUrl, {}, (scriptURL, url) => scriptURL === url),
    ).resolves.toEqual([worker, registration])

    // Give an unobserved rejection a chance to surface.
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(updateCalls).toBe(1)
    expect(unhandledRejectionListener).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
  } finally {
    process.off('unhandledRejection', unhandledRejectionListener)
  }
})
