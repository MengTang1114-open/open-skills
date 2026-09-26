#!/usr/bin/env python3
"""Check this Skill bundle for accidental private files and obvious secrets."""

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = {
    ".gitignore",
    "LICENSE",
    "README.md",
    "SECURITY.md",
    "SKILL.md",
    "tests/behavior-cases.md",
    "tools/check_public_bundle.py",
    "references/character-lock.md",
    "references/checks.md",
    "references/storyboard-template.md",
    "references/style-catalog.md",
    "references/video-prompt-contract.md",
    "references/visual-semantics.md",
    "references/voiceover.md",
}
REQUIRED = ALLOWED
ALLOWED_DIRS = {"references", "tests", "tools"}
FORBIDDEN_TEXT = [
    re.compile("/" + "Users" + r"/[^/\s]+/"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
    re.compile(r"(?im)^\s*(?:VOLC_API_KEY|VOLC_APP_ID|VOLC_ACCESS_TOKEN|API_KEY|ACCESS_TOKEN|SECRET_KEY)\s*=\s*[^\s#]+"),
]


def main() -> int:
    errors = []
    found = set()
    for path in ROOT.rglob("*"):
        rel = path.relative_to(ROOT).as_posix()
        if rel == ".git" or rel.startswith(".git/"):
            continue  # Git history needs a separate scan before publication.
        if path.is_symlink():
            errors.append(f"symlink not allowed: {rel}")
            continue
        if path.is_dir():
            if rel not in ALLOWED_DIRS:
                errors.append(f"unexpected directory: {rel}")
            continue
        found.add(rel)
        if rel not in ALLOWED:
            errors.append(f"unexpected file: {rel}")
            continue
        try:
            data = path.read_text(encoding="utf-8")
        except (UnicodeError, OSError):
            errors.append(f"non-text or unreadable file: {rel}")
            continue
        if any(p.search(data) for p in FORBIDDEN_TEXT):
            errors.append(f"possible secret or local path: {rel}")

    for rel in sorted(REQUIRED - found):
        errors.append(f"missing file: {rel}")
    skill = ROOT / "SKILL.md"
    if skill.exists():
        body = skill.read_text(encoding="utf-8")
        for ref in re.findall(r"references/[a-z0-9-]+\.md", body):
            if not (ROOT / ref).is_file():
                errors.append(f"broken Skill reference: {ref}")

    for error in errors:
        print(error, file=sys.stderr)
    if errors:
        print(f"public bundle check: FAIL ({len(errors)} issue(s))", file=sys.stderr)
        return 1
    print(f"public bundle check: PASS ({len(found)} text files)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
