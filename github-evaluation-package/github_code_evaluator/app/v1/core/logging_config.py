import logging
from pathlib import Path

def setup_logging():
    """Configures the root logger to output to logs/app.log as well as the console."""
    log_dir = Path("logs")
    try:
        log_dir.mkdir(exist_ok=True)
    except Exception:
        # Fallback to local directory if logs directory creation fails
        log_dir = Path(".")
        
    log_file = log_dir / "app.log"
    
    root_logger = logging.getLogger()
    
    # Avoid adding multiple FileHandlers if setup is called multiple times
    has_file_handler = any(isinstance(h, logging.FileHandler) for h in root_logger.handlers)
    if not has_file_handler:
        try:
            file_handler = logging.FileHandler(log_file, mode="a", encoding="utf-8")
            formatter = logging.Formatter(
                "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
            )
            file_handler.setFormatter(formatter)
            file_handler.setLevel(logging.INFO)
            root_logger.addHandler(file_handler)
            
            # Ensure root logger level is at least INFO to capture info logs
            if root_logger.level == logging.NOTSET or root_logger.level > logging.INFO:
                root_logger.setLevel(logging.INFO)
                
            # Suppress extremely verbose change detection logs from watchfiles
            logging.getLogger("watchfiles").setLevel(logging.WARNING)
        except Exception as e:
            # Fallback console log if file logging setup fails
            print(f"Failed to setup file logging handler: {e}")

