import io
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import hnl  # noqa: E402


def run(source, stdin=""):
    out = io.StringIO()
    hnl.run(source, io.StringIO(stdin), out)
    return out.getvalue()


def example(name):
    return (ROOT / "examples" / name).read_text(encoding="utf-8")


class LiteralTests(unittest.TestCase):
    def test_roundtrip(self):
        for n in (0, 3, 14, 100, 65, 123456, -14, -7, -100):
            self.assertEqual(hnl.parse_literal(hnl.encode(n)), n)

    def test_known_encodings(self):
        self.assertEqual(hnl.encode(14), "티~원 티~~~~원")
        self.assertEqual(hnl.encode(-14), "지~랄 티~~~~원")
        self.assertEqual(hnl.encode(100), "티~원 티원 티원")

    def test_too_many_tildes(self):
        with self.assertRaises(hnl.HnlError):
            hnl.parse("요이\n티~~~~~~~~~~원\n넌 나가라")


class ExampleTests(unittest.TestCase):
    def test_countdown(self):
        self.assertEqual(run(example("countdown.hnl")), "3\n2\n1\n")

    def test_factorial(self):
        self.assertEqual(run(example("factorial.hnl"), "5"), "120\n")
        self.assertEqual(run(example("factorial.hnl"), "0"), "1\n")
        self.assertEqual(run(example("factorial.hnl"), "10"), "3628800\n")

    def test_hello(self):
        self.assertEqual(run(example("hello.hnl")), "Hello, World!\n")

    def test_sum(self):
        self.assertEqual(run(example("sum.hnl"), "20 22"), "42\n")


class OpTests(unittest.TestCase):
    def calc(self, a, b, op):
        src = f"요이\n{hnl.encode(a)}\n{hnl.encode(b)}\n{op}\n줴줴이야\n넌 나가라"
        return run(src)

    def test_arithmetic(self):
        self.assertEqual(self.calc(7, 3, "아~"), "10")
        self.assertEqual(self.calc(7, 3, "아~~"), "4")
        self.assertEqual(self.calc(7, 3, "아~~~~~"), "21")
        self.assertEqual(self.calc(7, 3, "아~~~~~~~"), "2")
        self.assertEqual(self.calc(7, 3, "아~~~~~~~~"), "1")
        self.assertEqual(self.calc(-7, 2, "아~~~~~~~"), "-3")
        self.assertEqual(self.calc(-7, 2, "아~~~~~~~~"), "-1")
        self.assertEqual(self.calc(3, 7, "아~~~~~~~~~"), "1")
        self.assertEqual(self.calc(7, 3, "아~~~~~~~~~"), "0")

    def test_stack_ops(self):
        def stack_out(op, prints):
            src = f"요이\n티~원\n티~~원\n{op}\n" + "줴줴이야\n" * prints + "넌 나가라"
            return run(src)
        self.assertEqual(stack_out("아~~~", 2), "12")  # swap: [2 1] → 1, 2
        self.assertEqual(stack_out("아~~~~~~", 1), "1")  # drop: [1]

    def test_over(self):
        src = "요이\n티~원\n티~~원\n아~~~~\n줴줴이야\n줴줴이야\n줴줴이야\n넌 나가라"
        self.assertEqual(run(src), "121")

    def test_input(self):
        src = "요이\n이지랄ㅋㅋ\n이지랄ㅋㅋ\n아~\n줴줴이야\n넌 나가라"
        self.assertEqual(run(src, "20 22"), "42")


class ErrorTests(unittest.TestCase):
    def assertFails(self, source):
        with self.assertRaises(hnl.HnlError):
            run(source)

    def test_missing_wrapper(self):
        self.assertFails("티~원\n줴줴이야")
        self.assertFails("요이\n티~원\n줴줴이야")

    def test_question_needs_answer(self):
        self.assertFails("요이\n티~원\n예?\n넌 나가라")

    def test_question_answered_by_question(self):
        self.assertFails("요이\n티~원\n예?\n예?\n줴줴이야\n넌 나가라")

    def test_empty_stack(self):
        self.assertFails("요이\n줴줴이야\n넌 나가라")

    def test_bad_jump(self):
        self.assertFails("요이\n아뇨아뇨아뇨 티~~~원\n넌 나가라")

    def test_divide_by_zero(self):
        self.assertFails("요이\n티~원\n티원\n아~~~~~~~\n넌 나가라")

    def test_infinite_loop_guard(self):
        with self.assertRaises(hnl.HnlError):
            hnl.run("요이\n아뇨아뇨아뇨 티~원\n넌 나가라", io.StringIO(""), io.StringIO(), max_steps=100)


if __name__ == "__main__":
    unittest.main()
