"""Configuration and environment loader for Sawal.

Loads root .env using python-dotenv with override=False so system/shell
variables are respected. Path is derived relative to this file to work
regardless of current working directory.
"""

from pathlib import Path
import os

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

# Root directory of the repository (parent of core/)
ROOT_DIR = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT_DIR / ".env"


def load_environment() -> bool:
    """
    Load root .env file without overriding existing environment variables.
    Returns True if .env existed and was loaded, False otherwise.
    """
    if load_dotenv is not None and ENV_FILE.is_file():
        load_dotenv(dotenv_path=ENV_FILE, override=False)
        return True
    return False


# Automatically load on module import
load_environment()
