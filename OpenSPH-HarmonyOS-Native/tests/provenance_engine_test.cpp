#include "engine.h"
#include "impact_plan.h"
#include <chrono>
#include <cstring>
#include <fstream>
#include <functional>
#include <iostream>
#include <thread>
using namespace lab;
void require(bool b,const char* s){if(!b)throw std::runtime_error(s);}
Status wait(Engine& e,const std::function<bool(Status)>& done){for(int i=0;i<24000;i++){auto s=e.status();if(s.state=="failed")throw std::runtime_error(s.error);if(done(s))return s;std::this_thread::sleep_for(std::chrono::milliseconds(5));}throw std::runtime_error("timeout");}
uint32_t u32(const std::string& bytes,size_t at){require(at+4<=bytes.size(),"parser overrun");uint32_t n;std::memcpy(&n,bytes.data()+at,4);return n;}
int main(int argc,char** argv){try{
 require(argc==2,"directory required");std::string path=std::string(argv[1])+"/last-replay.osphr";auto write=[&](const std::string& b){std::ofstream out(path,std::ios::binary|std::ios::trunc);out.write(b.data(),b.size());};
 const double mass=4*3.141592653589793/3*1e15*2700/SOLAR_MASS;
 for(int mode=0;mode<4;mode++){
  Config c;c.count=200;c.duration=2;c.speed=8;c.selfGravity=true;
  if(mode==3){c.preset=2;c.speed=0;}
  if(mode==1||mode==2){auto& hit=c.impactContact;hit={1,1,2,0,8000*YEAR/AU};hit.hasIncoming=true;hit.incoming={OrbitBody{mass,{.02,-80000/AU,0},{0,4000*YEAR/AU,0},100000/AU},OrbitBody{mass*.216,{.02,80000/AU,0},{0,-4000*YEAR/AU,0},60000/AU}};hit.world={{1,{0,0,0},{0,0,0},695700000/AU},hit.incoming[0],hit.incoming[1]};c.impactTides=mode==2;}
  Engine e;e.start(c,true);wait(e,[](Status s){return s.state=="paused"&&s.frames>0;});const auto initial=e.frame()->origins;const auto budget=measureFragmentOrigins(e.frame()->fragments,initial,e.frame()->totalMass);
  e.pause(false);const auto done=wait(e,[](Status s){return s.state=="completed";});const auto final=*e.frame();require(initial.size()==final.origins.size(),"particle count changed");
  for(size_t i=0;i<initial.size();i++)require(initial[i].massKg==final.origins[i].massKg&&initial[i].source==final.origins[i].source&&final.particles[i].body==float(initial[i].source),"evolution changed identity or source mass");
  const auto expected=measureFragmentOrigins(final.fragments,final.origins,final.totalMass);require(expected.totals==budget.totals,"source total drift");if(mode==3)require(expected.totals[1]==0,"single body fabricated impactor");
  require(e.saveReplay(argv[1]),"v20 save failed");std::ifstream in(path,std::ios::binary);const std::string bytes((std::istreambuf_iterator<char>(in)),{});require(u32(bytes,4)==20&&u32(bytes,8)==uint32_t(mode==1?17:mode==2?19:15),"wrong wrapper/base version");
  require(e.loadReplay(argv[1]),"v20 load failed");e.seek(done.frames-1);auto loaded=e.frame();require(measureFragmentOrigins(loaded->fragments,loaded->origins,loaded->totalMass).groups==expected.groups,"v20 group sources changed");require(e.status().tidalPotentialJ==done.tidalPotentialJ,"lost tide budget");
  const auto source=e.fragmentFrame();require(source.orbitalSources==(mode==1||mode==2),"source namespace");if(source.orbitalSources)require(source.sourceBodyIds==std::array<int,2>{1,2},"lost original world IDs");
  require(e.saveReplay(argv[1]),"v20 resave failed");std::ifstream again(path,std::ios::binary);require(std::string((std::istreambuf_iterator<char>(again)),{})==bytes,"v20 not byte-exact");
  size_t at=140;if(mode==1||mode==2)at+=156;if(mode==2)at+=4+64*u32(bytes,at);std::vector<size_t> offsets;
  for(uint32_t frame=0;frame<u32(bytes,12);frame++){const auto count=u32(bytes,at);at+=84+count*sizeof(Particle)+80+count*sizeof(SphScalar)+32;const auto groups=u32(bytes,at);at+=4+count*4+groups*72+32+(mode==2?8:0);offsets.push_back(at);at+=count*12;}require(at==bytes.size()&&!offsets.empty(),"v20 layout mismatch");
  for(int variant=0;variant<7;variant++){auto bad=bytes;const size_t offset=offsets[0];if(variant==0){double n=NAN;std::memcpy(&bad[offset],&n,8);}if(variant==1){uint32_t n=2;std::memcpy(&bad[offset+8],&n,4);}if(variant==2){uint32_t n=1;std::memcpy(&bad[offset+8],&n,4);}if(variant==3)bad.resize(bytes.size()-1);if(variant==4)bad+='x';if(variant==5){double a,b;std::memcpy(&a,bad.data()+offset,8);std::memcpy(&b,bad.data()+offset+12,8);const double delta=a*.01;a+=delta;b-=delta;std::memcpy(&bad[offset],&a,8);std::memcpy(&bad[offset+12],&b,8);}if(variant==6){uint32_t n=20;std::memcpy(&bad[8],&n,4);}write(bad);const auto revision=e.sceneRevision();require(!e.loadReplay(argv[1])&&e.sceneRevision()==revision,"corrupt provenance changed scene");}
  require(e.saveReplay(argv[1],true,false)&&e.loadReplay(argv[1]),"legacy fixture failed");require(e.frame()->origins.empty(),"legacy invented particle masses");require(e.saveReplay(argv[1]),"legacy resave");std::ifstream old(path,std::ios::binary);std::string oldBytes((std::istreambuf_iterator<char>(old)),{});require(u32(oldBytes,4)!=20,"legacy fabricated provenance version");
  std::cout<<"PASS provenance mode="<<mode<<" particles="<<final.particles.size()<<" frames="<<done.frames<<": constant source mass, v20 exact replay, source IDs, seven transactional corrupt rejections, legacy unknown preserved\n";e.cancel();
 }
}catch(const std::exception& e){std::cerr<<"FAIL "<<e.what()<<'\n';return 1;}}
