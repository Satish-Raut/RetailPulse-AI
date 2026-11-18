import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { createReplenishmentAction, evaluateInventory, getInventoryAlerts, getReplenishmentActions } from '../api/inventory'
import { getProducts, getStores } from '../api/forecast'
import type {
  InventoryActionDecision,
  InventoryAlert,
  InventoryEvaluation,
  Product,
  ReplenishmentAction,
  Store,
} from '../api/types'
import { usePipeline } from '../context/usePipeline'
import './InventoryPage.css'

interface InventoryForm {
  productId: string
  storeId: string
  onHand: string
  inbound: string
  inboundExpectedAt: string
  leadTime: string
  safetyStock: string
}

const INITIAL_FORM: InventoryForm = {
  productId: '',
  storeId: '',
  onHand: '',
  inbound: '0',
  inboundExpectedAt: '',
  leadTime: '14',
  safetyStock: '20',
}

function describeError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (error.response) return `Request failed (${error.response.status}).`
    if (error.code === 'ECONNABORTED') return 'The request timed out. Please try again.'
  }
  return 'Could not complete the inventory request. Please try again.'
}

function riskLabel(risk: InventoryEvaluation['risk_level']): string {
  switch (risk) {
    case 'stockout':
      return 'Potential stockout'
    case 'below_safety_stock':
      return 'Below safety stock'
    case 'healthy':
      return 'Stock above safety level'
    default:
      return 'Risk unavailable'
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function InventoryPage() {
  const { isPipelineBusy } = usePipeline()
  const [products, setProducts] = useState<Product[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [alerts, setAlerts] = useState<InventoryAlert[]>([])
  const [form, setForm] = useState(INITIAL_FORM)
  const [evaluation, setEvaluation] = useState<InventoryEvaluation | null>(null)
  const [selectedAlert, setSelectedAlert] = useState<InventoryAlert | null>(null)
  const [actions, setActions] = useState<ReplenishmentAction[]>([])
  const [actionsAlertId, setActionsAlertId] = useState<string | null>(null)
  const [decision, setDecision] = useState<InventoryActionDecision>('needs_review')
  const [quantityConsidered, setQuantityConsidered] = useState('')
  const [actionNote, setActionNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [actionSubmitting, setActionSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const productNames = useMemo(
    () => new Map(products.map((product) => [product.product_id, product.product_name])),
    [products],
  )
  const storeNames = useMemo(
    () => new Map(stores.map((store) => [store.store_id, store.store_name])),
    [stores],
  )

  async function refreshAlerts() {
    const response = await getInventoryAlerts()
    setAlerts(response.results)
  }

  useEffect(() => {
    let active = true
    Promise.all([getProducts(), getStores(), getInventoryAlerts()])
      .then(([productList, storeList, alertResponse]) => {
        if (!active) return
        setProducts(productList)
        setStores(storeList)
        setAlerts(alertResponse.results)
        setLoadError(null)
      })
      .catch((error: unknown) => {
        if (active) setLoadError(describeError(error))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedAlert) return
    let active = true
    getReplenishmentActions(selectedAlert.id)
      .then((response) => {
        if (active) {
          setActions(response.results)
          setActionsAlertId(selectedAlert.id)
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setActionError(describeError(error))
          toast.error(describeError(error))
        }
      })
    return () => {
      active = false
    }
  }, [selectedAlert])

  function updateField<K extends keyof InventoryForm>(key: K, value: InventoryForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleEvaluate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isPipelineBusy || submitting) return
    if (Number(form.inbound) > 0 && !form.inboundExpectedAt) {
      setLoadError('Add the expected arrival date for inbound inventory, or set inbound quantity to 0.')
      return
    }

    setLoadError(null)
    setEvaluation(null)
    setSubmitting(true)
    try {
      const inboundQuantity = Number(form.inbound)
      const result = await evaluateInventory({
        product_id: form.productId,
        store_id: form.storeId,
        on_hand_qty: Number(form.onHand),
        inbound:
          inboundQuantity > 0
            ? [{ quantity: inboundQuantity, expected_at: new Date(`${form.inboundExpectedAt}T12:00:00`).toISOString() }]
            : [],
        lead_time_days: Number(form.leadTime),
        safety_stock_qty: Number(form.safetyStock),
        source: 'manual',
      })
      setEvaluation(result)
      if (result.alert) {
        setSelectedAlert(result.alert)
        await refreshAlerts()
      }
      toast.success('Inventory snapshot evaluated and saved.')
    } catch (error) {
      const message = describeError(error)
      setLoadError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRecordAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedAlert || actionSubmitting) return
    setActionError(null)
    setActionSubmitting(true)
    try {
      await createReplenishmentAction(selectedAlert.id, {
        decision,
        quantity_considered: quantityConsidered ? Number(quantityConsidered) : null,
        note: actionNote.trim() || null,
      })
      const [actionResponse] = await Promise.all([
        getReplenishmentActions(selectedAlert.id),
        refreshAlerts(),
      ])
      setActions(actionResponse.results)
      setActionNote('')
      setQuantityConsidered('')
      toast.success('Review decision recorded.')
    } catch (error) {
      const message = describeError(error)
      setActionError(message)
      toast.error(message)
    } finally {
      setActionSubmitting(false)
    }
  }

  return (
    <main className="dashboard inventory-page">
      <header className="dashboard-header inventory-header">
        <div className="header-top-row">
          <div>
            <p className="inventory-eyebrow">OPERATIONAL INVENTORY · REPLENISHMENT PLANNING</p>
            <h1>Inventory risk</h1>
          </div>
          <span className="inventory-header-mark" aria-hidden="true">01 / STOCK HEALTH</span>
        </div>
        <p className="subtitle">
          Compare current stock with the demand forecast, detect stockout risks before lead time, and record human-reviewed replenishment decisions.
        </p>
      </header>

      {isPipelineBusy && (
        <div className="inventory-notice" role="status">
          The forecast pipeline is running. Risk evaluation is paused until the refreshed forecast is ready.
        </div>
      )}
      {loadError && <div className="banner error-banner" role="alert">{loadError}</div>}

      <section className="inventory-layout">
        <div className="panel inventory-form-panel">
          <div className="inventory-section-heading">
            <div>
              <span className="inventory-section-index">01</span>
              <h2>Inventory snapshot</h2>
            </div>
            <p>Enter the latest stock information for one product at one store.</p>
          </div>

          {loading ? (
            <p className="inventory-muted">Loading products and stores…</p>
          ) : (
            <form className="inventory-form" onSubmit={(event) => void handleEvaluate(event)}>
              <div className="inventory-form-grid">
                <label className="inventory-field">
                  <div className="inventory-field-label">
                    <span>Product</span>
                  </div>
                  <select
                    value={form.productId}
                    onChange={(event) => updateField('productId', event.target.value)}
                    required
                    disabled={isPipelineBusy || submitting}
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.product_id} value={product.product_id}>
                        {product.product_name} ({product.product_id})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inventory-field">
                  <div className="inventory-field-label">
                    <span>Store</span>
                  </div>
                  <select
                    value={form.storeId}
                    onChange={(event) => updateField('storeId', event.target.value)}
                    required
                    disabled={isPipelineBusy || submitting}
                  >
                    <option value="">Select store</option>
                    {stores.map((store) => (
                      <option key={store.store_id} value={store.store_id}>
                        {store.store_name} ({store.store_id})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inventory-field">
                  <div className="inventory-field-label">
                    <span>On-hand quantity</span>
                    <span className="inventory-field-hint">units</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={form.onHand}
                    onChange={(event) => updateField('onHand', event.target.value)}
                    disabled={isPipelineBusy || submitting}
                    placeholder="e.g. 95"
                  />
                </label>
                <label className="inventory-field">
                  <div className="inventory-field-label">
                    <span>Inbound quantity</span>
                    <span className="inventory-field-hint">units</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={form.inbound}
                    onChange={(event) => updateField('inbound', event.target.value)}
                    disabled={isPipelineBusy || submitting}
                    placeholder="0"
                  />
                </label>
                <label className="inventory-field inventory-field--full">
                  <div className="inventory-field-label">
                    <span>Inbound expected date</span>
                    <span className={`inventory-field-hint ${Number(form.inbound) > 0 ? 'inventory-field-hint--accent' : ''}`}>
                      {Number(form.inbound) > 0 ? 'Required for incoming shipment' : 'Optional when inbound is 0'}
                    </span>
                  </div>
                  <input
                    type="date"
                    value={form.inboundExpectedAt}
                    onChange={(event) => updateField('inboundExpectedAt', event.target.value)}
                    disabled={isPipelineBusy || submitting || Number(form.inbound) === 0}
                    required={Number(form.inbound) > 0}
                  />
                </label>
                <label className="inventory-field">
                  <div className="inventory-field-label">
                    <span>Supplier lead time</span>
                    <span className="inventory-field-hint">days</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    step="1"
                    required
                    value={form.leadTime}
                    onChange={(event) => updateField('leadTime', event.target.value)}
                    disabled={isPipelineBusy || submitting}
                  />
                </label>
                <label className="inventory-field">
                  <div className="inventory-field-label">
                    <span>Safety stock threshold</span>
                    <span className="inventory-field-hint">units</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={form.safetyStock}
                    onChange={(event) => updateField('safetyStock', event.target.value)}
                    disabled={isPipelineBusy || submitting}
                  />
                </label>
              </div>
              <p className="inventory-form-help">
                Snapshots evaluate demand across lead time against your available stock plus inbound arrivals.
              </p>
              <button className="counter inventory-submit" type="submit" disabled={isPipelineBusy || submitting}>
                {submitting ? 'Evaluating forecast…' : 'Save snapshot & evaluate risk'}
                {!submitting && <span aria-hidden="true">→</span>}
              </button>
            </form>
          )}
        </div>

        <div className="inventory-result-column">
          {evaluation ? (
            <section className={`panel inventory-result inventory-result--${evaluation.risk_level}`}>
              <div className="inventory-result-heading">
                <div>
                  <span className="inventory-section-index">EVALUATION</span>
                  <h2>{riskLabel(evaluation.risk_level)}</h2>
                </div>
                <span className={`inventory-risk-tag inventory-risk-tag--${evaluation.risk_level}`}>
                  {evaluation.freshness === 'stale' ? 'STALE INPUT' : evaluation.freshness.toUpperCase()}
                </span>
              </div>
              <p className="inventory-result-explanation">{evaluation.explanation}</p>
              {evaluation.calculation && (
                <div className="inventory-calculation">
                  <div className="inventory-calc-row">
                    <span className="inventory-calc-label">On-hand quantity</span>
                    <strong className="inventory-calc-value">{evaluation.calculation.on_hand_qty.toLocaleString()} units</strong>
                  </div>
                  <div className="inventory-calc-row">
                    <span className="inventory-calc-label">Inbound before lead time</span>
                    <strong className="inventory-calc-value inventory-calc-value--pos">+{evaluation.calculation.inbound_before_lead_time.toLocaleString()} units</strong>
                  </div>
                  <div className="inventory-calc-row">
                    <span className="inventory-calc-label">Forecast demand · {evaluation.calculation.lead_time_days} days</span>
                    <strong className="inventory-calc-value inventory-calc-value--neg">−{evaluation.calculation.forecast_demand_during_lead_time.toLocaleString()} units</strong>
                  </div>
                  <div className="inventory-calc-row inventory-calculation-total">
                    <span className="inventory-calc-label">Projected stock · {formatDate(evaluation.calculation.forecast_end)}</span>
                    <strong className="inventory-calc-value">{evaluation.calculation.projected_stock_at_lead_time.toLocaleString()} units</strong>
                  </div>
                  <div className="inventory-calc-row">
                    <span className="inventory-calc-label">Safety stock threshold</span>
                    <strong className="inventory-calc-value">{evaluation.calculation.safety_stock_qty.toLocaleString()} units</strong>
                  </div>
                </div>
              )}
              <p className="inventory-disclaimer">
                Decision support only. Review inventory accuracy and supplier conditions before acting; no order is placed.
              </p>
            </section>
          ) : (
            <section className="panel inventory-empty-result">
              <span className="inventory-empty-icon" aria-hidden="true">↗</span>
              <h2>Your risk assessment will appear here</h2>
              <p>Submit a current snapshot to compare available inventory with forecast demand during lead time.</p>
            </section>
          )}

          {selectedAlert && (
            <section className="panel inventory-action-panel">
              <div className="inventory-section-heading">
                <div>
                  <span className="inventory-section-index">02</span>
                  <h2>Review this alert</h2>
                </div>
                <p>Record a decision for {selectedAlert.product_id} at {selectedAlert.store_id}.</p>
              </div>
              {actionError && <p className="error-text">{actionError}</p>}
              <form className="inventory-action-form" onSubmit={(event) => void handleRecordAction(event)}>
                <label className="inventory-field">
                  <div className="inventory-field-label">
                    <span>Decision</span>
                  </div>
                  <select value={decision} onChange={(event) => setDecision(event.target.value as InventoryActionDecision)}>
                    <option value="needs_review">Needs further review</option>
                    <option value="replenishment_planned">Replenishment planned</option>
                    <option value="no_action">No action</option>
                  </select>
                </label>
                <label className="inventory-field">
                  <div className="inventory-field-label">
                    <span>Quantity considered</span>
                    <span className="inventory-field-hint">optional</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={quantityConsidered}
                    onChange={(event) => setQuantityConsidered(event.target.value)}
                    placeholder="e.g. 25"
                  />
                </label>
                <label className="inventory-field inventory-field--wide">
                  <div className="inventory-field-label">
                    <span>Review note</span>
                    <span className="inventory-field-hint">optional</span>
                  </div>
                  <textarea
                    value={actionNote}
                    onChange={(event) => setActionNote(event.target.value)}
                    maxLength={2000}
                    rows={3}
                    placeholder="Add context for this decision…"
                  />
                </label>
                <button className="counter inventory-action-submit" type="submit" disabled={actionSubmitting}>
                  {actionSubmitting ? 'Saving review…' : 'Record decision'}
                  {!actionSubmitting && <span aria-hidden="true">→</span>}
                </button>
              </form>
              {actionsAlertId === selectedAlert.id && actions.length > 0 && (
                <div className="inventory-action-history">
                  <h3>Decision history</h3>
                  {actions.map((action) => (
                    <article key={action.id}>
                      <div><strong>{action.decision.replaceAll('_', ' ')}</strong><time>{formatDate(action.created_at)}</time></div>
                      {action.quantity_considered !== null && <span>{action.quantity_considered} units considered</span>}
                      {action.note && <p>{action.note}</p>}
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </section>

      <section className="panel inventory-alerts-panel">
        <div className="inventory-section-heading">
          <div>
            <span className="inventory-section-index">03</span>
            <h2>Risk alert history</h2>
          </div>
          <p>Select any recorded alert to review its details and log decisions.</p>
        </div>
        {alerts.length === 0 ? (
          <p className="inventory-muted">No inventory risk alerts have been recorded yet.</p>
        ) : (
          <div className="inventory-alert-container">
            <div className="inventory-alert-header-row" aria-hidden="true">
              <span className="col-indicator" />
              <span className="col-product">Product & Store</span>
              <span className="col-risk">Risk Assessment</span>
              <span className="col-stock">Projected Stock</span>
              <span className="col-status">Status</span>
              <span className="col-date">Date Logged</span>
              <span className="col-open" />
            </div>
            <div className="inventory-alert-list">
              {alerts.map((alert) => (
                <button
                  type="button"
                  key={alert.id}
                  className={`inventory-alert-row${selectedAlert?.id === alert.id ? ' inventory-alert-row--selected' : ''}`}
                  onClick={() => {
                    setSelectedAlert(alert)
                    setActionError(null)
                  }}
                >
                  <span className="col-indicator">
                    <span className={`inventory-alert-indicator inventory-alert-indicator--${alert.risk_level}`} />
                  </span>
                  <span className="col-product inventory-alert-product">
                    <strong>{productNames.get(alert.product_id) ?? alert.product_id}</strong>
                    <small>{alert.product_id} · {storeNames.get(alert.store_id) ?? alert.store_id}</small>
                  </span>
                  <span className="col-risk">
                    <span className={`inventory-alert-level-badge inventory-alert-level-badge--${alert.risk_level}`}>
                      {riskLabel(alert.risk_level)}
                    </span>
                  </span>
                  <span className="col-stock inventory-alert-stock">
                    <strong>{alert.calculation.projected_stock_at_lead_time.toLocaleString()}</strong> units
                  </span>
                  <span className="col-status">
                    <span className="inventory-alert-status">{alert.status.replace(/_/g, ' ')}</span>
                  </span>
                  <time className="col-date">{formatDate(alert.created_at)}</time>
                  <span className="col-open inventory-alert-open" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

export default InventoryPage
