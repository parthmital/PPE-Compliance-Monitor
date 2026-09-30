"""Detection classes. Names come from the dataset YAML the model was trained on."""

from pathlib import Path

import yaml

# Missing items that raise incidents. "NO-Mask" is reported but advisory only.
VIOLATION_CLASSES = frozenset({"NO-Hardhat", "NO-Safety Vest"})
PERSON_CLASS = "Person"
REQUIRED_PPE = ("Hardhat", "Safety Vest")


def load_class_names(dataset_yaml: Path) -> list[str]:
    data = yaml.safe_load(dataset_yaml.read_text(encoding="utf-8"))
    names = data["names"]
    return list(names.values()) if isinstance(names, dict) else list(names)
