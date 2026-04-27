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

### Key Features

- 3D orbit visualization using SGP4 propagation  
- Altitude density analysis across orbital bands  
- Conjunction detection using miss distance and time horizon  
- Kessler-style cascade simulation with fragment propagation  
- AI Copilot interface for natural language interaction  

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

### Architecture

Frontend (React + Vite + Plotly)  
↓  
Backend (FastAPI)  
↓  
Data (CelesTrak TLE + simulation layer)

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

- toggle object types  
- adjust altitude filters  

**Shows:** system density and congestion patterns  

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
