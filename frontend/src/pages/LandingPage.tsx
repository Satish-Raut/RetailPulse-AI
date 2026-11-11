import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import brandLogo from '../assets/retailpulse-ai-logo.png'
import './LandingPage.css'

const steps = [
  {
    number: '01',
    title: 'Choose your view',
    description: 'Select a product and store to focus on the part of your business you want to understand.',
  },
  {
    number: '02',
    title: 'Explore the forecast',
    description: 'See historical sales alongside the next 30 days, with key performance indicators at a glance.',
  },
  {
    number: '03',
    title: 'Ask a better question',
    description: 'Use analytics chat and forecast explanations to turn the numbers into a clearer business picture.',
  },
  {
    number: '04',
    title: 'Refresh when things change',
    description: 'Upload new sales or calendar data and retrain the pipeline to create an updated forecast.',
  },
]

const audiences = [
  {
    number: '01',
    title: 'Retail teams',
    description: 'Spot demand shifts sooner and make more informed product and store decisions.',
  },
  {
    number: '02',
    title: 'Data practitioners',
    description: 'Explore a practical forecasting workflow, from curated data through to useful insights.',
  },
  {
    number: '03',
    title: 'Builders & learners',
    description: 'See how forecasting, analytics, and AI can come together in a hands-on retail platform.',
  },
]

function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className={`landing-brand${light ? ' landing-brand--light' : ''}`}>
      <img src={brandLogo} alt="RetailPulse AI" className="landing-brand-img" />
    </span>
  )
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="M3.5 10h12m-5-5 5 5-5 5" />
    </svg>
  )
}

function LandingPage() {
  const footerBrandRef = useRef<HTMLDivElement | null>(null)
  const [footerBrandVisible, setFooterBrandVisible] = useState(false)

  useEffect(() => {
    const element = footerBrandRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setFooterBrandVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.18 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Main navigation">
        <a className="landing-logo-link" href="#home" aria-label="RetailPulse AI home">
          <Brand />
        </a>
        <div className="landing-nav-links">
          <a href="#platform">Platform</a>
          <a href="#how-it-works">How it works</a>
          <a href="#who-its-for">Who it’s for</a>
        </div>
        <Link className="landing-nav-cta" to="/dashboard">
          Open dashboard <ArrowIcon />
        </Link>
      </nav>

      <section className="landing-hero" id="home">
        <div className="landing-hero-copy">
          <div className="landing-eyebrow"><span /> RETAIL INTELLIGENCE, IN FOCUS</div>
          <h1>Make your next move <span>your best one.</span></h1>
          <p>
            RetailPulse AI brings sales forecasting and clear business insights together, so you can
            understand what’s happening today and plan for what comes next.
          </p>
          <div className="landing-hero-actions">
            <Link className="landing-button landing-button--primary" to="/dashboard">
              Explore the dashboard <ArrowIcon />
            </Link>
            <a className="landing-text-link" href="#platform">Discover the platform</a>
          </div>
          <div className="landing-hero-note">
            <span className="landing-note-icon" aria-hidden="true">↗</span>
            <span>From daily sales signals to a clearer 30-day outlook.</span>
          </div>
        </div>
        <div className="landing-scroll-cue" aria-hidden="true"><span /> SCROLL</div>
      </section>

      <section className="landing-proof-strip" aria-label="Platform highlights">
        <span>BUILT FOR RETAIL DECISIONS</span>
        <i />
        <span>30-DAY FORECASTING</span>
        <i />
        <span>EXPLAINABLE INSIGHTS</span>
        <i />
        <span>DATA-INFORMED ACTION</span>
      </section>

      <section className="landing-section platform-section" id="platform">
        <div className="section-intro">
          <span className="section-kicker">01 / THE PLATFORM</span>
          <h2>Good decisions start with <span>seeing the whole picture.</span></h2>
          <p>
            RetailPulse AI helps make retail data easier to act on. Explore what sold, understand
            what may be ahead, and ask questions in one connected workspace.
          </p>
        </div>
        <div className="platform-cards">
          <article className="platform-card">
            <div className="feature-icon feature-icon--mint">
              <svg viewBox="0 0 24 24" fill="none"><path d="M4 19V5m0 14h17M7 15l4-4 3 2 6-7" /></svg>
            </div>
            <span className="feature-index">01 — FORECAST</span>
            <h3>Look ahead with context</h3>
            <p>Compare recent sales with a 30-day forecast and see the demand trend in context.</p>
            <a href="#how-it-works">See how it works <ArrowIcon /></a>
          </article>
          <article className="platform-card">
            <div className="feature-icon feature-icon--blue">
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" /><path d="m4.5 7.7 7.5 4.4 7.5-4.4M12 12v8.5" /></svg>
            </div>
            <span className="feature-index">02 — UNDERSTAND</span>
            <h3>Find the story in the numbers</h3>
            <p>Use performance indicators and forecast explanations to make the data more approachable.</p>
            <a href="#how-it-works">See how it works <ArrowIcon /></a>
          </article>
          <article className="platform-card">
            <div className="feature-icon feature-icon--amber">
              <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" /><path d="M5 5v14" /></svg>
            </div>
            <span className="feature-index">03 — TAKE ACTION</span>
            <h3>Ask, explore, and refresh</h3>
            <p>Ask business questions in analytics chat, or refresh the pipeline with new data.</p>
            <a href="#how-it-works">See how it works <ArrowIcon /></a>
          </article>
        </div>
      </section>

      <section className="landing-workflow-section" id="how-it-works">
        <div className="workflow-heading">
          <span className="section-kicker">02 / HOW TO USE IT</span>
          <h2>From raw signals to <span>the next right step.</span></h2>
          <p>A focused workflow that keeps the important questions close at hand.</p>
        </div>
        <div className="workflow-layout">
          <div className="workflow-steps">
            {steps.map((step) => (
              <article className="workflow-step" key={step.number}>
                <span className="workflow-number">{step.number}</span>
                <div><h3>{step.title}</h3><p>{step.description}</p></div>
                <span className="workflow-arrow" aria-hidden="true"><ArrowIcon /></span>
              </article>
            ))}
          </div>
          <div className="workflow-demo">
            <div className="demo-header">
              <span className="demo-pulse"><i /> FORECAST PREVIEW</span>
              <span>PRODUCT / P006</span>
            </div>
            <div className="demo-copy">
              <span>PROJECTED UNIT SALES</span>
              <div><strong>+8.4%</strong><span>next 30 days</span></div>
            </div>
            <div className="demo-bars" aria-label="Animated illustrative forecast chart">
              {[34, 46, 39, 58, 52, 70, 61, 76, 68, 89, 80, 100].map((height, index) => (
                <span
                  key={index}
                  style={{ '--bar-height': `${height}%`, '--bar-delay': `${index * 70}ms` } as React.CSSProperties}
                />
              ))}
            </div>
            <div className="demo-footer"><span>HISTORICAL</span><i /><span>FORECAST</span><span className="demo-footnote">Illustrative visualization</span></div>
          </div>
        </div>
      </section>

      <section className="landing-audience-section" id="who-its-for">
        <div className="audience-heading">
          <span className="section-kicker">03 / WHO IT’S FOR</span>
          <h2>Made for people who <span>think ahead.</span></h2>
        </div>
        <div className="audience-list">
          {audiences.map((audience) => (
            <article className="audience-row" key={audience.number}>
              <span>{audience.number}</span>
              <h3>{audience.title}</h3>
              <p>{audience.description}</p>
              <ArrowIcon />
            </article>
          ))}
        </div>
      </section>

      <section className="landing-cta-section">
        <div className="cta-orb" aria-hidden="true" />
        <span className="section-kicker">THE SIGNAL IS ALREADY THERE</span>
        <h2>Let’s make it <span>make sense.</span></h2>
        <p>Step into the dashboard and explore your retail data from a new angle.</p>
        <Link className="landing-button landing-button--light" to="/dashboard">
          Open RetailPulse AI <ArrowIcon />
        </Link>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-top">
          <Link className="landing-logo-link" to="/" aria-label="RetailPulse AI home"><Brand light /></Link>
          <p>Clarity for the next retail decision.</p>
          <div className="footer-links">
            <a href="#platform">Platform</a>
            <a href="#how-it-works">How it works</a>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/analytics">Analytics chat</Link>
          </div>
        </div>
        <div
          ref={footerBrandRef}
          className={`footer-wordmark${footerBrandVisible ? ' footer-wordmark--visible' : ''}`}
          aria-hidden="true"
        >
          RetailPulse AI
        </div>
        <div className="landing-footer-bottom">
          <span>© {new Date().getFullYear()} RetailPulse AI</span>
          <span>RETAIL INTELLIGENCE, IN FOCUS.</span>
          <a href="#home">Back to top ↑</a>
        </div>
      </footer>
    </main>
  )
}

export default LandingPage
