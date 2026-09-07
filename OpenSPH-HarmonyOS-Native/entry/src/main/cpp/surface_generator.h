#pragma once
#include "planet_texture.h"
#include <condition_variable>
#include <memory>
#include <mutex>
#include <thread>
#include <string>
namespace lab {
struct SurfaceKey {
 int style=0; uint32_t seed=0,cloudSeed=0;
 bool operator==(const SurfaceKey &b)const{return style==b.style&&seed==b.seed&&cloudSeed==b.cloudSeed;}
 bool operator!=(const SurfaceKey &b)const{return !(*this==b);}
 bool generated()const{return style>0&&style<5&&(seed||cloudSeed);}
};
struct GeneratedSurface {SurfaceKey key;PlanetTexture texture;};
struct SurfaceGeneration {SurfaceKey wanted;std::shared_ptr<const GeneratedSurface> result;bool pending=false;std::string error;};
// One worker, eight bounded slots. Only the current request may publish a result.
class SurfaceGenerator {
 std::mutex mutex;std::condition_variable wake;bool stop=false;
 std::array<SurfaceGeneration,8> slots{};std::array<uint64_t,8> epochs{};
 std::thread worker;
 void run();
public:
 SurfaceGenerator();~SurfaceGenerator();
 void request(int index,SurfaceKey key);
 SurfaceGeneration state(int index);
};
}
