
from app.v1.core.celery_app import celery_app

def check_celery():
    # Check if any workers are active
    inspector = celery_app.control.inspect()
    active = inspector.active()
    
    if not active:
        print("CRITICAL: No active Celery workers found! Please start the worker.")
    else:
        print(f"ACTIVE WORKERS: {list(active.keys())}")
        
    # Check registered tasks
    registered = inspector.registered()
    if registered:
        for worker, tasks in registered.items():
            if "evaluate_candidate_transcript_task" in tasks:
                print(f"SUCCESS: Task is correctly registered on {worker}")
            else:
                print(f"ERROR: Task NOT found on {worker}. Check imports in celery_app.py")

if __name__ == "__main__":
    check_celery()
