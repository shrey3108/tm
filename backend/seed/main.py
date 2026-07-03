import asyncio
import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from seed.seed import main as seed_main
from seed.seed_for_user import main as seed_for_user_main
from seed.seed_skills import main as seed_skills_main
from seed.seed_stages import main as seed_stages_main
from seed.seed_system_settings import seed_system_settings as seed_system_settings_main
from seed.seed_priorities import main as seed_priorities_main
from seed.seed_positions import main as seed_positions_main
from seed.seed_guidelines import main as seed_guidelines_main
from seed.seed_criteria import seed as seed_criteria_main
from seed.seed_job import main as seed_job_main
from seed.seed_new_job import main as seed_new_job_main
from seed.seed_frontend_dev import main as seed_frontend_dev_main

SEED_STEPS = [
    ("seed.py", seed_main),
    ("seed_for_user.py", seed_for_user_main),
    ("seed_skills.py", seed_skills_main),
    ("seed_stages.py", seed_stages_main),
    ("seed_system_settings.py", seed_system_settings_main),
    ("seed_priorities.py", seed_priorities_main),
    ("seed_positions.py", seed_positions_main),
    ("seed_guidelines.py", seed_guidelines_main),
    ("seed_criteria.py", seed_criteria_main),
    ("seed_job.py", seed_job_main),
    ("seed_new_job.py", seed_new_job_main),
    ("seed_frontend_dev.py", seed_frontend_dev_main),
]



async def main() -> None:
    for name, runner in SEED_STEPS:
        print(f"Running {name}...")
        await runner()

    print("All seed scripts completed successfully.")


def run() -> None:
    asyncio.run(main())


if __name__ == "__main__":
    run()

