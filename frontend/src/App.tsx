import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import AnalyticsChatPage from './pages/AnalyticsChatPage'
import { PipelineProvider } from './context/PipelineContext'
import { Toaster } from 'react-hot-toast'
import './App.css'

function App() {
  return (
    <PipelineProvider>
      <Toaster position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/analytics" element={<AnalyticsChatPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PipelineProvider>
  )
}

export default App
