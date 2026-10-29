"""사용법: py -m hnl run <파일> | num <정수> | say <문자열>"""
import sys

from .core import HnlError, encode, run, say


def main(argv):
    if len(argv) == 3 and argv[1] == "run":
        with open(argv[2], encoding="utf-8") as f:
            source = f.read()
        try:
            run(source)
        except HnlError as e:
            print(f"에러: {e}", file=sys.stderr)
            return 1
        return 0
    if len(argv) == 3 and argv[1] == "num":
        print(encode(int(argv[2])))
        return 0
    if len(argv) == 3 and argv[1] == "say":
        sys.stdout.write(say(argv[2]))
        return 0
    print(__doc__, file=sys.stderr)
    return 2


def main_cli():
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")
    sys.exit(main(sys.argv))


if __name__ == "__main__":
    main_cli()
