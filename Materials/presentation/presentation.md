# Real-Time PPE Compliance Monitoring on Construction Sites

A fine-tuned YOLO11 detector with temporal violation confirmation

- **Parth Mital** (23BCE0842)
- **Jainish Patel** (23BCE0503)

**Faculty Guide:** Dr. Rajesh Kumar N, Assistant Professor, Senior Grade 1, Department of IoT, School of Computer Science and Engineering

Vellore Institute of Technology, Vellore

---

# Problem and Motivation

- Construction is one of the most hazardous industries; missing hardhats and safety vests are a recurring cause of injuries
- Safety officers check PPE by walking the site: labour-intensive, intermittent and hard to scale
- Existing cameras can watch every worker continuously with computer vision
- Most published PPE detectors stop at detection accuracy
- A real deployment also needs:
  - Rules that turn bounding boxes into compliance decisions
  - Filtering of single-frame errors in video
  - An interface for safety staff to review incidents

---

# Objectives and Contributions

1. **Detector:** fine-tune YOLO11m for ten classes covering PPE items, their explicit absence, persons and site context, within a fixed 0.70 h training budget on two GPUs
2. **Evaluation:** test on stratified validation and test splits, with and without test-time augmentation (TTA)
3. **Error analysis:** per class and per confusion pair, to find the errors that matter for safety
4. **Complete system:** compliance rule and five-frame temporal confirmation, served through a FastAPI backend and a React dashboard (open source)

---

# Related Work

| Study                                | Approach                                                | Key result                                   |
| ------------------------------------ | ------------------------------------------------------- | -------------------------------------------- |
| Park et al. (2015)                   | Classical vision, separate worker and hardhat detection | Hardhat wearing in site video                |
| Fang et al. (2018)                   | Faster R-CNN on far-field surveillance                  | Non-hardhat use detection                    |
| Nath et al. (2020)                   | Three YOLO-based strategies                             | Real-time worker, hardhat and vest detection |
| Wang et al. (2021)                   | Eight YOLO detectors on the CHV dataset                 | YOLOv5x best, mAP 86.55%                     |
| Ferdous and Ahsan (2022), base paper | YOLOX on the CHVG dataset (1,699 images, 8 classes)     | YOLOX-m, average mAP 89.84%                  |

**Gap:** few studies describe how detections become alerts, how transient errors are filtered in video, or how results reach site staff.

---

# System Architecture

**Pipeline:** React dashboard → FastAPI backend → YOLO11m detector → Compliance layer → Temporal filter → Incident log → Dashboard

- **Detector:** confidence 0.40, NMS IoU 0.45 (adjustable from 0.10 to 0.95 on the dashboard)
- **Compliance layer:** NO-Hardhat and NO-Safety Vest raise incidents; NO-Mask is advisory only
- **Compliant frame:** at least one person, with both Hardhat and Safety Vest detected
- **Temporal filter (video):** a violation must persist for **5 consecutive frames** before an incident is logged, with a **2 s cooldown** against repeats
- **Photos:** no temporal context, so any violation raises an incident directly
- **Output:** incidents with annotated snapshots, session metrics and a compliance score

---

# Dataset and Detection Classes

**Construction Site Safety Image Dataset** (Roboflow, Kaggle), pooled and re-split 80/10/10, stratified by dominant class (seed 42)

| Split      | Images    | Boxes      |
| ---------- | --------- | ---------- |
| Train      | 2,240     | 30,684     |
| Validation | 280       | 3,554      |
| Test       | 281       | 4,114      |
| **Total**  | **2,801** | **38,352** |

**10 classes:**

- Required PPE: Hardhat, Safety Vest
- Violations: NO-Hardhat, NO-Safety Vest
- Advisory: Mask, NO-Mask
- Counted: Person
- Site context: Safety Cone, machinery, vehicle

Imbalanced: Person has 9,872 boxes, about six times as many as vehicle (1,628) or Mask (1,700)

---

# Model and Training

**YOLO11m** (Ultralytics), initialised from COCO-pretrained weights

- 20.06 M parameters, 68.3 GFLOPs at 640 px
- Backbone with C3k2 blocks, SPPF and C2PSA attention; multi-scale neck; anchor-free head at strides 8, 16, 32
- Loss: box regression (7.5) + classification (0.5) + distribution focal loss (1.5)

**Training setup**

- Kaggle, 2 × NVIDIA Tesla T4 (15 GB each), distributed data-parallel with mixed precision
- 0.70 h time budget: **75 epochs** completed, best epoch 72
- SGD, initial LR 0.01, cosine schedule, batch size 32, input 640 px
- Augmentation: mosaic (off for last 10 epochs), mixup, copy-paste, HSV, flip, scale
- GPU utilisation mostly 85% to 100%, about 8.3 GB memory per GPU

---

# Results

| Split         | mAP@0.5    | mAP@0.5:0.95 | Precision  | Recall     | F1         | ms/img    |
| ------------- | ---------- | ------------ | ---------- | ---------- | ---------- | --------- |
| Validation    | 0.8679     | 0.6368       | 0.9236     | 0.8084     | 0.8621     | 32.79     |
| **Test**      | **0.8659** | **0.6158**   | **0.9135** | **0.8053** | **0.8560** | **31.32** |
| Test with TTA | 0.8603     | 0.6206       | 0.9027     | 0.7853     | 0.8399     | 85.98     |

- Validation and test results are close, so checkpoint selection did not overfit
- Precision is higher than recall: errors are mostly missed objects, not false alarms
- TTA lowered mAP@0.5 and was **2.7 times slower**, so the deployed system does not use it
- F1 peaks at 0.85 (confidence 0.362) on a broad plateau; the default of 0.40 sits in a stable region
- Incident classes: NO-Hardhat test AP@0.5 **0.8894**, NO-Safety Vest **0.8782**

---

# Per-Class and Error Analysis

**Best classes (test AP@0.5):** machinery 0.9565, Mask 0.9432, Person 0.9250

**Weakest classes:** Safety Cone 0.7447, Hardhat 0.7975, NO-Mask 0.8055, Safety Vest 0.8273

**Missed detections (small or thin objects):**

- 16% of Hardhat boxes, 14% of Safety Cone and Safety Vest boxes not detected

**Safety-critical class swaps:**

- 9% of NO-Hardhat boxes predicted as Hardhat: a violation looks compliant
- 7% of Safety Vest boxes predicted as NO-Safety Vest: false alarms
- 10% of Safety Vest boxes predicted as Person

**Role of the temporal filter:** suppresses errors lasting fewer than five frames, but not errors that persist across frames

---

# Conclusion and Future Work

**Conclusion**

- YOLO11m reaches test mAP@0.5 of **0.8659** and mAP@0.5:0.95 of **0.6158** at **31.3 ms** per image
- Compliance rule and five-frame confirmation turn detections into reviewable incidents
- Open-source FastAPI and React application, with an ONNX export (80.5 MB) for other runtimes

**Limitations**

- One training run on one dataset split; no external test set
- Compliance score is frame-level, not per worker
- Temporal window set by design, not tuned on annotated video

**Future work**

- Associate PPE with person boxes and track workers for per-worker compliance
- Evaluate on footage from other sites, weather and lighting
- Tune the temporal window on annotated video; improve small-object detection
- Compare with transformer detectors such as RT-DETR

**Code:** github.com/parthmital/PPE-Compliance-Monitor
