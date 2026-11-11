import { useContext } from 'react'
import { PipelineContext } from './pipeline-context'

export function usePipeline() {
  const context = useContext(PipelineContext)
  if (!context) {
    throw new Error('usePipeline must be used within a PipelineProvider.')
  }
  return context
}
