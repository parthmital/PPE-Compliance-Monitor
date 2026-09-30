# Architecture

A single-host app: a FastAPI backend running YOLOv8 inference, and a React (Vite) dashboard that talks to it over `/api`. One deployable per side; no services split, because nothing needs independent scaling yet.

## Module map

```
package.json            npm run dev (launcher) and npm run check (all checks)
scripts/
  dev/                  launcher: setup.mjs (first-run install), services.mjs (service table), main.mjs, log-window.mjs
  check.mjs             every lint, type, boundary, clone, test and build check
Backend/
  api.py                entry point only: load settings, create app, run uvicorn
  ppe_api/
    config.py           Settings from env/.env, validated at startup
    json_file.py        JSON document on disk, atomic writes
    detection/          pure detection logic, no FastAPI, no persistence
      classes.py        class names (from the dataset YAML), violation rules
      analysis.py       per-frame analysis, overlay drawing, temporal confirmation
      detector.py       YOLO model ownership, thresholds, thread-safe predict
    services/           application logic
      metrics.py        counters and derived rates
      incidents.py      incident log and snapshots
      session.py        opaque UI session document
      jobs.py           video job records
      uploads.py        upload naming and storage
      pipeline.py       photo and video detection flows feeding metrics and incidents
    container.py        builds the service graph; get_services dependency
    security.py         optional X-API-Key check
    routes/             thin HTTP handlers, one file per resource
    logging_config.py   uvicorn log format, polling noise filter
    main.py             create_app: middleware, static mounts, routers, lifespan
  tests/                pytest, with a fake detector (no weights needed)
  Construction-Site-Safety.ipynb   training notebook (Kaggle, self-contained)
Frontend/src/
  lib/                  API clients, shared types, formatting, video job polling
  contexts/             PPEContext (app state) and session-state.ts (persisted UI mapping)
  components/           shared UI; components/ui/ holds shadcn primitives
  pages/                one file or folder per route; pages/detection/ holds the Analyse page parts
```

## Dependency rules

Backend, enforced by import-linter (`Backend/.importlinter`):

`main → routes → security → container → services → detection → json_file | config`

`detection` must not import FastAPI, `services` or `json_file`.

Frontend, enforced by ESLint `no-restricted-imports` (`Frontend/eslint.config.js`):

`pages → components → contexts → lib`. `lib` imports no React state or UI; `contexts` import no UI; `components` import no pages.

## Where new code goes

| Change                                | Location                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| New endpoint                          | `routes/<resource>.py`, registered in `routes/__init__.py`; logic in a service             |
| New detection rule or class behaviour | `detection/classes.py` or `detection/analysis.py`, with a test in `tests/test_analysis.py` |
| New persisted backend state           | a service taking a `JsonFile`, wired in `container.py`                                     |
| New env setting                       | `config.py`, `Backend/.env.example` and the README table                                   |
| New API call                          | the matching `Frontend/src/lib/*-api.ts`, exported from `lib/index.ts`                     |
| New page                              | `pages/<Name>.tsx` or `pages/<name>/` when it has parts; route in `App.tsx`                |
| Shared UI                             | `components/`, exported from `components/index.ts`                                         |
| New long-running dev process          | an entry in `scripts/dev/services.mjs`                                                     |

## Decisions

- **Service container on `app.state`, not module globals.** Tests build an app with a fake detector and a temporary data folder; no global state leaks between requests or tests.
- **Blocking work runs off the event loop.** Detection endpoints are sync handlers (FastAPI runs them in its threadpool), and video jobs run as sync background tasks. `Detector` serialises `predict` with a lock because YOLO is not thread safe; metrics, incidents and jobs use locks for concurrent writers.
- **Temporal confirmation is per video job**, not global, so concurrent videos cannot corrupt each other's buffers. Single photos raise incidents straight away.
- **Class names come from `Trained Weights/ppe_data.yaml`**, the dataset file the model was trained on.
- **JSON files, not a database.** The data is small, single-writer and local. Writes are atomic (temp file plus rename).
- **The temporal window is served by `/api/config`**, so the frontend's "N consecutive frames" copy cannot drift from the backend.
- **The frontend polls one job helper** (`lib/video-job.ts`) for video progress; the page no longer estimates progress from global metrics.

## Allowed duplication

- `Frontend/src/lib/ppe-types.ts` `PPE_CLASSES` repeats the class names from the dataset YAML, because it adds UI-only colour and status data. If classes change, update both, or serve the names from `/api/config`.
- `Frontend/src/components/ui/` is vendored shadcn code and is excluded from the clone check.
- `Backend/services/session.py` default session and `Frontend/src/contexts/session-state.ts` initial state describe the same document on each side of the API. Sharing them would need codegen, which the project's size does not justify.
- Literal expected values in tests.
- The training notebook stays self-contained, as a Kaggle notebook must.

## Growth signals for the next pass

- **More than one backend process or host**: move metrics, incidents and jobs from JSON files and memory into SQLite or Postgres, and video jobs into a queue (for example RQ or Celery) so jobs survive restarts.
- **Incident log in the thousands**: paginate `/api/incidents` and the frontend list; the whole log is sent on every 2 s poll today.
- **Several concurrent videos or GPUs**: a pool of detectors instead of one locked model.
- **Real multi-user access**: replace the shared `API_KEY` with per-user auth. The frontend does not send the key today, so enabling `API_KEY` locks the dashboard out.
- **`PPEContext` grows beyond one screen of state**: split it into server-data, video-job and UI-preference contexts.
