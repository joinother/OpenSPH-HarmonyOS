#pragma once
#include <array>
#include <cstdint>
#include <vector>
namespace lab {
struct SkyStar { float x,y,z,brightness,r,g,b; };
struct SkyData { int width=1024,height=512; std::vector<uint8_t> haze; std::vector<SkyStar> stars; };
// Original illustrative sky, not an observed catalogue or IAU coordinate frame.
std::array<float,3> skyHaze(float x,float y,float z);
SkyData makeSkyData();
}
