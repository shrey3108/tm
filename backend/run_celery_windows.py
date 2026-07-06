import subprocess
import sys
import time
import signal

def main():
    print("Starting Celery Worker and Beat for Windows...")
    print("Press Ctrl+C to stop both processes cleanly.\n")
    
    # Define the commands
    worker_cmd = [
        sys.executable, "-m", "celery", 
        "-A", "app.v1.core.celery_app.celery_app", 
        "worker", 
        "--loglevel=info", 
        "--pool=solo"
    ]
    
    beat_cmd = [
        sys.executable, "-m", "celery", 
        "-A", "app.v1.core.celery_app.celery_app", 
        "beat", 
        "--loglevel=info"
    ]
    
    print(f"[Worker] {' '.join(worker_cmd)}")
    print(f"[Beat]   {' '.join(beat_cmd)}\n")
    
    # Launch both processes
    worker_process = subprocess.Popen(worker_cmd)
    
    # Wait a few seconds to let the worker initialize before starting beat
    time.sleep(3)
    beat_process = subprocess.Popen(beat_cmd)
    
    def signal_handler(sig, frame):
        print("\nReceived stop signal. Shutting down Celery processes...")
        beat_process.terminate()
        worker_process.terminate()
        beat_process.wait()
        worker_process.wait()
        print("Shutdown complete.")
        sys.exit(0)
        
    # Catch Ctrl+C to stop both gracefully
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Keep the main script alive while background processes run
        worker_process.wait()
        beat_process.wait()
    except KeyboardInterrupt:
        signal_handler(None, None)

if __name__ == "__main__":
    main()
