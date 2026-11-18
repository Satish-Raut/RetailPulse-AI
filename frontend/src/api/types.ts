export interface Product {
  product_id: string
  product_name: string
  category: string
}

export interface Store {
  store_id: string
  store_name: string
  city: string
  region: string
}

export interface TrendPoint {
  date: string
  actual_units: number | null
  predicted_units: number | null
}

export interface ForecastHistoryResponse {
  product_id: string
  store_id: string
  history_days: number
  points: TrendPoint[]
}

export interface ForecastSummary {
  avg_predicted_units: number
  total_predicted_units: number
  vs_recent_history_pct_change: number | null
}

export interface ForecastExplanation {
  product_id: string
  store_id: string
  forecast_summary: ForecastSummary
  explanation: string
  key_drivers: string[]
  risks_or_opportunities: string[]
  recommendation: string
  model_version: string
}

export interface ChatTurnHistory {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  answer: string
  data: Record<string, unknown>
  functions_used: string[]
}

export interface TopCategoryStat {
  days: number
  category: string | null
  total_units: number | null
}

export interface TopProductStat {
  days: number
  product_id: string | null
  product_name: string | null
  total_units: number | null
}

export interface PredictedRevenueStat {
  total_predicted_units: number | null
  total_predicted_revenue: number | null
  note: string | null
}

export interface KPISummary {
  top_category: TopCategoryStat
  top_product: TopProductStat
  predicted_revenue: PredictedRevenueStat
  at_risk_count: number
}

export interface UploadedFileInfo {
  filename: string
  volume_path: string
}

export interface PipelineUploadResponse {
  files: UploadedFileInfo[]
  status: string
}

export interface PipelineTriggerResponse {
  run_id: number
  status: string
}

export interface PipelineUploadAndTriggerResponse {
  files: UploadedFileInfo[]
  run_id: number
  status: string
}

export interface PipelineStatusResponse {
  run_id: number
  life_cycle_state: string
  result_state: string | null
  state_message: string | null
}

export interface InventoryInboundShipment {
  quantity: number
  expected_at: string
}

export interface InventorySnapshotInput {
  store_id: string
  product_id: string
  on_hand_qty: number
  inbound: InventoryInboundShipment[]
  lead_time_days: number
  safety_stock_qty: number
  source: string
}

export interface InventoryCalculation {
  on_hand_qty: number
  inbound_before_lead_time: number
  forecast_demand_during_lead_time: number
  projected_stock_at_lead_time: number
  safety_stock_qty: number
  lead_time_days: number
  forecast_start: string
  forecast_end: string
}

export type InventoryRiskLevel = 'stockout' | 'below_safety_stock' | 'healthy' | 'unavailable'

export interface InventorySnapshot {
  id: string
  store_id: string
  product_id: string
  on_hand_qty: number
  inbound: InventoryInboundShipment[]
  lead_time_days: number
  safety_stock_qty: number
  source: string
  observed_at: string
  created_at: string
}

export interface InventoryAlert {
  id: string
  store_id: string
  product_id: string
  snapshot_id: string
  forecast_start: string
  forecast_end: string
  risk_level: Exclude<InventoryRiskLevel, 'healthy' | 'unavailable'>
  calculation: InventoryCalculation
  rule_version: string
  status: 'open' | 'reviewed'
  created_at: string
  updated_at: string
}

export interface InventoryEvaluation {
  snapshot: InventorySnapshot
  freshness: 'current' | 'stale'
  risk_level: InventoryRiskLevel
  explanation: string
  calculation: InventoryCalculation | null
  alert: InventoryAlert | null
}

export type InventoryActionDecision = 'replenishment_planned' | 'no_action' | 'needs_review'

export interface ReplenishmentActionInput {
  decision: InventoryActionDecision
  quantity_considered?: number | null
  note?: string | null
}

export interface ReplenishmentAction {
  id: string
  alert_id: string
  decision: InventoryActionDecision
  quantity_considered: number | null
  note: string | null
  created_at: string
}
