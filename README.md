# Orbital Watch: https://adam-yonas.github.io/orbit-observer-91/

## Problem Statement

Many modern systems generate large volumes of dynamic, time-dependent data, yet most tools fail at the harder problem: helping users understand what to do with that data.

Users are often presented with dashboards that describe the current state of a system, but not its implications. They are required to interpret relationships manually, anticipate future outcomes, and make decisions without clear guidance. This creates a gap between data visibility and decision-making.

This problem appears across domains:
- operations teams monitoring infrastructure health over time  
- analysts evaluating evolving risk exposure  
- planners making decisions under uncertainty  

In each case, the system being observed is not static. Relationships change, interactions emerge, and small differences can lead to large downstream effects.

Orbital systems provide a clear example of this challenge. Thousands of objects move continuously, proximity changes over time, and collisions can create cascading consequences. However, the goal of this project is not limited to space debris. It is to explore how to design tools that help users reason about complex, evolving systems more effectively.

The users most affected by this problem are individuals who must make decisions based on dynamic data but do not have the time or expertise to interpret it manually.

Success for this system would mean:
- reducing the time required to identify risk  
- enabling users to test hypothetical scenarios  
- making system behavior understandable without deep domain expertise  

---

## Solution Overview

Orbital Watch is an interactive system that transforms complex, time-evolving data into an environment users can explore, modify, and learn from.

Instead of presenting static information, the system allows users to:
- observe how the system evolves over time  
- introduce changes and see their consequences  
- understand how interactions emerge within the system  

The core idea is to move from passive observation to active exploration.

### Key Capabilities

The system renders objects in a live 3D environment and propagates their motion forward in time. This allows users to see how spatial relationships evolve instead of interpreting static snapshots.

It continuously evaluates proximity between objects over a configurable time horizon. This exposes interactions that would otherwise remain hidden and helps users understand how risk develops.

Users can introduce new objects into the system and observe how they interact with existing ones. This turns the system into a tool for experimentation rather than observation.

The system also supports simulation of cascading events. When a collision is triggered, fragments are generated and propagated forward, allowing users to observe how localized disruptions can affect the entire system.

Finally, the system includes an AI layer that allows users to express intent in natural language. Instead of manually configuring parameters, users can describe goals, and the system translates those into structured actions.

### Role of AI

AI is used as an interface layer rather than a content generator. Its purpose is to reduce the gap between user intent and system configuration.

Without AI, interacting with the system would require:
- understanding multiple parameters  
- manually iterating on configurations  
- interpreting results across multiple steps  

With AI, the system becomes more accessible and responsive to user goals.

---

## AI Integration

The AI component is designed to map user intent to system actions in a predictable and reliable way.

The current implementation uses a deterministic model rather than a full large language model. This decision was made to prioritize:
- low latency  
- consistent outputs  
- ease of debugging  

The system follows a simple pipeline:
1. interpret user input  
2. map it to system constraints  
3. generate structured actions  

This approach avoids issues such as hallucination and inconsistent behavior, while still providing meaningful abstraction.

### Tradeoffs

Choosing a deterministic approach limits flexibility. The system cannot perform deep optimization or long-term planning. It also lacks probabilistic reasoning.

However, this tradeoff improves reliability and ensures that outputs remain grounded in system behavior.

### Reflection

The AI integration worked well in reducing interaction cost. Users were able to explore scenarios more quickly and with less friction.

It fell short in situations requiring deeper reasoning or multi-step planning. Extending the system to include tool-calling or planning-based LLM architectures would improve this.

---

## Architecture / Design Decisions

The system is structured as a separation between data ingestion, simulation, and visualization, with an emphasis on responsiveness and clarity.

Orbital data is sourced from publicly available satellite tracking datasets in the form of Two-Line Element (TLE) data. These TLEs represent the current known state of objects in orbit.

Instead of treating this data as static, the system continuously propagates each object forward in time using the SGP4 model. This means the system is not just displaying where objects are, but actively predicting where they will be as time evolves.

As a result, the environment shown to the user is constantly updating, reflecting a dynamic system rather than a snapshot. This is critical for exposing how relationships between objects change and how risk emerges over time.

The current architecture is frontend-first. The frontend, built with React and Vite, is responsible for:
- rendering the system in 3D  
- handling user interaction  
- performing orbit propagation using SGP4  
- running proximity detection  
- simulating cascade events  

Running this logic in the browser was an intentional decision. It allows:
- immediate feedback to user actions  
- no network latency during interaction  
- rapid iteration during development  

The backend is implemented in FastAPI and currently serves as a lightweight API layer. It provides a health endpoint and a structured foundation for future expansion.

The system is deployed using:
- GitHub Pages for the frontend  
- Render for the backend  

### Tradeoffs

Running simulation in the frontend improves responsiveness but limits scalability and computational complexity.

Using TLE data with SGP4 provides realistic motion modeling, but does not capture all physical effects such as atmospheric drag variations or high-fidelity collision physics.

---

## Development with AI Tools

This project was built using AI-assisted development tools, primarily Cursor and Lovable.

Cursor was used as the primary development environment. It helped accelerate development by generating code, debugging issues, and enabling rapid iteration. It was particularly useful for resolving integration issues between the frontend and backend.

However, Cursor required careful validation. It occasionally produced incorrect assumptions about React lifecycle behavior and did not always account for edge cases. As a result, all generated code was tested and refined manually.

Lovable was used to enhance the user interface and improve overall usability. It enabled rapid prototyping of layouts and components and helped elevate the visual quality of the application.

Not all generated code was suitable for production, and some components required restructuring. However, it significantly reduced the time required to reach a polished interface.

Together, these tools allowed for faster iteration and development, but they did not replace the need for engineering judgment. They were most effective when used as accelerators rather than sources of truth.

---

## Getting Started / Setup Instructions

### Prerequisites

Before running the project locally, install:

- Node.js v18 or newer
- Python v3.10–3.12
- Git

---

### 1. Clone the repository

```bash
git clone https://github.com/Adam-Yonas/orbit-observer-91.git
cd orbit-observer-91
```

---

### 2. Start the backend first

Open a terminal from the project root and run:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

The backend should run locally at:

```text
http://127.0.0.1:8000
```

Verify the backend is working:

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok"}
```

Keep this backend terminal running.

---

### 3. Confirm local frontend-backend connection

For local development, `src/App.tsx` should point to the local backend:

```ts
const API_BASE = "http://127.0.0.1:8000";
```

When the frontend loads, it should be able to call the local backend health endpoint.

---

### 4. Start the frontend

Open a second terminal from the project root and run:

```bash
npm install
npm run dev
```

The frontend should run locally at:

```text
http://localhost:8080/orbit-observer-91
```

Open that URL in your browser to view the UI.

---

## Demo

Live application:

https://adam-yonas.github.io/orbit-observer-91/

---

## How to Use

Begin by exploring the system visually. Adjust filters to understand how objects are distributed and where density increases.

Introduce a new object to see how it interacts with existing ones. This reveals how small changes affect system behavior.

Observe detected interactions to understand how proximity evolves over time.

Trigger a cascade event to see how localized disruptions propagate through the system.

Adjust simulation parameters to understand how assumptions influence outcomes.

Use the AI interface to express goals and allow the system to translate them into actions.

---

## Testing / Error Handling

The backend includes a health endpoint to verify availability.

The frontend handles API failures gracefully and falls back where possible.

The simulation includes safeguards such as limits on fragment generation and handling for invalid data.

Edge cases considered include:
- invalid orbital data  
- propagation failures  
- excessive system growth  

---

## Future Improvements

Future work includes:

- moving simulation logic to the backend to support heavier computation and multi-user scenarios  
- probabilistic collision modeling  
- improved physical modeling of fragmentation  
- persistent simulation scenarios  
- more advanced AI planning capabilities  

The next major step would be transitioning from a client-side simulation model to a backend-driven system, enabling more accurate, scalable, and collaborative use cases.
