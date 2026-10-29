"""web/ 과 examples/ 를 dist/ 로 모아 GitHub Pages 에 올릴 사이트를 만든다.

로컬 미리보기:
    py scripts/build_site.py
    py -m http.server 8000 -d dist
"""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"


def main():
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(ROOT / "web", DIST)
    shutil.copytree(ROOT / "examples", DIST / "examples")
    (DIST / ".nojekyll").touch()
    print(f"built {DIST}")


if __name__ == "__main__":
    main()
