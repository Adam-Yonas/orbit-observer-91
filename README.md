# Orbital Watch : https://adam-yonas.github.io/orbit-observer-91/

## Problem Statement

Modern products increasingly rely on large volumes of dynamic, time-dependent data, yet most interfaces fail to make that data actionable.

Users are often forced to:
- manually interpret complex system states
- navigate multiple tools to understand risk
- make decisions without clear forward projections

This creates a gap between **data availability** and **decision-making ability**.

In the context of orbital systems, operators must reason about:
- thousands of moving objects
- continuously evolving spatial relationships
- collision risk that changes over time

However, this challenge is not unique to aerospace. Similar problems exist in:
- logistics (routing under uncertainty)
- finance (risk exposure over time)
- infrastructure systems (failure propagation)

The core problem is:
> How do we help users understand and act on complex, evolving systems in real time?

### Users

- analysts working with dynamic datasets  
- operators managing risk-sensitive systems  
- planners exploring future scenarios  

### Desired Outcome

Users should be able to:
- understand system state instantly  
- simulate future scenarios  
- make decisions without manual analysis  

### Success Criteria

- reduced time to identify risk  
- ability to run “what-if” scenarios interactively  
- clearer mental model of system behavior  

---

## Solution Overview

Orbital Watch is an interactive platform that transforms complex system data into an explorable, decision-support interface.

It combines:
- real-time data visualization  
- forward simulation  
- AI-assisted interaction  

## Key Features

Orbital Watch provides several capabilities that help users understand and interact with a dynamic system:

- **3D System Visualization**  
  Objects are rendered in a live 3D environment, allowing users to see how positions change over time rather than interpreting static data.

- **Density Analysis by Region**  
  The system groups objects by altitude ranges to highlight where congestion occurs, helping users quickly identify high-risk zones.

- **Proximity Detection (Conjunctions)**  
  The system continuously checks whether objects come within a defined distance of each other over a time window, surfacing potential risks.

- **Scenario Simulation (Cascade Events)**  
  Users can simulate a collision event and observe how fragments spread and interact with other objects over time.

- **Natural Language Interaction (AI Copilot)**  
  Instead of manually adjusting parameters, users can describe goals or questions, and the system translates them into actions.
  
---

## AI Integration

AI acts as an interpretation layer between user intent and system behavior.

Instead of requiring manual parameter tuning, users can express goals in natural language, which are translated into structured actions.

### Design Approach

- Deterministic local model (no external LLM dependency)  
- Intent → structured mapping  
- Constraint-based reasoning  

### Tradeoffs

- Prioritized reliability and latency over LLM flexibility  
- Avoided API costs and rate limits  
- Reduced hallucination risk  

### Where AI Works Well

- simplifies interaction with complex systems  
- enables rapid exploration of scenarios  
- reduces need for domain expertise  

### Limitations

- limited optimization capability  
- no long-horizon planning  
- lacks probabilistic reasoning  

---

## Architecture / Design Decisions

The system is intentionally designed as a separation between visualization, computation, and data ingestion to keep it modular and responsive.

The frontend is built in React and is responsible for rendering the system state and handling user interaction. It performs no heavy computation, which keeps the interface fast and responsive even as the number of objects increases.

The backend is implemented in FastAPI and handles all simulation logic, including orbit propagation, proximity detection, and cascade modeling. This separation allows the computational layer to scale independently from the user interface.

Orbital data is sourced from publicly available Two-Line Element (TLE) sets and propagated using the SGP4 model. This provides a realistic baseline for object motion without requiring full physics simulation.

A key design decision was to use discrete timestep simulation rather than continuous-time modeling. This significantly reduces computational cost and allows real-time interaction, at the expense of precision.

Collision cascades are modeled using a simplified heuristic approach where fragments inherit the parent object's velocity with perturbations. While this is not physically exact, it captures the qualitative behavior of debris spreading and risk amplification.

The system is deployed using a split architecture:
- the frontend is hosted on GitHub Pages for fast static delivery  
- the backend is hosted on Render to provide a persistent API  

This separation mirrors production systems where computation and presentation are decoupled.

Overall, the system prioritizes interactivity and clarity over full physical accuracy, enabling users to explore and understand system behavior rather than producing mission-grade predictions.

---

### Key Decisions

- SGP4 used for orbit propagation (realistic baseline physics)  
- Discrete timestep screening for performance  
- Heuristic fragment generation for real-time cascade simulation  
- Separation of frontend (GitHub Pages) and backend (Render)

---

### Tradeoffs

- prioritized interactivity over full physical accuracy  
- used synthetic breakup modeling instead of NASA-standard models  
- optimized for responsiveness over precision  

---

## Development with AI Tools

This project was built using AI-assisted tools, primarily Cursor and Lovable.

### Cursor (Primary Development)

Used for:
- building React and FastAPI components  
- debugging frontend/backend integration  
- fixing runtime issues (hooks, routing, API calls)  
- accelerating iteration  

Strengths:
- rapid code generation  
- debugging assistance  
- reduced boilerplate  

Limitations:
- incorrect assumptions about React lifecycle  
- incomplete edge case handling  
- required manual validation  

Workflow:
1. generate  
2. test  
3. refine  

---

### Lovable (UI + Enhancement)

Used for:
- accelerating UI layout and structure  
- improving component quality  
- prototyping interactive features  

Strengths:
- faster UI iteration  
- improved visual polish  
- rapid prototyping  

Limitations:
- required restructuring for production  
- some generated logic replaced manually  

---

### Combined Impact

- significantly reduced development time  
- enabled faster iteration cycles  
- shifted focus toward system design  

AI acted as a **force multiplier**, not a replacement for engineering judgment.

---

## Local vs Deployed Usage

This project can be run fully locally.

### Local

- frontend → Vite (localhost:5173)  
- backend → FastAPI (localhost:8000)  

### Deployed

- frontend → GitHub Pages  
- backend → Render  

No external services are required for local execution.

---

## Getting Started

### Prerequisites

- Node.js (v18+)  
- Python (v3.10–3.12)  
- npm  

---

### 1. Clone

```bash
git clone https://github.com/Adam-Yonas/orbit-observer-91.git
cd orbit-observer-91
```

---

### 2. Install frontend

```bash
npm install
```

---

### 3. Run frontend

```bash
npm run dev
```

```
http://localhost:5173
```

---

### 4. Run backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

```
http://127.0.0.1:8000
```

---

### 5. Verify backend

```bash
curl http://127.0.0.1:8000/health
```

```json
{"status": "ok"}
```

---

### 6. Connect frontend to backend

Update in `src/App.tsx`:

```ts
const API_BASE = "http://127.0.0.1:8000";
```

---

## Demo

Frontend:  
https://adam-yonas.github.io/orbit-observer-91/

---

## How to Use

### Explore the System

Users can filter which types of objects are visible and adjust the altitude range.

This allows them to quickly see where objects are concentrated and how crowded different regions are.

---

### Add a New Object

Users can define a new orbit and insert it into the system.

The system immediately evaluates how that object interacts with others, highlighting potential risks.

---

### Understand Risk

The system detects when objects come close to each other and surfaces those interactions.

This helps users understand how small changes in position or trajectory can lead to potential collisions.

---

### Simulate a Cascade Event

Users can trigger a simulated collision that generates fragments.

The system then propagates those fragments forward and evaluates how they interact with existing objects.

This demonstrates how failures in a system can create downstream effects.

---

### Adjust Model Sensitivity

Users can change parameters such as:
- how far into the future the system checks interactions  
- how close objects must be to count as a risk  

This shows how different assumptions affect the system’s behavior.

---

### Use the AI Copilot

Users can describe goals or ask questions in plain language.

The system translates this into actions or recommendations, reducing the need for manual configuration.

---

### Launch a Satellite

- configure orbit parameters  
- click "Launch & Screen"  

**Shows:** how orbit choices affect exposure  

---

### Analyze Risk

- review conjunction alerts  
- inspect miss distance and timing  

**Shows:** how proximity evolves over time  

---

### Trigger Cascade

- select object  
- adjust collision parameters  
- run cascade  

**Shows:** how fragmentation propagates risk  

---

### Adjust Simulation

- screening horizon  
- miss distance  
- fragment count  

**Shows:** sensitivity of outcomes to assumptions  

---

### Use AI Copilot

- input goals in natural language  

**Shows:** abstraction of complex system control  

---

## Testing / Error Handling

- `/health` endpoint for backend validation  
- graceful frontend API fallback  
- limits on fragment growth  
- handling for invalid or missing data  

---

## Future Work

- probabilistic collision modeling  
- improved breakup physics  
- persistent simulations  
- full LLM-based planning  
- backend-driven risk scoring  

---

## Summary

Orbital Watch demonstrates how to:

- transform complex, dynamic data into an interactive system  
- simulate future states of a system  
- integrate AI to simplify decision-making  

The approach generalizes beyond aerospace to any domain involving evolving data and uncertainty.
