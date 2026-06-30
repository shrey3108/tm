import asyncio
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Tuple
from urllib.parse import urlparse

import nest_asyncio

try:
    from gitingest import ingest_async
except ImportError:
    from gitingest.entrypoint import ingest_async

logger = logging.getLogger(__name__)

# Common regex patterns to search for credentials/secrets
SECRET_PATTERNS = [
    re.compile(
        r"(?:api_key|apikey|secret|password|passwd|private_key|token|auth_token|client_secret|db_password|aws_access_key_id|aws_secret_access_key)\s*[:=]\s*['\"]([a-zA-Z0-9_\-\.\:\/@\#\$%\^&\*\(\)\+]{8,})['\"]",
        re.IGNORECASE,
    ),
    re.compile(r"(glpat-[a-zA-Z0-9_\-]{20,})"),  # GitLab PAT
    re.compile(r"(sk-proj-[a-zA-Z0-9]{32,})"),  # OpenAI key
    re.compile(r"-----BEGIN (?:RSA|OPENSSH|EC|PGP) PRIVATE KEY-----"),
]


def ingest_safely_sync(source: str, **kwargs) -> Tuple[Any, Any, Any]:
    """Helper to run async GitIngest ingestion safely within a sync context."""
    if sys.platform == "win32":
        try:
            asyncio.set_event_loop_policy(
                asyncio.WindowsProactorEventLoopPolicy()
            )
        except Exception:
            pass

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    res = loop.run_until_complete(ingest_async(source, **kwargs))
    return res


class RepositoryService:
    """Service to clone, parse, analyze, and detect stack information for repositories."""

    @staticmethod
    def validate_url(url: str) -> bool:
        """Validate if the given string is a valid HTTP/HTTPS GitHub URL."""
        try:
            parsed = urlparse(url)
            if not parsed.hostname:
                return False
            hostname = parsed.hostname.lower()
            return (
                parsed.scheme in ("http", "https")
                and (hostname == "github.com" or hostname.endswith(".github.com"))
            )
        except Exception:
            return False

    @staticmethod
    def clone_repository(github_url: str, dest_dir: str) -> bool:
        """Perform a shallow clone of the target repository into the destination directory."""
        try:
            logger.info(f"Cloning {github_url} to {dest_dir}...")
            # Set GIT_TERMINAL_PROMPT=0 to prevent interactive hanging on private repos
            env = os.environ.copy()
            env["GIT_TERMINAL_PROMPT"] = "0"
            result = subprocess.run(
                [
                    "git",
                    "clone",
                    "--single-branch",
                    "--depth",
                    "1",
                    github_url,
                    dest_dir,
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env,
                timeout=300,
            )
            if result.returncode != 0:
                logger.error(
                    f"Git clone failed. Return code: {result.returncode}. Stderr: {result.stderr}"
                )
                return False
            return True
        except subprocess.TimeoutExpired:
            logger.error("Git clone timed out after 90 seconds.")
            return False
        except Exception as e:
            logger.error(f"Error during cloning: {e}")
            return False

    @staticmethod
    def detect_tech_stack(tree_str: str, content_str: str) -> Dict[str, List[str]]:
        """Programmatically parses tree and content to identify languages, frameworks, etc.

        Matches the reference implementation in the notebook.
        """
        stack = {
            "Languages": set(),
            "Frameworks & Libraries": set(),
            "Databases & Vector DBs": set(),
            "DevOps & Containers": set(),
            "Testing Frameworks": set(),
        }

        # Analyze tree / file extensions
        lines = tree_str.lower().split("\n")
        for line in lines:
            if ".py" in line:
                stack["Languages"].add("Python")
            if ".js" in line or ".jsx" in line:
                stack["Languages"].add("JavaScript")
            if ".ts" in line or ".tsx" in line:
                stack["Languages"].add("TypeScript")
            if ".go" in line:
                stack["Languages"].add("Go")
            if ".rs" in line:
                stack["Languages"].add("Rust")
            if ".java" in line:
                stack["Languages"].add("Java")
            if ".cpp" in line or ".cc" in line:
                stack["Languages"].add("C++")

            # DevOps / Containers
            if "dockerfile" in line:
                stack["DevOps & Containers"].add("Dockerfile")
            if "docker-compose" in line:
                stack["DevOps & Containers"].add("Docker Compose")
            if ".github/workflows" in line:
                stack["DevOps & Containers"].add("GitHub Actions")
            if ".gitlab-ci" in line:
                stack["DevOps & Containers"].add("GitLab CI/CD")

            # Testing
            if "pytest" in line or "test_" in line:
                stack["Testing Frameworks"].add("PyTest")
            if "jest.config" in line:
                stack["Testing Frameworks"].add("Jest")
            if "cypress" in line:
                stack["Testing Frameworks"].add("Cypress")
            if "playwright.config" in line:
                stack["Testing Frameworks"].add("Playwright")

        # Analyze content details
        content_lower = content_str.lower()

        # Frameworks
        if "fastapi" in content_lower:
            stack["Frameworks & Libraries"].add("FastAPI")
        if "django" in content_lower:
            stack["Frameworks & Libraries"].add("Django")
        if "flask" in content_lower:
            stack["Frameworks & Libraries"].add("Flask")
        if "streamlit" in content_lower:
            stack["Frameworks & Libraries"].add("Streamlit")
        if "next" in content_lower:
            stack["Frameworks & Libraries"].add("Next.js")
        if "react" in content_lower:
            stack["Frameworks & Libraries"].add("React")
        if "express" in content_lower:
            stack["Frameworks & Libraries"].add("Express")
        if "langchain" in content_lower:
            stack["Frameworks & Libraries"].add("LangChain")
        if "llama_index" in content_lower or "llamaindex" in content_lower:
            stack["Frameworks & Libraries"].add("LlamaIndex")

        # Databases
        if "faiss" in content_lower:
            stack["Databases & Vector DBs"].add("FAISS")
        if "chroma" in content_lower or "chromadb" in content_lower:
            stack["Databases & Vector DBs"].add("ChromaDB")
        if "pinecone" in content_lower:
            stack["Databases & Vector DBs"].add("Pinecone")
        if "postgresql" in content_lower or "postgres" in content_lower:
            stack["Databases & Vector DBs"].add("PostgreSQL")
        if "sqlite" in content_lower:
            stack["Databases & Vector DBs"].add("SQLite")
        if "mongodb" in content_lower:
            stack["Databases & Vector DBs"].add("MongoDB")

        # Testing
        if "pytest" in content_lower:
            stack["Testing Frameworks"].add("PyTest")
        if "import unittest" in content_lower or "from unittest" in content_lower:
            stack["Testing Frameworks"].add("Unittest")
        if "jest" in content_lower:
            stack["Testing Frameworks"].add("Jest")
        if "mocha" in content_lower:
            stack["Testing Frameworks"].add("Mocha")
        if "vitest" in content_lower:
            stack["Testing Frameworks"].add("Vitest")
        if "playwright" in content_lower:
            stack["Testing Frameworks"].add("Playwright")
        if "cypress" in content_lower:
            stack["Testing Frameworks"].add("Cypress")

        return {k: sorted(list(v)) for k, v in stack.items()}

    @staticmethod
    def prepare_evaluation_context(
        tree_str: str, content_str: str, filter_mode: str = None, lightweight: bool = False
    ) -> str:
        """Filters and formats repository context to fit within LLM prompt limits safely."""
        files = {}
        # Pattern to capture filename and content blocks from GitIngest concat format
        pattern = r"={5,}\n[Ff][Ii][Ll][Ee]: (.*?)\n={5,}\n(.*?)(?=\n={5,}\n[Ff][Ii][Ll][Ee]: |\Z)"
        matches = re.findall(pattern, content_str, re.DOTALL)

        for filename, file_content in matches:
            files[filename.strip()] = file_content.strip()

        # If it doesn't match GitIngest format, fall back to simple string concatenation
        if not files:
            if lightweight:
                return f"DIRECTORY TREE:\n{tree_str}\n"
            return f"DIRECTORY TREE:\n{tree_str}\n\nCODE CONTENT:\n{content_str}"

        # Auto-enable lightweight mode if the total content size is too large
        total_len = sum(len(f) for f in files.values())
        if total_len > 400000:
            lightweight = True

        # Filter files based on filter_mode
        if filter_mode in ("code", "logic"):
            filtered_files = {}
            for fname, fcontent in files.items():
                path = Path(fname.lower())
                
                # Exclude common directories that don't contain core logic/code, EXCEPT if it contains docs
                ignored_parts = {"assets", "public", "static", "node_modules", ".git", ".venv", "venv"}
                if any(part in path.parts for part in ignored_parts):
                    continue
                
                # Define source, docs, and config file matching
                is_source = path.suffix in [".py", ".js", ".jsx", ".ts", ".tsx", ".go", ".rs", ".java", ".cpp", ".cc", ".cs", ".c", ".h"]
                is_doc_ext = path.suffix in [".md", ".rst", ".txt"]
                is_in_docs_folder = any(part in path.parts for part in ["docs", "documentation"])
                is_binary = path.suffix in [".png", ".jpg", ".jpeg", ".gif", ".pdf", ".zip", ".tar", ".gz"]
                is_doc = (is_doc_ext or is_in_docs_folder) and not is_binary
                is_config = path.name.lower() in [
                    "requirements.txt",
                    "package.json",
                    "go.mod",
                    "cargo.toml",
                    "dockerfile",
                    "docker-compose.yml",
                    "pyproject.toml",
                ]
                
                if is_source or is_doc or is_config:
                    filtered_files[fname] = fcontent
            files = filtered_files
        elif filter_mode == "non_code":
            filtered_files = {}
            for fname, fcontent in files.items():
                path = Path(fname.lower())
                
                is_doc_ext = path.suffix in [".md", ".rst", ".txt"]
                is_in_docs_folder = any(part in path.parts for part in ["docs", "documentation"])
                is_binary = path.suffix in [".png", ".jpg", ".jpeg", ".gif", ".pdf", ".zip", ".tar", ".gz"]
                is_doc = (is_doc_ext or is_in_docs_folder) and not is_binary
                is_config = path.name.lower() in [
                    "requirements.txt",
                    "package.json",
                    "go.mod",
                    "cargo.toml",
                    "dockerfile",
                    "docker-compose.yml",
                    "pyproject.toml",
                ]
                
                if is_doc or is_config:
                    filtered_files[fname] = fcontent
            files = filtered_files

        # ----------------------------------------------------
        # Reconstruct output based on lightweight & filter_mode
        # ----------------------------------------------------
        if filter_mode in ("code", "logic"):
            if not lightweight:
                reconstructed_parts = []
                for fname, fcontent in files.items():
                    reconstructed_parts.append(
                        f"=========================================\n"
                        f"FILE: {fname}\n"
                        f"=========================================\n"
                        f"{fcontent}\n"
                    )
                reconstructed_content = "".join(reconstructed_parts)
                return f"DIRECTORY TREE:\n{tree_str}\n\nCODE CONTENT:\n{reconstructed_content}"
            else:
                context_parts = []
                context_parts.append(f"DIRECTORY TREE:\n{tree_str}\n")

                # Sort files to prioritize core logic over tests/fixtures/mocks/demos
                def file_priority(item):
                    fname, _ = item
                    fname_lower = fname.lower()
                    is_test_or_mock = any(p in fname_lower for p in ["test", "spec", "mock", "fixture", "demo"])
                    return 1 if is_test_or_mock else 0

                sorted_files = sorted(files.items(), key=file_priority)

                max_chars = 400000
                current_chars = len(context_parts[0])
                truncated_files = []

                for fname, fcontent in sorted_files:
                    if current_chars >= max_chars:
                        truncated_files.append(fname)
                        continue

                    lines = fcontent.split("\n")
                    snippet = "\n".join(lines[:150])
                    if len(lines) > 150:
                        snippet += "\n... [TRUNCATED CODE LINES] ..."

                    file_block = f"FILE (Snippet): {fname}\n{snippet}\n"

                    if current_chars + len(file_block) > max_chars:
                        available_space = max_chars - current_chars
                        if available_space > 200:
                            file_block = file_block[:available_space] + "\n... [TRUNCATED FOR SIZE LIMIT] ...\n"
                            context_parts.append(file_block)
                            current_chars += len(file_block)
                        truncated_files.append(fname)
                    else:
                        context_parts.append(file_block)
                        current_chars += len(file_block)

                if truncated_files:
                    truncation_summary = (
                        f"\n... [TRUNCATED {len(truncated_files)} FILES TO FIT WITHIN PROMPT LIMITS] ...\n"
                        f"Omitted files: {', '.join(truncated_files[:20])}"
                    )
                    if len(truncated_files) > 20:
                        truncation_summary += " and others."
                    context_parts.append(truncation_summary)

                return "\n".join(context_parts)

        elif filter_mode == "non_code":
            if not lightweight:
                reconstructed_parts = []
                for fname, fcontent in files.items():
                    reconstructed_parts.append(
                        f"=========================================\n"
                        f"FILE: {fname}\n"
                        f"=========================================\n"
                        f"{fcontent}\n"
                    )
                reconstructed_content = "".join(reconstructed_parts)
                return f"DIRECTORY TREE:\n{tree_str}\n\nCODE CONTENT:\n{reconstructed_content}"
            else:
                context_parts = []
                context_parts.append(f"DIRECTORY TREE:\n{tree_str}\n")
                readme_key = next((k for k in files if k.lower() == "readme.md"), None)
                if readme_key:
                    readme_content = files[readme_key]
                    if len(readme_content) > 2000:
                        readme_content = (
                            readme_content[:2000]
                            + "\n... [TRUNCATED FOR LENGTH] ..."
                        )
                    context_parts.append(f"FILE: {readme_key}\n{readme_content}\n")
                dep_files = [
                    "requirements.txt",
                    "package.json",
                    "go.mod",
                    "cargo.toml",
                    "dockerfile",
                    "docker-compose.yml",
                    "pyproject.toml",
                ]
                for dep_file in dep_files:
                    dep_key = next((k for k in files if k.lower() == dep_file), None)
                    if dep_key:
                        context_parts.append(f"FILE: {dep_key}\n{files[dep_key]}\n")
                return "\n".join(context_parts)

        else:
            # Default / no filter mode
            if not lightweight:
                reconstructed_parts = []
                for fname, fcontent in files.items():
                    reconstructed_parts.append(
                        f"=========================================\n"
                        f"FILE: {fname}\n"
                        f"=========================================\n"
                        f"{fcontent}\n"
                    )
                reconstructed_content = "".join(reconstructed_parts)
                return f"DIRECTORY TREE:\n{tree_str}\n\nCODE CONTENT:\n{reconstructed_content}"
            else:
                context_parts = []
                context_parts.append(f"DIRECTORY TREE:\n{tree_str}\n")

                # 1. README.md
                readme_key = next((k for k in files if k.lower() == "readme.md"), None)
                if readme_key:
                    readme_content = files[readme_key]
                    if len(readme_content) > 2000:
                        readme_content = (
                            readme_content[:2000]
                            + "\n... [TRUNCATED FOR LENGTH] ..."
                        )
                    context_parts.append(f"FILE: {readme_key}\n{readme_content}\n")

                # 2. Config / dependencies
                dep_files = [
                    "requirements.txt",
                    "package.json",
                    "go.mod",
                    "cargo.toml",
                    "dockerfile",
                    "docker-compose.yml",
                    "pyproject.toml",
                ]
                for dep_file in dep_files:
                    dep_key = next((k for k in files if k.lower() == dep_file), None)
                    if dep_key:
                        context_parts.append(f"FILE: {dep_key}\n{files[dep_key]}\n")

                # 3. Main entry code snippets
                entry_patterns = [
                    "app.py",
                    "main.py",
                    "index.js",
                    "server.js",
                    "index.ts",
                    "server.ts",
                    "run.py",
                ]
                for entry_pattern in entry_patterns:
                    entry_key = next((k for k in files if k.lower() == entry_pattern), None)
                    if entry_key:
                        lines = files[entry_key].split("\n")
                        snippet = "\n".join(lines[:60])
                        if len(lines) > 60:
                            snippet += "\n... [TRUNCATED CODE LINES] ..."
                        context_parts.append(f"FILE (Snippet): {entry_key}\n{snippet}\n")

                return "\n".join(context_parts)

    @staticmethod
    def scan_for_secrets(local_dir: str) -> List[Dict[str, Any]]:
        """Scans local files for plain-text hardcoded credentials or key files."""
        findings = []
        try:
            for root_dir, _, filenames in os.walk(local_dir):
                # Skip common dependency, build, virtual environment, VCS, test, and doc directories
                parts = Path(root_dir).parts
                ignored_dirs = {
                    ".git", ".venv", "venv", "env", "node_modules", "__pycache__", 
                    ".pytest_cache", ".mypy_cache", "seed", "seeds", 
                    "test", "tests", "doc", "docs", "example", "examples"
                }
                if any(ignored in parts for ignored in ignored_dirs):
                    continue
                for filename in filenames:
                    file_path = Path(root_dir) / filename
                    # Skip common binaries/images and documentation/markdown files
                    if file_path.suffix.lower() in (
                        ".png",
                        ".jpg",
                        ".jpeg",
                        ".gif",
                        ".ico",
                        ".pdf",
                        ".zip",
                        ".gz",
                        ".md",
                        ".txt",
                        ".rst",
                        ".html",
                    ):
                        continue
                    
                    try:
                        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                            for idx, line in enumerate(f, start=1):
                                for pattern in SECRET_PATTERNS:
                                    match = pattern.search(line)
                                    if match:
                                        # If it is the generic keyword pattern, ignore if it is a comment line
                                        if pattern == SECRET_PATTERNS[0]:
                                            stripped = line.strip()
                                            if (
                                                stripped.startswith("//")
                                                or stripped.startswith("*")
                                                or stripped.startswith("/*")
                                                or stripped.endswith("*/")
                                                or stripped.startswith("#")
                                            ):
                                                continue

                                        # Skip common placeholder/test values to avoid false positives
                                        secret_val = match.group(1) if len(match.groups()) >= 1 else match.group(0)
                                        secret_val_clean = secret_val.lower().strip("'\" ")
                                        placeholders = {
                                            "your_api_key", "your_key", "your_token", "your_secret", "your-api-key", "your-key", "your-token", "your-secret",
                                            "mock_key", "mock_token", "mock_secret", "mock-key", "mock-token", "mock-secret", "mock", "dummy", "placeholder",
                                            "example", "example_key", "example-key", "my_api_key", "my_key", "my_secret", "my-key", "my-secret", "mysecret",
                                            "test_key", "test_token", "test-key", "test-token", "test_secret", "test-secret", "test", "password", "db_password",
                                            "secret", "passwd", "token", "auth_token", "client_secret", "aws_access_key_id", "aws_secret_access_key", "api_key", "apikey"
                                        }
                                        if any(p in secret_val_clean for p in placeholders):
                                            continue

                                        rel_path = os.path.relpath(
                                            file_path, local_dir
                                        )
                                        # Mask secret value in findings
                                        secret_found = match.group(0)
                                        masked = secret_found[:12] + "..." + secret_found[-4:] if len(secret_found) > 16 else "..."
                                        findings.append(
                                            {
                                                "file": rel_path,
                                                "line": idx,
                                                "finding": f"Possible credentials found (masked: {masked})",
                                                "severity": "CRITICAL",
                                            }
                                        )
                    except Exception as e:
                        logger.error(
                            f"Error reading file {file_path} for secret scan: {e}"
                        )
        except Exception as e:
            logger.error(f"Error during secrets scanning: {e}")
        return findings

    @staticmethod
    def run_bandit_scan(local_dir: str) -> List[Dict[str, Any]]:
        """Runs Bandit scan on Python files inside the local directory."""
        findings = []
        try:
            # Check if there are any Python files first
            has_py = False
            for root_dir, _, filenames in os.walk(local_dir):
                parts = Path(root_dir).parts
                ignored_dirs = {".git", ".venv", "venv", "env", "node_modules", "__pycache__", ".pytest_cache", ".mypy_cache", "seed", "seeds"}
                if any(ignored in parts for ignored in ignored_dirs):
                    continue
                if any(f.endswith(".py") for f in filenames):
                    has_py = True
                    break

            if not has_py:
                return []

            # Execute bandit programmatically
            result = subprocess.run(
                ["bandit", "-r", local_dir, "-f", "json"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=60,
            )
            
            # Bandit returns exit code 1 if issues are found, which is normal.
            if result.stdout:
                try:
                    data = json.loads(result.stdout)
                    results = data.get("results", [])
                    for item in results:
                        severity = item.get("issue_severity", "MEDIUM")
                        findings.append(
                            {
                                "file": os.path.relpath(
                                    item.get("filename", ""), local_dir
                                ),
                                "line": item.get("line_number"),
                                "finding": f"[{item.get('test_id')}] {item.get('issue_text')}",
                                "severity": severity,
                            }
                        )
                except Exception as e:
                    logger.error(f"Failed to parse Bandit JSON output: {e}")
        except FileNotFoundError:
            # Bandit not installed or not in path
            logger.warning("Bandit is not installed in the path. Skipping Bandit scan.")
        except Exception as e:
            logger.error(f"Error executing Bandit scan: {e}")
        return findings
