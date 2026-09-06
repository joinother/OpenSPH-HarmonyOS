OpenSPH https://github.com/pavelsevecek/OpenSPH
Commit: f3033faf4422a056dcb79cc6643c7c6f3d9fee19
MIT; see LICENSE.
Local adaptation: Vector.h selects sse2neon on ARM; sse2neon.h from existing HarmonyOS port, MIT header retained.
Core sources otherwise unmodified at import.
IRun.cpp: advance simulation time by the step actually integrated, not the next adaptive step. Regression in tests/engine_smoke.cpp verifies target duration within one maximum step.
