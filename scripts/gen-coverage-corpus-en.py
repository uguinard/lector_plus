#!/usr/bin/env python3
"""Generate the build-time coverage corpus for `build-dictionary.ts --lang en`.

Writes scripts/coverage-corpus-en.txt: the top-N most frequent English tokens
(alpha-filtered), used by the builder's >=85% coverage gate as the "typical
English reading" proxy. English is supported by wordfreq natively, so this is
the whole frequency story for English.

    pip install wordfreq
    python scripts/gen-coverage-corpus-en.py [N]   # default N=5000
"""
import os
import re
import sys

import wordfreq

N = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
OUT = os.path.join(os.path.dirname(__file__), "coverage-corpus-en.txt")

words = [w for w in wordfreq.top_n_list("en", N) if re.match(r"^[a-z]+$", w)]
with open(OUT, "w") as f:
    f.write("# Build-time coverage corpus for build-dictionary.ts --lang en.\n")
    f.write(f"# Top-{N} wordfreq-en tokens, alpha-filtered to [a-z]+. One per line; '#' = comment.\n")
    f.write(f"# Regenerate: pip install wordfreq && python scripts/gen-coverage-corpus-en.py {N}\n")
    f.write("\n".join(words) + "\n")
print(f"wrote {len(words)} words to {OUT}")
