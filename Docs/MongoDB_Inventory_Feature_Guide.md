# RetailPulse AI — MongoDB Inventory Feature Guide

## 1. Purpose of this document

This document describes the MongoDB feature planned for RetailPulse AI before implementation begins. It explains the business problem, MongoDB's role, the proposed user workflow and data model, a classroom presentation outline and script, and a suggested implementation structure.

The feature is an addition to the existing forecasting project. It does not replace the forecasting pipeline or require changes to the forecasting model.

## 2. Feature summary

The MongoDB feature is an **inventory-risk and replenishment decision-support workflow**.

RetailPulse AI already produces demand forecasts by product and store. A forecast alone does not say whether a store has enough stock to meet that demand. The additional feature lets a user submit a current inventory snapshot, compare reported stock with the relevant forecast, review possible inventory risks, and record a replenishment decision.

The application will **not place purchase orders automatically**. It presents a transparent calculation and leaves the decision with a person.

### Problem statement

Retail teams need to know:

- Which products at which stores may run short before new stock can arrive?
- Which inventory values and forecast period led to a risk alert?
- Has someone reviewed the alert, and what decision did they make?
- Is the inventory information recent enough to support a decision?

Sales histories and forecasts do not necessarily include on-hand inventory, inbound shipments, supplier lead times, or store-specific safety-stock settings. Without those operational inputs, forecast data cannot on its own provide a reliable view of inventory risk.

### Proposed solution

Collect a timestamped inventory snapshot and its operational inputs, retrieve the corresponding product/store forecast, calculate a documented risk result, and persist both the result and any human-reviewed action in MongoDB.

## 3. User workflow

1. **Select the product and store.** Use product and store identifiers already present in RetailPulse AI.
2. **Submit an inventory snapshot.** Provide the on-hand quantity, known inbound quantity and expected arrival, supplier lead time, safety-stock setting, source, and observation time.
3. **Check the input.** Validate identifiers, quantities, lead-time values, timestamps, and whether the snapshot is sufficiently fresh.
4. **Retrieve demand data.** The backend gets the matching forecast for the lead-time window from the existing forecast data source.
5. **Calculate and explain risk.** The backend applies a deterministic, documented calculation. It records the inputs and calculated values used.
6. **Review the alert.** A user can view the risk, its rationale, the snapshot time, and the forecast window.
7. **Record a decision.** The user can acknowledge the alert and record a proposed action, quantity considered, note, status, and timestamp.
8. **Review history.** The application can retrieve snapshots, open alerts, and previously reviewed actions.

## 4. Example risk calculation

For a selected product and store, the first version can calculate:

```text
forecast_demand_during_lead_time =
    sum(predicted_units over the supplier lead-time window)

inbound_before_lead_time =
    sum(inbound quantities expected to arrive on or before the lead-time date)

projected_stock_at_lead_time =
    on_hand + inbound_before_lead_time - forecast_demand_during_lead_time
```

Then compare `projected_stock_at_lead_time` with a configured safety-stock threshold:

- Projected stock at or below zero: potential stockout.
- Projected stock above zero but below the safety-stock threshold: below safety stock.
- Projected stock at or above the threshold: no low-stock alert from this rule.

An overstock alert is also a possible extension, but it requires a clearly defined business policy, such as a maximum coverage-days threshold. Do not label inventory as overstocked based on an arbitrary number.

### Illustrative example

Suppose a store reports 95 units on hand and 30 inbound units expected before the supplier lead time ends. The forecast for that period totals 120 units, and the configured safety stock is 20 units:

```text
projected stock = 95 + 30 - 120 = 5 units
```

Five projected units are above zero but below the 20-unit safety stock. The application can raise a "below safety stock" alert and show the arithmetic, inputs, and dates to the user.

This is an illustrative calculation, not actual project data or an optimized replenishment formula.

## 5. How MongoDB solves the operational data problem

MongoDB stores flexible, JSON-like documents. Inventory snapshots, calculated alerts, and human decisions are related but have different fields and lifecycles. A document database is a reasonable fit for storing each of these operational records with its relevant context.

MongoDB provides this feature with:

- **Persistence for operational updates:** new inventory observations and user decisions can be written as users interact with the app.
- **Timestamped history:** older snapshots and reviewed actions can remain available instead of being overwritten by the latest value.
- **Auditable risk explanations:** each alert can retain the snapshot reference, forecast window, calculation inputs, calculated values, rule version, status, and timestamps.
- **Flexible records:** the feature can add optional operational fields, such as source or supplier reference, without making MongoDB the store for large analytical tables.
- **Useful query patterns:** indexes can support searches by store, product, observation time, alert status, and alert history.
- **NoSQL course demonstration:** the project uses collections, documents, schema validation, indexes, query filters, and persistence for a concrete real-world workflow.

MongoDB does **not** make a risk result correct by itself. Correctness comes from validating inputs, using the right forecast window, applying explicit rules, handling stale or missing data, and testing the calculation.

## 6. Responsibilities: Databricks versus MongoDB

| System | Responsibility in this feature |
|---|---|
| Databricks / existing analytical data | Historical sales, product and store dimensions, model features, forecasts, and analytical queries. |
| MongoDB | Current and historical inventory snapshots, operational risk alerts, and user-reviewed replenishment actions. |
| FastAPI backend | Input validation, forecast retrieval, risk calculation, MongoDB access, and API responses. |
| React frontend | Inventory entry, risk/alert display, action review, and history views. It does not connect directly to MongoDB. |

MongoDB is not intended to replace Databricks as the analytical warehouse or model-training data lake. Keeping those roles separate lets each system serve the workload it is designed for.

## 7. Proposed MongoDB collections

### `inventory_snapshots`

One document represents the inventory information reported for a product at a store at a particular time.

Possible fields:

```json
{
  "_id": "ObjectId",
  "store_id": "S01",
  "product_id": "P004",
  "on_hand_qty": 95,
  "inbound": [
    {
      "quantity": 30,
      "expected_at": "2026-11-20T00:00:00Z"
    }
  ],
  "lead_time_days": 14,
  "safety_stock_qty": 20,
  "source": "manual_upload",
  "observed_at": "2026-11-12T05:30:00Z",
  "created_at": "2026-11-12T05:35:00Z"
}
```

### `inventory_alerts`

One document represents a calculated risk for a store/product and forecast window.

Possible fields:

```json
{
  "_id": "ObjectId",
  "store_id": "S01",
  "product_id": "P004",
  "snapshot_id": "ObjectId",
  "forecast_start": "2026-11-12",
  "forecast_end": "2026-11-26",
  "risk_type": "below_safety_stock",
  "calculation": {
    "on_hand_qty": 95,
    "inbound_before_lead_time": 30,
    "forecast_demand_during_lead_time": 120,
    "projected_stock_at_lead_time": 5,
    "safety_stock_qty": 20
  },
  "rule_version": "v1",
  "status": "open",
  "created_at": "2026-11-12T05:36:00Z",
  "updated_at": "2026-11-12T05:36:00Z"
}
```

### `replenishment_actions`

One document represents a user's review or decision about an alert. If action changes need a complete audit trail, store each decision as a new event or use an explicit history array rather than silently replacing the prior decision.

Possible fields:

```json
{
  "_id": "ObjectId",
  "alert_id": "ObjectId",
  "store_id": "S01",
  "product_id": "P004",
  "decision": "replenishment_planned",
  "quantity_considered": 25,
  "note": "Review with the store manager before placing an order.",
  "status": "reviewed",
  "user_id": null,
  "created_at": "2026-11-12T06:00:00Z",
  "updated_at": "2026-11-12T06:00:00Z"
}
```

`user_id` is optional until the application has authentication. Do not imply that an action is associated with a verified person if authentication does not exist.

## 8. Validation, freshness, and reliability rules

- Require valid, known product and store identifiers.
- Require nonnegative on-hand, inbound, and safety-stock quantities.
- Require a valid observation timestamp and an acceptable lead-time value.
- Identify stale snapshots and show their age. Do not present a stale snapshot as a current, reliable recommendation.
- Do not create a qualified risk result if the matching forecast is missing or incomplete. Return an explicit unavailable-data state or error.
- Store the input values and derived values for each alert so its reasoning can be reproduced.
- Make alert generation idempotent for a store/product/forecast window and rule version so API retries do not create duplicate alerts.
- Use indexes for common store/product/time lookups, alert status, and action history.
- Keep MongoDB credentials on the backend, use least-privilege database access, and do not expose MongoDB to the browser.
- Do not log secrets or unnecessary inventory document contents.

## 9. Classroom presentation outline

Suggested length: about 3–5 minutes.

### Slide 1 — The business problem

- Forecasts estimate future demand, but they do not automatically know current stock.
- A retailer also needs inventory quantity, inbound deliveries, lead time, and safety stock.
- Decisions made without those signals can contribute to stockouts or excess inventory.

### Slide 2 — The proposed MongoDB feature

- Add a store/product inventory snapshot.
- Compare stock and expected inbound quantities with forecast demand during supplier lead time.
- Create a transparent alert and let a person record a reviewed decision.
- The system recommends and explains; it does not place an order.

### Slide 3 — Why MongoDB

- Each inventory observation and review is a changing operational record with a timestamp and its own lifecycle.
- MongoDB documents keep related values and calculation context together.
- Collections and indexes support storing, validating, and retrieving the records efficiently.
- Databricks remains responsible for historical analytics and model forecasts; MongoDB handles operational inventory workflow records.

### Slide 4 — End-to-end flow

```text
User enters inventory snapshot
        ↓
React sends it to FastAPI
        ↓
FastAPI validates the input
        ↓
FastAPI retrieves the product/store forecast
        ↓
Backend calculates and explains inventory risk
        ↓
MongoDB saves snapshot and alert
        ↓
User reviews alert and records a decision
```

### Slide 5 — Example and safeguards

- Example: 95 on hand + 30 inbound − 120 forecast demand = 5 projected units.
- If safety stock is 20, flag the result as below safety stock.
- Show the snapshot age, forecast period, and calculation.
- If the inventory is stale or a forecast is missing, clearly say the result is unavailable or uncertain.
- The user remains responsible for the final replenishment decision.

### Slide 6 — What this demonstrates

- NoSQL document modeling and MongoDB collections.
- Validation, indexes, and persistent operational records.
- Integration between an analytical forecasting system and an operational application.
- A human-reviewed, explainable business workflow.

## 10. Suggested classroom speaking script

> RetailPulse AI already forecasts demand by product and store, but a demand forecast alone cannot tell a retailer whether enough stock is available. The project does not assume the sales dataset contains current stock, supplier lead times, or inbound deliveries. The MongoDB feature adds those missing operational inputs.
>
> A user submits an inventory snapshot with the current on-hand quantity, inbound stock, lead time, safety-stock setting, and the time the inventory was observed. The backend validates the snapshot and retrieves the forecast for the same product and store. It then calculates expected stock at the end of the supplier lead-time window and compares it with the safety-stock threshold.
>
> For example, if there are 95 units on hand, 30 inbound units arriving before the lead time ends, and forecast demand of 120 units, projected stock is 5 units. If the safety-stock threshold is 20, the application raises a below-safety-stock alert and shows the calculation.
>
> MongoDB stores timestamped inventory snapshots, the alert and its calculation details, and the user's reviewed decision. This makes the operational workflow persistent and auditable. Databricks remains responsible for historical sales analytics and forecasts, while MongoDB stores the current operational records. The feature is decision support only: it does not place orders automatically, and it clearly identifies stale or missing data.

## 11. Implementation structure

The feature is implemented as an additive part of the existing backend. `src/data/` continues to provide Databricks forecast access; MongoDB-specific connection and persistence code is separated from that access.

```text
backend/
├── main.py                              # Register inventory endpoints
├── requirements.txt                     # Includes the PyMongo driver
├── .env.example                         # MongoDB settings documented with placeholders only
├── src/
│   ├── data/
│   │   ├── db.py                        # Existing Databricks queries
│   │   └── mongodb_client.py            # MongoDB connection configuration
│   ├── inventory/
│   │   ├── __init__.py
│   │   ├── repository.py                # Collection reads/writes and indexes
│   │   ├── service.py                   # Snapshot, alert, and action orchestration
│   │   └── risk.py                      # Pure, deterministic inventory-risk rules
│   └── models/
│       ├── schemas.py                   # Existing API schemas
│       └── inventory.py                 # Inventory request/response schemas
└── tests/
    ├── test_inventory_risk.py           # Calculation and boundary tests
    └── test_inventory_service.py        # Service behavior with mocked data access

frontend/src/
├── api/
│   └── inventory.ts                     # Typed calls to inventory endpoints
└── pages/
    └── InventoryPage.tsx                # Inventory form, risk, alerts, and action history
```

### Component responsibilities

- **`mongodb_client.py`:** create and configure the MongoDB client from server-side environment configuration.
- **`src/models/inventory.py`:** validate API input and define stable request and response shapes.
- **`repository.py`:** own collection operations, index setup, filters, and persistence. Keep database queries out of React and out of the risk calculation.
- **`risk.py`:** implement and unit-test the deterministic calculation without database or LLM dependencies.
- **`service.py`:** coordinate input validation, product/store checks, forecast retrieval, risk calculation, idempotency, and repository calls.
- **`router.py`:** expose and document the inventory routes while mapping expected validation and dependency failures to clear HTTP responses; `main.py` registers the router.
- **Frontend components:** collect inputs and render returned results. The browser never connects directly to MongoDB.

### Implemented API routes

| Method and route | Purpose |
|---|---|
| `POST /inventory/evaluate` | Save a snapshot, verify freshness, fetch a complete Databricks forecast for lead time, calculate risk, and upsert a risk alert when needed. |
| `GET /inventory/snapshots` | Retrieve saved snapshots filtered by store/product, with pagination. |
| `GET /inventory/alerts` | List alerts, with store/product/status filters and pagination. |
| `POST /inventory/alerts/{alert_id}/actions` | Record a user's review or replenishment decision. |
| `GET /inventory/alerts/{alert_id}/actions` | Retrieve the recorded action history for an alert. |

The React application exposes the workflow at `/inventory`. It includes a manual snapshot form, forecast-risk calculation details, alert history, and a user review form. It does not connect directly to MongoDB.

### Implementation decisions in this MVP

- The first UI accepts one inbound shipment per evaluation; the API supports a list of inbound shipments.
- `INVENTORY_MAX_AGE_HOURS` defaults to 24 and controls snapshot freshness.
- Forecast coverage must include every calendar day from the day after observation through the end of supplier lead time; incomplete coverage is rejected.
- `stockout` is used when projected stock is at or below zero; `below_safety_stock` applies to positive projected stock below the threshold.
- Risk alerts are idempotent per store/product/forecast window/rule version. Re-evaluation updates the same alert; reviewed status is retained.
- A healthy evaluation persists its snapshot and calculation but does not create an alert document.
- User identity is not stored because authentication is not part of this MVP.
- No order is placed, and no LLM decides the risk classification.

## 12. Out of scope for the first version

- Automatically creating purchase orders or contacting suppliers.
- Replacing Databricks or migrating historical sales and forecast tables to MongoDB.
- Claiming optimal order quantities without an agreed inventory optimization policy.
- Treating generated LLM text as the source of truth for inventory quantities or risk calculations.
- Presenting stale or incomplete inputs as a reliable recommendation.

## 13. Relationship to the project documents

- [Project brief and architecture](./RetailPulse_AI_Project_Details.md) contains the overall project scope and architecture.
- [Implementation plan](./RetailPulse_AI_Implementation_Plan.md) places the inventory work in Stage 4 and backend/API integration in Stage 5.
- This guide expands the MongoDB feature and provides presentation material. Implementation should begin only after its assumptions and data contracts are agreed.

## 14. Demo inventory snapshots

The following values can be entered in the inventory form to demonstrate the three risk outcomes. Forecast demand values are included only to explain the arithmetic; the application retrieves actual predictions from Databricks for the selected product, store, and lead-time window. The displayed outcome may differ unless the matching forecast is complete and has the illustrative demand shown here.

| Demo | Product / store | On-hand | Inbound | Inbound expected date | Lead time | Safety stock | Example forecast demand | Example result |
|---|---|---:|---:|---|---:|---:|---:|---|
| Potential stockout | P002 / S05 | 32 | 0 | Leave blank | 14 days | 20 | 45 units | `32 + 0 - 45 = -13` units; stockout risk |
| Below safety stock | P002 / S04 | 65 | 0 | Leave blank | 14 days | 20 | 52 units | `65 + 0 - 52 = 13` units; below safety stock |
| Healthy | P004 / S01 | 120 | 20 | Set to a date within the next 14 days | 14 days | 20 | 80 units | `120 + 20 - 80 = 60` units; healthy |

Use the inbound date relative to the snapshot date. An inbound shipment arriving after the lead-time window is not included in projected stock. The examples assume fresh snapshots and complete daily forecast coverage for all 14 days. If the selected product/store forecast is missing, incomplete, or from an older date range, the API may reject the evaluation or the result may not represent a current business situation.
