## Summary

This video series presents a comprehensive case study on building a hybrid machine learning (ML) and generative AI (GenAI) sales forecasting application, inspired by the role of a Forward Deployed Engineer (FDE). The project covers the entire lifecycle from understanding business requirements, designing logical and physical architectures, coding and deploying data pipelines and microservices, containerization, cloud deployment, through to continuous integration and continuous delivery (CI/CD) automation. The central idea combines ML-based forecasting with GenAI-powered analytics explanations, delivered via a user-friendly interface.

This content is ideal for AI engineers, software developers, data engineers, or engineers preparing for FDE interviews interested in hands-on, end-to-end project development incorporating industry-grade tools and best practices. Viewers learn how to leverage cloud platforms (Azure), Databricks for ML pipelines, FastAPI and React for microservices, Docker for containerization, Azure Container Apps for deployment, and Azure DevOps for CI/CD, all integrated in a scalable, maintainable architecture suited for real-world enterprise applications.

---

## Timeline Summary

### 00:00 – 00:18:00: Introduction and Project Overview  

- Introduction to the Forward Deployed Engineer role and project goals  
- Demonstration of the sales forecasting app: dashboard with historical/forecast data and an analytics chatbot powered by GenAI  
- Explanation of problem statement: manual sales forecasting leads to stockouts/overstocking  
- Technologies: Databricks for pipeline and ML, FastAPI backend, React frontend, Azure Container Apps for hosting, Azure DevOps for pipeline automation, Azure OpenAI for GenAI  
- Dashboard features: KPI display, upload new data, retrain model, forecast visualization, explanation using LLM  

**Key point:** Hybrid project approach combining ML forecasting and generative AI analytics to serve business users.

---

### 00:18:00 – 00:42:00: Business Requirements, Data Overview, and Logical Architecture  

- Detailed business requirements document on sales forecasting problem, objectives, scope, and user experience  
- Available datasets: product info, store details, campaigns, sales transactions  
- Explanation of medallion architecture schema: bronze (raw), silver(cleaned), gold (business aggregates)  
- Entity-relationship diagram and one-to-many relationships explained  
- Logical architecture: data ingestion via Databricks pipelines, backend APIs interacting with Databricks and Azure OpenAI, frontend components consuming APIs for display and interaction  

**Key point:** Clear domain problem framing, data schema management, and architectural planning critical to aligning technology with business needs.

---

### 00:42:00 – 02:38:00: Databricks Data Processing and ML Pipeline Implementation  

- Setup of Databricks environment and workspace  
- Bronze pipeline: ingest raw CSV files (products, sales, campaigns, stores) with incremental loading  
- Silver pipeline: data cleaning, deduplication, business rule validation, dimension-fact table joins  
- Exploratory Data Analysis with visualizations revealing seasonality, category trends, promotional impact, stockout patterns  
- Gold pipeline: business-level aggregations, time series feature engineering (lags, rolling windows, trend, pricing, promotion-related features), train-validation-test splits  
- ML training with LightGBM regressor model, hyperparameter tuning, metric evaluation (weighted absolute percentage error) and model registry with MLflow  
- Batch inferencing pipeline for next 30-day forecasting, result storage back to Databricks  
- Pipeline orchestration via Databricks jobs and execution monitoring  

**Key point:** Step-by-step engineering of scalable, repeatable ETL and ML workflows using best practices and enterprise tools.

---

### 02:38:00 – 03:46:00: Backend and Frontend Microservices Development and Testing  

- Backend microservice development in Python using FastAPI with Databricks API integrations and Azure OpenAI LLM calls  
- Definition of multiple REST API endpoints: health check, forecast retrieval, forecast explanation, chatbot analytics  
- Backend codebase modularized into data and generative AI components with schema validation  
- Frontend development with React, including components for dashboard visualization, product/store selectors, KPI bars, charts, and chatbot  
- Setup instructions including dependency management and local testing  
- Demonstration of front + backend integration with UI showing live data loading and interaction  

**Key point:** Microservices architecture enhances modularity, and integration between UI/backend/ML APIs enables interactive business insights.

---

### 03:46:00 – 04:27:00: Containerization with Docker  

- Introduction to containerization and explanation of Docker images and containers benefits (consistent deployment environment, portability)  
- Detailed creation of Dockerfiles for backend (Python 3.12 slim base image, dependencies install, FastAPI run) and frontend (Node 22 alpine build with multi-stage build using Nginx for optimized serving)  
- Building, tagging, and running Docker images locally with troubleshooting and optimizations (image size reduction)  
- Verification of containerized services running as isolated instances locally  
- Preparation for cloud deployment by pushing images to Azure Container Registry (ACR)  

**Key point:** Containerization abstracts away environment differences, simplifies deployment, and guarantees code portability.

---

### 04:27:00 – 05:15:00: Deployment to Azure Container Apps  

- Explanation of Azure Container Apps as a serverless container hosting platform with autoscaling, ingress management, and zero infrastructure maintenance  
- Step-by-step creation of Azure Container Registry and pushing backend/frontend images  
- Creating container apps for backend and frontend services connected to ACR images  
- Configuration details including ingress rules, port exposures, environment variables, managed identity permissions  
- Troubleshooting deployment issues such as missing ingress port, Cross-Origin Resource Sharing (CORS) errors and correction by adjusting configuration and redeployment  
- Final testing confirming both services running and accessible through public endpoints  

**Key point:** Azure Container Apps streamline production deployment with managed scaling and security, facilitating microservices hosting at scale.

---

### 05:15:00 – 06:25:00: CI/CD Automation with Azure DevOps  

- Explanation of Continuous Integration/Continuous Delivery concepts and workflow automation benefits  
- Setup and configuration of Azure DevOps pipelines for backend and frontend microservices  
- Integration of service connections for ACR and Azure Container Apps with Azure DevOps for secure authentication  
- Creating YAML and classic editor pipelines including stages: build Docker images, push to ACR, deploy to container apps  
- Addition of branch filters for triggering pipelines only on relevant changes (backend vs. frontend)  
- Demonstration of pipeline runs triggered by code pushes and successful deployments  
- Finetuning pipeline to handle frontend build argument (backend API URL) dynamically  
- Validation of full end-to-end automated deployment pipeline with live update of UI and backend services  

**Key point:** Automated DevOps pipelines significantly reduce manual deployment errors and accelerate development cycles.

---

### 06:25:00 – 07:20:00: Automating Databricks Workflow Deployment with Declarative Automation Bundle (DAB)  

- Introduction to Databricks Declarative Automation Bundle (formerly asset bundle) for CI/CD of Databricks notebooks and jobs  
- Explanation of challenges with manual Databricks job replication across environments and how DAB standardizes deployment  
- Setting up DAB project locally via Databricks CLI and bundling notebooks, project configs, job definitions  
- Pulling existing jobs into DAB manifests to track and version workflow configuration  
- Incorporating DAB into Azure DevOps pipeline for validation and deployment to dedicated Databricks workspace folders for dev and production environment simulation  
- Handling workspace folder structuring, enforcing workspace paths, and testing deployed jobs  
- Final integration of DAB pipelines with other microservice pipelines assuring end-to-end versioned, automated DevOps lifecycle  

**Key point:** DAB enables modern software engineering principles for managing and promoting Databricks ML workflows with confidence and automation.

---

### 07:20:00 – End: Final Recap and Suggested Improvements  

- Recap of complete hybrid ML+GenAI sales forecasting project, architecture, tools, deployment, and automation  
- Suggested further improvements for interview readiness and enterprise readiness:  
  - User authentication & role-based access control (Azure AD, MFA)  
  - Centralized secrets management with Azure Key Vault  
  - Multi-environment deployment (Dev, QA, UAT, Prod)  
  - LLM evaluation and monitoring (hallucination control, golden dataset testing)  
  - Data drift detection and ML model monitoring dashboards  
  - Security hardening: private endpoints, virtual networks, firewalls, vulnerability scans  
  - Branch protection, review policies in SCM  
  - Backup, recovery, autoscale optimizations, cost management and governance  
- Cost summary and encouragement to showcase this comprehensive project experience in interviews  
- Closing remarks with gratitude and future project invitations  

**Key point:** Real-world robustness requires enhancements beyond development; focus on security, governance, monitoring, multi-stage rollout critical in production.

---

## Key Points

- 🎯 **Hybrid ML + GenAI Architecture** unites predictive forecasting and explainability for better business decision support.  
- ⚙️ **End-to-End Pipeline Engineering** covers data ingestion, cleaning, feature engineering, model training, inference, and deployment.  
- 🛠️ **Industry-Standard Tools** used: Databricks (ML pipelines), Azure OpenAI (LLM), FastAPI (backend), React (frontend), Docker (containerization), Azure Container Apps (hosting), Azure DevOps (CI/CD), DAB (Databricks workflow automation).  
- 🔄 **CI/CD Automation** with Azure DevOps ensures rapid, consistent deployment with branch-based triggers and environment-specific configurations.  
- 🔐 **Security and Access Management** improvements are essential (Azure AD, Key Vault, managed identities) for enterprise-grade solutions.  
- 📈 **Monitoring and Evaluation** for ML models and GenAI outputs enhance trustworthiness and operational excellence.  
- 🚀 **Containerization and Serverless Deployment** enable scalable, portable and maintainable microservices with minimal operational overhead.  
- 📊 **Rich Visual Analytics and Chatbot** frontends empower non-technical business users with interactive insights.  
- 🧰 **Declarative Automation Bundle** empowers software engineering best practices for Databricks notebooks and pipeline lifecycle.  

---

## Key Insights

- Insight: The project effectively simulates the FDE role by bridging business needs with technical implementation rapidly and end-to-end.  
- Insight: Using Azure's serverless container apps simplifies deployment complexity compared to Kubernetes, easing scalability and cost management.  
- Insight: Declarative Automation Bundle (DAB) transforms Databricks notebooks and jobs into manageable, version-controlled artifacts, a must-have for team collaboration and multi-env DevOps.  
- Insight: Separating frontend/backend microservices and automating respective pipelines with branch filters ensures modularity and efficiency in software delivery.  
- Insight: Combining time series feature engineering with LightGBM leverages modern boosting algorithms effectively for demand forecasting with good accuracy and easy handling of nulls.  

---

## Frequently Asked Questions (FAQs)

1. **Who is this project suitable for?**  
   It is ideal for software engineers, data scientists, and AI engineers aiming to develop practical skills in full-stack ML and GenAI application development, especially those preparing for Forward Deployed Engineer roles.

2. **Can this project be adapted to other cloud providers?**  
   Yes. While this series uses Azure services, the architecture and practices can be mapped to AWS or GCP equivalents, adapting services like AWS SageMaker, ECS/Fargate, Lambda, and corresponding CI/CD tools.

3. **What programming languages and frameworks are required?**  
   The backend uses Python (FastAPI), the frontend uses React (JavaScript/TypeScript), Databricks notebooks are primarily Python/SQL, and infrastructure is managed with Docker and Azure DevOps YAML pipelines.

4. **How to handle secrets and authentication in production?**  
   Integrate Azure Key Vault for secrets management and Azure Active Directory (AD) for authentication and role-based access control for secure enterprise deployment.

5. **How to monitor and maintain ML model performance over time?**  
   Implement drift detection, model evaluation with multiple metrics, and utilize monitoring dashboards coupled with CI gates to ensure model robustness and alert operators proactively.

---

## Conclusion

This forward deployed engineer project illustrates the complete journey of building a hybrid ML plus generative AI sales forecasting application designed with industry best practices. The series expertly translates business needs into scalable, maintainable, and interactive solutions leveraging Databricks, Azure cloud services, containerization, and automated DevOps pipelines. By integrating predictive modeling with generative explanations, it empowers decision-makers with actionable insights accessible via intuitive dashboards and natural language chatbots.

The automation strategies illustrated, including multi-repository CI/CD and Databricks declarative automation bundles, demonstrate how to maintain code quality, reduce deployment friction, and accelerate delivery cycles in complex AI projects. Moreover, the closing segment emphasizes the importance of extending solutions with robust security, monitoring, and governance practices to meet enterprise-grade requirements.

**Action Suggestions:**  

- Follow the repository and build this project hands-on to solidify understanding.  
- Experiment with security enhancements using Azure AD and Key Vault integration.  
- Extend the system to multi-environment deployments for professional workflow readiness.  
- Incorporate drift detection and LLM response quality assessment in your ML pipelines.  
- Explore scaling and logging enhancements for production system reliability.

This project offers a rich, practical blueprint to excel as a Forward Deployed Engineer, bridging AI innovation with impactful business applications.
