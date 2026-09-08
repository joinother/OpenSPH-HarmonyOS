#include "engine.h"
#include "orbit.h"
#include <chrono>
#include <stdexcept>

namespace lab {
using Clock = std::chrono::steady_clock;
void runGalaxy(Engine& engine,Config cfg,uint64_t generation) {
    if(!engine.preparationStage(generation,"galaxies"))return;
    GalaxySystem system({cfg.count,cfg.seed,cfg.speed,cfg.angle,cfg.galaxyMassRatio,cfg.galaxyOffsetKpc,cfg.galaxyRetrograde,cfg.galaxyResponsive});
    const double e0=system.energy(),l0=galaxyLength(system.angularMomentum());
    const double energyScale=std::abs(e0)+system.kineticTwice(),angularScale=system.angularScale();
    auto publish=[&](double ms){
        auto f=std::make_shared<Frame>();f->time=system.elapsed;f->galaxy=system.diagnostics();
        f->energyError=(system.energy()-e0)/energyScale;
        f->angularError=(galaxyLength(system.angularMomentum())-l0)/std::max(1.,angularScale);
        if(!validGalaxyDiagnostics(f->galaxy)||!std::isfinite(f->energyError)||std::abs(f->energyError)>.001)throw std::runtime_error("星系引力积分精度不足，已停止");
        for(int b=0;b<2;b++){const auto& c=system.cores[b];f->totalMass+=c.mass*SOLAR_MASS;
            for(int k=0;k<3;k++)f->centers[b*3+k]=c.position[k]/GALAXY_VIEW_KPC;}
        if(system.responsive())for(double m:system.masses)f->totalMass+=m*SOLAR_MASS;
        f->particles.reserve(system.points.size());
        for(const auto& p:system.points){
            const double speed=galaxyLength(p.velocity)*GALAXY_SPEED_KMS;
            if(!std::isfinite(speed)||!std::isfinite(galaxyLength(p.position)))throw std::runtime_error("Non-finite galaxy tracer");
            f->particles.push_back({float(p.position[0]/GALAXY_VIEW_KPC),float(p.position[1]/GALAXY_VIEW_KPC),float(p.position[2]/GALAXY_VIEW_KPC),float(speed),0,float(p.origin)});
            f->maxSpeed=std::max(f->maxSpeed,speed);
        }
        engine.publish(f,generation,ms);
    };
    if(!engine.preparationStage(generation,"snapshot"))return;publish(0);
    while(system.elapsed<cfg.duration&&!engine.stopped(generation)){
        if(!engine.waitUntilRunning(generation))return;
        const auto begin=Clock::now();const double end=std::min(cfg.duration,system.elapsed+4.);
        while(system.elapsed<end){if(engine.stopped(generation))return;system.step(std::min(.0625,end-system.elapsed));}
        publish(std::chrono::duration<double,std::milli>(Clock::now()-begin).count());
        std::this_thread::sleep_for(std::chrono::milliseconds(16));
    }
}
}
