import logging
import sys

def setup_logger(log_file: str = "birdnet_sync.log"):
    logger = logging.getLogger("birdnet_sync")
    logger.setLevel(logging.INFO)

    formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] %(message)s", "%Y-%m-%d %H:%M:%S")

    # Console output
    c_handler = logging.StreamHandler(sys.stdout)
    c_handler.setFormatter(formatter)
    logger.addHandler(c_handler)

    # File output
    f_handler = logging.FileHandler(log_file, encoding="utf-8")
    f_handler.setFormatter(formatter)
    logger.addHandler(f_handler)

    return logger
