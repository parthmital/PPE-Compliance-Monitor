# PPE Compliance Monitor

A Personal Protective Equipment (PPE) compliance monitor for construction sites. A YOLO11m object detector, trained in a Kaggle notebook, finds workers and their safety gear in photos and videos. A FastAPI backend serves the trained model, and a React dashboard shows the compliance score, detections, and incidents.

The model in this repository is the one produced by the latest notebook run. It scored **mAP@0.5 = 0.8659** and **mAP@0.5:0.95 = 0.6158** on 281 held-out test images (source: `Backend/output/metrics/eval_summary.csv`).

## Table of Contents

- [Screenshots](#screenshots)
- [Quick Start](#quick-start)
- [Features](#features)
- [How the Trained Model Is Used](#how-the-trained-model-is-used)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Model Classes](#model-classes)
- [Detection Thresholds](#detection-thresholds)
- [Data Persistence and Video Processing](#data-persistence-and-video-processing)
- [Training Notebook Walkthrough](#training-notebook-walkthrough)
- [Results](#results)
- [Output Files](#output-files)
- [Testing and Code Quality](#testing-and-code-quality)
- [Troubleshooting](#troubleshooting)
- [Known Limitations](#known-limitations)

## Screenshots

### Overview

Site compliance score, detection activity counters and recent incidents.

![Overview dashboard](docs/screenshots/overview.png)

### Analyse

Upload model weights, tune the confidence and overlap thresholds, then analyse a site photo or video.

![Analyse page](docs/screenshots/analyse.png)

### Incidents

Confirmed PPE violations with the captured frame, exportable as CSV.

![Incidents log](docs/screenshots/incidents.png)

## Quick Start

### Prerequisites

| Requirement | Version                                    | Why                                    |
| ----------- | ------------------------------------------ | -------------------------------------- |
| Windows     | 10 or 11                                   | The launcher opens Windows log windows |
| Node.js     | 18 or newer (`package.json` `engines`)     | Runs the launcher and the frontend     |
| Python      | 3.10 or newer on `PATH` (`py` or `python`) | Runs the backend in `.venv`            |

### Run

From the repository root:

```powershell
npm run dev
```

That single command works on a fresh clone and on an existing setup. It:

1. **Sets up what is missing, once.** It installs the frontend packages, creates `.venv` at the root, installs `Backend/requirements.txt` into it, and copies each `.env.example` to `.env`. Every step records a hash of its source file (`package-lock.json`, `requirements.txt`), so later runs skip it unless that file changes. The first run downloads PyTorch and can take several minutes.
2. **Checks the model weights.** It prints the weights path (`Backend\output\weights\best.pt`) when the trained model is present. If it is missing, the app still starts and shows a warning.
3. **Opens two log windows**: _Backend logs_ (FastAPI on `http://localhost:8000`) and _Frontend logs_ (Vite on `http://localhost:8080`). Backend request logs are timestamped and hide successful calls to the endpoints the UI polls, so uploads, errors and warnings stand out.
4. **Keeps the terminal you ran it in as the controller.** It waits for both services, opens the app in your browser, and reports status. Press **Ctrl+C** there to stop both services and close their windows. Closing either log window also stops everything.

If port 8000 or 8080 is already taken, it names the process holding the port and exits without starting anything.

### Running the services manually

```powershell
# Backend
cd Backend
..\.venv\Scripts\python.exe -u api.py

# Frontend (separate terminal)
cd Frontend
npm run dev
```

## Features

- **10-class PPE detection**: Hardhat, Mask, NO-Hardhat, NO-Mask, NO-Safety Vest, Person, Safety Cone, Safety Vest, machinery, vehicle.
- **Photo and video analysis**: single images are analysed straight away; videos run as background jobs with progress polling.
- **Temporal confirmation**: in videos, a violation must persist for 5 consecutive frames (`TEMPORAL_WINDOW = 5` in `Backend/ppe_api/detection/analysis.py`) before it becomes an incident.
- **Violation rules**: `NO-Hardhat` and `NO-Safety Vest` raise incidents; `NO-Mask` is reported as advisory only (`Backend/ppe_api/detection/classes.py`).
- **Dashboard metrics**: safety score, alerts per hour, false alarm rate, frames processed, and persons detected.
- **Incident log** with captured frames and CSV export.
- **Runtime thresholds**: confidence and NMS IoU can be changed without a restart.
- **Model hot swap**: upload a different `.pt` file from the Analyse page.
- **Session persistence**: UI state survives page reloads.
- **Optional API key** via the `X-API-Key` header.

## How the Trained Model Is Used

The training notebook writes its results to `/kaggle/working/` and zips them into `outputs.zip`. Extracting that zip into `Backend/output/` is the whole deployment step, because the backend reads the model straight from there:

| File                                   | Read by                                                   | Purpose                                           |
| -------------------------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| `Backend/output/weights/best.pt`       | `MODEL_PATH` default in `Backend/ppe_api/config.py`       | YOLO11m weights used for every detection          |
| `Backend/output/weights/ppe_data.yaml` | `CLASS_NAMES_FILE` default in `Backend/ppe_api/config.py` | Class names in the order the model was trained on |

```mermaid
flowchart LR
    A[Kaggle notebook] -->|outputs.zip| B[Backend/output/]
    B --> C[weights/best.pt]
    B --> D[weights/ppe_data.yaml]
    C -->|MODEL_PATH| E[Detector]
    D -->|CLASS_NAMES_FILE| F[DetectionPipeline]
    E --> F
    F --> G[FastAPI /api routes]
    G --> H[React dashboard]
```

At startup the `Detector` copies `best.pt` into `Backend/data/models/` (only when the source is newer than the copy) and loads it with Ultralytics. If the copy fails, it loads the original file.

`.gitignore` ignores `*.pt` and `*.onnx` but makes one exception, `!Backend/output/weights/best.pt`, so the trained model (40.5 MB) can be committed and a fresh clone runs detection without extra steps. `last.pt`, `best.onnx`, and the two pretrained checkpoints stay ignored.

To use a newly trained model, run the notebook on Kaggle, download `outputs.zip`, extract it over `Backend/output/`, and restart the backend.

## Technology Stack

| Technology                   | Version                                     | Purpose and where it is used                                                                                                                |
| ---------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Ultralytics YOLO11m          | `ultralytics>=8.3.0` (trained with 8.4.171) | Object detector. Trained in the notebook; loaded in `Backend/ppe_api/detection/detector.py`. YOLO11 models need Ultralytics 8.3.0 or newer. |
| PyTorch                      | 2.10.0+cu128 on Kaggle                      | Deep learning runtime under Ultralytics                                                                                                     |
| OpenCV (`opencv-python`)     | `>=4.9.0`                                   | Image decoding, video frames, and overlay drawing in the backend                                                                            |
| FastAPI + Uvicorn            | unpinned (`Backend/requirements.txt`)       | HTTP API (`Backend/ppe_api/routes/`) and the server started by `Backend/api.py`                                                             |
| python-dotenv, PyYAML        | unpinned                                    | Read `Backend/.env` and the dataset YAML                                                                                                    |
| React                        | `^18.3.1`                                   | Dashboard UI in `Frontend/src/`                                                                                                             |
| TypeScript                   | `^5.8.3`                                    | Frontend type checking                                                                                                                      |
| Vite                         | `^5.2.0`                                    | Frontend dev server (port 8080) and build                                                                                                   |
| Tailwind CSS                 | `^3.4.17`                                   | Styling                                                                                                                                     |
| React Router                 | `^6.30.1`                                   | Page routing                                                                                                                                |
| Radix UI + shadcn/ui         | see `Frontend/package.json`                 | UI primitives in `Frontend/src/components/ui/`                                                                                              |
| pytest, Black, import-linter | unpinned                                    | Backend tests, formatting, and layer contracts                                                                                              |

## Repository Structure

```text
PPE-Compliance-Monitor/
|-- package.json              npm run dev (launcher) and npm run check (all checks)
|-- ARCHITECTURE.md           module map, dependency rules, design decisions
|-- scripts/
|   |-- check.mjs             every lint, type, boundary, clone, test and build check
|   `-- dev/                  first-run setup and the two-window launcher
|-- Backend/
|   |-- api.py                entry point: load settings, create app, run uvicorn
|   |-- requirements.txt      Python dependencies
|   |-- .env.example          backend settings template
|   |-- Construction-Site-Safety.ipynb   Kaggle training notebook
|   |-- output/               notebook outputs (extracted outputs.zip)
|   |   |-- weights/          best.pt (served), last.pt, best.onnx, ppe_data.yaml
|   |   |-- plots/            30 training and evaluation plots
|   |   |-- metrics/          CSV and JSON metrics
|   |   |-- logs/             full training log and GPU usage log
|   |   `-- predictions/      281 annotated test images and test_detections.csv
|   |-- ppe_api/              FastAPI application (config, detection, services, routes)
|   `-- tests/                pytest suite with a fake detector (no weights needed)
|-- Frontend/
|   `-- src/                  React dashboard (pages, components, contexts, lib)
|-- docs/screenshots/         dashboard screenshots used above
`-- Materials/                project report, presentation, and reviews
```

The full module map is in [ARCHITECTURE.md](ARCHITECTURE.md).

## Configuration

### Backend environment variables (`Backend/.env`)

| Variable           | Required | Default                                                             | Purpose                                                                        |
| ------------------ | -------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `API_KEY`          | Optional | unset (no auth)                                                     | When set, requests must send `X-API-Key`. The frontend does not send it today. |
| `ALLOWED_ORIGINS`  | Optional | `http://localhost:3000,http://localhost:5173,http://localhost:8080` | Comma-separated CORS origins                                                   |
| `MODEL_PATH`       | Optional | `output/weights/best.pt`                                            | YOLO weights loaded at startup                                                 |
| `CLASS_NAMES_FILE` | Optional | `output/weights/ppe_data.yaml`                                      | Dataset YAML the class names come from                                         |
| `DATA_DIR`         | Optional | `data`                                                              | Runtime data folder                                                            |
| `MAX_UPLOAD_SIZE`  | Optional | `52428800` (50 MB)                                                  | Maximum upload size in bytes                                                   |
| `HOST` / `PORT`    | Optional | `0.0.0.0` / `8000`                                                  | Address the API listens on                                                     |

Relative paths resolve against `Backend/`. Invalid integer values stop the backend at startup. If an older `Backend/.env` still has `MODEL_PATH=Trained Weights/best.pt`, change it to `output/weights/best.pt` or delete the line.

### Frontend environment variables (`Frontend/.env`)

| Variable            | Default                     | Purpose         |
| ------------------- | --------------------------- | --------------- |
| `VITE_API_BASE_URL` | `http://localhost:8000/api` | Backend API URL |

## API Endpoints

| Method | Endpoint                           | Purpose                                 |
| ------ | ---------------------------------- | --------------------------------------- |
| GET    | `/api/health`                      | Health check and model status           |
| GET    | `/api/config`                      | Model name, thresholds, temporal window |
| POST   | `/api/config/thresholds`           | Update `conf` and `iou` thresholds      |
| POST   | `/api/model/reload`                | Upload `.pt` weights and load them      |
| POST   | `/api/detect/image`                | Analyse one image                       |
| POST   | `/api/detect/video`                | Start a background video job            |
| GET    | `/api/detect/video/{job_id}`       | Video job status and progress           |
| GET    | `/api/metrics`                     | Session metrics                         |
| GET    | `/api/incidents`                   | All incidents                           |
| DELETE | `/api/incidents/clear`             | Clear all incidents                     |
| GET    | `/api/session`                     | Saved UI session state                  |
| POST   | `/api/session`                     | Save UI session state                   |
| DELETE | `/api/session`                     | Clear UI session state                  |
| GET    | `/api/videos/{filename}`           | Static: uploaded videos                 |
| GET    | `/api/incidents/images/{filename}` | Static: incident captures               |

## Model Classes

The order below is the class index order in `Backend/output/weights/ppe_data.yaml`, and it matches the names stored inside `best.pt`.

| Index | Class          | Role in the app                           |
| ----- | -------------- | ----------------------------------------- |
| 0     | Hardhat        | Compliance (required PPE)                 |
| 1     | Mask           | Compliance                                |
| 2     | NO-Hardhat     | Violation, raises an incident             |
| 3     | NO-Mask        | Advisory, reported but raises no incident |
| 4     | NO-Safety Vest | Violation, raises an incident             |
| 5     | Person         | Counted for the compliance score          |
| 6     | Safety Cone    | Context object                            |
| 7     | Safety Vest    | Compliance (required PPE)                 |
| 8     | machinery      | Context object                            |
| 9     | vehicle        | Context object                            |

## Detection Thresholds

Adjustable from the Analyse page or `POST /api/config/thresholds`. Both are clamped to 0.1 to 0.95 (`Backend/ppe_api/detection/detector.py`).

| Threshold  | Default | Effect                                                                                   |
| ---------- | ------- | ---------------------------------------------------------------------------------------- |
| Confidence | 0.40    | Minimum score for a box to be kept. Higher means fewer boxes.                            |
| NMS IoU    | 0.45    | Overlap above which duplicate boxes are suppressed. Higher keeps more overlapping boxes. |

The backend default confidence (0.40) is higher than the 0.25 the notebook used for its test predictions, so the dashboard shows fewer low-confidence boxes than `Backend/output/predictions/`.

## Data Persistence and Video Processing

Runtime data lives in `Backend/data/` (Git-ignored):

| File                 | Contents                                     |
| -------------------- | -------------------------------------------- |
| `incidents.json`     | Violation records; captures in `incidents/`  |
| `metrics.json`       | Session counters                             |
| `session_state.json` | UI state (theme, thresholds, video progress) |
| `video_jobs.json`    | Video job records                            |
| `models/best.pt`     | Working copy of the served weights           |

Writes are atomic (temporary file plus rename). Videos are processed as follows:

1. The upload starts a background job in a worker thread, off the event loop.
2. The job ID is returned immediately. Running jobs live in memory, so a backend restart forgets them.
3. The frontend polls `/api/detect/video/{job_id}` every 2 seconds and shows progress.
4. On completion, incidents and metrics refresh.

## Training Notebook Walkthrough

Notebook: [Backend/Construction-Site-Safety.ipynb](Backend/Construction-Site-Safety.ipynb). It runs on Kaggle with **GPU T4 x2**, **Internet on**, and the dataset **Construction Site Safety Image Dataset (Roboflow)** by snehilsanyal attached. It was not executed locally; every number below comes from its saved cell outputs and the files in `Backend/output/`.

### Cell 0: Overview (markdown)

States the goal (10 PPE classes), the data source (`css-data`, YOLO format, re-split 80/10/10), the approach (COCO-pretrained YOLO11m, DDP across both T4s, fp16 AMP, RAM cache, cosine LR, a wall-clock training budget), the evaluation plan (val, test, and test with TTA), and the output layout.

### Cells 1-2: Setup

Installs `ultralytics>=8.3.0`, `onnx>=1.14`, and `onnxslim` with pip, then imports every library used later so no cell depends on a late import. `onnx` and `onnxslim` are installed up front so the export step does not stall.

Output: `ultralytics 8.4.171 | torch 2.10.0+cu128`.

### Cells 3-4: Hardware check

Prints each GPU, CPU cores, RAM, and free disk, and stops early if fewer than two GPUs are visible.

| Resource  | Value                            |
| --------- | -------------------------------- |
| GPU 0     | Tesla T4, 15.6 GB VRAM           |
| GPU 1     | Tesla T4, 15.6 GB VRAM           |
| CPU cores | 4                                |
| RAM       | 33.7 GB total, 31.8 GB available |
| Disk free | 20.9 GB in `/kaggle/working`     |

### Cells 5-6: Configuration

Defines every path, the class list, the seed, the split ratios, and the training arguments in one place. Key choices:

- `time=0.70` hours is the real training budget. `epochs=200` is only an upper bound; Ultralytics fits the epoch count and cosine schedule to the time budget.
- `batch=32` is 16 images per T4 at 640 px. Auto-batch does not work under DDP, so the batch is fixed.
- `workers = max(2, 4 // 2) = 2` per DDP process.
- `cache="ram"` decodes every image once.
- `close_mosaic=10` turns mosaic off for the last 10 epochs.

Printed training arguments:

| Argument        | Value                                   | Argument        | Value |
| --------------- | --------------------------------------- | --------------- | ----- |
| `data`          | `/kaggle/working/weights/ppe_data.yaml` | `hsv_h`         | 0.015 |
| `epochs`        | 200 (upper bound)                       | `hsv_s`         | 0.7   |
| `time`          | 0.7 hours                               | `hsv_v`         | 0.4   |
| `patience`      | 100                                     | `degrees`       | 5.0   |
| `imgsz`         | 640                                     | `translate`     | 0.1   |
| `batch`         | 32                                      | `scale`         | 0.5   |
| `device`        | `[0, 1]`                                | `shear`         | 2.0   |
| `workers`       | 2                                       | `fliplr`        | 0.5   |
| `cache`         | `ram`                                   | `mosaic`        | 1.0   |
| `amp`           | True                                    | `mixup`         | 0.1   |
| `optimizer`     | SGD                                     | `copy_paste`    | 0.1   |
| `lr0`           | 0.01                                    | `close_mosaic`  | 10    |
| `lrf`           | 0.01                                    | `seed`          | 42    |
| `momentum`      | 0.937                                   | `deterministic` | False |
| `weight_decay`  | 0.0005                                  | `cos_lr`        | True  |
| `warmup_epochs` | 3.0                                     | `save_period`   | -1    |

### Cells 7-8: Data loading

Collects every image across the original `train`, `valid`, and `test` folders and reads the label files in parallel threads. For each image it records per-class box counts and the class with the most boxes, which becomes the stratification key.

Output: `Images: 2801 | with labels: 2801`.

### Cells 9-10: Stratified 80/10/10 split

Splits image indices twice with `train_test_split`, stratified by dominant class with `random_state=42`. Buckets smaller than 5 images are merged into a background bucket so stratification works.

| Split | Images | Share | Boxes |
| ----- | ------ | ----- | ----- |
| train | 2240   | 80.0% | 30684 |
| val   | 280    | 10.0% | 3554  |
| test  | 281    | 10.0% | 4114  |
| total | 2801   | 100%  | 38352 |

Box totals are the column sums of `metrics/class_distribution.csv`; the val and test counts match the `Instances` column in the evaluation logs.

### Cells 11-12: Split tree and dataset YAML

Builds `split_data/{train,val,test}/{images,labels}` with symlinks into the read-only input, prefixing file names with the original dataset folder to avoid collisions. This is why files in the new test split are named `train_...`, `valid_...`, or `test_...`: the prefix is where the image came from, not the split it was assigned to. It then writes `weights/ppe_data.yaml` with `nc: 10` and the 10 class names. This is the same file the backend now reads from `Backend/output/weights/ppe_data.yaml`.

Output: `train: 2240 images linked`, `val: 280 images linked`, `test: 281 images linked`.

### Cells 13-14: Class distribution

Counts boxes per class in each split, saves `metrics/class_distribution.csv`, and plots it.

| Class          | Train | Val | Test | Total |
| -------------- | ----- | --- | ---- | ----- |
| Person         | 7908  | 923 | 1041 | 9872  |
| machinery      | 4274  | 505 | 567  | 5346  |
| NO-Safety Vest | 3269  | 422 | 467  | 4158  |
| Safety Cone    | 2782  | 337 | 383  | 3502  |
| Hardhat        | 2667  | 276 | 391  | 3334  |
| NO-Mask        | 2634  | 282 | 334  | 3250  |
| Safety Vest    | 2556  | 266 | 313  | 3135  |
| NO-Hardhat     | 1943  | 225 | 259  | 2427  |
| Mask           | 1346  | 168 | 186  | 1700  |
| vehicle        | 1305  | 150 | 173  | 1628  |

![Boxes per class and split](Backend/output/plots/class_distribution.png)

_Boxes per class in each split._ Each class keeps a similar share across train, val, and test, which shows the stratified split worked. Person has about 6 times as many boxes as vehicle or Mask, so the dataset is imbalanced.

### Cells 15-16: Training on both GPUs

Writes a small `train.py` (saved as [Backend/output/train.py](Backend/output/train.py)), runs it as a subprocess so Ultralytics can launch DDP on both GPUs, and streams every line into the notebook and `logs/train.log`. A background thread polls `nvidia-smi` every 30 seconds into `logs/gpu_usage.csv`.

Facts from `logs/train.log`:

- Model: YOLO11m, 231 layers, 20,060,718 parameters, 68.3 GFLOPs before fusing; 649/649 items transferred from the COCO-pretrained `yolo11m.pt`.
- Ultralytics downloaded `yolo26n.pt` for its AMP check only ("not used for training").
- `75 epochs completed in 0.701 hours`, then `best.pt` was validated: YOLO11m fused, 125 layers, 20,037,742 parameters, 67.8 GFLOPs.
- Speed in that validation: 1.3 ms preprocess, 15.0 ms inference, 6.2 ms postprocess per image.

Final validation of `best.pt` printed by the training run (280 images, 3554 instances):

| Class          | Images | Instances | P     | R     | mAP50 | mAP50-95 |
| -------------- | ------ | --------- | ----- | ----- | ----- | -------- |
| all            | 280    | 3554      | 0.924 | 0.808 | 0.868 | 0.637    |
| Hardhat        | 135    | 276       | 0.934 | 0.819 | 0.859 | 0.618    |
| Mask           | 114    | 168       | 0.961 | 0.935 | 0.976 | 0.768    |
| NO-Hardhat     | 131    | 225       | 0.919 | 0.804 | 0.868 | 0.598    |
| NO-Mask        | 150    | 282       | 0.921 | 0.743 | 0.828 | 0.512    |
| NO-Safety Vest | 185    | 422       | 0.916 | 0.853 | 0.903 | 0.676    |
| Person         | 266    | 923       | 0.964 | 0.858 | 0.929 | 0.727    |
| Safety Cone    | 60     | 337       | 0.847 | 0.617 | 0.703 | 0.398    |
| Safety Vest    | 134    | 266       | 0.939 | 0.782 | 0.832 | 0.629    |
| machinery      | 213    | 505       | 0.952 | 0.911 | 0.955 | 0.829    |
| vehicle        | 79     | 150       | 0.884 | 0.761 | 0.829 | 0.615    |

Output: `Training done in 43.5 min. Best: /kaggle/working/runs/yolo11m_ppe/weights/best.pt`.

Plots that Ultralytics produced in the training run folder (copied to `plots/` with the `yolo11m_ppe_` prefix by cell 22):

![Ultralytics training results](Backend/output/plots/yolo11m_ppe_results.png)

_Per-epoch losses and metrics drawn by Ultralytics._ Train losses fall steadily, with a visible step down at epoch 66 when mosaic turns off. Validation losses spike in epochs 3 to 6 right after warmup, then fall and flatten after about epoch 60. Val mAP50 and mAP50-95 rise and level off near 0.87 and 0.64.

| Precision curve                                                                         | Recall curve                                                                                                  |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| ![Training run precision curve](Backend/output/plots/yolo11m_ppe_BoxP_curve.png)        | ![Training run recall curve](Backend/output/plots/yolo11m_ppe_BoxR_curve.png)                                 |
| **F1 curve**                                                                            | **PR curve**                                                                                                  |
| ![Training run F1 curve](Backend/output/plots/yolo11m_ppe_BoxF1_curve.png)              | ![Training run PR curve](Backend/output/plots/yolo11m_ppe_BoxPR_curve.png)                                    |
| **Confusion matrix**                                                                    | **Normalised confusion matrix**                                                                               |
| ![Training run confusion matrix](Backend/output/plots/yolo11m_ppe_confusion_matrix.png) | ![Training run normalised confusion matrix](Backend/output/plots/yolo11m_ppe_confusion_matrix_normalized.png) |

_Validation-set curves and confusion matrices from the final `best.pt` validation inside the training run._ They show the same split as the `eval_val_*` plots in cell 20, produced by a separate validation call.

### Cells 17-18: Training curves and GPU usage

Reads `results.csv`, saves it to `metrics/results.csv`, finds the best epoch by val mAP50-95, and plots losses, precision and recall, mAP, and learning rate. A second plot shows per-GPU utilisation and memory.

Output: `Epochs run: 75 | best epoch 72: mAP50 0.8692, mAP50-95 0.6375`.

![Training curves](Backend/output/plots/training_curves.png)

_Losses, precision and recall, mAP, and learning rate per epoch._ The learning rate rises during the 3 warmup epochs, then follows the cosine schedule down to 0.000104 at epoch 75. The best epoch (72) is three epochs before the end, and from epoch 68 onward val mAP50-95 stays between 0.632 and 0.638, so training ended on a plateau.

![GPU utilisation and memory](Backend/output/plots/gpu_usage.png)

_Utilisation and memory of both T4s, sampled every 30 seconds for 2586 seconds._ Both GPUs were busy for most of the run.

| GPU | Mean utilisation | Max utilisation | Mean memory (MB) | Peak memory (MB) |
| --- | ---------------- | --------------- | ---------------- | ---------------- |
| 0   | 90.8%            | 100%            | 7971.0           | 8677             |
| 1   | 92.4%            | 100%            | 7812.0           | 8543             |

Each T4 reports 15360 MB total, so peak training memory was about 57% of VRAM.

The full per-epoch log from `metrics/results.csv` is in [Per-epoch training metrics](#per-epoch-training-metrics).

### Cells 19-20: Evaluation on validation and test

Defines `evaluate(split, device, augment)`, which validates `best.pt` with fp16 at 640 px and returns overall and per-class metrics. Validation runs on GPU 0 and test on GPU 1 at the same time, then test is re-run with test-time augmentation (TTA). F1 is computed as `2PR / (P + R)`. Results go to `metrics/eval_summary.csv` and `metrics/per_class_metrics.csv`.

Logged details: val had 280 images with 3 backgrounds and 3554 instances; test had 281 images with 2 backgrounds and 4114 instances.

| Split    | mAP50  | mAP50-95 | Precision | Recall | F1     | Inference ms/img |
| -------- | ------ | -------- | --------- | ------ | ------ | ---------------- |
| val      | 0.8679 | 0.6368   | 0.9236    | 0.8084 | 0.8621 | 32.79            |
| test     | 0.8659 | 0.6158   | 0.9135    | 0.8053 | 0.8560 | 31.32            |
| test_tta | 0.8603 | 0.6206   | 0.9027    | 0.7853 | 0.8399 | 85.98            |

Per-class results are in [Per-class metrics](#per-class-metrics). The curve and confusion-matrix plots from these three runs are shown under cell 22, which copies them into `plots/`.

### Cells 21-22: Per-class AP and evaluation plots

Plots per-class AP@0.5 for val, test, and test with TTA, then copies every PNG from the training run and the three evaluation runs into `plots/`, prefixed with the run name.

![Per-class AP@0.5](Backend/output/plots/per_class_ap.png)

_Per-class AP@0.5 for val, test, and test with TTA._ machinery (0.9555 val, 0.9565 test) and Mask (0.9763 val, 0.9432 test) score highest. Safety Cone is lowest on every split (0.7027 val, 0.7447 test). Hardhat drops from 0.8592 on val to 0.7975 on test.

#### Validation plots (`eval_val_*`)

| Precision curve                                                             | Recall curve                                                                                      |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| ![Val precision curve](Backend/output/plots/eval_val_BoxP_curve.png)        | ![Val recall curve](Backend/output/plots/eval_val_BoxR_curve.png)                                 |
| **F1 curve**                                                                | **PR curve**                                                                                      |
| ![Val F1 curve](Backend/output/plots/eval_val_BoxF1_curve.png)              | ![Val PR curve](Backend/output/plots/eval_val_BoxPR_curve.png)                                    |
| **Confusion matrix**                                                        | **Normalised confusion matrix**                                                                   |
| ![Val confusion matrix](Backend/output/plots/eval_val_confusion_matrix.png) | ![Val normalised confusion matrix](Backend/output/plots/eval_val_confusion_matrix_normalized.png) |

_Validation split (280 images)._ The PR curve gives mAP50 0.868 for all classes; the confusion matrices show per-class hits, swaps between classes, and misses against background.

#### Test plots (`eval_test_*`)

| Precision curve                                                               | Recall curve                                                                                        |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| ![Test precision curve](Backend/output/plots/eval_test_BoxP_curve.png)        | ![Test recall curve](Backend/output/plots/eval_test_BoxR_curve.png)                                 |
| **F1 curve**                                                                  | **PR curve**                                                                                        |
| ![Test F1 curve](Backend/output/plots/eval_test_BoxF1_curve.png)              | ![Test PR curve](Backend/output/plots/eval_test_BoxPR_curve.png)                                    |
| **Confusion matrix**                                                          | **Normalised confusion matrix**                                                                     |
| ![Test confusion matrix](Backend/output/plots/eval_test_confusion_matrix.png) | ![Test normalised confusion matrix](Backend/output/plots/eval_test_confusion_matrix_normalized.png) |

_Held-out test split (281 images)._ In the normalised confusion matrix the diagonal ranges from 0.63 (Safety Vest) to 0.96 (machinery). The largest off-diagonal values are true Hardhat predicted as background (0.16), true Safety Cone and Safety Vest predicted as background (0.14 each), and true Safety Vest predicted as Person (0.10). In the background column, 0.28 of background false positives were predicted as Person.

#### Test with TTA plots (`eval_test_tta_*`)

| Precision curve                                                                  | Recall curve                                                                                           |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| ![TTA precision curve](Backend/output/plots/eval_test_tta_BoxP_curve.png)        | ![TTA recall curve](Backend/output/plots/eval_test_tta_BoxR_curve.png)                                 |
| **F1 curve**                                                                     | **PR curve**                                                                                           |
| ![TTA F1 curve](Backend/output/plots/eval_test_tta_BoxF1_curve.png)              | ![TTA PR curve](Backend/output/plots/eval_test_tta_BoxPR_curve.png)                                    |
| **Confusion matrix**                                                             | **Normalised confusion matrix**                                                                        |
| ![TTA confusion matrix](Backend/output/plots/eval_test_tta_confusion_matrix.png) | ![TTA normalised confusion matrix](Backend/output/plots/eval_test_tta_confusion_matrix_normalized.png) |

_Test split with flip and scale TTA._ TTA lowered mAP50 (0.8659 to 0.8603), precision, and recall, raised mAP50-95 slightly (0.6158 to 0.6206), and took about 2.7 times longer per image (85.98 ms against 31.32 ms). The backend does not use TTA.

### Cells 23-24: Inference on test images

Runs `best.pt` on all 281 test images, half on each GPU, with fp16, `conf=0.25`, and streaming. Every annotated image is saved to `predictions/` and every box to `predictions/test_detections.csv`.

Output: `4002 boxes on 281 images | 35.9 img/s end to end`.

![Sample predictions](Backend/output/plots/sample_predictions.png)

_Six test images picked with seed 42, with the predicted boxes drawn._ All 281 annotated images are saved in `Backend/output/predictions/` and are not embedded here.

### Cells 25-26: Export to ONNX

Exports `best.pt` to ONNX on CPU with opset 17 and onnxslim simplification. Input shape `(1, 3, 640, 640)`, output shape `(1, 14, 8400)` (4 box values plus 10 class scores for 8400 anchors). Ultralytics auto-installed `onnxruntime==1.30.0` during export.

Output: `ONNX: /kaggle/working/weights/best.onnx (80.5 MB)`. The backend loads `best.pt`, not the ONNX file.

### Cells 27-28: Summary

Writes `metrics/stage_times.csv` and `metrics/summary.json` and prints the final tables.

| Stage        | Seconds | Minutes |
| ------------ | ------- | ------- |
| Data loading | 2.3     | 0.04    |
| Training     | 2609.6  | 43.49   |
| Evaluation   | 61.4    | 1.02    |
| Inference    | 7.8     | 0.13    |
| ONNX export  | 6.3     | 0.11    |
| Total        | 2692.9  | 44.88   |

In `summary.json`, the `stage_minutes` keys keep their `_s` suffix (for example `training_s: 43.49`) although the values are minutes.

### Cells 29-30: Download outputs

Zips everything in `/kaggle/working/` except caches, the symlinked split tree, and the raw `runs/` folder. Images and weights are stored without recompression.

Output: `Zipped 328 files (0.26 GB) into /kaggle/working/outputs.zip`. Its contents are what `Backend/output/` holds.

## Results

### Headline metrics

| Metric                | Value                                 | Split | Source                     |
| --------------------- | ------------------------------------- | ----- | -------------------------- |
| mAP@0.5               | 0.8679                                | val   | `metrics/eval_summary.csv` |
| mAP@0.5:0.95          | 0.6368                                | val   | `metrics/eval_summary.csv` |
| mAP@0.5               | 0.8659                                | test  | `metrics/eval_summary.csv` |
| mAP@0.5:0.95          | 0.6158                                | test  | `metrics/eval_summary.csv` |
| Precision             | 0.9135                                | test  | `metrics/eval_summary.csv` |
| Recall                | 0.8053                                | test  | `metrics/eval_summary.csv` |
| F1                    | 0.8560                                | test  | `metrics/eval_summary.csv` |
| mAP@0.5 with TTA      | 0.8603                                | test  | `metrics/eval_summary.csv` |
| mAP@0.5:0.95 with TTA | 0.6206                                | test  | `metrics/eval_summary.csv` |
| Epochs run            | 75                                    | train | `metrics/summary.json`     |
| Best epoch            | 72                                    | val   | `metrics/summary.json`     |
| End-to-end throughput | 35.9 img/s on 2 T4s, fp16             | test  | `metrics/summary.json`     |
| Inference latency     | 31.32 ms/img (batch 16, fp16, one T4) | test  | `metrics/eval_summary.csv` |
| Total notebook time   | 44.88 min                             | -     | `metrics/stage_times.csv`  |

The dashboard's "detection accuracy" tile is a fixed value, `DETECTION_ACCURACY = 0.87` in `Backend/ppe_api/services/metrics.py`, which equals the val mAP@0.5 of 0.8679 rounded to two places. It is not measured live.

These figures describe this dataset's val and test splits only. Accuracy on other sites, cameras, or lighting is not measured in the current repository.

### Per-class metrics

From `metrics/per_class_metrics.csv`:

| Class          | val AP50 | val AP50-95 | val precision | val recall | test AP50 | test AP50-95 | test precision | test recall | test_tta AP50 | test_tta AP50-95 | test_tta precision | test_tta recall |
| -------------- | -------- | ----------- | ------------- | ---------- | --------- | ------------ | -------------- | ----------- | ------------- | ---------------- | ------------------ | --------------- |
| Hardhat        | 0.8592   | 0.617       | 0.9339        | 0.8188     | 0.7975    | 0.542        | 0.9183         | 0.7473      | 0.7928        | 0.5358           | 0.9081             | 0.733           |
| Mask           | 0.9763   | 0.7667      | 0.9609        | 0.9345     | 0.9432    | 0.7137       | 0.9411         | 0.9194      | 0.9514        | 0.7372           | 0.9285             | 0.9073          |
| NO-Hardhat     | 0.8676   | 0.5992      | 0.9188        | 0.8043     | 0.8894    | 0.5813       | 0.9217         | 0.8179      | 0.8796        | 0.5929           | 0.8971             | 0.8224          |
| NO-Mask        | 0.8249   | 0.5129      | 0.9209        | 0.7433     | 0.8055    | 0.4587       | 0.8878         | 0.7346      | 0.7891        | 0.4558           | 0.8536             | 0.7036          |
| NO-Safety Vest | 0.9034   | 0.6753      | 0.9161        | 0.8535     | 0.8782    | 0.6445       | 0.9318         | 0.8194      | 0.883         | 0.6531           | 0.8975             | 0.8223          |
| Person         | 0.929    | 0.7275      | 0.9638        | 0.8581     | 0.925     | 0.7124       | 0.9459         | 0.854       | 0.9201        | 0.7177           | 0.9227             | 0.848           |
| Safety Cone    | 0.7027   | 0.3969      | 0.8468        | 0.6172     | 0.7447    | 0.3963       | 0.8583         | 0.6641      | 0.7146        | 0.3874           | 0.8576             | 0.5504          |
| Safety Vest    | 0.8317   | 0.6284      | 0.9388        | 0.782      | 0.8273    | 0.5983       | 0.9103         | 0.7572      | 0.8167        | 0.6065           | 0.9203             | 0.7284          |
| machinery      | 0.9555   | 0.829       | 0.952         | 0.9109     | 0.9565    | 0.8325       | 0.9663         | 0.9065      | 0.9621        | 0.8382           | 0.9427             | 0.9224          |
| vehicle        | 0.8288   | 0.6155      | 0.8839        | 0.7612     | 0.8914    | 0.6781       | 0.8538         | 0.8324      | 0.8938        | 0.6817           | 0.8992             | 0.815           |

### Test detections per class

From `predictions/test_detections.csv` (4002 boxes at `conf >= 0.25`; 280 of the 281 test images have at least one box):

| Class          | Predicted boxes | Ground-truth test boxes |
| -------------- | --------------- | ----------------------- |
| Person         | 1049            | 1041                    |
| machinery      | 563             | 567                     |
| NO-Safety Vest | 452             | 467                     |
| Safety Cone    | 374             | 383                     |
| Hardhat        | 345             | 391                     |
| NO-Mask        | 314             | 334                     |
| Safety Vest    | 278             | 313                     |
| NO-Hardhat     | 252             | 259                     |
| vehicle        | 188             | 173                     |
| Mask           | 187             | 186                     |
| **all**        | **4002**        | **4114**                |

### Per-epoch training metrics

From `metrics/results.csv`. Time is cumulative seconds. Mosaic was turned off from epoch 66 (`close_mosaic=10`), which is where the train losses drop.

<details>
<summary>Show all 75 epochs</summary>

Epoch 72, the best by val mAP50-95, is in bold.

| Epoch  | Time (s)    | Train box   | Train cls   | Train dfl   | P           | R           | mAP50       | mAP50-95    | Val box    | Val cls     | Val dfl     | LR pg0         |
| ------ | ----------- | ----------- | ----------- | ----------- | ----------- | ----------- | ----------- | ----------- | ---------- | ----------- | ----------- | -------------- |
| 1      | 45.8653     | 1.55528     | 2.23998     | 1.64065     | 0.56922     | 0.41542     | 0.44149     | 0.24039     | 1.292      | 1.45614     | 1.29138     | 0.00328571     |
| 2      | 78.7627     | 1.3103      | 1.44497     | 1.43144     | 0.66975     | 0.50806     | 0.54711     | 0.29967     | 1.26369    | 1.29359     | 1.26225     | 0.0066137      |
| 3      | 114.019     | 1.33674     | 1.43425     | 1.43504     | 0.58999     | 0.38268     | 0.41526     | 0.21165     | 1.4378     | 2.069       | 1.4376      | 0.00992866     |
| 4      | 147.061     | 1.35352     | 1.46492     | 1.46396     | 0.59193     | 0.42337     | 0.42655     | 0.21734     | 1.45824    | 1.66216     | 1.50179     | 0.00995111     |
| 5      | 181.042     | 1.37924     | 1.50685     | 1.48232     | 0.59209     | 0.40881     | 0.40931     | 0.2076      | 1.45589    | 1.71776     | 1.48176     | 0.00991814     |
| 6      | 214.812     | 1.3424      | 1.42324     | 1.45706     | 0.57599     | 0.38618     | 0.39677     | 0.19784     | 1.49124    | 1.8013      | 1.50938     | 0.00987589     |
| 7      | 248.245     | 1.30938     | 1.3712      | 1.43797     | 0.66661     | 0.48258     | 0.52102     | 0.28212     | 1.32327    | 1.33008     | 1.32962     | 0.00982658     |
| 8      | 282.08      | 1.28444     | 1.32234     | 1.41831     | 0.69996     | 0.53336     | 0.57453     | 0.31992     | 1.26731    | 1.26672     | 1.32264     | 0.00976445     |
| 9      | 315.553     | 1.29151     | 1.31395     | 1.42867     | 0.69589     | 0.47371     | 0.51982     | 0.27902     | 1.43721    | 1.35933     | 1.3977      | 0.00970148     |
| 10     | 349.123     | 1.25438     | 1.24942     | 1.40091     | 0.77571     | 0.52824     | 0.59373     | 0.34321     | 1.22221    | 1.18892     | 1.2681      | 0.0096232      |
| 11     | 382.952     | 1.26237     | 1.26158     | 1.4117      | 0.75076     | 0.54305     | 0.60945     | 0.35387     | 1.21502    | 1.08489     | 1.28591     | 0.00954865     |
| 12     | 416.577     | 1.23355     | 1.21527     | 1.3812      | 0.72273     | 0.453       | 0.51168     | 0.29486     | 1.28542    | 1.36064     | 1.3239      | 0.00945564     |
| 13     | 450.049     | 1.20459     | 1.18904     | 1.36838     | 0.76002     | 0.55883     | 0.63093     | 0.37925     | 1.1508     | 1.03547     | 1.19562     | 0.00935447     |
| 14     | 483.78      | 1.19126     | 1.16374     | 1.35842     | 0.79728     | 0.56799     | 0.63788     | 0.38264     | 1.15439    | 1.01557     | 1.20835     | 0.00924533     |
| 15     | 517.336     | 1.19175     | 1.14357     | 1.34936     | 0.81169     | 0.59488     | 0.68095     | 0.42088     | 1.09134    | 0.9079      | 1.1713      | 0.00912842     |
| 16     | 551.088     | 1.1919      | 1.12483     | 1.35825     | 0.81286     | 0.60994     | 0.6899      | 0.42251     | 1.12102    | 0.91105     | 1.17001     | 0.00900396     |
| 17     | 584.859     | 1.15444     | 1.06426     | 1.32403     | 0.82394     | 0.62064     | 0.69895     | 0.43496     | 1.08522    | 0.86401     | 1.15369     | 0.00890128     |
| 18     | 618.573     | 1.15223     | 1.06066     | 1.32668     | 0.80933     | 0.64846     | 0.71381     | 0.44326     | 1.08175    | 0.83376     | 1.13278     | 0.00876583     |
| 19     | 652.299     | 1.15568     | 1.06071     | 1.32391     | 0.81691     | 0.6053      | 0.68851     | 0.43019     | 1.10144    | 0.90728     | 1.14923     | 0.00862368     |
| 20     | 685.782     | 1.13829     | 1.0349      | 1.31233     | 0.80318     | 0.65397     | 0.71751     | 0.44396     | 1.07771    | 0.84721     | 1.1436      | 0.0084751      |
| 21     | 719.433     | 1.11872     | 1.00113     | 1.29707     | 0.86428     | 0.64797     | 0.7303      | 0.47034     | 1.03169    | 0.76706     | 1.09917     | 0.00832034     |
| 22     | 753.174     | 1.11534     | 0.98946     | 1.29124     | 0.81546     | 0.66854     | 0.73533     | 0.47294     | 1.01906    | 0.75811     | 1.10018     | 0.00815969     |
| 23     | 786.771     | 1.08877     | 0.95993     | 1.26799     | 0.82848     | 0.65802     | 0.73261     | 0.46647     | 1.03151    | 0.76468     | 1.10751     | 0.00799343     |
| 24     | 820.302     | 1.10484     | 0.9842      | 1.28423     | 0.84812     | 0.68398     | 0.7531      | 0.48745     | 1.01056    | 0.71579     | 1.0986      | 0.00782188     |
| 25     | 853.976     | 1.07078     | 0.92841     | 1.25797     | 0.85247     | 0.69707     | 0.76391     | 0.50257     | 0.98074    | 0.68784     | 1.07248     | 0.00764532     |
| 26     | 887.568     | 1.06789     | 0.93014     | 1.25898     | 0.85005     | 0.68262     | 0.75517     | 0.48785     | 1.01586    | 0.72583     | 1.08942     | 0.00746409     |
| 27     | 921.001     | 1.05469     | 0.91562     | 1.25481     | 0.88465     | 0.70052     | 0.7759      | 0.50571     | 0.98709    | 0.67088     | 1.07424     | 0.00727851     |
| 28     | 954.642     | 1.05513     | 0.91908     | 1.26374     | 0.86554     | 0.68177     | 0.76786     | 0.50374     | 0.97655    | 0.68985     | 1.06623     | 0.00708891     |
| 29     | 988.087     | 1.02592     | 0.86413     | 1.24077     | 0.88386     | 0.70984     | 0.78581     | 0.52379     | 0.93722    | 0.63597     | 1.035       | 0.00689564     |
| 30     | 1021.61     | 1.02423     | 0.87481     | 1.23173     | 0.87728     | 0.67815     | 0.76614     | 0.51219     | 0.96458    | 0.67498     | 1.05607     | 0.00669904     |
| 31     | 1055.17     | 1.00691     | 0.83935     | 1.2211      | 0.88849     | 0.71342     | 0.7965      | 0.53044     | 0.93813    | 0.61999     | 1.02502     | 0.00649947     |
| 32     | 1088.81     | 1.02144     | 0.86719     | 1.22398     | 0.87808     | 0.70635     | 0.78387     | 0.52135     | 0.94936    | 0.6401      | 1.03774     | 0.00629729     |
| 33     | 1122.22     | 1.01037     | 0.84514     | 1.22059     | 0.8811      | 0.73703     | 0.80659     | 0.54473     | 0.91828    | 0.6048      | 1.01081     | 0.00618034     |
| 34     | 1155.73     | 1.00182     | 0.83984     | 1.22046     | 0.89459     | 0.72932     | 0.80547     | 0.53916     | 0.92514    | 0.59136     | 1.01662     | 0.00597754     |
| 35     | 1189.31     | 0.98019     | 0.81519     | 1.20011     | 0.89683     | 0.73942     | 0.81123     | 0.55576     | 0.89238    | 0.58284     | 0.99862     | 0.00577311     |
| 36     | 1222.86     | 0.9762      | 0.81534     | 1.19588     | 0.88142     | 0.73952     | 0.81301     | 0.54851     | 0.91461    | 0.58362     | 1.01658     | 0.00556742     |
| 37     | 1256.38     | 0.95907     | 0.78235     | 1.18615     | 0.88307     | 0.75034     | 0.81285     | 0.55309     | 0.90629    | 0.57604     | 1.02103     | 0.00536081     |
| 38     | 1289.99     | 0.95775     | 0.78705     | 1.1946      | 0.90775     | 0.7394      | 0.81758     | 0.56146     | 0.88402    | 0.56509     | 0.98882     | 0.00515366     |
| 39     | 1323.58     | 0.94621     | 0.78539     | 1.18716     | 0.87765     | 0.75999     | 0.82368     | 0.56711     | 0.87546    | 0.55268     | 0.98397     | 0.00494634     |
| 40     | 1357.17     | 0.94114     | 0.76638     | 1.17794     | 0.89221     | 0.7489      | 0.82345     | 0.57467     | 0.8603     | 0.54259     | 0.97266     | 0.00473919     |
| 41     | 1390.87     | 0.92603     | 0.75419     | 1.16683     | 0.91819     | 0.74948     | 0.82859     | 0.57833     | 0.85618    | 0.52741     | 0.96363     | 0.00453258     |
| 42     | 1424.5      | 0.91498     | 0.72345     | 1.15806     | 0.89157     | 0.75759     | 0.82707     | 0.57367     | 0.86617    | 0.53853     | 0.9765      | 0.00432689     |
| 43     | 1457.96     | 0.92338     | 0.74575     | 1.1649      | 0.92133     | 0.74822     | 0.83217     | 0.58063     | 0.84865    | 0.52406     | 0.9676      | 0.00412246     |
| 44     | 1491.51     | 0.90331     | 0.72499     | 1.1533      | 0.90769     | 0.76635     | 0.84087     | 0.58474     | 0.84397    | 0.51375     | 0.95883     | 0.00391966     |
| 45     | 1525.27     | 0.8815      | 0.69733     | 1.13722     | 0.89461     | 0.7683      | 0.83813     | 0.5867      | 0.83947    | 0.51192     | 0.95745     | 0.00371885     |
| 46     | 1558.73     | 0.87248     | 0.67815     | 1.12195     | 0.91622     | 0.7655      | 0.84069     | 0.59338     | 0.82831    | 0.49597     | 0.95211     | 0.00352037     |
| 47     | 1592.19     | 0.87467     | 0.69694     | 1.13661     | 0.92754     | 0.76424     | 0.84478     | 0.59832     | 0.83294    | 0.49547     | 0.94997     | 0.00332457     |
| 48     | 1625.76     | 0.86674     | 0.67171     | 1.12744     | 0.9129      | 0.77307     | 0.84583     | 0.59962     | 0.81986    | 0.48604     | 0.93253     | 0.0031318      |
| 49     | 1659.18     | 0.85692     | 0.67232     | 1.12354     | 0.90431     | 0.77603     | 0.84104     | 0.59434     | 0.83338    | 0.49722     | 0.95193     | 0.00294239     |
| 50     | 1692.52     | 0.83321     | 0.65412     | 1.11475     | 0.90438     | 0.77759     | 0.84386     | 0.59542     | 0.83625    | 0.48389     | 0.95637     | 0.00275668     |
| 51     | 1726.02     | 0.83743     | 0.64291     | 1.10302     | 0.91883     | 0.77944     | 0.85274     | 0.6096      | 0.80208    | 0.46722     | 0.93129     | 0.002575       |
| 52     | 1759.59     | 0.8392      | 0.65564     | 1.11439     | 0.9141      | 0.78689     | 0.85357     | 0.61026     | 0.79877    | 0.46257     | 0.91864     | 0.00239766     |
| 53     | 1793.17     | 0.82018     | 0.62998     | 1.10008     | 0.92158     | 0.78017     | 0.84968     | 0.60258     | 0.80121    | 0.47136     | 0.92898     | 0.00222497     |
| 54     | 1826.72     | 0.85157     | 0.66727     | 1.11351     | 0.91905     | 0.79315     | 0.85287     | 0.60994     | 0.79612    | 0.45839     | 0.92112     | 0.00205723     |
| 55     | 1860.15     | 0.82954     | 0.64275     | 1.10581     | 0.91031     | 0.80369     | 0.85713     | 0.61951     | 0.77956    | 0.4474      | 0.91365     | 0.00189475     |
| 56     | 1893.79     | 0.82175     | 0.63786     | 1.10184     | 0.92297     | 0.78333     | 0.85788     | 0.61989     | 0.77788    | 0.44623     | 0.90941     | 0.0017378      |
| 57     | 1927.43     | 0.81711     | 0.62926     | 1.09391     | 0.91363     | 0.80087     | 0.85816     | 0.6213      | 0.77899    | 0.44573     | 0.91507     | 0.00158667     |
| 58     | 1961.0      | 0.80067     | 0.62028     | 1.098       | 0.92485     | 0.79955     | 0.86051     | 0.6258      | 0.76269    | 0.4404      | 0.899       | 0.00144161     |
| 59     | 1994.53     | 0.78866     | 0.61307     | 1.08789     | 0.93889     | 0.78668     | 0.86011     | 0.62626     | 0.76421    | 0.43909     | 0.90668     | 0.00130287     |
| 60     | 2028.18     | 0.80125     | 0.59938     | 1.08455     | 0.92721     | 0.79628     | 0.86102     | 0.62492     | 0.77459    | 0.43599     | 0.90697     | 0.00117072     |
| 61     | 2061.56     | 0.77829     | 0.59697     | 1.07804     | 0.93822     | 0.79284     | 0.86389     | 0.62691     | 0.76152    | 0.43019     | 0.90173     | 0.00104537     |
| 62     | 2094.96     | 0.78374     | 0.59418     | 1.07753     | 0.91922     | 0.80191     | 0.86346     | 0.6256      | 0.77233    | 0.43467     | 0.90877     | 0.00092704     |
| 63     | 2128.48     | 0.7818      | 0.59936     | 1.08093     | 0.92898     | 0.80336     | 0.86387     | 0.62723     | 0.76854    | 0.42954     | 0.90949     | 0.000815947    |
| 64     | 2162.11     | 0.76787     | 0.59768     | 1.07927     | 0.92491     | 0.80431     | 0.86376     | 0.62857     | 0.76725    | 0.42766     | 0.90646     | 0.000712282    |
| 65     | 2195.72     | 0.76667     | 0.5846      | 1.07002     | 0.94089     | 0.79427     | 0.86556     | 0.63099     | 0.76407    | 0.4248      | 0.90064     | 0.000616227    |
| 66     | 2230.34     | 0.68613     | 0.42118     | 0.99777     | 0.91654     | 0.80639     | 0.86181     | 0.62526     | 0.76796    | 0.42962     | 0.90777     | 0.00052795     |
| 67     | 2263.56     | 0.67364     | 0.41512     | 1.00171     | 0.92203     | 0.80611     | 0.8635      | 0.62995     | 0.7597     | 0.42392     | 0.90401     | 0.000447606    |
| 68     | 2296.85     | 0.65444     | 0.39773     | 0.99712     | 0.92298     | 0.81173     | 0.86877     | 0.63298     | 0.75572    | 0.42173     | 0.90118     | 0.000375337    |
| 69     | 2330.2      | 0.64159     | 0.39522     | 0.98685     | 0.92907     | 0.8103      | 0.86913     | 0.63352     | 0.75476    | 0.42209     | 0.90049     | 0.000311268    |
| 70     | 2363.46     | 0.65534     | 0.3949      | 0.98829     | 0.92654     | 0.80702     | 0.86702     | 0.6365      | 0.74743    | 0.41655     | 0.89455     | 0.000255513    |
| 71     | 2396.86     | 0.63358     | 0.386       | 0.98103     | 0.91869     | 0.81273     | 0.86697     | 0.6324      | 0.75426    | 0.41972     | 0.90108     | 0.000208169    |
| **72** | **2430.07** | **0.63711** | **0.39246** | **0.98635** | **0.92355** | **0.80842** | **0.86921** | **0.63755** | **0.7467** | **0.41525** | **0.89509** | **0.00016932** |
| 73     | 2463.44     | 0.62532     | 0.37953     | 0.97653     | 0.92538     | 0.80768     | 0.86861     | 0.63572     | 0.75205    | 0.41648     | 0.89875     | 0.000139032    |
| 74     | 2496.59     | 0.63045     | 0.38381     | 0.97826     | 0.92431     | 0.80974     | 0.86973     | 0.63556     | 0.75051    | 0.41419     | 0.89901     | 0.00011736     |
| 75     | 2523.32     | 0.63426     | 0.38762     | 0.98289     | 0.92741     | 0.80962     | 0.86942     | 0.63517     | 0.75099    | 0.41618     | 0.90069     | 0.000104342    |

</details>

## Output Files

All paths are under `Backend/output/`.

| File                              | Size              | Contents                                                                                    |
| --------------------------------- | ----------------- | ------------------------------------------------------------------------------------------- |
| `weights/best.pt`                 | 40.5 MB           | Best weights (epoch 72). **Served by the backend.** Committed via a `.gitignore` exception. |
| `weights/ppe_data.yaml`           | 237 B             | Dataset YAML; `nc: 10` and class names. **Read by the backend.**                            |
| `weights/last.pt`                 | 40.5 MB           | Weights after the final epoch (75). Git-ignored.                                            |
| `weights/best.onnx`               | 80.5 MB           | ONNX export of `best.pt`, opset 17. Git-ignored; not used by the backend.                   |
| `weights/yolo26n.pt`              | 5.5 MB            | Downloaded by Ultralytics for its AMP check only. Git-ignored; safe to delete.              |
| `yolo11m.pt`                      | 40.7 MB           | COCO-pretrained starting weights. Git-ignored; safe to delete.                              |
| `train.py`                        | 99 B              | The 3-line training script cell 16 runs under DDP.                                          |
| `metrics/results.csv`             | 9.4 KB            | 75 rows, one per epoch: losses, P, R, mAP50, mAP50-95, learning rates.                      |
| `metrics/eval_summary.csv`        | 193 B             | 3 rows (val, test, test_tta): mAP50, mAP50_95, precision, recall, F1, ms_per_img.           |
| `metrics/per_class_metrics.csv`   | 1.1 KB            | 10 classes by 12 columns: AP50, AP50-95, precision, recall for each split.                  |
| `metrics/class_distribution.csv`  | 299 B             | Boxes per class for train, val, test, and total.                                            |
| `metrics/stage_times.csv`         | 108 B             | Seconds per notebook stage.                                                                 |
| `metrics/summary.json`            | 833 B             | Model, epochs, splits, metrics, throughput, peak GPU memory, stage minutes.                 |
| `logs/train.log`                  | 889 KB            | Full Ultralytics training output, 6291 lines.                                               |
| `logs/gpu_usage.csv`              | 3.6 KB            | 172 samples (86 per GPU): elapsed_s, gpu, util_pct, mem_used_mb, mem_total_mb.              |
| `predictions/test_detections.csv` | 424 KB            | 4002 rows: image, cls, conf, x1, y1, x2, y2 (pixel coordinates).                            |
| `predictions/*.jpg`               | about 40 MB total | 281 annotated test images.                                                                  |
| `plots/*.png`                     | 30 files          | Every plot is embedded in this README.                                                      |

## Testing and Code Quality

Run every check from the repository root:

```powershell
npm run check
```

It runs ESLint (including module boundary rules), the TypeScript check, Prettier, the jscpd duplicate-code check, the Vite build, Black, import-linter layer contracts, and the backend pytest suite (13 tests). The tests use a fake detector, so they need `Backend/output/weights/ppe_data.yaml` but not `best.pt`. CI (`.github/workflows/ci.yml`) runs the same command. The module layout and dependency rules are in [ARCHITECTURE.md](ARCHITECTURE.md).

## Troubleshooting

| Problem                                                               | Likely cause                                                                       | Check                                                                                  | Fix                                                                                      |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Setup prints `Model weights` ... `not found`                          | `best.pt` missing, or `Backend/.env` points elsewhere                              | `Test-Path Backend\output\weights\best.pt` and `Select-String MODEL_PATH Backend\.env` | Extract `outputs.zip` into `Backend/output/`, or set `MODEL_PATH=output/weights/best.pt` |
| Backend log: `Failed to load model from ...`                          | Ultralytics older than 8.3.0 cannot read YOLO11 weights                            | `.venv\Scripts\python.exe -m pip show ultralytics`                                     | Reinstall `Backend/requirements.txt` (it pins `ultralytics>=8.3.0`)                      |
| Backend fails to start with a `FileNotFoundError` for `ppe_data.yaml` | `CLASS_NAMES_FILE` path is wrong                                                   | `Test-Path Backend\output\weights\ppe_data.yaml`                                       | Restore the file or fix `CLASS_NAMES_FILE`                                               |
| Wrong labels on boxes                                                 | YAML class order differs from the model                                            | Compare `ppe_data.yaml` with the training run                                          | Use the YAML from the same notebook run as `best.pt`                                     |
| CORS errors in the browser                                            | Frontend origin not allowed                                                        | Check `ALLOWED_ORIGINS` in `Backend/.env`                                              | Add the frontend URL                                                                     |
| Upload rejected                                                       | Request `Content-Length` larger than `MAX_UPLOAD_SIZE` (`Backend/ppe_api/main.py`) | Check the file size                                                                    | Raise `MAX_UPLOAD_SIZE` or upload a smaller file                                         |
| `npm run dev` exits naming a process                                  | Port 8000 or 8080 in use                                                           | The launcher prints the process                                                        | Stop that process and rerun                                                              |

## Known Limitations

- Metrics come from one Kaggle run on one dataset split. No cross-validation or external test set was run.
- Safety Cone has the lowest AP (0.7447 test AP50) and Safety Vest the lowest normalised confusion-matrix hit rate (0.63 on test).
- Video jobs live in memory, so a backend restart loses running jobs.
- The frontend does not send `X-API-Key`, so setting `API_KEY` locks the dashboard out.
- The dashboard accuracy tile is a fixed number, not a live measurement.
