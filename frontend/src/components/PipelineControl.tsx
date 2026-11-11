import { useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { triggerPipeline, uploadAndTriggerPipeline } from '../api/pipeline'
import type { PipelineStatusResponse } from '../api/types'
import { usePipeline } from '../context/usePipeline'

interface FilePick {
  file: File
  error: string | null
}

const SALES_PREFIX = 'sales_transactions'
const CALENDAR_PREFIX = 'calendar_marketing_external'

function describeError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') return 'The request timed out. Please try again.'
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (error.response) return `Request failed (${error.response.status}).`
  }
  return 'Something went wrong. Please try again.'
}

function validateFilename(filename: string, expectedPrefix: string): string | null {
  if (!filename.toLowerCase().endsWith('.csv')) {
    return 'Only CSV files are accepted.'
  }
  if (!filename.toLowerCase().startsWith(expectedPrefix)) {
    return `Filename must start with ${expectedPrefix}.`
  }
  return null
}

function getFilePick(event: React.ChangeEvent<HTMLInputElement>, expectedPrefix: string): FilePick | null {
  const file = event.target.files?.[0]
  return file ? { file, error: validateFilename(file.name, expectedPrefix) } : null
}

function statusLabel(status: PipelineStatusResponse): { text: string; tone: 'pending' | 'running' | 'success' | 'failed' } {
  const { life_cycle_state, result_state, state_message } = status

  if (life_cycle_state === 'TERMINATED') {
    if (result_state === 'SUCCESS') return { text: 'Success', tone: 'success' }
    return { text: `Failed: ${state_message || result_state || 'unknown error'}`, tone: 'failed' }
  }
  if (life_cycle_state === 'INTERNAL_ERROR') {
    return { text: `Failed: ${state_message || 'internal error'}`, tone: 'failed' }
  }
  if (life_cycle_state === 'SKIPPED') {
    return { text: 'Skipped', tone: 'failed' }
  }
  if (life_cycle_state === 'RUNNING' || life_cycle_state === 'TERMINATING') {
    return { text: 'Running…', tone: 'running' }
  }
  if (life_cycle_state === 'PENDING' || life_cycle_state === 'QUEUED') {
    return { text: 'Queued…', tone: 'pending' }
  }
  if (life_cycle_state === 'WAITING_FOR_RETRY') {
    return { text: 'Waiting to retry…', tone: 'pending' }
  }
  return { text: life_cycle_state, tone: 'pending' }
}

function PipelineControl() {
  const [salesFile, setSalesFile] = useState<FilePick | null>(null)
  const [calendarFile, setCalendarFile] = useState<FilePick | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const {
    isPipelineBusy,
    pipelineRunId,
    pipelineStatus,
    beginPipeline,
    trackPipelineRun,
    cancelPipeline,
  } = usePipeline()
  const busy = isPipelineBusy || submitting

  const filePicks = [salesFile, calendarFile].filter((pick): pick is FilePick => pick !== null)
  const hasInvalidFile = filePicks.some((pick) => pick.error !== null)

  async function handleUploadAndTrigger() {
    if (filePicks.length === 0 || hasInvalidFile) return

    setActionError(null)
    setSubmitting(true)
    beginPipeline()
    const toastId = toast.loading('Uploading files and starting the pipeline…')
    try {
      const result = await uploadAndTriggerPipeline(filePicks.map((pick) => pick.file))
      trackPipelineRun(result.run_id)
      toast.success(`Pipeline run #${result.run_id} started. Analytics are paused until it finishes.`, { id: toastId })
    } catch (error) {
      cancelPipeline()
      const message = describeError(error)
      setActionError(message)
      toast.error(message, { id: toastId })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleTriggerOnly() {
    setActionError(null)
    setSubmitting(true)
    beginPipeline()
    const toastId = toast.loading('Starting the pipeline…')
    try {
      const result = await triggerPipeline()
      trackPipelineRun(result.run_id)
      toast.success(`Pipeline run #${result.run_id} started. Analytics are paused until it finishes.`, { id: toastId })
    } catch (error) {
      cancelPipeline()
      const message = describeError(error)
      setActionError(message)
      toast.error(message, { id: toastId })
    } finally {
      setSubmitting(false)
    }
  }

  const label = pipelineStatus ? statusLabel(pipelineStatus) : null

  return (
    <div className="panel pipeline-panel">
      <h2>Retrain Forecasting Model</h2>
      <p className="pipeline-hint pipeline-subtitle">
        Ingests sales data through Bronze → Silver → Gold, retrains the model, and generates a
        fresh 30-day forecast.
      </p>

      <div className="pipeline-actions">
        <div className="pipeline-action">
          <p className="pipeline-action-title">Upload New Data &amp; Retrain</p>
          <p className="pipeline-hint">
            Choose the sales transactions file, calendar/marketing file, or both. Each file must be a
            CSV with the matching filename prefix shown below.
          </p>
          <label className="pipeline-file-field">
            <span>Sales transactions CSV <small>(filename starts with {SALES_PREFIX})</small></span>
            <input
              type="file"
              accept=".csv"
              onChange={(event) => setSalesFile(getFilePick(event, SALES_PREFIX))}
              disabled={busy}
            />
            {salesFile && (
              <span className={salesFile.error ? 'error-text' : 'pipeline-file-name'}>
                {salesFile.file.name}{salesFile.error ? ` — ${salesFile.error}` : ''}
              </span>
            )}
          </label>
          <label className="pipeline-file-field">
            <span>Calendar/marketing CSV <small>(filename starts with {CALENDAR_PREFIX})</small></span>
            <input
              type="file"
              accept=".csv"
              onChange={(event) => setCalendarFile(getFilePick(event, CALENDAR_PREFIX))}
              disabled={busy}
            />
            {calendarFile && (
              <span className={calendarFile.error ? 'error-text' : 'pipeline-file-name'}>
                {calendarFile.file.name}{calendarFile.error ? ` — ${calendarFile.error}` : ''}
              </span>
            )}
          </label>
          <button
            type="button"
            className="counter"
            onClick={() => void handleUploadAndTrigger()}
            disabled={busy || filePicks.length === 0 || hasInvalidFile}
          >
            {busy ? 'Working…' : 'Upload & Retrain'}
          </button>
        </div>

        <div className="pipeline-action">
          <p className="pipeline-action-title">Retrain on Existing Data</p>
          <p className="pipeline-hint">
            Re-run training using the data already uploaded -- no new file needed.
          </p>
          <button type="button" className="counter" onClick={() => void handleTriggerOnly()} disabled={busy}>
            {busy ? 'Working…' : 'Retrain Model'}
          </button>
        </div>
      </div>

      {actionError && <p className="error-text">{actionError}</p>}

      {pipelineRunId && (
        <div className="pipeline-status">
          <span>Training run #{pipelineRunId}:</span>
          {label ? (
            <span className={`status-badge status-badge--${label.tone}`}>
              {label.tone === 'running' || label.tone === 'pending' ? <span className="spinner" /> : null}
              {label.text}
            </span>
          ) : (
            <span className="status-badge status-badge--pending">
              <span className="spinner" /> Checking…
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default PipelineControl
