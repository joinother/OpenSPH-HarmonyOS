#pragma once
#include <cstdint>
#include <stdexcept>
#include <vector>
namespace lab {
// One immutable, north-first RGBA map, retained for context recreation.
struct MoonMap {
 std::vector<uint8_t> rgba;
 MoonMap(int width,int height,const uint8_t* bytes,size_t length){
  if(width!=2048||height!=1024||!bytes||length!=8388608)throw std::invalid_argument("Expected 2048x1024 RGBA Moon map");
  rgba.assign(bytes,bytes+length);
 }
};
}
