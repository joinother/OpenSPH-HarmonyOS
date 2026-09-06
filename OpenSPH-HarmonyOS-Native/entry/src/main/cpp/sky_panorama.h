#pragma once
#include <cstdint>
#include <stdexcept>
#include <vector>
namespace lab {
// Bounded RGBA handoff. Immutable after publication; retained for EGL recreation.
struct SkyPanorama {
    int width, height;
    std::vector<uint8_t> rgba;
    SkyPanorama(int w,int h,const uint8_t* bytes,size_t length):width(w),height(h) {
        if(w!=2048 || h!=1024 || !bytes || length!=size_t(w)*h*4)
            throw std::invalid_argument("Expected 2048x1024 RGBA sky panorama");
        rgba.assign(bytes,bytes+length);
    }
};
}
