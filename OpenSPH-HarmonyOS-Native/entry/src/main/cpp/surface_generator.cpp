#include "surface_generator.h"
#include <stdexcept>
namespace lab {
SurfaceGenerator::SurfaceGenerator():worker([this]{run();}){}
SurfaceGenerator::~SurfaceGenerator(){{std::lock_guard<std::mutex> lock(mutex);stop=true;}wake.notify_all();worker.join();}
void SurfaceGenerator::request(int i,SurfaceKey key){
 if(i<0||i>=8||key.style<0||key.style>5||key.seed>1000000||key.cloudSeed>1000000)throw std::invalid_argument("Invalid surface request");
 std::lock_guard<std::mutex> lock(mutex);auto &s=slots[i];if(s.wanted==key)return;
 s.wanted=key;++epochs[i];s.error.clear();s.pending=key.generated();
 if(!s.pending)s.result.reset();wake.notify_one();
}
SurfaceGeneration SurfaceGenerator::state(int i){std::lock_guard<std::mutex> lock(mutex);return slots.at(i);}
void SurfaceGenerator::run(){
 for(;;){
  int i=0;uint64_t epoch;SurfaceKey key;
  {std::unique_lock<std::mutex> lock(mutex);wake.wait(lock,[&]{if(stop)return true;for(auto &s:slots)if(s.pending)return true;return false;});if(stop)return;
   while(i<8&&!slots[i].pending)++i;epoch=epochs[i];key=slots[i].wanted;}
  auto cancelled=[&]{std::lock_guard<std::mutex> lock(mutex);return stop||epochs[i]!=epoch;};
  std::shared_ptr<GeneratedSurface> result;std::string error;
  try{result=std::make_shared<GeneratedSurface>();result->key=key;result->texture=makePlanetTexture(key.style,512,256,key.seed,key.cloudSeed,cancelled);}
  catch(const std::exception &e){error=e.what();}
  {std::lock_guard<std::mutex> lock(mutex);if(stop)return;if(epochs[i]!=epoch)continue;
   slots[i].pending=false;slots[i].error=error;if(result&&!result->texture.surface.empty())slots[i].result=result;}
 }
}
}
