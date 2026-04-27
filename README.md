# Orbital Watch 

https://adam-yonas.github.io/orbit-observer-91/

https://www.loom.com/share/c1418334063e4f30a6b350ad0f8d2a3d

## Problem Statement

The rapid growth of satellite deployments has made it increasingly difficult to identify safe and sustainable orbits.

New satellite operators must choose orbital parameters that avoid collisions not just at launch, but over time as objects move and interact. This is challenging because orbital environments are dynamic. The relative positions of objects change continuously, and small differences in trajectory can lead to close approaches or collisions.

Most available tools either provide static snapshots of orbital data or require significant expertise to interpret. This makes it difficult, especially for smaller or newer organizations, to evaluate whether a proposed orbit is actually safe.

I wanted to build a system that allows users to test an orbit before deployment, evaluate how it interacts with existing objects, and understand how risks evolve over time.

Beyond initial placement, it is also important to understand how failures affect the system. A single collision can generate debris that increases risk for other objects, creating cascading effects.

The goal of this project is to provide a way to:
- evaluate orbit safety dynamically  
- simulate how a new object interacts with an existing system  
- understand how local events impact the broader environment  

Success would mean that a user can move from guessing whether an orbit is safe to directly testing and understanding its behavior.

---

## Solution Overview

Orbital Watch is an interactive system designed to evaluate orbit safety and system-level risk in a dynamic orbital environment.

Instead of presenting static orbital data, the system allows users to test proposed orbits, observe how they interact with existing satellites and debris, and understand how risk evolves over time. It combines real orbital data from CelesTrak with continuous propagation using the SGP4 model to simulate how objects move and relate to one another.

Users can introduce new objects into the system and immediately evaluate their exposure to potential collisions. The system also supports simulation of cascade events, allowing users to see how a single failure can generate debris and impact the broader environment.

An AI-assisted Copilot, powered by Gemini 2.5 Flash, allows users to describe goals in natural language and translates that intent into system actions. This allows users to focus on evaluating outcomes rather than tuning parameters.

The result is a system that turns orbit selection and analysis into an interactive process, enabling users to move from guessing whether an orbit is safe to directly testing and understanding its behavior.

---

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

The Copilot interface uses Gemini 2.5 Flash through the Lovable AI Gateway to enable natural language interaction with the system.

The role of the AI is not to simulate physics or replace the core model, but to reduce the gap between user intent and system configuration. A user can describe a goal, such as evaluating a safer orbit or understanding risk, and the Copilot translates that into structured actions using the system’s existing data and tools.

The Copilot operates by combining:
- Gemini for natural language understanding  
- tool-calling against the loaded orbital catalog  
- deterministic simulation logic for evaluation  

This separation is intentional. The AI is used as an interface layer, while all simulation, propagation, and risk evaluation remain grounded in deterministic models running in the system.

### Tradeoffs

Using Gemini enables flexible and intuitive interaction, but introduces dependency on an external model and requires careful control over how outputs are mapped to system actions.

### Reflection

The AI integration improved usability by allowing users to explore the system without needing to understand every parameter. However, it does not yet perform multi-step planning or optimization, which would be the next step in making it more decision-focused.

---

## Architecture / Design Decisions

The system is structured as a separation between data ingestion, simulation, and visualization, with an emphasis on responsiveness and clarity.

Orbital data is sourced from CelesTrak, which provides publicly available Two-Line Element (TLE) datasets for active satellites and debris. These TLEs represent the latest known orbital parameters for each object.

The system fetches this data and uses it as the initial state for all objects in the environment. From there, each object is continuously propagated forward in time using the SGP4 model.

This means the system is not simply displaying static positions from the dataset. Instead, it is using real-world orbital parameters as a starting point and actively predicting future positions as time evolves.

By combining real TLE data with continuous propagation, the system reflects a dynamic and evolving environment, allowing users to observe how relationships between objects change and how risk develops over time.
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

Begin by exploring the existing orbital environment. Adjust filters to understand where objects are concentrated and how congestion varies across altitude ranges.

To evaluate a proposed orbit, define a new object and insert it into the system. The system will immediately propagate its motion and evaluate how it interacts with existing objects over time.

Review detected interactions to understand how proximity evolves and where potential collision risks emerge. This allows you to see how small differences in orbital parameters can affect safety.

To understand system-level impact, trigger a cascade event. This generates fragments from a collision and propagates them forward, showing how a single event can increase risk across the system.

You can adjust simulation parameters such as screening horizon and proximity thresholds to explore how different assumptions influence outcomes.

Finally, use the AI Copilot to describe goals or scenarios in natural language. The system will translate this intent into actions, reducing the need for manual parameter tuning and enabling faster exploration of safer configurations.

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
