import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import prepare_prefixes as pp

FIXTURES = REPO_ROOT / "tests" / "fixtures"


def decode(ids):
    return "".join(chr(token) for token in ids)


class FakeTokenizer:
    def encode(self, text):
        return [ord(char) for char in text]

    def decode(self, ids):
        return decode(ids)

    def get_vocab(self):
        return {chr(code): code for code in range(33, 129)}


class FilterTests(unittest.TestCase):
    def test_keeps_clean_text(self):
        ids = list(range(100, 164))
        self.assertIsNone(pp.filter_reason("testo normale senza dati personali", ids))

    def test_rejects_email(self):
        self.assertEqual(pp.filter_reason("scrivi a nome@example.com per info", list(range(100, 164))), "email")

    def test_rejects_url(self):
        self.assertEqual(pp.filter_reason("vedi https://example.com/page", list(range(100, 164))), "url")
        self.assertEqual(pp.filter_reason("vedi www.example.com/page", list(range(100, 164))), "url")

    def test_rejects_phone(self):
        self.assertEqual(pp.filter_reason("chiama +39 02 1234567", list(range(100, 164))), "telefono")

    def test_rejects_long_digit_run(self):
        self.assertEqual(pp.filter_reason("codice 1234567890 nel testo", list(range(100, 164))), "sequenza_di_cifre")

    def test_rejects_few_distinct_tokens(self):
        ids = [100] * 50 + list(range(101, 115))
        self.assertEqual(pp.filter_reason("testo ripetitivo", ids), "pochi_token_distinti")

    def test_apply_filters_counts_by_reason(self):
        rows = [
            {"text": "pulito", "ids": list(range(100, 164))},
            {"text": "mail a a@b.it", "ids": list(range(100, 164))},
            {"text": "url http://x.y", "ids": list(range(100, 164))},
            {"text": "ancora pulito", "ids": list(range(200, 264))},
        ]
        kept, rejected = pp.apply_filters(rows)
        self.assertEqual(len(kept), 2)
        self.assertEqual(rejected["email"], 1)
        self.assertEqual(rejected["url"], 1)


class SamplingTests(unittest.TestCase):
    def test_same_seed_same_split_is_identical(self):
        first = pp.sample_row_indices(1000, 10, 42, "duped.70m")
        second = pp.sample_row_indices(1000, 10, 42, "duped.70m")
        self.assertEqual(first, second)

    def test_different_split_differs(self):
        first = pp.sample_row_indices(1000, 10, 42, "duped.70m")
        second = pp.sample_row_indices(1000, 10, 42, "deduped.70m")
        self.assertNotEqual(first, second)

    def test_output_is_sorted(self):
        indices = pp.sample_row_indices(1000, 50, 7, "duped.70m")
        self.assertEqual(indices, sorted(indices))

    def test_too_few_rows_raises(self):
        with self.assertRaises(pp.PreparazioneError):
            pp.sample_row_indices(5, 10, 42, "duped.70m")


class EntryTests(unittest.TestCase):
    def test_memorized_entry_shape(self):
        tokenizer = FakeTokenizer()
        ids = list(range(65, 129))
        entry = pp.build_entry("m01", "memorized", "duped.70m", 12, ids, tokenizer)
        self.assertEqual(len(entry["prefix_ids"]), 32)
        self.assertEqual(len(entry["expected_ids"]), 32)
        self.assertEqual(entry["prefix_text"], decode(ids[:32]))
        self.assertEqual(entry["expected_text"], decode(ids[32:]))
        self.assertFalse(entry["reviewed"])
        self.assertEqual(entry["notes"], "")
        self.assertNotIn("reproduced_pytorch", entry)

    def test_control_entry_is_reviewed_and_has_no_source(self):
        tokenizer = FakeTokenizer()
        entry = pp.build_control_entries([{"id": "c01", "text": "a" * 70}], tokenizer)[0]
        self.assertEqual(entry["type"], "control")
        self.assertIsNone(entry["split"])
        self.assertIsNone(entry["index"])
        self.assertTrue(entry["reviewed"])
        self.assertEqual(len(entry["prefix_ids"]), 32)
        self.assertEqual(len(entry["expected_ids"]), 32)

    def test_short_control_raises(self):
        tokenizer = FakeTokenizer()
        with self.assertRaises(pp.PreparazioneError):
            pp.build_control_entries([{"id": "c01", "text": "a" * 20}], tokenizer)


class TokenizerCheckTests(unittest.TestCase):
    def test_equal_tokenizers_pass(self):
        tokenizer = FakeTokenizer()
        ids = list(range(65, 129))
        pp.check_tokenizers(tokenizer, FakeTokenizer(), [ids])

    def test_different_vocab_raises(self):
        class OtherVocab(FakeTokenizer):
            def get_vocab(self):
                return {}

        with self.assertRaises(pp.PreparazioneError):
            pp.check_tokenizers(FakeTokenizer(), OtherVocab(), [])


class ReproductionQuotaTests(unittest.TestCase):
    def test_below_threshold_prints_warning(self):
        entries = [{"reproduced_pytorch": True}, {"reproduced_pytorch": False}]
        reproduced, total = pp.check_reproduction_quota(entries)
        self.assertEqual((reproduced, total), (1, 2))


class FinalizeTests(unittest.TestCase):
    def load_fixture(self, name):
        with (FIXTURES / name).open(encoding="utf-8") as fh:
            return json.load(fh)

    def test_excludes_non_reviewed_entries(self):
        entries = self.load_fixture("candidates_mix.json")
        reviewed = pp.finalize_entries(entries, decode)
        self.assertEqual([e["id"] for e in reviewed], ["c01", "c03"])

    def test_tampered_ids_raise(self):
        entries = self.load_fixture("candidates_tampered_ids.json")
        with self.assertRaises(pp.PreparazioneError):
            pp.finalize_entries(entries, decode)

    def test_tampered_text_raises(self):
        entries = self.load_fixture("candidates_tampered_text.json")
        with self.assertRaises(pp.PreparazioneError):
            pp.finalize_entries(entries, decode)

    def test_write_json_is_deterministic(self):
        entries = self.load_fixture("candidates_mix.json")
        reviewed = pp.finalize_entries(entries, decode)
        with tempfile.TemporaryDirectory() as tmp:
            first = Path(tmp) / "a.json"
            second = Path(tmp) / "b.json"
            pp.write_json(first, reviewed)
            pp.write_json(second, reviewed)
            self.assertEqual(first.read_bytes(), second.read_bytes())

    def test_read_json_reports_missing_file(self):
        with self.assertRaises(pp.PreparazioneError):
            pp.read_json(FIXTURES / "inesistente.json")


class ControlsPipelineTests(unittest.TestCase):
    def test_controls_file_round_trip(self):
        tokenizer = FakeTokenizer()
        source = json.loads((FIXTURES / "controls_source.json").read_text(encoding="utf-8"))
        entries = pp.build_control_entries(source, tokenizer)
        self.assertEqual(len(entries), 2)
        self.assertEqual([e["id"] for e in entries], ["c01", "c02"])
        for entry in entries:
            self.assertEqual(entry["type"], "control")
            self.assertEqual(len(entry["prefix_ids"]) + len(entry["expected_ids"]), 64)

    def test_short_control_file_raises(self):
        tokenizer = FakeTokenizer()
        source = json.loads((FIXTURES / "controls_source_short.json").read_text(encoding="utf-8"))
        with self.assertRaises(pp.PreparazioneError):
            pp.build_control_entries(source, tokenizer)


class ControlPytorchTests(unittest.TestCase):
    def build_entries(self):
        tokenizer = FakeTokenizer()
        source = json.loads((FIXTURES / "controls_source.json").read_text(encoding="utf-8"))
        return pp.build_control_entries(source, tokenizer)

    def generate_exact(self, model, prefix_ids):
        return [97] * len(prefix_ids)

    def generate_different(self, model, prefix_ids):
        return [42] * len(prefix_ids)

    def test_exact_continuation_prints_warning(self):
        entries = self.build_entries()
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            pp.evaluate_controls(entries, {"duped": object()}, self.generate_exact)
        output = buffer.getvalue()
        self.assertIn("Attenzione", output)
        self.assertIn("c01", output)
        self.assertIn("duped", output)
        self.assertEqual(entries[0]["reproduced_pytorch"], {"duped": True})
        self.assertEqual(entries[0]["matching_tokens"], {"duped": 32})

    def test_different_continuation_prints_no_warning(self):
        entries = self.build_entries()
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            pp.evaluate_controls(entries, {"duped": object()}, self.generate_different)
        self.assertNotIn("Attenzione", buffer.getvalue())
        self.assertEqual(entries[0]["reproduced_pytorch"], {"duped": False})
        self.assertEqual(entries[0]["matching_tokens"], {"duped": 0})

    def test_both_models_are_recorded(self):
        entries = self.build_entries()[:1]
        models = {"duped": object(), "deduped": object()}
        pp.evaluate_controls(entries, models, self.generate_different)
        self.assertEqual(
            entries[0]["reproduced_pytorch"], {"duped": False, "deduped": False}
        )
        self.assertEqual(
            entries[0]["matching_tokens"], {"duped": 0, "deduped": 0}
        )

    def test_common_prefix_length(self):
        self.assertEqual(pp.common_prefix_length([1, 2, 3, 4], [1, 2, 9, 4]), 2)
        self.assertEqual(pp.common_prefix_length([1], [2]), 0)
        self.assertEqual(pp.common_prefix_length([], []), 0)

    def test_skip_pytorch_writes_file_without_models(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "controls.json"
            with mock.patch.object(pp, "load_tokenizer", return_value=FakeTokenizer()):
                code = pp.main([
                    "--controls", str(FIXTURES / "controls_source.json"),
                    "--controls-out", str(out),
                    "--skip-pytorch",
                ])
            self.assertEqual(code, 0)
            written = json.loads(out.read_text(encoding="utf-8"))
            self.assertEqual([e["id"] for e in written], ["c01", "c02"])
            for entry in written:
                self.assertNotIn("reproduced_pytorch", entry)
                self.assertNotIn("matching_tokens", entry)

    def test_parse_args_has_skip_pytorch_flag(self):
        args = pp.parse_args(["--controls", "x", "--skip-pytorch"])
        self.assertTrue(args.skip_pytorch)


class CliTests(unittest.TestCase):
    def test_finalize_on_fixture_mix(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "prefixes.json"
            code = pp.main([
                "--finalize",
                "--candidates", str(FIXTURES / "candidates_mix.json"),
                "--prefixes-out", str(out),
            ])
            self.assertEqual(code, 1)
            self.assertFalse(out.exists())

    def test_controls_requires_valid_source(self):
        code = pp.main([
            "--controls", str(FIXTURES / "controls_source.json"),
            "--controls-out", "/tmp/controls_test.json",
        ])
        self.assertEqual(code, 1)


if __name__ == "__main__":
    unittest.main()


class BuildRowsTests(unittest.TestCase):
    def dataset(self, count=10, length=64):
        return [{"index": 1000 + i, "tokens": list(range(100 + i, 100 + i + length))} for i in range(count)]

    def test_uses_dataset_index_and_tokens(self):
        rows = pp.build_rows(self.dataset(), "duped.70m", 3, 42, FakeTokenizer())
        self.assertEqual(len(rows), 3)
        for row in rows:
            self.assertGreaterEqual(row["index"], 1000)
            self.assertEqual(len(row["ids"]), 64)
            self.assertEqual(row["text"], decode(row["ids"]))

    def test_rows_pass_through_filters(self):
        rows = pp.build_rows(self.dataset(), "duped.70m", 5, 42, FakeTokenizer())
        kept, rejected = pp.apply_filters(rows)
        self.assertEqual(len(kept) + sum(rejected.values()), 5)

    def test_wrong_length_raises(self):
        with self.assertRaises(pp.PreparazioneError):
            pp.build_rows(self.dataset(length=63), "duped.70m", 2, 42, FakeTokenizer())


class FinalizeReproductionTests(unittest.TestCase):
    def test_reviewed_unreproduced_memorized_raises(self):
        ids = list(range(100, 164))
        entry = pp.build_entry("m01", "memorized", "duped.70m", 1, ids, FakeTokenizer(), reproduced=False)
        entry["reviewed"] = True
        with self.assertRaises(pp.PreparazioneError):
            pp.finalize_entries([entry], decode)

    def test_default_splits_are_both(self):
        args = pp.parse_args([])
        self.assertIsNone(args.split)
