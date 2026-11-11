import { NavLink, Outlet } from 'react-router-dom'
import brandLogo from '../assets/retailpulse-ai-logo.png'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'nav-link nav-link--active' : 'nav-link'
}

function Layout() {
  return (
    <div className="app-shell">
      <nav className="topbar">
        <div className="brand">
          <NavLink to="/" className="retailpulse-brand" aria-label="RetailPulse AI home">
            <img src={brandLogo} alt="RetailPulse AI" className="brand-logo-img" />
          </NavLink>
        </div>
        <div className="nav-links">
          <NavLink to="/dashboard" className={navLinkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/analytics" className={navLinkClass}>
            Analytics Chat
          </NavLink>
        </div>
      </nav>
      <Outlet />
    </div>
  )
}

export default Layout
