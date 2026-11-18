import apiClient from './client'
import type {
  InventoryAlert,
  InventoryEvaluation,
  InventorySnapshot,
  InventorySnapshotInput,
  ReplenishmentAction,
  ReplenishmentActionInput,
} from './types'

interface ListResponse<T> {
  count: number
  results: T[]
}

export async function evaluateInventory(input: InventorySnapshotInput): Promise<InventoryEvaluation> {
  const { data } = await apiClient.post<InventoryEvaluation>('/inventory/evaluate', input, {
    timeout: 60000,
  })
  return data
}

export async function getInventorySnapshots(): Promise<ListResponse<InventorySnapshot>> {
  const { data } = await apiClient.get<ListResponse<InventorySnapshot>>('/inventory/snapshots', {
    timeout: 30000,
  })
  return data
}

export async function getInventoryAlerts(): Promise<ListResponse<InventoryAlert>> {
  const { data } = await apiClient.get<ListResponse<InventoryAlert>>('/inventory/alerts', {
    timeout: 30000,
  })
  return data
}

export async function getReplenishmentActions(alertId: string): Promise<ListResponse<ReplenishmentAction>> {
  const { data } = await apiClient.get<ListResponse<ReplenishmentAction>>(
    `/inventory/alerts/${encodeURIComponent(alertId)}/actions`,
  )
  return data
}

export async function createReplenishmentAction(
  alertId: string,
  input: ReplenishmentActionInput,
): Promise<ReplenishmentAction> {
  const { data } = await apiClient.post<ReplenishmentAction>(
    `/inventory/alerts/${encodeURIComponent(alertId)}/actions`,
    input,
  )
  return data
}
