#!/usr/bin/env python3
"""Read-only checks for owned Markdown; no network or third-party rewrites."""
from pathlib import Path
from urllib.parse import unquote, urlsplit
import datetime
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
FILES = [ROOT / 'README.md', ROOT / 'AGENTS.md', *sorted((ROOT / 'docs').rglob('*.md'))]
workspace_index = ROOT.parent / 'README.md'
if workspace_index.is_file() and 'OpenSPH-HarmonyOS-Native/' in workspace_index.read_text():
    FILES.append(workspace_index)
errors = []
links_checked = 0

def fail(path, line, message):
    errors.append(f'{path.relative_to(ROOT.parent)}:{line}: {message}')

def prose_lines(source):
    fence = None
    for number, line in enumerate(source.splitlines(), 1):
        mark = re.match(r'^\s*(`{3,}|~{3,})', line)
        if mark:
            token = mark[1]
            if fence is None:
                fence = token
            elif token[0] == fence[0] and len(token) >= len(fence):
                fence = None
            continue
        if fence is None:
            yield number, line

def anchors(path):
    result = set()
    counts = {}
    for _, line in prose_lines(path.read_text(encoding='utf-8')):
        m = re.match(r'^#{1,6}\s+(.+?)(?:\s+#+)?$', line)
        if m:
            slug = re.sub(r'[^\w\-\s]', '', m[1].lower()).replace(' ', '-')
            n = counts.get(slug, 0)
            counts[slug] = n + 1
            result.add(slug + (f'-{n}' if n else ''))
    return result

for path in FILES:
    raw = path.read_bytes()
    source = raw.decode('utf-8')
    lines = source.splitlines()
    if b'\r' in raw or not raw.endswith(b'\n'):
        fail(path, 1, 'Use LF and a final newline')
    if '\n\n\n' in source:
        fail(path, 1, 'Repeated blank lines')
    fence = None
    for n, line in enumerate(lines, 1):
        if line != line.rstrip():
            fail(path, n, 'Trailing whitespace')
        if '\t' in line:
            fail(path, n, 'Tab character')
        m = re.match(r'^\s*(`{3,}|~{3,})(.*)$', line)
        if m:
            if fence is None:
                fence = m[1]
                if not m[2].strip():
                    fail(path, n, 'Code fence needs a language')
            elif m[1][0] == fence[0] and len(m[1]) >= len(fence):
                fence = None
    if fence:
        fail(path, len(lines), 'Unclosed code fence')
    prose = list(prose_lines(source))
    if sum(bool(re.match(r'^#\s', line)) for _, line in prose) != 1:
        fail(path, 1, 'Expected exactly one H1')
    for n, line in prose:
        if re.match(r'^#{1,6}\s', line):
            if n > 1 and lines[n-2].strip():
                fail(path, n, 'Blank line required before heading')
            if n < len(lines) and lines[n].strip():
                fail(path, n, 'Blank line required after heading')
        if re.match(r'^[-*+]\s|^\d+\.\s', line) and n > 1:
            prev = lines[n-2]
            if prev.strip() and not re.match(r'^[-*+]\s|^\d+\.\s|^\s{2,}', prev):
                fail(path, n, 'Blank line required before list')
        # Check inline Markdown links outside code spans/fences. URLs are not fetched.
        plain = re.sub(r'`+[^`]*`+', '', line)
        for m in re.finditer(r'!?\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)', plain):
            target = m[1].strip('<>')
            parts = urlsplit(target)
            if parts.scheme or parts.netloc:
                continue
            destination = (path.parent / unquote(parts.path)).resolve() if parts.path else path
            links_checked += 1
            if not destination.exists():
                fail(path, n, f'Broken link: {target}')
            elif parts.fragment and destination.suffix.lower() == '.md':
                if unquote(parts.fragment) not in anchors(destination):
                    fail(path, n, f'Unknown heading: {target}')
        # Validate explicitly labelled document dates, not historical log formats.
        for date in re.findall(r'(?:日期|时间)[：:]\s*(\d{4}-\d{2}-\d{2})', plain):
            try:
                datetime.date.fromisoformat(date)
            except ValueError:
                fail(path, n, f'Invalid metadata date: {date}')
        if re.search(r'(?:日期|时间)[：:]\s*\d{4}[/年.]', plain):
            fail(path, n, 'Metadata date must use YYYY-MM-DD')

version = re.search(r'"versionName"\s*:\s*"([^"]+)"', (ROOT / 'AppScope/app.json5').read_text())[1]
for path, key in [(ROOT/'README.md', '源码版本'), (ROOT/'docs/README.md', '源码版本'), (ROOT/'docs/CLI.md', '适用版本')]:
    match = re.search(key + r'：([0-9.]+)', path.read_text())
    if not match or match[1] != version:
        fail(path, 1, f'{key} must match AppScope/app.json5: {version}')
if workspace_index in FILES and f'当前源码为 **{version}**' not in workspace_index.read_text():
    fail(workspace_index, 1, 'Workspace version disagrees with app')
for path in (ROOT/'docs').iterdir():
    if path.is_file() and path.suffix in {'.json', '.csv', '.txt'}:
        fail(path, 1, 'Raw evidence belongs in docs/evidence/')

print(json.dumps({'ok': not errors, 'markdownFiles': len(FILES), 'localLinksChecked': links_checked,
                  'sourceVersion': version, 'errors': errors}, ensure_ascii=False, indent=2))
sys.exit(1 if errors else 0)
