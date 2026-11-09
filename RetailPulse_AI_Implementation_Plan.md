# RetailPulse AI — Implementation Plan

## Purpose

This plan sequences the project features so each stage has working prerequisites, testable outputs, and a clear completion gate before the next stage begins. It is aligned with [RetailPulse_AI_Project_Details.md](./RetailPulse_AI_Project_Details.md).

The order is based on dependencies rather than fixed calendar weeks. Complete and verify one stage before moving its dependent work into the main branch. Build the first working version locally, then deploy it to AWS.

> **Reliability note:** no plan can guarantee an error-free system. This plan reduces avoidable errors with small increments, explicit data/API contracts, automated tests, fail-fast checks, health checks, and a rollback path.

## Target delivery sequence

```mermaid
flowchart TD
    A[0. Confirm scope, accounts, data, and costs] --> B[1. Repository and local development foundation]
    B --> C[2. Data pipeline and data quality]
    C --> D[3. Forecast baseline, model, and S3 outputs]
    B --> E[4. MongoDB inventory workflow and API]
    D --> F[5. Integrate forecast and inventory in FastAPI]
    E --> F
    F --> G[6. React dashboard and user workflow]
    G --> H[7. Local end-to-end validation]
    H --> I[8. AWS infrastructure and secure deployment]
    I --> J[9. Cloud observability, security gates, and final acceptance]
```

Stages 2 and 4 can be developed in parallel after Stage 1 if enough time is available. The final integration in Stage 5 depends on both. Do not start cloud deployment until the local end-to-end workflow passes.

## Stage 0 — Confirm scope and prerequisites

**Purpose:** avoid building around unavailable data, services, or assumptions.

### Tasks

- Confirm access to the tutorial dataset and list the available columns for sales, products, stores, and promotions.
- Confirm the source and format of demo inventory inputs: on-hand units, inbound units, supplier lead time, and safety-stock threshold.
- Decide the AWS region and check availability/access requirements for Amazon Bedrock models.
- Confirm that the Databricks workspace and its AWS/S3 configuration are available and within the project budget.
- Confirm MongoDB Atlas access, or select MongoDB Community Server for local development and Atlas for the demo.
- Set a cost limit and identify resources that must be stopped or removed when not in use.
- Define the initial forecast horizon (30 days in the brief), supported user workflow, and what is explicitly out of scope.

### Completion gate

- Dataset fields and inventory-input provenance are documented.
- AWS region, Bedrock availability, Databricks/S3 path, and MongoDB development option are confirmed.
- No real or sensitive retail data is required for the initial demo.

### If blocked

Use synthetic or course-provided sample data for the inventory workflow. Do not derive on-hand stock or supplier lead time from sales. If Bedrock access is unavailable, keep the application functional without chat and defer the LLM integration.

## Stage 1 — Repository and local development foundation

**Purpose:** establish reproducible local development before feature work begins.

### Tasks

- Create a clear repository structure for `frontend`, `backend`, `data`/Databricks assets, `infra`, and tests.
- Record environment setup and run instructions; keep `.env` files and credentials out of Git.
- Define shared identifiers and API/data schemas for `store_id`, `product_id`, dates, quantities, forecast values, and timestamps.
- Add Dockerfiles for the React/Nginx frontend and FastAPI backend.
- Add Docker Compose for local frontend/backend and MongoDB services (or a documented Atlas development connection).
- Add a basic CI job in Jenkins, triggered from the Git provider, to run formatting, linting, and unit tests.
- Add a health endpoint and a minimal frontend page that can call the local API.

### Completion gate

- A new developer can follow the setup instructions and start the local services.
- `GET /health` responds successfully, and the frontend can reach the backend through the intended local route.
- CI runs on a change and fails visibly when a required check fails.
- No credentials or real data are committed.

## Stage 2 — Data ingestion, validation, and curated datasets

**Purpose:** create trustworthy model inputs before implementing forecasting.

### Tasks

- Implement Databricks ingestion of the available source files into the **Bronze** layer with ingestion timestamps and source metadata.
- Build the **Silver** layer with explicit type conversion, required-field checks, duplicate handling, and documented invalid-record behavior.
- Build the **Gold** layer with product/store/date sales aggregates and only features supported by the actual dataset.
- Add data-quality checks for missing identifiers, invalid dates, impossible quantities, duplicate keys, and unexpected schema changes.
- Store the data lake outputs in the configured private S3 bucket using environment-specific paths.
- Log job status, duration, rejected-record counts, and input/output freshness.

### Completion gate

- A representative dataset completes the pipeline from Bronze to Gold.
- Row counts and key uniqueness are checked at each transformation boundary.
- Invalid records are reported or quarantined; they are not silently treated as valid.
- A rerun has documented behavior and does not create unintended duplicate outputs.

## Stage 3 — Forecast baseline, model, and forecast outputs

**Purpose:** produce an evaluated, versioned forecast that the application can consume.

### Tasks

- Create a simple baseline (for example, recent-period average or seasonal naive) before training a more complex model.
- Split data chronologically into train, validation, and test windows; do not randomly split time-series observations.
- Train the initial LightGBM model and track parameters, code/run metadata, and evaluation metrics with MLflow.
- Compare the model against the baseline. Record the evaluation dates, metric definitions, results, and limitations.
- Generate forecasts for the agreed horizon and write a versioned output to S3 with product/store keys, forecast dates, model version, and generation timestamp.
- Validate the forecast output schema and check for missing/duplicate keys before publishing it for application use.
- Make the current forecast location and version discoverable to the backend without hard-coding environment-specific paths.

### Completion gate

- Model evaluation is reproducible and includes a baseline comparison.
- Forecast outputs pass schema, key, date-range, and nonnegative-value checks where applicable.
- A sample forecast can be read from S3 using the intended least-privilege access.
- The project reports measured results rather than claiming an unverified accuracy target.

## Stage 4 — MongoDB inventory workflow

**Purpose:** implement the project’s distinct NoSQL assignment feature.

### Tasks

- Define MongoDB document schemas for `inventory_snapshots`, `inventory_alerts`, and `replenishment_actions`.
- Add validation for required identifiers, nonnegative quantities, valid timestamps, and acceptable lead-time values.
- Add indexes for common store/product/time lookups, alert status, and action history.
- Implement API operations to create/read inventory snapshots and list alerts/actions.
- Implement the initial transparent risk calculation using the selected forecast and documented inventory inputs.
- Persist the inputs and calculated values associated with each alert so users can understand why it was raised.
- Record reviewed actions with status, note, timestamp, and user identifier where authentication is available.
- Make alert generation idempotent for a given store/product/forecast window to avoid duplicate alerts on retries.

### Completion gate

- Valid snapshot, alert, and action documents survive service restarts.
- Invalid or missing required inputs return clear validation errors and do not create success-shaped records.
- Repeating an alert-generation request does not create unintended duplicates.
- A stale or incomplete inventory input is clearly identified and does not produce an unqualified recommendation.

## Stage 5 — FastAPI integration

**Purpose:** make the model outputs and MongoDB workflow available through a consistent, validated API.

### Tasks

- Add forecast retrieval from S3 and MongoDB inventory/alert/action endpoints.
- Implement the inventory-risk calculation in backend code, not in the frontend or the LLM.
- Define request/response models and consistent error responses for missing forecasts, stale inventory, database outages, and invalid input.
- Add pagination and filters to list endpoints where appropriate.
- Keep MongoDB, S3, and Bedrock credentials server-side; never expose them to the browser.
- Add unit tests for business rules and integration tests for representative database and forecast retrieval paths.
- Add request IDs and structured logs while avoiding tokens, secrets, and unnecessary document contents.

### Completion gate

- API contract tests cover successful and failure responses.
- Missing/unavailable forecast data returns an explicit service/data error, not fabricated values.
- MongoDB and S3 failures are logged and surfaced clearly without returning a false success.
- The API health check distinguishes service liveness from required dependency readiness as appropriate.

## Stage 6 — React dashboard and user workflow

**Purpose:** deliver the primary user experience on top of a stable API contract.

### Tasks

- Add store/product selectors and historical-versus-forecast charts.
- Display forecast horizon, model version, and forecast generation date.
- Add inventory views for snapshot freshness, risk alerts, calculation inputs, and recommendation rationale.
- Add forms to submit inventory snapshots and record a reviewed action.
- Display API validation, unavailable-data, and dependency errors in clear user-facing states.
- Ensure that the dashboard never implies that an AI-generated explanation is an observed fact or an automatic purchase decision.
- Add frontend tests for the critical selection, loading, error, and action flows.

### Completion gate

- A user can select a product/store and see the corresponding forecast and inventory context.
- Submitting an invalid form gives a useful error and does not show success.
- A recorded action can be retrieved after refresh/restart.
- Loading, empty, stale-data, and service-error states are distinguishable.

## Stage 7 — Optional grounded analytics with Amazon Bedrock

**Purpose:** add GenAI after trusted forecast and inventory retrieval are already working.

### Tasks

- Confirm the selected model, region access, cost, request limits, and IAM permissions.
- Implement a backend-only Bedrock client using the EC2 instance role in AWS; use a local development credential profile only for local development.
- Retrieve relevant, authorized values from the API data sources and pass bounded context to the model.
- Instruct the model to identify missing information and avoid inventing figures.
- Label generated text as AI-generated and keep numeric forecasts/risk calculations authoritative in application code.
- Add timeouts, request-size limits, usage/error logging, and a clear unavailable-model fallback.

### Completion gate

- The application remains usable when Bedrock is disabled or unavailable.
- A model failure is reported as an explanation-service error; the system does not return a fabricated answer.
- Numeric facts displayed in answers can be traced to retrieved application data.

## Stage 8 — AWS infrastructure and deployment

**Purpose:** deploy the verified local application with repeatable AWS infrastructure and a safe image flow.

### Tasks

- Use Terraform for the project’s AWS resources, including the EC2 instance, security group, IAM instance role/policies, S3 permissions, Parameter Store references, and CloudWatch configuration.
- Keep the S3 bucket private and encrypted; grant EC2 access only to the required forecast paths.
- Configure EC2 as an AWS Systems Manager managed node and verify SSM connectivity before using it for deployments.
- Install and configure Docker Engine on EC2; ensure container restart behavior and disk usage are understood.
- Configure the React/Nginx container to serve the frontend and proxy API requests to FastAPI. Expose only the required web ports; do not expose the FastAPI container directly unless necessary.
- Configure TLS for public traffic and restrict administrative access. Prefer Systems Manager Session Manager over broadly exposed SSH.
- Store runtime secrets in Parameter Store SecureString. Keep Docker Hub push credentials in Jenkins protected credentials; if Docker Hub repositories are private, give EC2 a read-only pull token through a protected runtime mechanism.
- Configure Jenkins to run tests and security checks, build versioned images, scan with Trivy, and push to Docker Hub only after scans pass.
- Configure Jenkins deployment to invoke SSM Run Command, deploy explicit image tags, and run a post-deployment health/smoke test.
- Keep the previous known-good image tags so a failed deployment can be rolled back.
- Test Terraform plan and apply in a controlled environment; never put secret values in Terraform source, plans, or state.

### Completion gate

- Terraform creates the required resources with least-privilege access and documented cost.
- EC2 is reachable through SSM and can access only its required S3/Parameter Store/Bedrock/CloudWatch resources.
- Jenkins publishes a versioned image only after passing tests and the Trivy severity policy.
- Deployment health checks pass, and a rollback to the prior image tags is documented and tested.
- The public application is reachable only through the intended frontend entry point.

## Stage 9 — Observability, security hardening, and final acceptance

**Purpose:** verify operation and demonstrate course outcomes, not just a successful deployment.

### Tasks

- Configure the CloudWatch Agent or log forwarding for system, container, and application logs; add CloudWatch alarms for actionable failures.
- Expose a small, bounded set of Prometheus application metrics and build Grafana dashboards for API health, inventory activity, and pipeline/model status.
- Add Jenkins checks for Gitleaks, Python and frontend dependency audits, Bandit, Checkov, tests, and Trivy image scans.
- Document any accepted security-scan exception and its rationale; do not silently suppress findings.
- Confirm that secrets are not present in Git history, container layers, logs, or frontend assets.
- Run a full acceptance scenario: ingest data → generate forecast → retrieve forecast → submit inventory snapshot → create risk alert → review action → view dashboard → request optional explanation.
- Record evidence for the course demonstration: architecture, test results, scan results, model evaluation, and monitoring dashboard.
- Review AWS, Databricks, MongoDB Atlas, Docker Hub, and model usage costs; stop or remove resources that are not needed.

### Completion gate

- The end-to-end scenario succeeds from a clean deployment and each failure path produces a clear error.
- Monitoring shows service and pipeline health and an actionable test alert has been verified.
- Security checks run in CI and block the configured release conditions.
- Setup, deployment, rollback, and teardown steps are documented.

## Release workflow — run in this order for every change

1. Make a small change on a feature branch and keep secrets/data out of the commit.
2. Open a pull request and run formatting, lint, unit, API/frontend, secret, dependency, and Terraform checks.
3. If code or dependency tests fail, stop; fix and rerun. Do not publish or deploy.
4. Build images from the reviewed commit using immutable version tags (commit SHA or release version).
5. Run Trivy against each built image. If the configured policy fails, stop before pushing.
6. Push approved images to Docker Hub using Jenkins' protected credentials.
7. Deploy the exact image tags to EC2 using SSM Run Command.
8. Run health and smoke tests. If they fail, collect logs, roll back to the last known-good image tags, and mark the deployment failed.
9. Verify CloudWatch logs/alarms and Prometheus/Grafana dashboards after deployment.
10. Record the deployed commit, image tags, model/forecast version, test results, and any approved exceptions.

## Error prevention and recovery rules

- **One source of truth per interface:** keep API schemas and MongoDB/data contracts explicit and versioned.
- **Fail fast:** reject invalid data and configuration at ingestion/startup rather than silently defaulting to plausible values.
- **No fabricated success:** failed writes, unavailable dependencies, and failed deployments must return/report failure.
- **Safe retries:** make ingestion and alert generation idempotent where possible; use request IDs or unique keys for retried operations.
- **Visible data freshness:** expose the observation and forecast timestamps and stop/qualify recommendations when required inputs are stale.
- **Separate credentials by purpose:** Jenkins push/deploy credentials, EC2 runtime IAM role, MongoDB credentials, and Bedrock access must not be shared unnecessarily.
- **Deploy immutable versions:** do not use `latest` as the only deployment reference; retain a known-good image tag for rollback.
- **Keep a local path:** retain Docker Compose or equivalent local instructions so the project can still be demonstrated if cloud services or credits are unavailable.
- **Control spending:** check current service prices and student-credit terms before provisioning; stop EC2 when unused and remove billable resources after the demo.

## Definition of done

The project is ready for its final demonstration when a reviewer can:

1. Follow the documented local setup.
2. Inspect a time-based model evaluation and trace a forecast to its model version.
3. See a forecast and its data freshness in the dashboard.
4. Submit inventory data, inspect a transparent risk alert, and record/retrieve a reviewed action in MongoDB.
5. Understand how Jenkins, Trivy, Docker Hub, Terraform, EC2, IAM, SSM, Parameter Store, Bedrock, and CloudWatch fit together.
6. Observe clear test failures, application errors, and deployment rollback behavior without exposing credentials.

