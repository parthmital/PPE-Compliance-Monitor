"""uvicorn logging with timestamps, app loggers included, and polling noise hidden."""

import copy
import logging

POLLED_PATHS = (
    "/api/health",
    "/api/config",
    "/api/metrics",
    "/api/incidents",
    "/api/session",
    "/api/detect/video/",
)


class QuietPollingFilter(logging.Filter):
    """Hide successful access-log lines for endpoints the frontend polls."""

    def filter(self, record):
        # uvicorn access records: (client_addr, method, path, http_version, status)
        if isinstance(record.args, tuple) and len(record.args) == 5:
            _, method, path, _, status = record.args
            if (
                method in ("GET", "POST")
                and 200 <= int(status) < 300
                and path.startswith(POLLED_PATHS)
            ):
                return False
        return True


def build_log_config() -> dict:
    from uvicorn.config import LOGGING_CONFIG

    config = copy.deepcopy(LOGGING_CONFIG)
    config["formatters"]["default"]["fmt"] = "%(asctime)s %(levelprefix)s %(message)s"
    config["formatters"]["access"][
        "fmt"
    ] = '%(asctime)s %(levelprefix)s "%(request_line)s" %(status_code)s'
    for formatter in config["formatters"].values():
        formatter["datefmt"] = "%H:%M:%S"
    config.setdefault("filters", {})["quiet_polling"] = {"()": QuietPollingFilter}
    config["handlers"]["access"]["filters"] = ["quiet_polling"]
    config["loggers"]["ppe_api"] = {
        "handlers": ["default"],
        "level": "INFO",
        "propagate": False,
    }
    return config
