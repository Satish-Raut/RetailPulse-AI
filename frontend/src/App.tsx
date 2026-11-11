import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import LandingPage from './pages/LandingPage'
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
          <Route path="/" element={<LandingPage />} />
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/analytics" element={<AnalyticsChatPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PipelineProvider>
  )
}

export default App
