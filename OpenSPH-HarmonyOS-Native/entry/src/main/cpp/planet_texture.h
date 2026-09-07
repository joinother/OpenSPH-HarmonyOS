#pragma once
#include <array>
#include <cstdint>
#include <vector>
#include <functional>
namespace lab {
struct PlanetTexel { std::array<float,3> color; float ocean, cloud; };
struct PlanetTexture { int width, height; std::vector<uint8_t> surface, clouds; };
// Original deterministic art, sampled in 3D on a unit sphere (no longitude seam).
PlanetTexel planetTexel(int style, double x, double y, double z, uint32_t seed=0, uint32_t cloudSeed=0);
PlanetTexture makePlanetTexture(int style, int width=1024, int height=512, uint32_t seed=0, uint32_t cloudSeed=0, const std::function<bool()> &cancel={});
const std::array<PlanetTexture,5> &planetTextures();
}
