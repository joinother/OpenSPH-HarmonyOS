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
 e.pause(false);wait(e,"completed");check(e.status().time==50&&e.status().frames==14,"duration and frame cadence");auto observation=e.galaxyObservation();check(observation.available&&observation.samples.size()==14&&observation.config.galaxyOffsetKpc==c.galaxyOffsetKpc,"coherent observation identity");
 for(size_t i=0;i<observation.samples.size();i++){e.seek(int(i));auto f=e.frame();const auto& row=observation.samples[i];check(row.frame==int(i)&&row.time==f->time&&row.values==f->galaxy.values&&row.energyError==f->energyError&&row.angularError==f->angularError,"every observation matches frame");}
 e.seekGalaxyObservation(2,observation.sceneRevision,8);check(e.status().time==8,"seek observed sample");
 bool rejected=false;try{e.seekGalaxyObservation(2,observation.sceneRevision+1,8);}catch(...){rejected=true;}check(rejected&&e.status().time==8,"stale seek atomic");
 e.seek(-1);auto f=*e.frame();check(e.saveReplay(dir),"save");const auto bytes=read(file);uint32_t version;std::memcpy(&version,bytes.data()+4,4);check(version==12,"v12");check(e.loadReplay(dir),"load");e.seek(-1);auto loaded=e.galaxyObservation();check(loaded.available&&loaded.samples.size()==observation.samples.size(),"replay observation size");for(size_t i=0;i<loaded.samples.size();i++)check(loaded.samples[i].values==observation.samples[i].values&&loaded.samples[i].time==observation.samples[i].time,"replay observations exact");auto replay=*e.frame();check(replay.galaxy.values==f.galaxy.values&&replay.energyError==f.energyError&&replay.angularError==f.angularError&&replay.time==f.time,"diagnostic roundtrip");check(replay.particles.size()==f.particles.size()&&std::memcmp(replay.particles.data(),f.particles.data(),f.particles.size()*sizeof(Particle))==0,"particle roundtrip");check(e.saveReplay(dir)&&read(file)==bytes,"byte exact v12");
 auto reject=[&](std::string damaged){write(file,damaged);const auto revision=e.sceneRevision();check(!e.loadReplay(dir),"invalid replay rejected");check(e.sceneRevision()==revision&&e.frame()->time==50,"load failure atomic");};
 auto damaged=bytes;damaged.resize(damaged.size()-1);reject(damaged);damaged=bytes;uint32_t old=3;std::memcpy(&damaged[4],&old,4);reject(damaged);damaged=bytes;double invalid=.1;std::memcpy(&damaged[108],&invalid,8);reject(damaged);damaged=bytes;invalid=NAN;const size_t firstDiag=132+4+32+48+201*sizeof(Particle);std::memcpy(&damaged[firstDiag],&invalid,8);reject(damaged);write(file,bytes);
 // New model has its own replay version and whole-system error scope.
 c.galaxyResponsive=true;c.count=201;e.start(c,true);wait(e,"paused");e.pause(false);wait(e,"completed");auto live=*e.frame();
 check(e.status().config.galaxyResponsive&&live.galaxy.available,"live applied config");check(e.saveReplay(dir),"save responsive");const auto liveBytes=read(file);std::memcpy(&version,liveBytes.data()+4,4);check(version==13,"v13 model identity");
 check(e.loadReplay(dir),"load responsive");e.seek(-1);check(e.status().config.galaxyResponsive,"responsive model restored");check(e.frame()->galaxy.values==live.galaxy.values&&e.frame()->energyError==live.energyError,"whole-system diagnostic roundtrip");check(e.saveReplay(dir)&&read(file)==liveBytes,"byte exact v13");
 auto truncated=liveBytes;truncated.pop_back();reject(truncated);write(file,liveBytes);
 write(file,bytes);check(e.loadReplay(dir)&&!e.status().config.galaxyResponsive,"v12 remains restricted model");
 std::cout<<"PASS responsive galaxy engine: v13 exact roundtrip, closed-system diagnostics, malformed rejection and v12 model identity retained\n";
 e.seek(0);check(e.status().time==0,"seek initial");e.start(c,true);wait(e,"paused");e.cancel();check(e.status().state=="cancelled","cancel paused");Config orbit;orbit.preset=3;orbit.speed=1;orbit.duration=1;e.start(orbit,true);wait(e,"paused");check(!e.galaxyObservation().available&&e.galaxyObservation().samples.empty(),"non-galaxy observation unavailable");check(!e.status().galaxy.available&&e.frame()->orbital,"replace by orbit clears galaxy");e.pause(false);wait(e,"completed");check(e.saveReplay(dir)&&e.loadReplay(dir),"legacy orbit replay");
 std::cout<<"PASS galaxy engine: initial pause, 50 Myr cadence, odd count, v12 exact roundtrip, malformed atomic rejection, coherent whole-history observation, guarded seek, seek/cancel/replacement and legacy orbit\n";
 return 0;
 }catch(const std::exception& e){std::cerr<<"FAIL "<<e.what()<<"\n";return 1;}}
