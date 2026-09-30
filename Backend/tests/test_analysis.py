import numpy as np

from ppe_api.detection.analysis import (
    TEMPORAL_WINDOW,
    TemporalConfirmer,
    analyse_frame,
    draw_violation_overlay,
)

from .conftest import CLASS_NAMES, results


def test_analyse_frame_counts_violations_and_compliance():
    a = analyse_frame(results("Person", "Hardhat", "Safety Vest"), CLASS_NAMES)
    assert (a.persons, a.compliant, a.violations) == (1, 1, set())

    b = analyse_frame(results("Person", "NO-Hardhat", "NO-Mask"), CLASS_NAMES)
    assert b.compliant == 0
    assert b.violations == {"NO-Hardhat"}  # NO-Mask is advisory only
    assert [d["is_violation"] for d in b.detections] == [False, True, False]
    assert b.detections[1]["bbox"] == [10, 10, 50, 50]


def test_temporal_confirmer_needs_full_window():
    confirmer = TemporalConfirmer()
    for _ in range(TEMPORAL_WINDOW - 1):
        assert confirmer.update({"NO-Hardhat"}) == set()
    assert confirmer.update({"NO-Hardhat"}) == {"NO-Hardhat"}
    assert confirmer.update(set()) == set()


def test_overlay_does_not_modify_input():
    frame = np.zeros((100, 100, 3), np.uint8)
    dets = analyse_frame(results("NO-Hardhat"), CLASS_NAMES).detections
    out = draw_violation_overlay(frame, dets)
    assert frame.sum() == 0 and out.sum() > 0
