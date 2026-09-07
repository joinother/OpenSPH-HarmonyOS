#include "engine.h"
#include "orbit.h"
#include <chrono>
#include <cmath>
#include <cstring>
#include <fstream>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <sys/stat.h>
#include <thread>
using namespace lab;
void require(bool b, const char *message) {
    if (!b)
        throw std::runtime_error(message);
}
void awaitState(Engine &e, const std::string &value) {
    for (int i = 0; i < 1500; ++i) {
        auto s = e.status();
        if (s.state == "failed")
            throw std::runtime_error(s.error);
        if (s.state == value)
            return;
        std::this_thread::sleep_for(std::chrono::milliseconds(20));
    }
    throw std::runtime_error("Timed out: " + value);
}
std::string legacySph(const std::string &data) {
    require(data.size()>108&&(data[4]==5||data[4]==7),"expected SPH v5");
    std::string result=data.substr(0,108);result[4]=2;size_t at=108;uint32_t n=0;std::memcpy(&n,data.data()+8,4);
    for(uint32_t i=0;i<n;++i){uint32_t count=0;require(at+4<=data.size(),"v5 count missing");std::memcpy(&count,data.data()+at,4);
        size_t bytes=84+size_t(count)*sizeof(Particle);require(at+bytes+80+size_t(count)*sizeof(SphScalar)<=data.size(),"v5 truncated");result+=data.substr(at,bytes);at+=bytes+80+size_t(count)*sizeof(SphScalar)+(data[4]>=7?32:0);}
    require(at==data.size(),"v5 trailing data");return result;
}
int main(int argc, char **argv) {
    try {
        std::string dir = argc > 1 ? argv[1] : ".";
        mkdir(dir.c_str(), 0700);
        Engine e;
        {
            for(int mode=0;mode<3;mode++){Config c{0,200,5,0,1};c.selfGravity=mode>0;c.relaxationSeconds=mode==2?16:0;e.start(c,true);awaitState(e,"paused");auto original=e.frame();
                require(validSphFragments(original->fragments,original->particles.size(),original->totalMass),"initial fragment summary invalid");std::cout<<"initial fragment mode="<<mode<<" groups="<<original->fragments.groups.size()<<" largest_count="<<original->fragments.groups[0].count<<std::endl;
                require(e.saveReplay(dir),"v10 save failed");const std::string path=dir+"/last-replay.osphr";std::ifstream in(path,std::ios::binary);std::string bytes((std::istreambuf_iterator<char>(in)),{});in.close();require(bytes[4]==10,"missing v10 fragments");
                require(e.loadReplay(dir)&&e.status().config.selfGravity==c.selfGravity&&e.status().config.relaxationSeconds==c.relaxationSeconds,"v10 model identity changed");require(e.frame()->fragments.labels==original->fragments.labels,"v10 labels changed");require(e.frame()->fragments.groups[0].mass==original->fragments.groups[0].mass,"v10 mass changed");
                uint32_t count=0;std::memcpy(&count,bytes.data()+120,4);const size_t groupsAt=120+84+size_t(count)*sizeof(Particle)+80+size_t(count)*sizeof(SphScalar)+32;
                for(int badCase=0;badCase<5;badCase++){auto bad=bytes;uint32_t value=badCase==0?0:count+1;double nan=std::numeric_limits<double>::quiet_NaN();
                    if(badCase==0)std::memcpy(&bad[groupsAt],&value,4);if(badCase==1)std::memcpy(&bad[groupsAt+4],&value,4);if(badCase==2)std::memcpy(&bad[groupsAt+4+4*count+8],&nan,8);if(badCase==3)bad.pop_back();if(badCase==4){value=2;std::memcpy(&bad[108],&value,4);}
                    {std::ofstream out(path,std::ios::binary);out.write(bad.data(),bad.size());}const auto current=e.frame();require(!e.loadReplay(dir)&&e.frame()==current,"corrupt v10 replaced active history");}
                {std::ofstream out(path,std::ios::binary);out.write(bytes.data(),bytes.size());}require(e.loadReplay(dir),"v10 recovery failed");require(e.saveReplay(dir,false)&&e.loadReplay(dir)&&!e.frame()->fragments.available,"legacy replay fabricated groups");
            }
            std::cout<<"PASS fragments: initial geometry, v10 three model identities and exact labels/mass, malformed data rejection, legacy absence"<<std::endl;
        }
        {
            Config stationary{2,200,0,0,1};stationary.selfGravity=true;stationary.relaxationSeconds=16;
            e.start(stationary,true);awaitState(e,"paused");require(e.frame()->maxSpeed==0&&e.frame()->sph.structure.values[1]==0,"stationary sphere has artificial spin");
            e.pause(false);awaitState(e,"completed");require(e.frame()->sph.structure.values[1]>0,"ordinary free evolution did not respond to residual forces");
            require(e.saveReplay(dir,false)&&e.loadReplay(dir),"zero-spin prepared replay failed");require(e.status().config.speed==0&&e.status().config.preset==2,"replay lost stationary mode");
            auto invalid=stationary;invalid.preset=0;require(!validConfig(invalid),"zero collision speed wrongly accepted");invalid.preset=1;require(!validConfig(invalid),"zero oblique impact speed wrongly accepted");
            std::cout<<"PASS stationary sphere: no initial spin, undamped release response, zero-speed prepared replay, impact speed validation"<<std::endl;
        }
        {
            Config prepared{0,200,5,30,1};prepared.selfGravity=true;prepared.relaxationSeconds=16;
            e.start(prepared,true);awaitState(e,"paused");auto initial=e.frame();
            require(initial->time==0&&e.status().frames==1,"preparation leaked into collision clock");
            bool primary=false,secondary=false;for(const auto&p:initial->particles){if(p.body==0){primary=true;require(p.speed==0,"primary retained preparation velocity");}else{secondary=true;require(std::abs(p.speed-5)<1e-6,"impactor velocity damped");}}
            require(primary&&secondary,"prepared body identity lost");
            auto events=e.status().preparation.events;bool target=false,impactor=false;for(const auto&v:events){target|=v.stage=="relax-target";impactor|=v.stage=="relax-impactor";}require(target&&impactor,"missing separate relaxation stages");
            e.pause(false);awaitState(e,"completed");auto last=e.frame();require(last->sph.structure.available,"prepared continuation lost diagnostics");
            require(e.saveReplay(dir,false),"prepared replay save");const auto path=dir+"/last-replay.osphr";std::ifstream in(path,std::ios::binary);std::string bytes((std::istreambuf_iterator<char>(in)),{});in.close();require(bytes[4]==9,"expected prepared v9");
            require(e.loadReplay(dir)&&e.status().config.relaxationSeconds==16&&e.status().config.selfGravity,"prepared replay model lost");e.seek(-1);require(e.frame()->sph.structure.values==last->sph.structure.values,"prepared replay diagnostics changed");
            for(double value:{0.,-1.,8.,std::numeric_limits<double>::quiet_NaN()}){auto bad=bytes;std::memcpy(&bad[108],&value,8);{std::ofstream out(path,std::ios::binary);out.write(bad.data(),bad.size());}auto current=e.frame();require(!e.loadReplay(dir)&&e.frame()==current,"invalid relaxation header replaced state");}
            for(double seconds:{-1.,1.,std::numeric_limits<double>::infinity()}){auto bad=prepared;bad.relaxationSeconds=seconds;require(!validConfig(bad),"bad preparation duration accepted");}
            auto bad=prepared;bad.selfGravity=false;require(!validConfig(bad),"preparation accepted without gravity");
            prepared.count=600;prepared.relaxationSeconds=64;e.start(prepared,true);
            for(int n=0;n<1000&&e.status().preparation.stage!="relax-target";++n)std::this_thread::sleep_for(std::chrono::milliseconds(2));
            require(e.status().preparation.stage=="relax-target","no cancellable relaxation stage");const auto revision=e.sceneRevision();e.cancel();require(e.status().state=="cancelled","relax cancel state");
            e.start({0,200,5,0,1},true);awaitState(e,"paused");require(e.sceneRevision()>revision&&e.status().config.relaxationSeconds==0&&e.status().frames==1,"cancelled relaxation contaminated next scene");
            std::cout<<"PASS preparation: isolated body stages, collision velocities and clock, continuation, v9 exact replay, invalid inputs and cooperative cancellation"<<std::endl;
        }
        {
            Config c{0,200,5,0,1};c.selfGravity=true;e.start(c,true);awaitState(e,"paused");
            auto first=e.frame();require(validSphStructure(first->sph.structure),"missing structure");
            const double targetMass=4./3.*3.141592653589793*1e15*2700,impactMass=targetMass*.216;
            const double relativeKinetic=.5*(targetMass*impactMass/(targetMass+impactMass))*25e6;
            require(std::abs(first->sph.structure.values[1]/relativeKinetic-1)<1e-12,"COM collision kinetic reference");
            require(first->sph.structure.values[0]<0&&first->sph.structure.values[2]>0&&first->sph.structure.values[3]<0,"initial collision structure signs");
            require(e.saveReplay(dir,false),"structure replay save");const std::string path=dir+"/last-replay.osphr";
            std::ifstream input(path,std::ios::binary);std::string bytes((std::istreambuf_iterator<char>(input)),{});input.close();require(bytes[4]==8,"expected gravity v8");
            uint32_t count=0;std::memcpy(&count,bytes.data()+108,4);const size_t at=108+84+size_t(count)*sizeof(Particle)+80+size_t(count)*sizeof(SphScalar);
            for(int mode=0;mode<5;++mode){auto bad=bytes;double value=mode==0?1.:-1.;if(mode==3)value=std::numeric_limits<double>::quiet_NaN();
                if(mode==4)bad.pop_back();else std::memcpy(&bad[at+8*mode],&value,8);
                {std::ofstream out(path,std::ios::binary);out.write(bad.data(),bad.size());}
                const auto current=e.frame();require(!e.loadReplay(dir)&&e.frame()==current,"malformed structure replaced state");}
            {std::ofstream out(path,std::ios::binary);out.write(bytes.data(),bytes.size());}
            require(e.loadReplay(dir)&&e.status().config.selfGravity,"v8 model lost");require(e.frame()->sph.structure.values==first->sph.structure.values,"structure replay changed");
            auto legacy=bytes.substr(0,bytes.size()-32);legacy[4]=6;
            {std::ofstream out(path,std::ios::binary);out.write(legacy.data(),legacy.size());}
            require(e.loadReplay(dir)&&e.status().config.selfGravity&&!e.status().sph.structure.available,"legacy v6 fabricated structure");
            require(!e.sphObservation().samples[0].structure.available,"legacy curve fabricated structure");
            std::cout<<"PASS structure: analytic collision COM energy, signed potential/radial, v8 roundtrip, corrupted payload rejection, legacy v6 absence"<<std::endl;
        }
        try {
            e.start({0, 0, 5, 0, 1});
            throw std::runtime_error("invalid config accepted");
        } catch (const std::invalid_argument &) {
        }
        // Cancellation at preparation boundaries must never publish into a newer request.
        e.start({0,2400,5,0,16},true);const auto cancelledRequest=e.sceneRevision();e.cancel();
        require(e.status().state=="cancelled","cancel preparation state");
        require(e.status().preparation.requestId==cancelledRequest,"cancel lost request identity");
        e.start({0,200,5,0,16},true);awaitState(e,"paused");
        const auto ready=e.status().preparation;
        require(ready.requestId==e.sceneRevision()&&ready.stage=="ready"&&!ready.slow,"ready preparation identity");
        const char* stages[]={"queued","starting","target","impactor","solver","snapshot","ready"};
        require(ready.events.size()==7,"SPH preparation stages missing");
        double elapsed=-1;for(size_t i=0;i<ready.events.size();++i){require(ready.events[i].stage==stages[i],"SPH preparation order");require(ready.events[i].elapsedMs>=elapsed,"preparation time not monotonic");elapsed=ready.events[i].elapsedMs;}
        require(!e.preparationStage(cancelledRequest,"failed"),"stale preparation update accepted");
        std::this_thread::sleep_for(std::chrono::milliseconds(40));
        require(e.status().preparation.elapsedMs==ready.elapsedMs&&e.status().time==0,"ready timing or paused scene changed");
        std::cout<<"PASS preparation stages, cancellation, stale isolation and frozen timing"<<std::endl;
        // Exercise changed resolution after completed and paused runs, then
        // replacement while running and a burst where only the latest may publish.
        for(int count:{200,1200,200,1200}) {
            e.start({0,count,5,0,16},true);awaitState(e,"paused");
            require(e.status().count==(count==200?212:1276)&&e.status().time==0,"resolution initial state");
            e.pause(false);awaitState(e,"completed");
            require(e.status().time>=16&&e.status().time<16.2,"resolution run completion");
        }
        e.start({0,1200,5,0,16});awaitState(e,"running");
        for(int i=0;i<20;++i)e.start({0,i%2?1200:200,5,0,16},true);
        e.start({0,200,5,0,16},true);awaitState(e,"paused");
        require(e.status().count==212&&e.status().time==0&&e.status().frames==1,"latest resolution did not win");
        const auto revision=e.sceneRevision();std::this_thread::sleep_for(std::chrono::milliseconds(100));
        require(e.sceneRevision()==revision&&e.status().time==0&&e.status().frames==1,"stale run published");
        std::cout<<"PASS resolution transitions and latest-request replacement"<<std::endl;
        for (int preset = 0; preset < 3; ++preset) {
            Config c{preset, 200, preset == 2 ? 2.0 : 5.0, preset == 1 ? 45.0 : 0.0, 10};
            e.start(c);
            e.pause(true);
            awaitState(e, "paused");
            auto initial = e.frame();
            require(initial && initial->time == 0, "missing initial state");
            auto steps = e.status().steps;
            std::this_thread::sleep_for(std::chrono::milliseconds(150));
            require(e.status().steps == steps, "paused run advanced");
            e.pause(false);
            awaitState(e, "completed");
            auto end = e.frame();
            const auto curve=e.sphObservation();require(curve.samples.size()==size_t(e.status().frames),"SPH curve history size");
            require(curve.samples.back().values==end->sph.values,"SPH curve loses double precision");
            const auto selected=e.status().selected;e.sphObservation();require(e.status().selected==selected,"SPH observation mutates selection");
            e.seekSphObservation(0,curve.sceneRevision,curve.samples[0].time);require(e.frame()==initial,"SPH curve seek wrong frame");
            for(int invalid=0;invalid<3;++invalid){bool rejected=false;try{e.seekSphObservation(invalid==0?999:0,curve.sceneRevision+(invalid==1?1:0),curve.samples[0].time+(invalid==2?1:0));}catch(...){rejected=true;}require(rejected&&e.frame()==initial,"stale SPH curve changed state");}e.seek(-1);

            require(initial->sph.available&&end->sph.available&&end->scalars.size()==end->particles.size(),"missing SPH diagnostics");
            require(validSphDiagnostics(end->sph),"invalid SPH aggregate");
            for(const auto &p:end->scalars)require(validSphScalar(p),"invalid SPH scalar");
            require(std::abs(end->sph.values[InternalJ]/end->totalMass/1e6-end->sph.values[InternalMean])<1e-9,"internal energy weighting");
            if(preset==0)require(end->sph.values[PressureMax]>0,"collision pressure absent");
            std::cout<<"SPH_DIAGNOSTICS preset="<<preset<<" pressureMaxGPa="<<end->sph.values[PressureMax]<<" internalMeanMJkg="<<end->sph.values[InternalMean]<<" damageMax="<<end->sph.values[DamageMax]<<std::endl;
            require(end && end->time >= 10.0 && end->time <= 10.15, "time did not advance");
            require(std::abs(end->totalMass / initial->totalMass - 1) < 1e-12, "mass not conserved");
            bool moved = false;
            for (size_t i = 0; i < end->particles.size(); ++i) {
                auto &a = initial->particles[i];
                auto &b = end->particles[i];
                if (std::abs(a.x - b.x) + std::abs(a.y - b.y) + std::abs(a.z - b.z) > 1e-6)
                    moved = true;
            }
            require(moved, "particles did not evolve");
            e.seek(0);
            require(e.frame()->time == 0, "seek failed");
            e.seek(-1);
            require(e.saveReplay(dir,false), "save failed");
            require(e.loadReplay(dir), "load failed");
            require(e.status().preparation.requestId==0&&e.status().preparation.stage=="idle","replay inherited preparation");
            e.seek(-1);
            auto restored = e.frame();
            require(e.sphObservation().samples.back().values==curve.samples.back().values,"v5 curve changed");
            require(restored->sph.values==end->sph.values&&restored->sph.available,"replay diagnostic summary changed");
            require(restored->scalars.size()==end->scalars.size()&&std::memcmp(restored->scalars.data(),end->scalars.data(),end->scalars.size()*sizeof(SphScalar))==0,"replay diagnostic scalars changed");
            require(restored->particles.size() == end->particles.size(), "replay particle count changed");
            require(std::memcmp(restored->particles.data(), end->particles.data(),
                                end->particles.size() * sizeof(Particle)) == 0,
                    "replay data changed");
            e.start(c);
            awaitState(e, "completed");
            auto repeated = e.frame();
            for(size_t k=0;k<10;++k)require(std::abs(repeated->sph.values[k]-end->sph.values[k])<=1e-10*std::max(1.,std::abs(end->sph.values[k])),"repeat diagnostics exceeded floating-point tolerance");
            require(repeated->particles.size() == end->particles.size(), "repeat count changed");
            require(std::memcmp(repeated->particles.data(), end->particles.data(),
                                end->particles.size() * sizeof(Particle)) == 0,
                    "fixed seed did not reproduce");
            std::cout << "PASS preset=" << preset << " particles=" << end->particles.size()
                      << " time=" << end->time << " mass=" << end->totalMass << std::endl;
        }
        {
            Config c{0,200,3,20,1};
            c.targetRadiusKm=80;c.impactorRadiusKm=40;c.targetDensity=2600;c.impactorDensity=2800;c.targetSpin=0.002;c.seed=4321;
            e.start(c);e.pause(true);awaitState(e,"paused");
            const auto initial=e.frame();
            const double expected=4*3.141592653589793/3*(std::pow(80000.,3)*2600+std::pow(40000.,3)*2800);
            require(std::abs(initial->totalMass/expected-1)<0.02,"edited radii/density not reflected in mass");
            e.pause(false);awaitState(e,"completed");
            require(e.saveReplay(dir,false),"v2 replay save failed");
            e.start({2,200,2,0,1});awaitState(e,"completed");
            require(e.loadReplay(dir),"v2 replay load failed");
            const auto restored=e.status();
            require(restored.configKnown && restored.config.targetRadiusKm==80 && restored.config.impactorDensity==2800 && restored.config.seed==4321,"replay lost scene config");
            {
                const std::string path=dir+"/last-replay.osphr";
                std::ifstream source(path,std::ios::binary);
                std::string data((std::istreambuf_iterator<char>(source)),std::istreambuf_iterator<char>());
                source.close();
                uint32_t firstCount=0;std::memcpy(&firstCount,data.data()+108,4);
                const size_t diagnosticsAt=108+84+size_t(firstCount)*sizeof(Particle);
                for(int field=0;field<3;++field){std::string bad=data;
                    if(field==0){double value=NAN;std::memcpy(&bad[diagnosticsAt+16],&value,8);}
                    if(field==1){float value=1.5f;std::memcpy(&bad[diagnosticsAt+80+8],&value,4);}
                    if(field==2)bad.resize(bad.size()-1);
                    {std::ofstream out(path,std::ios::binary|std::ios::trunc);out.write(bad.data(),bad.size());}
                    const auto old=e.frame();require(!e.loadReplay(dir),"invalid v5 diagnostics accepted");require(e.frame()==old,"invalid v5 replay changed active scene");
                }
                // Legacy v1 has the same frame records but no configuration block.
                std::string v2=legacySph(data);
                {std::ofstream out(path,std::ios::binary|std::ios::trunc);out.write(v2.data(),v2.size());}
                require(e.loadReplay(dir)&&!e.status().sph.available&&e.sphObservation().samples.empty(),"v2 diagnostic absence");
                std::string legacy=v2.substr(0,20)+v2.substr(108);
                legacy[4]=1;
                {std::ofstream out(path,std::ios::binary|std::ios::trunc);out.write(legacy.data(),legacy.size());}
                require(e.loadReplay(dir) && !e.status().configKnown,"legacy replay compatibility failed");
                {std::ofstream out(path,std::ios::binary|std::ios::trunc);out.write(data.data(),data.size());}
                require(e.loadReplay(dir),"v2 re-load failed");
            }
            c.targetRadiusKm=0;
            try {e.start(c);throw std::runtime_error("invalid radius accepted");} catch(const std::invalid_argument&) {}
            require(e.status().state=="replay","invalid transaction changed scene");
            std::cout<<"PASS edited bodies mass, v2 config restoration, v1 compatibility, invalid radius atomicity"<<std::endl;
        }
        for(int preset:{3,4}) {
            Config c{preset,600,1,0,2};e.start(c);e.pause(true);awaitState(e,"paused");
            auto first=e.frame();require(first->orbital&&first->time==0,"orbit initial frame");
            auto steps=e.status().steps;std::this_thread::sleep_for(std::chrono::milliseconds(100));
            require(e.status().steps==steps,"paused orbit advanced");
            e.pause(false);awaitState(e,"completed");auto last=e.frame();
            require(last->time==2&&last->particles.size()==size_t(preset==3?2:4),"orbit duration/body count");
            require(std::abs(last->energyError)<1e-7,"orbit energy error");
            require(last->trails.size()==last->particles.size()*512,"trail cap");
            require(e.status().frames==240,"orbit history cap");
            const auto observed=e.observation(1);const auto oldSelected=e.status().selected;
            require(observed.samples.size()==240&&observed.samples.front().time>0,"observation history window");
            require(e.status().selected==oldSelected,"observation read moved timeline");
            const auto &point=observed.samples.back();const auto &bp=last->particles[1],&sp=last->particles[0];
            require(std::abs(point.distanceAU-std::hypot(double(bp.x)-sp.x,double(bp.y)-sp.y,double(bp.z)-sp.z))<1e-12&&point.speedKmS==bp.speed,"observation snapshot units");
            e.seekObservation(5,observed.sceneRevision,observed.samples[5].time);require(e.status().selected==5,"observation seek");
            for(int mode=0;mode<3;++mode){try{e.seekObservation(mode==2?-1:5,observed.sceneRevision+(mode==0?1:0),observed.samples[5].time+(mode==1?1:0));throw std::runtime_error("stale observation accepted");}catch(const std::invalid_argument&){}require(e.status().selected==5,"stale observation changed selection");}
            e.seek(-1);
            require(e.saveReplay(dir,false),"orbit save");e.start({0,200,5,0,1});awaitState(e,"completed");
            require(e.loadReplay(dir),"orbit replay load");e.seek(-1);auto restored=e.frame();
            require(e.status().config.preset==preset&&restored->orbital,"orbit model restoration");
            const auto replayObservation=e.observation(1);require(replayObservation.samples.size()==observed.samples.size(),"replay observation count");
            for(size_t i=0;i<observed.samples.size();++i)require(replayObservation.samples[i].time==observed.samples[i].time&&replayObservation.samples[i].distanceAU==observed.samples[i].distanceAU&&replayObservation.samples[i].speedKmS==observed.samples[i].speedKmS,"replay observation changed");
            require(replayObservation.sceneRevision!=observed.sceneRevision,"replay observation revision");
            require(restored->energyError==last->energyError&&restored->trails.size()==last->trails.size(),"orbit diagnostics restoration");
            require(std::memcmp(restored->trails.data(),last->trails.data(),last->trails.size()*sizeof(Particle))==0,"orbit trails changed");
            const auto path=dir+"/last-replay.osphr";std::ifstream file(path,std::ios::binary);
            std::string bytes((std::istreambuf_iterator<char>(file)),std::istreambuf_iterator<char>());file.close();
            {std::ofstream out(path,std::ios::binary|std::ios::trunc);out.write(bytes.data(),bytes.size()-1);}
            require(!e.loadReplay(dir)&&e.frame()==restored,"truncated orbit replay changed state");
            const auto stale=e.observation(1);auto next=std::make_shared<Frame>(*restored);next->time+=.01;e.publish(next,e.sceneRevision(),0);
            try{e.seekObservation(0,stale.sceneRevision,stale.samples[0].time);throw std::runtime_error("shifted history accepted");}catch(const std::invalid_argument&){}
            c.speed=2;try{e.start(c);throw std::runtime_error("invalid orbit speed accepted");}catch(const std::invalid_argument&){}
            e.start({preset,600,1,0,2});e.pause(true);awaitState(e,"paused");e.cancel();
            e.start({0,200,5,0,1});awaitState(e,"completed");require(!e.frame()->orbital,"orbit to SPH switching failed");require(e.observation(1).samples.empty(),"SPH leaked orbital observation");
            std::cout<<"PASS orbit preset="<<preset<<" observation units/read-only/guarded seek/history eviction/replay, pause, 2 years, conserved energy, bounded trails/history, v3 roundtrip, truncation atomicity, cancel and SPH switching"<<std::endl;
        }
        {
            Config c{5,600,1,0,1};c.orbitBodies.push_back({"中央恒星",1,0,0,0,0,0,0,0});
            for(int i=1;i<8;++i){double r=.6+i*.35,phase=i*.8,v=std::sqrt(SOLAR_GM*(1+3.e-6)/(r*AU))/1000;
                c.orbitBodies.push_back({"行星 "+std::to_string(i),3.e-6,r*std::cos(phase),r*std::sin(phase),i==7?.2:0,-v*std::sin(phase),v*std::cos(phase),i==7?1.:0.,1+i%4});}
            c.orbitBodies[7].surface=5;
            e.start(c);e.pause(true);awaitState(e,"paused");require(e.frame()->particles.size()==8,"custom count");
            e.pause(false);awaitState(e,"completed");auto end=e.frame();
            require(std::abs(end->energyError)<1.e-5&&std::isfinite(end->angularError),"custom diagnostics");
            require(e.saveReplay(dir,false),"v4 save");require(e.loadReplay(dir),"v4 load");e.seek(-1);
            auto restored=e.frame();require(restored->surfaces==end->surfaces,"v4 surface restoration");
            require(restored->surfaces[3]==4,"ring style lost in replay");require(restored->surfaces[7]==5,"moon style lost in replay");
            auto invalidStyle=c;invalidStyle.orbitBodies[1].surface=6;
            try{e.start(invalidStyle);throw std::runtime_error("unknown surface accepted");}catch(const std::invalid_argument&){}
            require(e.frame()==restored,"invalid surface changed replay");
            require(e.status().config.orbitBodies[7].name=="行星 7"&&e.status().config.orbitBodies[7].vzKmS==1,"v4 configuration restoration");
            require(std::memcmp(restored->particles.data(),end->particles.data(),8*sizeof(Particle))==0,"v4 particle roundtrip");
            require(std::memcmp(restored->trails.data(),end->trails.data(),end->trails.size()*sizeof(Particle))==0,"v4 trail roundtrip");
            const std::string path=dir+"/last-replay.osphr";std::ifstream in(path,std::ios::binary);std::string bytes((std::istreambuf_iterator<char>(in)),{});in.close();
            require(bytes[4]==4,"wrong custom replay version");
            for(int variant=0;variant<5;++variant){auto bad=bytes;
                if(variant==0)bad.resize(180);if(variant==1)bad[108]=9;if(variant==2)bad[112]=char(255);if(variant==3)bad.back()=char(255);if(variant==4)bad[116]=char(255);
                std::ofstream out(path,std::ios::binary|std::ios::trunc);out.write(bad.data(),bad.size());out.close();
                require(!e.loadReplay(dir)&&e.frame()==restored,"invalid v4 mutated state");}
            auto invalid=c;invalid.orbitBodies[1].xAU=0;invalid.orbitBodies[1].yAU=0;
            try{e.start(invalid);throw std::runtime_error("overlap accepted");}catch(const std::invalid_argument&){}
            require(e.frame()==restored,"invalid custom start mutated state");
            e.start(c);awaitState(e,"completed");require(std::memcmp(e.frame()->particles.data(),end->particles.data(),8*sizeof(Particle))==0,"custom non-determinism");
            c.orbitBodies.resize(2);c.orbitBodies[1]={"静止行星",3.e-6,1,0,0,0,0,0,1};
            e.start(c);e.pause(true);awaitState(e,"paused");require(std::isfinite(e.frame()->energyError)&&std::isfinite(e.frame()->angularError),"zero angular momentum produced NaN");
            e.pause(false);bool failed=false;for(int i=0;i<500;++i){if(e.status().state=="failed"){failed=true;break;}std::this_thread::sleep_for(std::chrono::milliseconds(20));}
            require(failed,"radial infall did not stop");require(std::isfinite(e.frame()->energyError),"failed run published invalid diagnostic");
            std::cout<<"PASS custom 8 bodies, 3D, deterministic integration, v4 complete roundtrip/corruption atomicity, zero angular momentum, radial stop"<<std::endl;
        }
        {
            std::ofstream corrupt(dir + "/last-replay.osphr", std::ios::binary | std::ios::trunc);
            corrupt << "bad";
        }
        require(!e.loadReplay(dir), "corrupt replay accepted");
        e.start({0, 600, 5, 0, 60});
        e.pause(true);
        awaitState(e, "paused");
        e.cancel();
        require(e.status().state == "cancelled", "cancel failed");
        e.start({2, 200, 2, 0, 1});
        awaitState(e, "completed");
        e.start({0, 600, 5, 0, 60});
        awaitState(e, "completed");
        require(e.status().frames == 240, "history not bounded at 240 frames");
        require(e.frame()->time >= 60.0, "long collision ended early");
        const auto bounded=e.sphObservation();require(bounded.samples.size()==240&&bounded.samples.front().frame==0&&bounded.samples.front().time>0,"SPH curve cap/reindex");
        bool oldRejected=false;try{e.seekSphObservation(0,bounded.sceneRevision,0);}catch(...){oldRejected=true;}require(oldRejected,"evicted SPH frame accepted");
        std::cout << "PASS SPH curves: double statistics, read-only snapshots, guarded seek, v5 roundtrip, missing legacy, bounded history" << std::endl;
        std::cout << "PASS 60 s collision, 600-particle budget, bounded 240-frame history" << std::endl;
        std::cout << "PASS pause/resume, seek, replay round-trip, deterministic runs, invalid input, corrupt "
                     "file, cancel/restart"
                  << std::endl;
        return 0;
    } catch (const std::exception &e) {
        std::cerr << "FAIL " << e.what() << std::endl;
        return 1;
    }
}
