# VisionGuard AI - Project Context for Claude Code

# Project Overview

## Project Name
VisionGuard AI

## Project Type
AI-powered CCTV Surveillance System with Intelligent Region-Based Dehazing

## Goal

Develop a lightweight, CPU-friendly CCTV surveillance platform capable of enhancing visibility in hazy or smoggy environments while remaining suitable for real-time deployment.

Unlike traditional image dehazing systems that enhance every frame, VisionGuard enhances only suspicious regions detected within surveillance footage, reducing computational cost and enabling edge deployment.

The project combines classical computer vision with lightweight deep learning.

---

# Core Research Idea

The project is based on two research directions:

1. Dark Channel Prior (DCP) based dehazing
2. Tiny CNN based transmission map refinement

The neural network DOES NOT replace DCP.

Instead, DCP produces an initial transmission map while the Tiny CNN refines the transmission map before image reconstruction.

The architecture is therefore:

Physics Prior
+
Lightweight Learning

instead of

End-to-End Deep Learning.

---

# Primary Objective

Improve CCTV visibility under haze while maintaining:

- CPU friendliness
- Low latency
- Real-time performance
- Explainability
- Easy deployment

---

# Target Users

- Security guards
- Building surveillance operators
- University campus surveillance
- Small business CCTV systems
- Parking lot monitoring
- Warehouse surveillance

---

# Main Features

## 1. Live CCTV / Webcam Feed

Supports:

- Webcam
- IP Camera
- Uploaded video
- Recorded CCTV footage

---

## 2. Motion Detection

Continuously monitor video.

If no motion exists:

Do NOT run dehazing.

If motion exists:

Extract ROI.

---

## 3. ROI Extraction

Instead of processing the whole frame,

only crop the suspicious region.

This is the biggest optimization.

---

## 4. Hybrid Dehazing Pipeline

Pipeline:

ROI

↓

Dark Channel Prior

↓

Atmospheric Light Estimation

↓

Initial Transmission Map

↓

Tiny CNN Refinement

↓

Radiance Recovery

↓

Enhanced ROI

↓

Merge Back into Original Frame

---

## 5. Event Logging

Store:

- timestamp
- event image
- event type
- ROI coordinates

Future versions may include a database.

---

## 6. Timeline Search

Allow users to browse detected events.

Future enhancement:

Natural language querying.

Example:

"When was someone detected near the gate?"

---

# Current Scope

Current implementation includes

✔ ROI-based enhancement

✔ Real-time dehazing

✔ Event storage

Future versions can include

- object detection
- intrusion detection
- NLP retrieval

These are NOT part of MVP.

---

# Dehazing Methodology

## Step 1

Capture video frame.

---

## Step 2

Detect motion.

---

## Step 3

Extract ROI.

---

## Step 4

Compute Dark Channel.

Minimum RGB

↓

Morphological erosion

↓

Dark Channel

---

## Step 5

Estimate Atmospheric Light.

Instead of using one brightest pixel,

average Top-K brightest pixels.

This reduces flickering.

---

## Step 6

Estimate Transmission Map

Using Dark Channel Prior.

---

## Step 7

Tiny CNN Refinement

Input:

- Grayscale ROI
- Dark Channel
- Coarse Transmission Map

Output:

Refined Transmission Map

The CNN predicts corrections to the coarse transmission map.

---

## Step 8

Radiance Recovery

Recover clean scene using

Atmospheric Scattering Model.

---

## Step 9

Gamma Correction

Improve visual quality.

---

## Step 10

Merge Enhanced ROI back into original frame.

---

# Tiny CNN

Purpose:

Improve DCP transmission estimation.

Not image generation.

Very lightweight.

Architecture

Input

↓

Conv(3x3,16)

↓

ReLU

↓

Conv(3x3,32)

↓

ReLU

↓

Conv(3x3,16)

↓

ReLU

↓

Conv(3x3,1)

↓

Sigmoid

↓

Refined Transmission Map

---

# Future Improvement

Instead of predicting

Transmission

predict

Residual Transmission

t_final

=

t_DCP

+

Δt

Residual learning is preferred.

---

# Possible Temporal Improvement

Future work:

Use previous frame transmission.

Input channels become

- Gray ROI
- Dark Channel
- Current Transmission
- Previous Transmission

This improves temporal consistency.

---

# Performance Goals

Target:

30 FPS

CPU execution

Low memory usage

Edge deployable

No GPU required for inference.

---

# Technology Stack

## Backend

Python

FastAPI

OpenCV

NumPy

PyTorch

ONNX Runtime (future)

---

## Frontend

React

TypeScript

Vite

TailwindCSS

Shadcn UI

React Query

Axios

---

## Database

SQLite (development)

PostgreSQL (future)

---

## AI Libraries

PyTorch

Torchvision

OpenCV

NumPy

---

## Video

OpenCV VideoCapture

FFmpeg (future)

---

# Folder Structure

project/

frontend/

backend/

models/

tiny_cnn.py

dehazing/

dark_channel.py

atmosphere.py

transmission.py

radiance.py

gamma.py

motion/

motion_detector.py

roi.py

events/

logger.py

storage.py

api/

routes.py

database/

training/

dataset.py

train.py

weights/

tests/

README.md

---

# Backend Modules

## Motion Module

Responsibilities

- frame differencing
- motion mask
- ROI extraction

---

## Dehazing Module

Responsibilities

Dark Channel

Atmospheric estimation

Transmission estimation

CNN refinement

Radiance recovery

Gamma correction

---

## CNN Module

Responsibilities

Load trained weights

Inference

Transmission refinement

---

## Event Module

Responsibilities

Save

- timestamp
- image
- metadata

---

## API Module

Responsibilities

Expose REST endpoints

Future websocket streaming.

---

# API Ideas

POST

/upload-video

POST

/start-camera

POST

/stop-camera

GET

/events

GET

/frame

GET

/system-status

---

# Coding Guidelines

Prefer

- dataclasses
- type hints
- dependency injection

Avoid

- global variables
- duplicated code
- hardcoded paths

---

# Style Guidelines

PEP8

Black formatter

isort

ruff

mypy

---

# Logging

Use Python logging.

No print() statements.

---

# Configuration

Use .env

Example

MODEL_PATH

VIDEO_SOURCE

CONFIDENCE_THRESHOLD

ROI_PADDING

---

# Error Handling

Every module should raise meaningful exceptions.

Never silently ignore failures.

---

# Unit Tests

Every major module should have tests.

Especially

Dark Channel

Transmission

CNN inference

Motion detection

ROI extraction

---

# Future Research Ideas

- Residual transmission prediction
- Temporal smoothing
- ONNX optimization
- TensorRT deployment
- Adaptive haze estimation
- Multi-camera support

---

# Development Philosophy

Always prioritize

1. Simplicity
2. Readability
3. Modularity
4. Explainability
5. CPU efficiency

Avoid unnecessarily large neural networks.

The neural network should only improve the transmission map, while the physical image formation model remains responsible for final image reconstruction.

This project should remain a hybrid computer vision + lightweight AI system rather than an end-to-end deep learning solution.