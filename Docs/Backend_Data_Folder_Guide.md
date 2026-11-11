# Backend `src/data` Folder Guide

This guide documents the Python source files in `backend/src/data/`. It
describes each file's purpose, responsibilities, and relationship to the
other backend modules. Generated files under `__pycache__/` are not source
files and are intentionally excluded.

## Folder overview

The `data` package is the backend's boundary to Databricks and the layer that
turns returned rows into business analytics. It contains two ways of talking
to Databricks:

- SQL Warehouse queries for reading forecast, sales, product, and store data.
- The Databricks workspace API for uploading files to Unity Catalog Volumes,
  starting jobs, and checking job status.

## Files

### `__init__.py`

**Purpose:** Marks `src/data` as a Python package.

**What it does:** It is currently empty. Its presence allows modules elsewhere
in the backend to import files from this folder, for example
`from src.data import db`.

### `databricks_client.py`

**Purpose:** Creates connections to the Databricks SQL Warehouse.

**What it does:**

- Reads `DATABRICKS_SERVER_HOSTNAME`, `DATABRICKS_HTTP_PATH`, and
  `DATABRICKS_TOKEN` from the process environment.
- Uses the Databricks SQL Connector (`databricks.sql`) to open a connection.
- Raises a clear configuration error when a required value is missing and
  wraps connection failures with guidance about the workspace and warehouse
  settings.

**Used by:** `db.py`, `forecast_results_loader.py`, and
`test_connection.py`.

**Important:** The token is a credential. Keep it in the local `.env` file or
another secret store, and never commit or share its value.

### `db.py`

**Purpose:** Central SQL query and data-access layer for the API.

**What it does:**

- Uses the catalog from `DATABRICKS_CATALOG`, defaulting to
  `retailpulse_ai`, and validates that it is a valid catalog identifier.
- Defines SQL for the `gold` forecast and sales-feature tables and the `silver`
  product and store tables.
- Executes queries through `databricks_client.get_connection()`.
- Binds filter values as query parameters, such as product ID, store ID,
  category, and date-window values.
- Converts query results to lists of dictionaries, keyed by column name.
- Provides helpers for forecasts, historical actuals, product and store
  lists, category/product totals, store performance, declining trends, and
  predicted revenue.
- Provides `connection_scope()` so a group of queries can reuse one SQL
  connection, as the dashboard KPI summary does.

**Used by:** `main.py` routes and `analytics.py`.

**Typical flow:** A route or analytics function calls a helper such as
`fetch_forecasts()`. That helper calls `run_query()`, which runs the SQL and
returns rows to the caller.

### `analytics.py`

**Purpose:** Computes business analytics from rows fetched by `db.py`.

**What it does:**

- Determines top-selling categories and products.
- Compares sales between categories.
- Compares recent store performance with a longer-term baseline.
- Finds products or stores whose latest month-over-month growth is below a
  threshold.
- Calculates total predicted units and approximate predicted revenue.
- Combines several analytics results into the dashboard's KPI summary.

This file contains Python calculations and formatting-oriented result
construction; its SQL queries live in `db.py`. Revenue is explicitly
approximate because it uses each product's base price as a proxy for future
price.

**Used by:** The `/chat/quick` and `/kpis` API features, and by the
Groq-backed free-text chat tools.

### `databricks_jobs.py`

**Purpose:** Manages Databricks Jobs and Unity Catalog Volume operations.

**What it does:**

- Loads the backend `.env` file using a path relative to this module.
- Creates and caches a Databricks `WorkspaceClient`, using `DATABRICKS_HOST`
  or deriving the host from `DATABRICKS_SERVER_HOSTNAME`, together with
  `DATABRICKS_TOKEN`.
- Uploads file bytes to `DATABRICKS_VOLUME_INCOMING_PATH`.
- Starts the configured Databricks job using `DATABRICKS_JOB_ID`.
- Retrieves the lifecycle and result status for a job run.
- Validates the required settings and raises `DatabricksJobsConfigError`
  when they are missing.

**Used by:** The pipeline upload, trigger, and status API routes in `main.py`.

This module uses the workspace Jobs/Files APIs, not SQL queries; that is why
it is separate from `databricks_client.py` and `db.py`.

### `forecast_results_loader.py`

**Purpose:** Loads the forecast-results dataset into a Pandas DataFrame for
standalone analysis or scripts.

**What it does:**

- Reads the catalog from `DATABRICKS_CATALOG`, defaulting to
  `retailpulse_ai`, and targets `<catalog>.gold.forecast_results`.
- If `LOCAL_FORECAST_RESULTS_PATH` points to an existing supported file, it
  loads CSV, Parquet, or Feather data locally instead.
- Otherwise, it queries Databricks and returns the results as a DataFrame.
- Closes the SQL connection after the Databricks read.
- When run as a script, prints row count, column names, and a sample of the
  loaded data.

**Used by:** Standalone Python workflows that need the complete forecast
table as a DataFrame. The API's individual filtered queries are handled by
`db.py`.

### `test_connection.py`

**Purpose:** Provides a manual diagnostic for checking a Databricks SQL
connection.

**What it does:**

- Opens a connection using the shared Databricks SQL connection helper.
- Queries Databricks for the current catalog and schema.
- Prints whether the connection worked and the returned catalog/schema.
- Closes the connection even if the diagnostic query fails.

**How to run:** From the `backend` directory, run:

```powershell
uv run python src/data/test_connection.py
```

This is a manual smoke-check script, not an automated unit-test suite.

## Data access flow

```text
FastAPI route in main.py
    ├── forecast/product/store reads ──> db.py
    │                                      └── databricks_client.py
    │                                              └── Databricks SQL Warehouse
    ├── KPI / quick analytics ────────> analytics.py ──> db.py
    └── upload / pipeline controls ───> databricks_jobs.py
                                           └── Databricks Workspace APIs

Standalone DataFrame load ────────────> forecast_results_loader.py
                                           └── databricks_client.py
```

## Databricks settings used by this folder

| Environment variable | Used by | Purpose |
|---|---|---|
| `DATABRICKS_CATALOG` | `db.py`, `forecast_results_loader.py` | Unity Catalog catalog; defaults to `retailpulse_ai`. |
| `DATABRICKS_SERVER_HOSTNAME` | `databricks_client.py`, `databricks_jobs.py` | Databricks workspace host; also used to derive the Jobs API host when `DATABRICKS_HOST` is not set. |
| `DATABRICKS_HTTP_PATH` | `databricks_client.py` | SQL Warehouse HTTP path for SQL queries. |
| `DATABRICKS_TOKEN` | `databricks_client.py`, `databricks_jobs.py` | Credential used for SQL Warehouse and workspace API access. |
| `DATABRICKS_HOST` | `databricks_jobs.py` | Optional explicit workspace URL for the Jobs/Files API. |
| `DATABRICKS_JOB_ID` | `databricks_jobs.py` | Job to start when triggering the pipeline. |
| `DATABRICKS_VOLUME_INCOMING_PATH` | `databricks_jobs.py` | Unity Catalog Volume directory for uploaded source files. |
| `LOCAL_FORECAST_RESULTS_PATH` | `forecast_results_loader.py` | Optional path to a local CSV, Parquet, or Feather forecast-results file. |

The active catalog configured for this project is `retailpulse_ai`; the SQL
and loader modules use that catalog by default. Change
`DATABRICKS_CATALOG` only if you intentionally want the backend to query a
different catalog.

---

# Backend `src/models` Folder Guide

This section documents the Python source files in `backend/src/models/`.
Generated files under `__pycache__/` are not source files and are intentionally
excluded.

## Folder overview

The `models` package contains Pydantic schemas used to validate and describe
the API's request and response data. These are data-contract models, not the
machine-learning forecasting model. The forecasting model and its training
workflow are maintained in the Databricks project.

## Files

### `__init__.py`

**Purpose:** Marks `src/models` as a Python package.

**What it does:** It is currently empty. It allows modules such as `main.py`
to import API schemas from `src.models.schemas`.

### `schemas.py`

**Purpose:** Defines the API's request and response shapes using Pydantic
`BaseModel`.

**What it does:** FastAPI uses these classes to validate incoming JSON bodies,
serialize returned values, and publish request/response definitions in the
OpenAPI schema shown by Swagger at `/docs`.

The file contains the following groups of models:

#### Forecast and health models

- `ForecastRecord` describes one row returned from
  `retailpulse_ai.gold.forecast_results`, including product/store identifiers,
  forecast date, predicted units, horizon, and model metadata.
- `ForecastListResponse` wraps the regular `GET /forecast` results with a
  record count.
- `ForecastPoint` represents one date in an actual-versus-predicted timeline.
  Its actual and predicted unit values are optional because a point may
  represent historical actuals or forecast output.
- `ForecastTrendResponse` wraps the merged timeline returned by
  `GET /forecast?include_history=true`.
- `ProductForecastGroup` groups forecast records by product for
  `GET /forecast/trend/all`.
- `HealthResponse` describes the result of the `GET /health` check.

#### Product and store models

- `Product` describes the product identifier, display name, and category
  returned by `GET /products`.
- `Store` describes the store identifier, name, city, and region returned by
  `GET /stores`.

#### Forecast explanation models

- `ExplainRequest` validates the product and store identifiers, plus an
  optional user question, for `POST /forecast/explain`.
- `ForecastSummary` holds computed forecast summary values such as average
  predicted units, total predicted units, and optional percentage change
  versus recent history.
- `ExplainResponse` defines the explanation endpoint's response, including
  the forecast summary, narrative, key drivers, risks or opportunities,
  recommendation, and model version.

#### Chat models

- `ChatMessage` represents one prior user or assistant turn. `Literal` limits
  the role to those two values.
- `ChatRequest` validates the free-text chat message, optional conversation
  history, and optional currently selected store details for `POST /chat`.
- `ChatResponse` is the shared response shape for `POST /chat` and
  `POST /chat/quick`: answer text, supporting data, and names of analytics
  functions used.
- `QuickActionRequest` validates the action name and its parameter dictionary
  for deterministic `POST /chat/quick` requests.

#### Dashboard KPI models

- `TopCategoryStat` represents top-category metrics, including the lookback
  window and optional result values.
- `TopProductStat` represents top-product metrics and optional product
  details.
- `PredictedRevenueStat` represents forecasted units and approximate
  predicted revenue, with an optional explanatory note.
- `KPISummary` combines the category, product, predicted-revenue, and
  at-risk-count values returned by `GET /kpis`.

#### Databricks pipeline models

- `UploadedFileInfo` describes a file uploaded to a Unity Catalog Volume.
- `PipelineTriggerResponse` describes the job run ID and trigger status
  returned by `POST /pipeline/trigger`.
- `PipelineStatusResponse` describes a job's lifecycle state, optional result
  state, and optional status message for `GET /pipeline/status/{run_id}`.
- `PipelineUploadAndTriggerResponse` combines uploaded-file details with the
  run ID and trigger status for `POST /pipeline/upload-and-trigger`.

## How schemas connect to the API

`main.py` imports these models and assigns them to route parameters and
`response_model` declarations. For example, FastAPI validates a JSON
`POST /chat` body as a `ChatRequest`; the response is serialized according to
`ChatResponse`. For a route that can return one of two shapes,
`GET /forecast` declares a union of `ForecastListResponse` and
`ForecastTrendResponse`.

When a Databricks query returns dictionaries, the API constructs the relevant
Pydantic response models from those dictionaries. Missing required fields or
values that cannot be converted to the declared types can therefore cause a
response-validation error.

## Models folder flow

```text
Incoming API JSON ──> request schema validation ──> route in main.py
                                                    │
Databricks rows ────────────────────────────────────┘
                                                    │
                                                    v
                                         response schema validation
                                                    │
                                                    v
                                         JSON response / OpenAPI docs
```

---

# Backend `src/genai` Folder Guide

This section documents the AI-related and deterministic analytics helper
files in `backend/src/genai/`. It includes the `groq/` provider subfolder.
Generated files under `__pycache__/` are not source files and are
intentionally excluded.

## Folder overview

The `genai` package contains shared chat analytics tools, forecast-context
preparation, a deterministic explanation fallback, and provider-specific LLM
integrations.

**Current runtime:** `main.py` directly imports the Groq provider for
`POST /chat` and `POST /forecast/explain`. The deterministic quick actions
also live in this package and do not call an LLM. The Azure client file is
left in the folder but is not imported by the active API routes. There is no
AWS Bedrock implementation or provider-selection setting in this folder yet.

## Top-level files

### `__init__.py`

**Purpose:** Marks `src/genai` as a Python package.

**What it does:** It is currently empty and enables imports from this package,
such as `src.genai.chatbot`.

### `chatbot.py`

**Purpose:** Holds shared analytics tool definitions and deterministic
chat-action logic used by free-text chat and quick-question endpoints.

**What it does:**

- Defines the analytics tools available to an LLM, such as getting a top
  category or product, comparing categories, checking store performance,
  finding declining products or stores, and summarizing predicted revenue.
- Maps model-requested tool names to functions in `src.data.analytics`.
- Executes tool calls and packages results for the model.
- Checks whether answer numbers appear in the actual tool results and logs a
  warning for unexpected values.
- Defines `run_chat_with_completion()`, provider-independent orchestration
  that accepts a completion function. It runs the tool-calling round trip,
  validates the final JSON answer, retries a malformed answer, and uses a
  deterministic answer based on tool results if the final response is still
  invalid.
- Defines `QUICK_ACTIONS` and `run_quick_action()` for predefined analytics
  responses that do not require a model.

**Used by:** `main.py` imports `QUICK_ACTIONS` and `run_quick_action` for
`POST /chat/quick`. The Groq chat adapter supplies its completion function to
`run_chat_with_completion()` for `POST /chat`.

The fallback for malformed model output is not an offline fallback for
provider or network errors; those errors propagate to the route and are
reported as HTTP 503.

### `explain_context.py`

**Purpose:** Builds a compact, structured data context for a forecast
explanation.

**What it does:**

- Normalizes Databricks date and datetime values.
- Sorts forecast rows and recent sales-feature rows.
- Calculates forecast horizon, average and total predicted units, and
  comparison with the recent rolling average.
- Includes product attributes, recent trends, promotion state, and supported
  holidays in the forecast window.
- Returns a Python dictionary used as the facts source for the forecast
  explanation.

It does not call an LLM or query Databricks itself. The API route fetches the
required data through `src.data.db` and passes it into
`build_forecast_context()`.

### `forecast_explainer.py`

**Purpose:** Creates a deterministic Python-template explanation for an
already computed forecast.

**What it does:** `generate_explanation()` calls the internal fallback
formatter, which returns an explanation, key drivers, risks or opportunities,
and a recommendation using values in the context. It does not call an LLM.

**Used by:** The Groq forecast-explanation module calls it if Groq returns a
response that cannot be parsed into the expected fields. It is not the active
LLM endpoint implementation itself.

### `llm_client.py`

**Purpose:** Contains the older Azure OpenAI client integration.

**What it does:** Reads Azure OpenAI environment variables, creates an
`AzureOpenAI` client, and provides chat-completion helpers for JSON and
tool-calling requests.

**Current status:** This module is retained from the tutorial integration but
is dormant. The active routes import Groq modules, not this Azure module. It
still contains Azure-specific code and should not be confused with the
currently active Groq configuration.

## `groq/` provider subfolder

This folder groups the active Groq-specific client and endpoint
implementations separately from the shared analytics and fallback logic.

### `groq/__init__.py`

**Purpose:** Marks `src/genai/groq` as a Python package.

**What it does:** It is currently empty and enables imports from the Groq
provider package.

### `groq/client.py`

**Purpose:** Reads Groq configuration and creates an API client.

**What it does:**

- Loads the backend `.env` using a path relative to the module.
- Uses the OpenAI Python SDK with Groq's OpenAI-compatible API base URL.
- Reads `GROQ_API_KEY` and `GROQ_MODEL`.
- Raises `GroqConfigError` with the missing variable name when configuration
  is incomplete.

**Used by:** `groq/chatbot.py` and `groq/forecast_explainer.py`.

### `groq/chatbot.py`

**Purpose:** Adapts the shared chat orchestration to Groq's chat-completions
API.

**What it does:** Creates the configured Groq client, passes model tool
definitions and tool-choice settings for the analytics round trip, enables
JSON response mode for the final answer, and calls the shared
`run_chat_with_completion()` logic.

**Used by:** `main.py` for `POST /chat`.

### `groq/forecast_explainer.py`

**Purpose:** Generates a structured natural-language explanation for a
forecast using Groq.

**What it does:**

- Builds a prompt from the forecast context and optional user question.
- Requests JSON output with the explanation, key drivers, risks or
  opportunities, and recommendation.
- Parses and checks the response fields before returning them.
- Uses the deterministic top-level `forecast_explainer.py` implementation
  when the model response is malformed.

**Used by:** `main.py` for `POST /forecast/explain`. The forecast context is
prepared in Python; the generated forecast values themselves come from
Databricks and are not generated by Groq.

## Active request flows

```text
POST /chat
  main.py
    └── groq/chatbot.py
          ├── groq/client.py ──> Groq API
          └── chatbot.py ──> analytics.py ──> db.py ──> Databricks SQL

POST /chat/quick
  main.py
    └── chatbot.py ──> analytics.py ──> db.py ──> Databricks SQL
          (no LLM call)

POST /forecast/explain
  main.py
    ├── explain_context.py <── forecast and sales data from db.py
    └── groq/forecast_explainer.py
          ├── groq/client.py ──> Groq API
          └── forecast_explainer.py (deterministic malformed-response fallback)
```

## Groq environment variables

| Environment variable | Used by | Purpose |
|---|---|---|
| `GROQ_API_KEY` | `groq/client.py` | Secret key used to authenticate to Groq. |
| `GROQ_MODEL` | `groq/client.py` | Groq model ID used for chat and forecast explanations. |

These settings belong in the local backend `.env` or an appropriate secret
store. Do not put an actual API key in documentation, source control, or
screenshots.
