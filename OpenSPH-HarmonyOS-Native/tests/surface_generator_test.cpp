#include "surface_generator.h"
#include <cassert>
#include <cmath>
#include <chrono>
#include <iostream>
using namespace lab;
int main(){
 for(int style=1;style<5;style++){
  auto a=makePlanetTexture(style,64,32,73,91),b=makePlanetTexture(style,64,32,74,91),c=makePlanetTexture(style,64,32,73,92);
  assert(a.surface!=b.surface&&a.clouds==b.clouds);assert(a.surface==c.surface&&a.clouds!=c.clouds);
  auto again=makePlanetTexture(style,64,32,73,91);assert(again.surface==a.surface&&again.clouds==a.clouds);
 }
 for(int style=1;style<5;style++)for(int j=0;j<31;j++){
  double lat=(j-15)*.1;auto a=planetTexel(style,-std::cos(lat),std::sin(lat),1e-10,731,919),b=planetTexel(style,-std::cos(lat),std::sin(lat),-1e-10,731,919);
  for(int c=0;c<3;c++)assert(std::isfinite(a.color[c])&&std::abs(a.color[c]-b.color[c])<1e-5);
  assert(std::abs(a.cloud-b.cloud)<1e-5);
 }
 int rows=0;auto cancelled=makePlanetTexture(1,64,32,1,2,[&]{return ++rows>3;});assert(cancelled.surface.empty()&&rows==4);
 SurfaceGenerator worker;worker.request(1,{1,1,2});worker.request(1,{1,999,888});worker.request(2,{3,75,76});worker.request(2,{});
 auto until=std::chrono::steady_clock::now()+std::chrono::seconds(10);
 while(worker.state(1).pending&&std::chrono::steady_clock::now()<until)std::this_thread::sleep_for(std::chrono::milliseconds(5));
 auto s=worker.state(1);assert(!s.pending&&s.error.empty()&&s.result&&s.result->key.seed==999&&s.result->key.cloudSeed==888);
 auto ref=makePlanetTexture(1,512,256,999,888);assert(s.result->texture.surface==ref.surface);assert(!worker.state(2).result&&!worker.state(2).pending);
 worker.request(1,{});assert(!worker.state(1).result);bool bad=false;try{worker.request(8,{});}catch(...){bad=true;}assert(bad);
 std::cout<<"PASS independent seeds, deterministic maps, row cancellation, latest request, bounded slots and legacy reset\n";
}
