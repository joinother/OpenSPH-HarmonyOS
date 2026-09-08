#include "engine.h"
#include <chrono>
#include <thread>
#include <iostream>
#include <fstream>
#include <cstring>
using namespace lab;
void check(bool b,const char* name){if(!b)throw std::runtime_error(name);}
void wait(Engine& e,const char* state){for(int i=0;i<3000;i++){auto s=e.status();if(s.state==state)return;if(s.state=="failed")throw std::runtime_error(s.error);std::this_thread::sleep_for(std::chrono::milliseconds(5));}throw std::runtime_error("wait timeout");}
std::string read(const std::string& file){std::ifstream f(file,std::ios::binary);return {std::istreambuf_iterator<char>(f),{}};}
void write(const std::string& file,const std::string& bytes){std::ofstream f(file,std::ios::binary);f.write(bytes.data(),bytes.size());}
int main(int argc,char**argv){try{
 check(argc==2,"directory required");const std::string dir=argv[1],file=dir+"/last-replay.osphr";Engine e;Config c;c.preset=6;c.count=201;c.speed=1;c.angle=25;c.duration=50;c.galaxyMassRatio=.6;
 check(validConfig(c),"valid galaxy");auto bad=c;bad.selfGravity=true;check(!validConfig(bad),"reject rock gravity");bad=c;bad.duration=801;check(!validConfig(bad),"reject duration");bad=c;bad.galaxyMassRatio=NAN;check(!validConfig(bad),"reject nan");
 e.start(c,true);wait(e,"paused");check(e.status().time==0&&e.status().count==201&&e.status().galaxy.available,"paused initial identity");check(!e.frame()->orbital&&!e.frame()->sph.available,"model separation");
 e.pause(false);wait(e,"completed");check(e.status().time==50&&e.status().frames==14,"duration and frame cadence");auto f=*e.frame();check(e.saveReplay(dir),"save");const auto bytes=read(file);uint32_t version;std::memcpy(&version,bytes.data()+4,4);check(version==12,"v12");check(e.loadReplay(dir),"load");e.seek(-1);auto replay=*e.frame();check(replay.galaxy.values==f.galaxy.values&&replay.energyError==f.energyError&&replay.angularError==f.angularError&&replay.time==f.time,"diagnostic roundtrip");check(replay.particles.size()==f.particles.size()&&std::memcmp(replay.particles.data(),f.particles.data(),f.particles.size()*sizeof(Particle))==0,"particle roundtrip");check(e.saveReplay(dir)&&read(file)==bytes,"byte exact v12");
 auto reject=[&](std::string damaged){write(file,damaged);const auto revision=e.sceneRevision();check(!e.loadReplay(dir),"invalid replay rejected");check(e.sceneRevision()==revision&&e.frame()->time==50,"load failure atomic");};
 auto damaged=bytes;damaged.resize(damaged.size()-1);reject(damaged);damaged=bytes;uint32_t old=3;std::memcpy(&damaged[4],&old,4);reject(damaged);damaged=bytes;double invalid=.1;std::memcpy(&damaged[108],&invalid,8);reject(damaged);damaged=bytes;invalid=NAN;const size_t firstDiag=132+4+32+48+201*sizeof(Particle);std::memcpy(&damaged[firstDiag],&invalid,8);reject(damaged);write(file,bytes);
 e.seek(0);check(e.status().time==0,"seek initial");e.start(c,true);wait(e,"paused");e.cancel();check(e.status().state=="cancelled","cancel paused");Config orbit;orbit.preset=3;orbit.speed=1;orbit.duration=1;e.start(orbit,true);wait(e,"paused");check(!e.status().galaxy.available&&e.frame()->orbital,"replace by orbit clears galaxy");e.pause(false);wait(e,"completed");check(e.saveReplay(dir)&&e.loadReplay(dir),"legacy orbit replay");
 std::cout<<"PASS galaxy engine: initial pause, 50 Myr cadence, odd count, v12 exact roundtrip, malformed atomic rejection, seek/cancel/replacement and legacy orbit\n";
 return 0;
 }catch(const std::exception& e){std::cerr<<"FAIL "<<e.what()<<"\n";return 1;}}
