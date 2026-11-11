import { createContext } from 'react'
import type { PipelineStatusResponse } from '../api/types'

export interface PipelineContextValue {
  isPipelineBusy: boolean
  pipelineRunId: number | null
  pipelineStatus: PipelineStatusResponse | null
  refreshKey: number
  beginPipeline: () => void
  trackPipelineRun: (runId: number) => void
  cancelPipeline: () => void
}

export const PipelineContext = createContext<PipelineContextValue | null>(null)
