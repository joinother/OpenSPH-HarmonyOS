#include "engine.h"
#include <chrono>
#include <cmath>
#include <fstream>
#include <functional>
#include <iostream>
#include <stdexcept>
#include <thread>
using namespace lab;
static void require(bool ok,const char* message){if(!ok)throw std::runtime_error(message);}
static Status wait(Engine& e,const std::function<bool(Status)>& ready,int ms=20000){for(int i=0;i<ms/5;i++){auto s=e.status();if(s.state=="failed")throw std::runtime_error(s.error);if(ready(s))return s;std::this_thread::sleep_for(std::chrono::milliseconds(5));}throw std::runtime_error("Timed out waiting for engine");}
static void same(const std::vector<OrbitSpec>& a,const std::vector<OrbitSpec>& b){require(a.size()<=b.size(),"body count shrank");for(size_t i=0;i<a.size();i++){require(a[i].name==b[i].name&&a[i].surface==b[i].surface,"body identity changed");for(auto member:{&OrbitSpec::massSolar,&OrbitSpec::xAU,&OrbitSpec::yAU,&OrbitSpec::zAU,&OrbitSpec::vxKmS,&OrbitSpec::vyKmS,&OrbitSpec::vzKmS,&OrbitSpec::radiusKm})require(a[i].*member==b[i].*member,"existing exact state changed on insertion");}}
static OrbitSpec visitor(const Status& s,int offset=4){auto a=s.orbitState[0];a.name="来访恒星";a.massSolar=.5;a.xAU+=offset;a.vyKmS+=std::sqrt(ORBIT_G*1.5/offset)*AU/YEAR/1000;a.surface=0;return a;}
int main(int argc,char** argv){try{
    require(argc==2,"directory required");Engine e;Config c;c.preset=4;c.speed=1;c.duration=1;e.start(c,true);
    auto first=wait(e,[](Status s){return s.state=="paused"&&s.frames>0;});require(first.time==0&&first.orbitState.size()==4,"exact initial state unavailable");
    e.orbitClock(100);e.pause(false);wait(e,[](Status s){return s.time>1.02;});e.pause(true);auto paused=e.status();
    require(paused.state=="paused"&&paused.continuous&&paused.time>paused.duration,"fixed duration still stops sandbox");
    std::this_thread::sleep_for(std::chrono::milliseconds(120));require(e.status().time==paused.time,"time moves while paused");same(paused.orbitState,e.status().orbitState);
    e.freezeOrbit();auto before=e.status();e.insertOrbit(visitor(before),before.orbitRevision,false);auto after=e.status();
    require(after.time==before.time&&after.orbitState.size()==5,"insertion reset time");same(before.orbitState,after.orbitState);require(after.frames>1,"insertion erased history");
    bool stale=false;try{e.insertOrbit(visitor(after,5),before.orbitRevision,false);}catch(...){stale=true;}require(stale,"stale transaction accepted");
    require(e.saveReplay(argv[1]),"session save failed");std::ifstream file(std::string(argv[1])+"/last-replay.osphr",std::ios::binary);uint32_t header[2];file.read(reinterpret_cast<char*>(header),8);require(header[1]==14,"session missing exact version");
    file.clear();file.seekg(0);std::string bytes((std::istreambuf_iterator<char>(file)),{});file.close();
    for(size_t length:{size_t(4),size_t(16),size_t(28),size_t(92),size_t(163),size_t(201),bytes.size()-1}){
        std::ofstream cut(std::string(argv[1])+"/last-replay.osphr",std::ios::binary|std::ios::trunc);cut.write(bytes.data(),length);cut.close();
        const auto revision=e.sceneRevision();require(!e.loadReplay(argv[1]),"partial session accepted");require(revision==e.sceneRevision(),"partial load changed scene");
    }
    std::ofstream complete(std::string(argv[1])+"/last-replay.osphr",std::ios::binary|std::ios::trunc);complete.write(bytes.data(),bytes.size());complete.close();
    require(e.loadReplay(argv[1]),"session load failed");auto loaded=e.status();require(loaded.time==after.time&&loaded.orbitState.size()==5,"loaded wrong session frame");same(after.orbitState,loaded.orbitState);
    e.seek(0);require(e.status().orbitState.size()==4,"history mislabels body topology");e.freezeOrbit();require(e.status().selected==0,"preview changed selected history");e.pause(false);
    auto cancelled=wait(e,[&](Status s){return s.time>=after.time;});require(cancelled.orbitState.size()==5,"cancel discarded future history");
    e.pause(true);e.orbitClock(10);e.pause(false);auto resumed=wait(e,[&](Status s){return s.time>loaded.time+.0001;});require(resumed.time>1,"resume restarted clock");e.pause(true);
    e.seek(0);e.orbitClock(1);auto branch=e.status();require(branch.orbitState.size()==4&&branch.frames==1,"resume from selected frame did not branch");e.pause(false);wait(e,[&](Status s){return s.time>branch.time;});e.pause(true);
    auto safe=e.status();std::ofstream corrupt(std::string(argv[1])+"/last-replay.osphr",std::ios::binary|std::ios::trunc);corrupt.write("SPHL\16\0\0\0",8);corrupt.close();require(!e.loadReplay(argv[1]),"truncated session accepted");require(e.status().orbitRevision==safe.orbitRevision,"failed load mutated scene");
    e.start(c,true);wait(e,[](Status s){return s.state=="paused"&&s.time==0&&s.frames>0;});e.freezeOrbit();
    auto point=e.status();auto satellite=point.orbitState[1];satellite.name="卫星";satellite.surface=5;satellite.massSolar=point.orbitState[1].massSolar*.0123;satellite.radiusKm=1737;
    satellite.xAU+=.0013;satellite.vyKmS+=std::sqrt(ORBIT_G*(point.orbitState[1].massSolar+satellite.massSolar)/.0013)*AU/YEAR/1000;
    e.insertOrbit(satellite,point.orbitRevision,false,true);auto physical=e.status();
    require(physical.time==point.time&&physical.orbitState.size()==5,"local insertion reset state");
    auto promoted=point.orbitState;for(size_t i=0;i<promoted.size();i++){require(physical.orbitState[i].radiusKm>0,"physical radius missing");promoted[i].radiusKm=physical.orbitState[i].radiusKm;}same(promoted,physical.orbitState);
    require(e.saveReplay(argv[1])&&e.loadReplay(argv[1]),"promoted session roundtrip failed");same(physical.orbitState,e.status().orbitState);
    e.orbitClock(.1);e.pause(false);wait(e,[](Status s){return s.time>0;});e.pause(true);require(e.status().orbitState.size()==5,"satellite vanished");
    std::cout<<"PASS local insertion: point-to-sphere atomic promotion, existing vectors/time retained, v14 continuation\n";
    e.cancel();std::cout<<"PASS orbit sandbox: beyond duration, pause, exact insertion, stellar mass, stale revision, rolling history, v14 roundtrip, cancel, resume, branch, atomic corrupt rejection\n";
}catch(const std::exception& ex){std::cerr<<"FAIL "<<ex.what()<<"\n";return 1;}}
