import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getForecastWithHistory } from '../api/forecast'
import type { TrendPoint } from '../api/types'

interface ForecastChartProps {
  productId: string
  storeId: string
}

function ForecastChart({ productId, storeId }: ForecastChartProps) {
  const [points, setPoints] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!productId || !storeId) {
      setPoints([])
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    getForecastWithHistory(productId, storeId, 90)
      .then((response) => {
        if (!cancelled) setPoints(response.points)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load forecast data.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [productId, storeId])

  if (!productId || !storeId) {
    return (
      <div className="panel chart-panel empty-state">
        <p>Select a product and store to see the forecast.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="panel chart-panel empty-state">
        <span className="spinner" aria-label="Loading forecast" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="panel chart-panel empty-state">
        <p className="error-text">{error}</p>
      </div>
    )
  }

  // The history/forecast boundary is the last date with a real actual value,
  // not the real wall-clock "today" -- this dataset's calendar is simulated
  // and won't generally line up with whenever the dashboard happens to be viewed.
  const boundaryDate = [...points].reverse().find((point) => point.actual_units !== null)?.date

  return (
    <div className="panel chart-panel">
      <h2>Forecast vs. actuals</h2>
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={points} margin={{ top: 26, right: 28, left: 0, bottom: 6 }}>
          <defs>
            <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.20} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="predictedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.20} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#9ca3af"
            fontSize={13}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
          />
          <YAxis
            stroke="#9ca3af"
            fontSize={13}
            tickLine={false}
            axisLine={false}
            label={{ value: 'Units sold', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 13 }}
          />
          <Tooltip
            contentStyle={{
              background: '#15181f',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 10,
              color: '#f9fafb',
              fontSize: 14.5,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 14, color: '#9ca3af', paddingTop: 10 }}
          />
          {boundaryDate && (
            <ReferenceLine
              x={boundaryDate}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{ value: 'Today', position: 'top', fill: '#f59e0b', fontSize: 13 }}
            />
          )}
          <Area
            type="monotone"
            dataKey="actual_units"
            name="Actual"
            stroke="#10b981"
            strokeWidth={2.5}
            fill="url(#actualFill)"
            dot={false}
            activeDot={{ r: 4, fill: '#10b981' }}
            connectNulls={false}
          />
          <Area
            type="monotone"
            dataKey="predicted_units"
            name="Predicted"
            stroke="#f59e0b"
            strokeWidth={2.5}
            strokeDasharray="6 4"
            fill="url(#predictedFill)"
            dot={false}
            activeDot={{ r: 4, fill: '#f59e0b' }}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ForecastChart
