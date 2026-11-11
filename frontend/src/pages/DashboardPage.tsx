import { useEffect, useState } from 'react'
import { getProducts, getStores } from '../api/forecast'
import type { Product, Store } from '../api/types'
import ProductStoreSelector from '../components/ProductStoreSelector'
import ForecastChart from '../components/ForecastChart'
import ExplanationPanel from '../components/ExplanationPanel'
import KPIBar from '../components/KPIBar'
import PipelineControl from '../components/PipelineControl'
import TrendBackdrop from '../components/TrendBackdrop'
import { usePipeline } from '../context/usePipeline'

function DashboardPage() {
  const { isPipelineBusy, refreshKey } = usePipeline()
  const [products, setProducts] = useState<Product[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedStoreId, setSelectedStoreId] = useState('')

  useEffect(() => {
    if (isPipelineBusy) return

    let cancelled = false
    Promise.all([getProducts(), getStores()])
      .then(([productList, storeList]) => {
        if (cancelled) return
        setLoadError(null)
        setProducts(productList)
        setStores(storeList)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not connect to backend.')
      })

    return () => {
      cancelled = true
    }
  }, [isPipelineBusy, refreshKey])

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-top-row">
          <h1>Sales AI Forecast Tool</h1>
        </div>
        <p className="subtitle">Databricks-powered forecasts and explanations</p>
        <TrendBackdrop />
      </header>

      {loadError && <div className="banner error-banner">{loadError}</div>}

      {isPipelineBusy ? (
        <div className="panel analytics-paused" role="status">
          <h2>Analytics temporarily paused</h2>
          <p>Forecasts and analytics will be available again after the pipeline finishes.</p>
        </div>
      ) : (
        <KPIBar key={refreshKey} />
      )}

      <PipelineControl />

      {!isPipelineBusy && (
        <>
          <ProductStoreSelector
            products={products}
            stores={stores}
            selectedProductId={selectedProductId}
            selectedStoreId={selectedStoreId}
            onSelectProduct={setSelectedProductId}
            onSelectStore={setSelectedStoreId}
          />

          <div className="dashboard-grid">
            <ForecastChart productId={selectedProductId} storeId={selectedStoreId} />

            {selectedProductId && selectedStoreId ? (
              <ExplanationPanel
                key={`${selectedProductId}-${selectedStoreId}-${refreshKey}`}
                productId={selectedProductId}
                storeId={selectedStoreId}
              />
            ) : (
              <div className="panel explanation-panel empty-state">
                <p>Select a product and store to explain the forecast.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default DashboardPage
