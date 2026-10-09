import json
from datetime import datetime, timezone
from pathlib import Path


class SessionLog:
    """
    One JSON file per run. The name is built ONCE, when the object is created:
     - same run → every save() overwrites the same file
     - new run  → new name, previous sessions stay untouched
    """

    def __init__(self, directory: Path, label: str):
        directory.mkdir(parents=True, exist_ok=True)
        self.started_at = datetime.now(timezone.utc).isoformat()
        safe_date = self.started_at.replace(":", "-").replace(".", "-").replace("+", "_")
        self.file = directory / f"{safe_date}_{label}.json"

    def save(self, data: dict) -> None:
        # ensure_ascii=False keeps accents readable ("Sebastián" instead of "Sebastián")
        self.file.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
