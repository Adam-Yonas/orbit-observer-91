# Orbital Watch — AI-Powered Orbital Risk & Debris Simulation

## Problem Statement

Modern systems generate large volumes of dynamic, time-evolving data, but most tools fail to make that data interpretable or actionable.

In the context of space operations, satellite operators must reason about:
- thousands of moving objects
- evolving collision risk
- cascading failure scenarios (Kessler Syndrome)

This problem extends beyond aerospace. Many industries (including marketing, analytics, and operations) face similar challenges:
- understanding complex systems over time
- identifying risk before it becomes failure
- translating raw data into decisions

Success would mean enabling users to:
- understand system state quickly
- simulate “what-if” scenarios
- receive actionable recommendations from ambiguous inputs

---

## Solution Overview

Orbital Watch is an interactive data platform that combines:
- real-time orbital data visualization
- simulation of collision cascades
- an AI-assisted interface for reasoning about system behavior

### Core Features

- **3D Orbit Visualization**
  - SGP4-based propagation of satellite positions
  - Interactive filtering by object class and altitude

- **Kessler-Style Cascade Simulation**
  - Fragment generation from collision events
  - Multi-generation chain reactions
  - Forward propagation of fragments

- **Conjunction Detection**
  - Screening based on miss distance and time horizon
  - User-defined satellites for scenario testing

- **AI Copilot Interface**
  - Natural language input → system interpretation
  - Generates structured recommendations based on system state

### Role of AI

AI is used as an **interpretation and reasoning layer**, not just a UI feature.

It translates ambiguous user intent (e.g., “lower orbit safely”) into:
- system constraints
- candidate solutions
- risk-aware recommendations

This makes the system significantly more usable compared to a purely manual interface.

---

## AI Integration

The AI system is designed to:
- interpret user goals
- map them to system constraints
- generate structured outputs

### Design Approach

- Lightweight AI layer (currently local heuristic model)
- Designed for future extension to:
  - LLM-based planning
  - multi-step reasoning
  - tool-calling architectures

### Tradeoffs

- Prioritized reliability and latency over heavy LLM usage
- Avoided external dependencies for core functionality
- AI output is deterministic for consistent UX

### Reflection

AI exceeded expectations in:
- simplifying user interaction
- enabling rapid scenario exploration

AI fell short in:
- deep optimization
- long-horizon planning

---

## Architecture / Design Decisions

### System Architecture

Frontend (React + Vite + Plotly)  
↓  
Backend (FastAPI on Render)  
↓  
Data Sources (CelesTrak TLEs + synthetic simulation)

### Frontend

- React + TypeScript
- Plotly 3D visualization
- Real-time UI updates
- GitHub Pages deployment

### Backend

- FastAPI (Python)
- Hosted on Render
- Handles:
  - health checks
  - API endpoints for future AI + simulation logic

### Data Pipeline

- TLE ingestion from CelesTrak
- SGP4 propagation for orbit prediction
- Synthetic generation for fragment simulation

### Key Tradeoffs

- Used **heuristic cascade modeling** instead of full physics
- Used **discrete time sampling** for conjunction detection
- Prioritized **interactivity over simulation fidelity**

---

## Development with AI Tools

AI tools (ChatGPT, coding assistants) were used to:
- accelerate frontend layout and component structure
- debug deployment issues (GitHub Pages + Render)
- refactor API integration and routing

They were most helpful for:
- rapid iteration
- fixing integration bugs

Limitations:
- required manual correction for:
  - React lifecycle issues
  - deployment configuration
  - physics modeling accuracy

This led to a workflow of:
1. generate → 2. validate → 3. refine manually

---

## Getting Started / Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/Adam-Yonas/orbit-observer-91.git
cd orbit-observer-91
