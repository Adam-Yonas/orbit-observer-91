# Orbital Watch

## Problem Statement

Modern systems generate large volumes of dynamic, time-evolving data, but most tools fail to make that data interpretable or actionable.

In the context of space operations, satellite operators must reason about:
- thousands of moving objects
- evolving collision risk
- cascading failure scenarios (Kessler Syndrome)

This problem extends beyond aerospace. Many industries face similar challenges:
- understanding complex systems over time
- identifying risk before it becomes failure
- translating raw data into decisions

The primary users affected are:
- satellite operators
- mission planners
- analysts working with dynamic systems

If solved, users would be able to:
- understand system state instantly
- simulate future scenarios
- make informed decisions under uncertainty

Success would mean:
- faster identification of high-risk configurations
- ability to test “what-if” scenarios interactively
- reduced cognitive load when interpreting complex systems

---

## Solution Overview

Orbital Watch is an interactive platform that combines:
- real-time orbital data visualization
- simulation of collision cascades
- an AI-assisted interface for reasoning about system behavior

### Key Features

- 3D orbit visualization using SGP4 propagation  
- Altitude density analysis across orbital bands  
- Conjunction detection using miss distance and time horizon  
- Kessler-style cascade simulation with fragment propagation  
- AI Copilot interface for natural language interaction  

### Role of AI

AI acts as an interpretation layer that converts user intent into structured system actions.

It enables users to interact with the system using natural language instead of manual parameter tuning.

Without AI, the system would require:
- manual configuration  
- domain expertise  
- multiple UI interactions  

With AI, the system becomes:
- faster to use  
- easier to explore  
- more accessible to non-experts  

---

## AI Integration

The current implementation uses a lightweight deterministic AI layer instead of a full LLM.

### Design Choices

- Local heuristic model instead of external LLM APIs  
- Deterministic outputs for reliability  
- Designed for future extension into:
  - LLM-based planning  
  - tool-calling systems  
  - multi-step reasoning pipelines  

### Patterns Used

- Intent → structured mapping  
- Constraint-based reasoning  
- System-aware recommendations  

### Tradeoffs

- Chose reliability and latency over LLM flexibility  
- Avoided API cost and rate limits  
- Reduced hallucination risk  

### Where AI Worked Well

- Simplified user interaction significantly  
- Enabled rapid scenario exploration  
- Reduced need for manual parameter tuning  

### Where AI Fell Short

- Limited ability to perform deep optimization  
- No long-horizon planning  
- Lacks probabilistic reasoning  

---

## Architecture / Design Decisions

### Architecture

Frontend (React + Vite + Plotly)  
↓  
Backend (FastAPI on Render)  
↓  
Data (CelesTrak TLE + synthetic simulation)

### Key Design Decisions

- Used SGP4 for realistic orbit propagation  
- Implemented cascade simulation using heuristic delta-v distribution  
- Used discrete timestep collision detection for performance  
- Hosted frontend on GitHub Pages and backend on Render  

### Tradeoffs

- Prioritized interactivity over physical accuracy  
- Used synthetic fragment generation instead of NASA breakup models  
- Chose simple backend API for extensibility  

---

## Development with AI Tools

This project was built using AI-assisted development tools, primarily Cursor and Lovable, to accelerate both implementation and iteration.

### Cursor (Primary Development Environment)

Cursor was used to:
- scaffold React components and FastAPI endpoints  
- debug frontend-backend integration issues  
- fix runtime errors (React hooks, routing, API calls)  
- refactor and clean up code structure  

It was especially helpful for:
- rapid iteration  
- resolving deployment issues (GitHub Pages + Render)  
- reducing time spent on boilerplate  

Limitations:
- occasional incorrect assumptions about React lifecycle rules  
- incomplete edge case handling  
- required manual validation of generated logic  

Workflow:
1. generate solution  
2. test locally  
3. refine manually  

---

### Lovable (UI + System Enhancement)

Lovable was used to:
- accelerate UI structure and layout  
- improve component quality and styling  
- prototype interactive features quickly  
- enhance overall user experience  

It enabled faster iteration on:
- dashboard layout  
- control panels and filters  
- interaction design  

Limitations:
- required restructuring to fit final architecture  
- some generated logic needed replacement  
- not all outputs were production-ready  

---

### Combined Impact

Using Cursor and Lovable together:
- significantly reduced development time  
- enabled rapid iteration  
- allowed focus on system design over boilerplate  

AI acted as a **force multiplier**, but required:
- careful validation  
- manual debugging  
- strong engineering judgment  

---

## Getting Started / Setup Instructions

### Prerequisites

- Node.js (v18+)  
- Python (v3.10–3.12)  
- npm  

---

### 1. Clone the repository

```bash
git clone https://github.com/Adam-Yonas/orbit-observer-91.git
cd orbit-observer-91
```

---

### 2. Install frontend dependencies

```bash
npm install
```

---

### 3. Start the frontend

```bash
npm run dev
```

Frontend:

```
http://localhost:5173
```

---

### 4. Run the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend:

```
http://127.0.0.1:8000
```

---

### 5. Verify backend

```bash
curl http://127.0.0.1:8000/health
```

Expected:

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

Live site:

https://adam-yonas.github.io/orbit-observer-91/

### How to Use

- Toggle object classes (payloads, debris, rocket bodies)  
- Adjust altitude filters  
- Launch a simulated satellite  
- Trigger a cascade event  
- Observe fragment propagation  
- Use AI Copilot for scenario input  

---

## Testing / Error Handling

- Backend includes `/health` endpoint for validation  
- Frontend handles API failures gracefully  
- Cascade simulation includes:
  - fragment limits  
  - generation caps  
  - fallback propagation  

Edge cases considered:
- invalid TLE data  
- propagation failures  
- excessive fragment growth  

---

## Future Improvements

- probabilistic collision modeling  
- improved breakup physics  
- persistent simulations  
- full LLM-based planning system  
- backend-driven risk scoring  

---

## Application Links

Frontend:
https://adam-yonas.github.io/orbit-observer-91/

Backend:
https://space-debris-dashboard.onrender.com/health
