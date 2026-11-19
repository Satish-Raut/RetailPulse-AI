# RetailPulse AI — Project Questions and Answers

This guide explains the inventory feature, forecasting model, testing approach, and analytics-chat flow in presentation-friendly language. It describes the implementation currently in the repository.

## 1. What do the inventory terms mean?

- **On-hand quantity:** the usable units currently available at the selected store or warehouse.
- **Inbound quantity:** units already ordered and expected from a supplier. The expected arrival date is needed so the system can tell whether those units will arrive in time.
- **Supplier lead time:** the number of days between placing a supplier order and receiving it. The user enters this value; the forecasting model does not predict it.
- **Safety-stock level:** the minimum reserve quantity the manager wants to keep. The user enters this threshold; the model does not calculate it.

The inventory feature estimates stock at the end of the supplier lead-time window:

```text
projected stock =
    on-hand quantity
    + inbound quantity arriving by the end of lead time
    - forecast demand during lead time
```

The result is classified as:

- **Potential stockout:** projected stock is zero or less.
- **Below safety stock:** projected stock is positive but below the manager's threshold.
- **Healthy:** projected stock is at or above the threshold.

The backend requires a forecast for every calendar day in the lead-time window. If forecast rows are missing, it reports incomplete coverage rather than estimating from partial data. A fresh inventory snapshot does not necessarily mean its forecast data is recent; the dates in the forecast should also be checked before interpreting the result as a current business recommendation.

## 2. Why use MongoDB for inventory?

Databricks and MongoDB serve different purposes in this project:

| Technology | Project responsibility |
|---|---|
| Databricks | Historical sales, product/store analytics, model forecasts, and analytical SQL queries. |
| MongoDB Atlas | Inventory snapshots entered by users, inventory-risk alerts, and human-reviewed replenishment decisions. |

Inventory snapshots and decisions are operational records that are created over time. MongoDB stores each as a document with its related context and timestamps. For example, an alert document can retain the product/store, forecast window, calculation inputs, projected stock, risk level, and review status together.

This makes MongoDB appropriate for demonstrating document modeling, collections, indexes, persistence, and history for the NoSQL course. MongoDB does not calculate a forecast or make the business decision by itself: the FastAPI service validates inputs and applies the explicit risk rule.

The application uses these collections:

- `inventory_snapshots` — one record per submitted inventory observation.
- `inventory_alerts` — calculated stock-risk alerts.
- `replenishment_actions` — decisions recorded by a person reviewing an alert.

Collection access and index setup are in `backend/src/inventory/repository.py`. MongoDB creates collections automatically as indexes are created or documents are first written; there is no separate collection-creation script.

## 3. What forecasting model is used, and how does it work?

The training notebook uses **LightGBM**, specifically `LGBMRegressor`, to predict daily `units_sold`.

LightGBM is a gradient-boosted decision-tree model. In simple terms, it builds a sequence of trees. Each new tree learns patterns in the remaining prediction errors from earlier trees, and the trees' contributions are combined into the final prediction. This lets the model learn non-linear relationships, such as demand changing differently by product, store, season, promotion, or price.

The project trains **one global model** across the product/store series rather than training a separate model for every product or store. Product, store, category, and other attributes are included as model features so one model can learn patterns shared across series while still distinguishing their characteristics.

### Model inputs and training

The notebook uses features such as:

- Product, store, category, brand, and store attributes.
- Calendar and holiday information.
- Lagged sales (for example, sales from 1, 7, or 28 days earlier).
- Rolling averages, variability, and sales trends.
- Price, discount, promotion, inventory, and selected weather/economic features.

The target is `units_sold`. Data is split by time rather than randomly: 2021–2023 for training, 2024 for validation, and 2025 for testing. A time-based split better reflects the task of predicting future sales from past data.

The notebook compares LightGBM with a simple baseline that predicts from the previous week's value (`lag_7`). It reports MAE, RMSE, MAPE, and WAPE; WAPE is emphasized because it remains useful when there are genuine zero-sales days. Early stopping uses validation performance to help avoid unnecessary training after improvements stop.

Training runs and metrics are logged with MLflow, and the model is registered in the Databricks Unity Catalog Model Registry. A new version is assigned the `Champion` alias only if it beats the current Champion on test WAPE; otherwise it is kept as a `Challenger` for review. The batch-inference notebook loads the Champion version and writes predictions, including forecast date, product/store, predicted units, and model version, to the Gold forecast results table.

**Presentation summary:** “We use a global LightGBM regression model. It learns demand patterns from historical sales, product/store details, calendar events, promotions, and other features. We test it on later time periods, compare it with a last-week baseline, and track model versions and metrics in MLflow.”

## 4. How is the frontend tested?

There is currently **no dedicated frontend unit/component testing library** such as Vitest, Jest, or React Testing Library configured in the project. It is important not to claim that automated component tests have been run.

The frontend checks currently used are:

- `npm run build` — runs TypeScript project checks and creates the production Vite build. This passed during the recent validation.
- `npm run lint` — runs Oxlint. It passed with existing warnings in `ForecastChart.tsx`, `KPIBar.tsx`, and `ChatPanel.tsx`.
- Manual/container smoke checks — after building with Docker Compose, the frontend, Nginx API proxy, and backend endpoints were requested to confirm that the app and routing responded.

These checks catch compile-time and lint issues and confirm that the built app can be served. They are not a substitute for automated tests of individual React components or browser workflows.

## 5. How is the backend tested? Which library is used?

The focused inventory tests use Python's built-in **`unittest`** framework. API endpoint tests use FastAPI's **`TestClient`** to send HTTP requests to the app in-process. External calls to MongoDB and Databricks are mocked where appropriate, so these tests do not require live cloud services.

The current inventory test files cover these cases:

### `backend/tests/test_inventory_risk.py`

1. **`test_inventory_at_safety_threshold_is_healthy`** — confirms stock exactly at the safety-stock threshold is healthy.
2. **`test_inbound_within_lead_time_is_counted_but_later_inbound_is_not`** — includes an expected delivery within the lead-time window and excludes a later one.
3. **`test_nonpositive_projected_stock_is_stockout_risk`** — confirms zero or negative projected stock is classified as stockout risk.
4. **`test_incomplete_daily_forecast_is_rejected`** — confirms a missing forecast day prevents a risk calculation.

### `backend/tests/test_inventory_service.py`

1. **`test_saves_snapshot_and_persists_risk_alert`** — mocks forecast and repository calls, then verifies a risk result is returned and both the snapshot and alert are persisted.
2. **`test_stale_snapshot_is_saved_but_not_evaluated`** — verifies stale input is retained as a snapshot but is not sent to forecasting or given a risk alert.
3. **`test_missing_forecast_does_not_save_snapshot`** — verifies a missing forecast is reported and no snapshot is written.

### `backend/tests/test_inventory_api.py`

1. **`test_inventory_evaluation_response_serializes_mongo_ids`** — confirms MongoDB `ObjectId` values are returned as API-safe strings in a successful response.
2. **`test_invalid_inventory_quantity_is_rejected_before_database_access`** — confirms negative quantity input returns HTTP 422 without attempting database access.
3. **`test_missing_mongodb_configuration_returns_service_unavailable`** — confirms missing MongoDB configuration produces a clear HTTP 503 response.

The test command from the `backend` directory is:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

These are focused inventory tests; they are not a claim that the entire application has comprehensive automated backend coverage. Live integration checks against Databricks and MongoDB Atlas are separate from the mocked unit/API tests.

## 6. How does Groq interact with Databricks for Analytics Chat?

The free-text chat uses Groq to interpret a business question and explain results. **Groq does not connect directly to Databricks and does not write arbitrary SQL.** The backend provides a fixed set of analytics functions. Those functions run parameterized SQL through the Databricks SQL connector, and the result—not database credentials or a direct database connection—is returned to Groq as tool output.

### Free-text question flow

```text
User asks a question in the React chat
        ↓
Frontend POSTs /chat to FastAPI
        ↓
Backend gives Groq the question, allowed tools, and relevant selected-store context
        ↓
Groq chooses a tool and supplies its arguments
        ↓
Backend runs the matching analytics function
        ↓
analytics.py calls db.py; db.py runs parameterized SQL in Databricks
        ↓
Query results are returned to Groq as tool results
        ↓
Groq writes a plain-language answer from those results
        ↓
FastAPI returns the answer and data to React for display
```

The prompt instructs Groq to use provided tools, avoid inventing data, and ask for clarification when needed. The backend parses the final JSON response and checks whether answer numbers appear in the tool results; malformed final output falls back to a templated answer based on actual results.

### Quick-question buttons

Predefined quick questions use `POST /chat/quick`. These call the same backend analytics functions but use deterministic answer formatters instead of making an LLM call. This keeps quick answers predictable and avoids using Groq when the action is already known.

### Files involved

| File | Role in the chat flow |
|---|---|
| `frontend/src/components/ChatPanel.tsx` | Renders the chat, collects free-text questions and quick actions, and displays returned answers. |
| `frontend/src/api/chat.ts` | Sends requests to `/chat` or `/chat/quick` and sets request timeouts. |
| `backend/main.py` | Defines the `/chat` and `/chat/quick` API endpoints and handles service errors. |
| `backend/src/genai/groq/client.py` | Reads Groq model/API-key settings and creates the OpenAI-compatible Groq API client. |
| `backend/src/genai/groq/chatbot.py` | Sends messages and allowed tools to Groq and returns tool-call or final-answer messages. |
| `backend/src/genai/chatbot.py` | Defines the system prompt, available analytics tools, dispatch, tool-call handling, answer validation, and quick-action formatters. |
| `backend/src/data/analytics.py` | Implements business metrics and calls the appropriate Databricks query helpers. |
| `backend/src/data/db.py` | Defines parameterized SQL queries and executes them through a Databricks connection. |
| `backend/src/data/databricks_client.py` | Creates the server-side Databricks SQL connection from backend configuration. |

The free-text path uses Groq; the quick-action path does not. Both ultimately use the same analytics functions and Databricks data for their results.
