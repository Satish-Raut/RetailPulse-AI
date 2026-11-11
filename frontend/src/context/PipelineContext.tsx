import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { getPipelineStatus } from '../api/pipeline'
import type { PipelineStatusResponse } from '../api/types'
import { PipelineContext } from './pipeline-context'

const STORAGE_KEY = 'retailpulse.pipelineRunId'
const POLL_INTERVAL_MS = 4000
const TERMINAL_STATES = ['TERMINATED', 'SKIPPED', 'INTERNAL_ERROR']

function getStoredRunId(): number | null {
  if (typeof window === 'undefined') return null
  const stored = window.sessionStorage.getItem(STORAGE_KEY)
  if (!stored) return null

  const runId = Number(stored)
  return Number.isSafeInteger(runId) && runId > 0 ? runId : null
}

export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const [pipelineRunId, setPipelineRunId] = useState<number | null>(getStoredRunId)
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatusResponse | null>(null)
  const [isPipelineBusy, setIsPipelineBusy] = useState(() => getStoredRunId() !== null)
  const [refreshKey, setRefreshKey] = useState(0)

  const beginPipeline = useCallback(() => {
    setIsPipelineBusy(true)
    setPipelineStatus(null)
  }, [])

  const trackPipelineRun = useCallback((runId: number) => {
    window.sessionStorage.setItem(STORAGE_KEY, String(runId))
    setPipelineRunId(runId)
    setIsPipelineBusy(true)
    setPipelineStatus(null)
  }, [])

  const cancelPipeline = useCallback(() => {
    window.sessionStorage.removeItem(STORAGE_KEY)
    setPipelineRunId(null)
    setIsPipelineBusy(false)
  }, [])

  useEffect(() => {
    if (pipelineRunId === null) return

    const runId = pipelineRunId
    let active = true
    let polling = false
    let pollErrorShown = false

    async function poll() {
      if (polling) return
      polling = true

      try {
        const status = await getPipelineStatus(runId)
        if (!active) return

        setPipelineStatus(status)
        if (TERMINAL_STATES.includes(status.life_cycle_state)) {
          window.sessionStorage.removeItem(STORAGE_KEY)
          setPipelineRunId(null)
          setIsPipelineBusy(false)
          setRefreshKey((key) => key + 1)

          if (status.life_cycle_state === 'TERMINATED' && status.result_state === 'SUCCESS') {
            toast.success('Pipeline completed. Analytics have been refreshed.')
          } else {
            toast.error(`Pipeline finished with status: ${status.state_message || status.result_state || status.life_cycle_state}`)
          }
        }
      } catch {
        if (active && !pollErrorShown) {
          pollErrorShown = true
          toast.error('Could not check pipeline status. Analytics remain paused while status checks retry.')
        }
      } finally {
        polling = false
      }
    }

    void poll()
    const intervalId = window.setInterval(() => void poll(), POLL_INTERVAL_MS)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [pipelineRunId])

  const value = useMemo(
    () => ({
      isPipelineBusy,
      pipelineRunId,
      pipelineStatus,
      refreshKey,
      beginPipeline,
      trackPipelineRun,
      cancelPipeline,
    }),
    [isPipelineBusy, pipelineRunId, pipelineStatus, refreshKey, beginPipeline, trackPipelineRun, cancelPipeline],
  )

  return <PipelineContext.Provider value={value}>{children}</PipelineContext.Provider>
}
