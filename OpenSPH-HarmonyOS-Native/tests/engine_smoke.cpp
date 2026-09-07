#include "engine.h"
#include "orbit.h"
#include <chrono>
#include <cmath>
#include <cstring>
#include <fstream>
#include <iostream>
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
    require(data.size()>108&&data[4]==5,"expected SPH v5");
    std::string result=data.substr(0,108);result[4]=2;size_t at=108;uint32_t n=0;std::memcpy(&n,data.data()+8,4);
    for(uint32_t i=0;i<n;++i){uint32_t count=0;require(at+4<=data.size(),"v5 count missing");std::memcpy(&count,data.data()+at,4);
        size_t bytes=84+size_t(count)*sizeof(Particle);require(at+bytes+80+size_t(count)*sizeof(SphScalar)<=data.size(),"v5 truncated");result+=data.substr(at,bytes);at+=bytes+80+size_t(count)*sizeof(SphScalar);}
    require(at==data.size(),"v5 trailing data");return result;
}
int main(int argc, char **argv) {
    try {
        std::string dir = argc > 1 ? argv[1] : ".";
        mkdir(dir.c_str(), 0700);
        Engine e;
        try {
            e.start({0, 0, 5, 0, 1});
            throw std::runtime_error("invalid config accepted");
        } catch (const std::invalid_argument &) {
        }
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
            require(e.saveReplay(dir), "save failed");
            require(e.loadReplay(dir), "load failed");
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
            require(e.saveReplay(dir),"v2 replay save failed");
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
            require(e.saveReplay(dir),"orbit save");e.start({0,200,5,0,1});awaitState(e,"completed");
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
            require(e.saveReplay(dir),"v4 save");require(e.loadReplay(dir),"v4 load");e.seek(-1);
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
