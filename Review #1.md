# Slide 1: Real-Time PPE Compliance Monitoring System

## Automated Safety Surveillance for Industrial & Construction Sites

### Review #1: Architecture, Model & Data Pipeline

- **Presenter / Team**: PPE Compliance Monitoring Team
- **Objective**: Develop an automated, real-time computer vision system to monitor Personal Protective Equipment (PPE) compliance, mitigate workplace accidents, and maintain strict industrial safety standards.
- **Core Functionality**: Automatic detection of safety gear violations (hard hats, masks, safety vests) alongside machinery and personnel tracking across live camera feeds and recorded videos.
- **Review Focus Areas**:
  - Construction Site Safety Dataset & Class Distribution
  - YOLOv8 Computer Vision Architecture & Training
  - End-to-End System & API Architecture
  - Complete Technology Stack
  - Expected Analytical Outputs & Incident Logging

# Slide 2: Project Overview & Problem Statement

## Mitigating Industrial Hazards through Computer Vision

- **The Industrial Challenge**:
  - Construction and manufacturing zones face high occupational hazards and safety non-compliance.
  - Manual safety inspection is labour-intensive, error-prone, inconsistent, and cannot provide continuous 24/7 coverage.
- **Proposed Solution**:
  - Real-time automated visual inspection pipeline using state-of-the-art object detection.
  - Instantaneous identification of compliant vs. non-compliant personnel.
  - Automated generation of violation logs with timestamped visual evidence.
- **Key Monitored Classes**:
  - **Compliance Classes**: Hardhat, Mask, Safety Vest
  - **Violation Classes**: NO-Hardhat, NO-Mask, NO-Safety Vest
  - **Contextual & Neutral Classes**: Person, Machinery, Vehicle, Safety Cone

# Slide 3: Dataset Characteristics & Class Distribution

## Construction Site Safety Dataset (Kaggle)

- **Dataset Source & Link**:
  - **Kaggle URL**: https://www.kaggle.com/datasets/snehilsanyal/construction-site-safety-image-dataset-roboflow
  - **Origin**: Construction Site Safety Image Dataset (Roboflow Universe via Kaggle)
- **Dataset Scale & Partition**:
  - Total Images: 2,801 annotated images
  - Total Annotations: 38,352 object bounding boxes
  - Training Split: 2,240 images (30,684 annotations, ~80%)
  - Validation Split: 280 images (3,554 annotations, ~10%)
  - Test Split: 281 images (4,114 annotations, ~10%)
- **Class Annotation Breakdown**:
  - Person: 9,872 instances (primary contextual object)
  - Machinery & Vehicles: 5,346 machinery and 1,628 vehicle instances
  - Safety Equipment: 4,158 NO-Safety Vest, 3,502 Safety Cone, 3,334 Hardhat, 3,250 NO-Mask, 3,135 Safety Vest, 2,427 NO-Hardhat, 1,700 Mask
- **Dataset Relevance**: High diversity of angles, lighting conditions, occlusions, and multi-worker density typical of live industrial sites.

# Slide 4: Data Augmentation & Preprocessing Pipeline

## Robustness Engineering for Dynamic Industrial Environments

- **Input Preprocessing**:
  - Spatial Standardisation: 640 x 640 pixel resolution (BCHW tensor format)
  - Normalisation: Pixel values scaled to [0.0, 1.0] range
- **Data Augmentation Strategy**:
  - **Photometric Distortions**: HSV colour jittering (Hue: 0.015, Saturation: 0.7, Value/Brightness: 0.4) for varying daylight conditions
  - **Geometric Transformations**: Rotation (+-5.0 degrees), Translation (+-0.1), Scaling (+-50%), Shear (+-2.0 degrees), Horizontal Flip (p = 0.5)
  - **Advanced Composition**: Mosaic Augmentation (scale 1.0) and Mixup (0.1) to boost detection of small and partially occluded safety gear
  - **Regularisation**: Copy-Paste augmentation (0.1) and disabling Mosaic in the final 10 epochs for fine-grained boundary stabilisation

# Slide 5: Computer Vision Model Architecture

## YOLOv8m (Ultralytics) Single-Stage Object Detector

- **Model Selection: YOLOv8m (Medium)**:
  - Balances high inference accuracy (mAP) with real-time frame rates (>40 FPS).
- **Architectural Components**:
  - **Backbone**: Modified CSPDarknet53 with C2f (Cross-Stage Partial with 2 Convolutions) modules for rich multi-scale feature extraction.
  - **Neck**: Path Aggregation Network (PANet) and Feature Pyramid Network (FPN) for seamless multi-scale contextual semantic fusion.
  - **Detection Head**: Anchor-free, decoupled head separating classification and bounding box regression branches to accelerate convergence.
- **Loss Functions**:
  - Complete IoU (CIoU) and Distribution Focal Loss (DFL) for precise bounding box localisation.
  - Binary Cross-Entropy (BCE) with Label Smoothing (0.1) for class classification.

# Slide 6: Model Training, Hardware & Performance Metrics

## Rigorous Training Pipeline & Quantitative Evaluation

- **Training Infrastructure**:
  - Hardware: Dual NVIDIA Tesla T4 GPUs (16 GB VRAM each)
  - Framework: PyTorch 2.10.0, CUDA 13.0, Ultralytics 8.4.30
  - Optimization: SGD (momentum: 0.937, weight decay: 0.0005) with Cosine Annealing Learning Rate Schedule (Initial LR: 0.01, Final LR: 0.0001)
  - Training Duration: 100 Epochs (Best model achieved at Epoch 88)
- **Quantitative Results (Test Set Evaluation)**:
  - **Overall Performance**: mAP@0.5 = 0.8807 (88.07%), mAP@0.5:0.95 = 0.6425
  - **Precision & Recall**: Precision = 92.27%, Recall = 80.92%
  - **Critical Class Accuracies (AP@0.5)**: Machinery (96.40%), Mask (95.48%), Person (93.38%), Vehicle (90.57%), NO-Safety Vest (89.17%), NO-Hardhat (87.62%), Safety Vest (85.05%), NO-Mask (82.98%), Hardhat (82.76%)
  - **Inference Speed**: ~23.5 ms per frame (~42 FPS), fully supporting real-time streaming

# Slide 7: System Architecture & Workflow Pipeline

## Client-Server Decoupled Architecture with Asynchronous Inference

- **End-to-End Operational Pipeline**:
  - **1. Input Layer**: User uploads live feed, single image, or batch video stream via modern web client.
  - **2. API Gateway (FastAPI)**: Validates media payloads, enforces size limits, and delegates video tasks to an asynchronous background worker pool.
  - **3. Inference Engine (YOLOv8 Core)**: Executes forward pass, applies Non-Maximum Suppression (NMS), and classifies 10 target classes.
  - **4. Temporal Smoothing Filter**: 5-frame temporal buffer prevents transient false alarms caused by temporary occlusions.
  - **5. Persistence & Analytics Store**: Writes incident frames, bounding box coordinates, and session analytics to local JSON datastore.
  - **6. Presentation Layer**: Delivers real-time annotated visual overlays, live safety metrics, and alert triggers.

# Slide 8: Tools & Technologies Stack

## End-to-End Modern Software & ML Stack

- **Machine Learning & Vision**:
  - YOLOv8 (Ultralytics), PyTorch, ONNX Runtime (Opset 17 export for edge acceleration), OpenCV, NumPy
- **Backend & Service Layer**:
  - FastAPI (Python 3.10+ high-performance asynchronous REST API)
  - Uvicorn (ASGI server implementation)
  - Pydantic (data validation and settings management)
  - BackgroundTasks (non-blocking asynchronous video decoding and processing)
- **Frontend & User Interface**:
  - React 18 with TypeScript
  - Vite 5 (high-speed build tool and development server)
  - Tailwind CSS 3.4 (utility-first responsive styling)
  - Radix UI & shadcn/ui (accessible UI component primitives)
  - Framer Motion (interactive micro-animations and dashboard transitions)
  - Lucide React (vector iconography)

# Slide 9: Expected Outputs & Application Deliverables

## Comprehensive Safety Monitoring & Incident Analytics

- **Visual Detections**:
  - Real-time bounding box annotations with distinct colour-coding (Green for Compliance, Red for Violations, Cyan for Site Context).
- **Interactive Safety Dashboard**:
  - Real-time Site Safety Compliance Score (percentage of compliant vs total workers).
  - Detection Metrics: Live mAP indicator, active alert frequency, and processed frame rates.
- **Automated Incident Logging**:
  - Immediate snapshot capture of violation events.
  - Timestamped tabular log with worker identifier, violation category, and confidence score.
- **Operational Control & Customisation**:
  - Dynamic confidence threshold (0.1 to 0.95) and NMS IoU adjustment from the UI.
  - Model weight hot-reloading capability for rapid updates without server restarts.

# Slide 10: Summary, Progress Status & Future Roadmap

## Review #1 Milestones & Next Phase Execution

- **Milestones Completed (Review #1)**:
  - Curation and preprocessing of 2,801 construction safety images across 10 classes.
  - Full training and evaluation of YOLOv8m model achieving 88.07% mAP@0.5.
  - Implementation of FastAPI asynchronous backend and React TypeScript UI dashboard.
  - End-to-end integration of single image and multi-frame video inference pipelines.
- **Next Steps (Review #2 & Beyond)**:
  - Integration of real-time RTSP camera streaming protocols.
  - Multi-camera zone management and automated alert notifications (SMS/Email/WebSockets).
  - Model quantisation (INT8 / TensorRT) for deployment on edge devices like NVIDIA Jetson.
