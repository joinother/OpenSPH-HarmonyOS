#include "engine.h"
#include "sph_gravity.h"
#include "sph_relaxation.h"
#include "orbit.h"
#include "Sph.h"
#include "gravity/IGravity.h"
#include "system/Factory.h"
#include "io/LogWriter.h"
#include "thread/Scheduler.h"
#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <stdexcept>

namespace lab {
using namespace Sph;
using Clock = std::chrono::steady_clock;
static double monotonicMs(){return std::chrono::duration<double,std::milli>(Clock::now().time_since_epoch()).count();}
static void preparationPoint(Engine& engine,uint64_t generation,const char* stage){
    if(!engine.preparationStage(generation,stage))throw std::runtime_error("Preparation superseded or cancelled");
}
class Experiment : public IRun, public IRunCallbacks {
    AutoPtr<IGravity> energyGravity;
    Engine &engine;
    Config cfg;
    uint64_t generation;
    Size split = 0;
    Clock::time_point last = Clock::now();
    double elapsed = 0, usedDt = 0;

  public:
    Experiment(Engine &e, Config c, uint64_t g) : engine(e), cfg(c), generation(g) {
        scheduler = SequentialScheduler::getGlobalInstance();
        configureSphGravity(settings, cfg.selfGravity);
        if(cfg.selfGravity)energyGravity=Factory::getGravity(settings);
        settings.set(RunSettingsId::RUN_LOGGER, LoggerEnum::NONE);
        settings.set(RunSettingsId::RUN_OUTPUT_TYPE, IoEnum::NONE);
        settings.set(RunSettingsId::RUN_RNG_SEED, cfg.seed);
        settings.set(RunSettingsId::RUN_END_TIME, Float(cfg.duration));
        settings.set(RunSettingsId::TIMESTEPPING_CRITERION, TimeStepCriterionEnum::COURANT);
        settings.set(RunSettingsId::TIMESTEPPING_INITIAL_TIMESTEP, 0.02_f);
        settings.set(RunSettingsId::TIMESTEPPING_MAX_TIMESTEP, 0.15_f);
        logWriter = makeAuto<NullLogWriter>();
    }
    void setUp(SharedPtr<Storage> storage) override {
        if(cfg.relaxationSeconds>0){
            InitialConditions ic(settings);BodySettings body;
            body.set(BodySettingsId::PARTICLE_COUNT,cfg.preset==2?cfg.count:cfg.count*3/4);
            body.set(BodySettingsId::DENSITY,Float(cfg.targetDensity));
            preparationPoint(engine,generation,"target");Storage primary;
            auto target=ic.addMonolithicBody(primary,SphericalDomain(Vector(0._f),Float(cfg.targetRadiusKm*1000)),body);
            preparationPoint(engine,generation,"relax-target");
            const auto stop=[this]{return engine.stopped(generation);};
            prepareStationaryBody(primary,settings,cfg.relaxationSeconds,stop);
            target.addRotation(Vector(0._f,0._f,Float(cfg.targetSpin)),Vector(0._f));
            if(cfg.preset==2)target.addRotation(Vector(0._f,0._f,Float(cfg.speed*.003)),Vector(0._f));
            split=primary.getParticleCnt();storage->merge(std::move(primary));
            if(cfg.preset!=2){
                preparationPoint(engine,generation,"impactor");Storage secondary;
                body.set(BodySettingsId::PARTICLE_COUNT,cfg.count/4);body.set(BodySettingsId::DENSITY,Float(cfg.impactorDensity));
                auto impactor=ic.addMonolithicBody(secondary,SphericalDomain(Vector(0._f),Float(cfg.impactorRadiusKm*1000)),body);
                preparationPoint(engine,generation,"relax-impactor");
                prepareStationaryBody(secondary,settings,cfg.relaxationSeconds,stop);
                const double distance=1125.*(cfg.targetRadiusKm+cfg.impactorRadiusKm);
                impactor.displace(Vector(Float(distance),Float(std::sin(cfg.angle*3.141592653589793/180.)*distance*.5),0._f));
                impactor.addVelocity(Vector(Float(-cfg.speed*1000),0._f,0._f));storage->merge(std::move(secondary));
            }
            preparationPoint(engine,generation,"solver");return;
        }
        preparationPoint(engine,generation,"target");
        InitialConditions ic(settings);
        BodySettings body;
        body.set(BodySettingsId::PARTICLE_COUNT, cfg.preset == 2 ? cfg.count : cfg.count * 3 / 4);
        body.set(BodySettingsId::DENSITY, Float(cfg.targetDensity));
        auto target = ic.addMonolithicBody(*storage, SphericalDomain(Vector(0._f), Float(cfg.targetRadiusKm * 1000)), body);
        target.addRotation(Vector(0._f, 0._f, Float(cfg.targetSpin)), Vector(0._f));
        split = storage->getParticleCnt();
        preparationPoint(engine,generation,cfg.preset==2?"solver":"impactor");
        if (cfg.preset == 2) {
            target.addRotation(Vector(0._f, 0._f, Float(cfg.speed * 0.003)), Vector(0._f));
        } else {
            body.set(BodySettingsId::PARTICLE_COUNT, cfg.count / 4);
            const double a = cfg.angle * 3.141592653589793 / 180.0;
            const double distance = 1125.0 * (cfg.targetRadiusKm + cfg.impactorRadiusKm);
            const double offset = std::sin(a) * distance * 0.5;
            body.set(BodySettingsId::DENSITY, Float(cfg.impactorDensity));
            auto impactor = ic.addMonolithicBody(
                *storage, SphericalDomain(Vector(Float(distance), Float(offset), 0._f), Float(cfg.impactorRadiusKm * 1000)), body);
            impactor.addVelocity(Vector(Float(-cfg.speed * 1000), 0._f, 0._f));
        }
        preparationPoint(engine,generation,"solver");
    }
    void tearDown(const Storage &, const Statistics &) override {}
    void snapshot(const Storage &storage, double time) {
        if (storage.getParticleCnt() == 0 || engine.stopped(generation))
            return;
        auto f = std::make_shared<Frame>();
        f->time = time;
        const auto &r = storage.getValue<Vector>(QuantityId::POSITION);
        const auto &v = storage.getDt<Vector>(QuantityId::POSITION);
        const auto &rho = storage.getValue<Float>(QuantityId::DENSITY);
        const auto &mass = storage.getValue<Float>(QuantityId::MASS);
        const auto &pressure=storage.getValue<Float>(QuantityId::PRESSURE);
        const auto &internal=storage.getValue<Float>(QuantityId::ENERGY);
        const auto &damage=storage.getValue<Float>(QuantityId::DAMAGE);
        SphAccumulator diagnostics;f->scalars.reserve(r.size());
        std::vector<StructureParticle> structure;structure.reserve(r.size());
        std::vector<double> smoothing;smoothing.reserve(r.size());
        double weights[2] = {};
        f->particles.reserve(r.size());
        for (Size i = 0; i < r.size(); ++i) {
            double speed = std::sqrt(double(v[i][X] * v[i][X] + v[i][Y] * v[i][Y] + v[i][Z] * v[i][Z]));
            if (!std::isfinite(speed) || !std::isfinite(double(r[i][X])) || !std::isfinite(double(r[i][Y])) ||
                !std::isfinite(double(r[i][Z])) || !std::isfinite(double(rho[i])))
                throw std::runtime_error("Non-finite particle state; reduce speed or increase resolution.");
            smoothing.push_back(double(r[i][H]));
            structure.push_back({double(mass[i]),{double(r[i][X]),double(r[i][Y]),double(r[i][Z])},{double(v[i][X]),double(v[i][Y]),double(v[i][Z])}});
            f->scalars.push_back(diagnostics.add(pressure[i],internal[i],damage[i],mass[i],speed));
            int body = i < split ? 0 : 1;
            f->particles.push_back({float(r[i][X] / 1.e5), float(r[i][Y] / 1.e5), float(r[i][Z] / 1.e5),
                                    float(speed / 1000), float(rho[i]), float(body)});
            f->maxSpeed = std::max(f->maxSpeed, speed / 1000);
            f->meanDensity += rho[i];
            f->totalMass += mass[i];
            weights[body] += mass[i];
            for (int j = 0; j < 3; ++j)
                f->centers[body * 3 + j] += double(r[i][j] / 1.e5) * mass[i];
        }
        for (int b = 0; b < 2; ++b)
            for (int j = 0; j < 3; ++j)
                if (weights[b] > 0)
                    f->centers[b * 3 + j] /= weights[b];
        f->meanDensity /= r.size();f->sph=diagnostics.finish();
        double potential=0;
        if(energyGravity){Statistics stats;energyGravity->build(*scheduler,storage);potential=energyGravity->evalEnergy(*scheduler,stats);}
        f->sph.structure=measureSphStructure(structure,potential);
        f->fragments=measureSphFragments(structure,smoothing);
        auto now = Clock::now();
        engine.publish(f, generation, std::chrono::duration<double, std::milli>(now - last).count());
        last = now;
    }
    void onSetUp(const Storage &storage, Statistics &) override {
        preparationPoint(engine,generation,"snapshot");
        snapshot(storage, 0);
        engine.waitUntilRunning(generation);
        last = Clock::now();
    }
    void onTimeStep(const Storage &storage, Statistics &stats) override {
        // OpenSPH updates the next time-step during step(). Track the physical
        // step used for this snapshot independently of its pre-step RUN_TIME.
        if (storage.getParticleCnt() == 0)
            return;
        if (usedDt == 0)
            usedDt = 0.02;
        elapsed += usedDt;
        if (stats.has(StatisticsId::TIMESTEP_VALUE))
            usedDt = stats.get<Float>(StatisticsId::TIMESTEP_VALUE);
        snapshot(storage, elapsed);
        engine.waitUntilRunning(generation);
        // Keep input responsive and bound preview production on fast scenes.
        std::this_thread::sleep_for(std::chrono::milliseconds(8));
        last = Clock::now();
    }
    bool shouldAbortRun() const override { return engine.stopped(generation); }
};
static void runOrbit(Engine &engine, Config cfg, uint64_t generation) {
    preparationPoint(engine,generation,"orbits");
    std::vector<OrbitBody> initial;
    for(const auto &b:cfg.orbitBodies)initial.push_back({b.massSolar,{b.xAU,b.yAU,b.zAU},{b.vxKmS*1000*YEAR/AU,b.vyKmS*1000*YEAR/AU,b.vzKmS*1000*YEAR/AU},b.radiusKm*1000/AU});
    OrbitSystem system=cfg.preset==5?OrbitSystem(initial):OrbitSystem(cfg.preset,cfg.speed);
    const double e0=system.energy(),l0=norm(system.angularMomentum());
    double energyScale=0,angularScale=0;
    for(size_t i=0;i<system.bodies.size();++i){const auto &b=system.bodies[i];
        energyScale+=.5*b.mass*norm(b.velocity)*norm(b.velocity);
        angularScale+=b.mass*norm(b.position)*std::max(norm(b.velocity),std::sqrt(ORBIT_G/std::max(.02,norm(b.position))));
        for(size_t j=0;j<i;++j){Vec3 d;for(int k=0;k<3;++k)d[k]=b.position[k]-system.bodies[j].position[k];energyScale+=ORBIT_G*b.mass*system.bodies[j].mass/norm(d);}}
    const double eden=(std::abs(e0)<1.e-6*energyScale?energyScale:std::abs(e0)),lden=(l0<1.e-6*angularScale?angularScale:l0);
    std::vector<std::deque<Particle>> trails(system.bodies.size());
    double time=0;
    auto publish=[&](double ms) {
        auto f=std::make_shared<Frame>();f->orbital=true;f->time=time;f->contact=system.contact;
        f->energyError=(system.energy()-e0)/eden;
        f->angularError=(norm(system.angularMomentum())-l0)/lden;
        for(size_t i=0;i<system.bodies.size();++i){const auto &b=system.bodies[i];
            Particle p{float(b.position[0]),float(b.position[1]),float(b.position[2]),float(norm(b.velocity)*AU/YEAR/1000),float(b.mass),float(i)};
            if(system.finiteSpheres())f->radiiAU.push_back(b.radius);
            f->surfaces.push_back(cfg.preset==5?cfg.orbitBodies[i].surface:int(i));
            f->particles.push_back(p);trails[i].push_back(p);if(trails[i].size()>512)trails[i].pop_front();
            f->trails.insert(f->trails.end(),trails[i].begin(),trails[i].end());
            f->maxSpeed=std::max(f->maxSpeed,double(p.speed));f->totalMass+=b.mass*SOLAR_MASS;
            if(i<2)for(int k=0;k<3;++k)f->centers[3*i+k]=b.position[k];
        }
        engine.publish(f,generation,ms);
    };
    preparationPoint(engine,generation,"snapshot");publish(0);
    while(time<cfg.duration&&!engine.stopped(generation)){
        if(!engine.waitUntilRunning(generation))return;
        auto begin=Clock::now();const auto contactsBefore=system.contact.count;
        double frameEnd=cfg.duration;
        if(system.finiteSpheres()){
            // Sample close encounters densely enough to see approach and replay contact.
            double span=ORBIT_DT*16;
            for(size_t i=0;i<system.bodies.size();i++)for(size_t j=0;j<i;j++){
                const auto& a=system.bodies[i];const auto& b=system.bodies[j];Vec3 r,v;
                for(int k=0;k<3;k++){r[k]=a.position[k]-b.position[k];v[k]=a.velocity[k]-b.velocity[k];}
                const double d=norm(r),rate=norm(v)+std::sqrt(ORBIT_G*(a.mass+b.mass)/d);
                span=std::min(span,.01*d/rate);
            }
            frameEnd=std::min(frameEnd,time+std::max(1.e-12,span));
        }
        for(int k=0;k<(cfg.preset==5?128:16)&&time<frameEnd;++k){double dt=std::min(ORBIT_DT/(cfg.preset==5?8:1),frameEnd-time);const auto contacts=system.contact.count;time+=system.step(dt);
            if(cfg.preset==5&&std::abs(system.energy()-e0)>eden*.01)throw std::runtime_error("积分精度不足：能量偏差超过阈值，已停止；请增大间距或降低初速");
            if(system.contact.count!=contacts)break;}
        publish(std::chrono::duration<double,std::milli>(Clock::now()-begin).count());
        if(system.contact.count!=contactsBefore)engine.pauseOnContact(generation);
        std::this_thread::sleep_for(std::chrono::milliseconds(16));
    }
}
static void runGalaxy(Engine& engine,Config cfg,uint64_t generation) {
    preparationPoint(engine,generation,"galaxies");
    GalaxySystem system({cfg.count,cfg.seed,cfg.speed,cfg.angle,cfg.galaxyMassRatio,cfg.galaxyOffsetKpc,cfg.galaxyRetrograde});
    const double e0=system.coreEnergy(),l0=galaxyLength(system.coreAngularMomentum());
    double energyScale=std::abs(e0),angularScale=0;
    for(const auto& c:system.cores){energyScale+=c.mass*std::pow(galaxyLength(c.velocity),2);angularScale+=c.mass*galaxyLength(c.position)*galaxyLength(c.velocity);}
    auto publish=[&](double ms){
        auto f=std::make_shared<Frame>();f->time=system.elapsed;f->galaxy=system.diagnostics();
        f->energyError=(system.coreEnergy()-e0)/energyScale;
        f->angularError=(galaxyLength(system.coreAngularMomentum())-l0)/std::max(1.,angularScale);
        if(!validGalaxyDiagnostics(f->galaxy)||!std::isfinite(f->energyError)||std::abs(f->energyError)>.001)throw std::runtime_error("星系中心积分精度不足，已停止");
        for(int b=0;b<2;b++){const auto& c=system.cores[b];f->totalMass+=c.mass*SOLAR_MASS;
            for(int k=0;k<3;k++)f->centers[b*3+k]=c.position[k]/GALAXY_VIEW_KPC;}
        f->particles.reserve(system.points.size());
        for(const auto& p:system.points){
            const double speed=galaxyLength(p.velocity)*GALAXY_SPEED_KMS;
            if(!std::isfinite(speed)||!std::isfinite(galaxyLength(p.position)))throw std::runtime_error("Non-finite galaxy tracer");
            f->particles.push_back({float(p.position[0]/GALAXY_VIEW_KPC),float(p.position[1]/GALAXY_VIEW_KPC),float(p.position[2]/GALAXY_VIEW_KPC),float(speed),0,float(p.origin)});
            f->maxSpeed=std::max(f->maxSpeed,speed);
        }
        engine.publish(f,generation,ms);
    };
    preparationPoint(engine,generation,"snapshot");publish(0);
    while(system.elapsed<cfg.duration&&!engine.stopped(generation)){
        if(!engine.waitUntilRunning(generation))return;
        const auto begin=Clock::now();const double end=std::min(cfg.duration,system.elapsed+4.);
        while(system.elapsed<end){if(engine.stopped(generation))return;system.step(std::min(.0625,end-system.elapsed));}
        publish(std::chrono::duration<double,std::milli>(Clock::now()-begin).count());
        std::this_thread::sleep_for(std::chrono::milliseconds(16));
    }
}
Engine::Engine() : worker(&Engine::loop, this) {}
Engine::~Engine() {
    quit = true;
    ++generation;
    cv.notify_all();
    if (worker.joinable())
        worker.join();
}
Engine &Engine::instance() {
    static Engine e;
    return e;
}
static bool validOrbitName(const std::string &name) {
    size_t units=0;bool visible=false;
    for(size_t i=0;i<name.size();){unsigned char c=name[i++];uint32_t cp=c;int extra=0;uint32_t minimum=0;
        if(c>=0xf0&&c<=0xf4){extra=3;cp=c&7;minimum=0x10000;}
        else if(c>=0xe0&&c<=0xef){extra=2;cp=c&15;minimum=0x800;}
        else if(c>=0xc2&&c<=0xdf){extra=1;cp=c&31;minimum=0x80;}
        else if(c>=0x80)return false;
        for(int k=0;k<extra;++k){if(i>=name.size())return false;unsigned char d=name[i++];if((d&0xc0)!=0x80)return false;cp=(cp<<6)|(d&63);}
        if(cp<minimum||cp>0x10ffff||(cp>=0xd800&&cp<=0xdfff)||cp<32||cp==127)return false;
        units+=cp>0xffff?2:1;if(units>48)return false;
        bool space=cp==32||cp==0xa0||cp==0x1680||(cp>=0x2000&&cp<=0x200a)||cp==0x2028||cp==0x2029||cp==0x202f||cp==0x205f||cp==0x3000||cp==0xfeff;
        visible|=!space;
    }
    return visible;
}
bool validConfig(const Config &c) {
    auto range = [](double x, double low, double high) { return std::isfinite(x) && x >= low && x <= high; };
    if(c.relaxationSeconds!=0&&c.relaxationSeconds!=16&&c.relaxationSeconds!=64)return false;
    if(c.relaxationSeconds>0&&(!c.selfGravity||c.preset>=3))return false;
    if(c.preset==5){
        if(c.orbitBodies.size()<2||c.orbitBodies.size()>8||c.speed!=1)return false;
        const bool finite=c.orbitBodies[0].radiusKm>0;
        for(size_t i=0;i<c.orbitBodies.size();++i){const auto &b=c.orbitBodies[i];
            if(!std::isfinite(b.radiusKm)||b.radiusKm<0||b.radiusKm>1.e7||(b.radiusKm>0)!=finite||(finite&&b.radiusKm<1))return false;
            if(!validOrbitName(b.name))return false;
            if(!range(b.massSolar,i==0?.1:1.e-8,i==0?2:.01)||b.surface<(i==0?0:1)||b.surface>(i==0?0:5))return false;
            if(!range(b.xAU,-10,10)||!range(b.yAU,-10,10)||!range(b.zAU,-10,10)||!range(norm({b.vxKmS,b.vyKmS,b.vzKmS}),0,100))return false;
            for(size_t j=0;j<i;++j){const auto &a=c.orbitBodies[j];if(norm({b.xAU-a.xAU,b.yAU-a.yAU,b.zAU-a.zAU})<(finite?(b.radiusKm+a.radiusKm)*1000/AU:.05))return false;}
        }
    }else if(!c.orbitBodies.empty())return false;
    if(c.preset==6){if(!validGalaxyParameters({c.count,c.seed,c.speed,c.angle,c.galaxyMassRatio,c.galaxyOffsetKpc,c.galaxyRetrograde}))return false;}
    else if(c.galaxyMassRatio!=.6||c.galaxyOffsetKpc!=12||c.galaxyRetrograde)return false;
    return (!c.selfGravity || (c.preset < 3 && c.count <= 1200)) && c.preset >= 0 && c.preset <= 6 && c.count >= 200 && c.count <= 2400 &&
        range(c.speed,c.preset>=3?0.75:(c.preset==2?0:0.5),c.preset>=3?1.25:10) && range(c.angle,0,70) && range(c.duration,c.preset==6?50:1,c.preset==6?800:(c.preset>=3?10:120)) &&
        range(c.targetRadiusKm,40,200) && range(c.impactorRadiusKm,20,120) &&
        range(c.targetDensity,2400,3000) && range(c.impactorDensity,2400,3000) &&
        range(c.targetSpin,-0.01,0.01) && c.seed >= 1 && c.seed <= 1000000;
}
void Engine::start(Config c, bool initiallyPaused) {
    if (!validConfig(c)) throw std::invalid_argument("Invalid scene parameters");
    std::lock_guard<std::mutex> lock(mutex);
    ++generation;
    config = c;
    pending = true;
    paused = initiallyPaused;
    history.clear();
    current = Status{};
    current.state = "preparing";
    current.duration = c.duration;
    preparation.begin(generation.load(),monotonicMs());
    cv.notify_all();
}
void Engine::pauseOnContact(uint64_t request) {
    std::lock_guard<std::mutex> lock(mutex);
    if(stopped(request))return;
    paused=true;current.state="paused";cv.notify_all();
}
void Engine::pause(bool value) {
    std::lock_guard<std::mutex> lock(mutex);
    if (current.state == "running" || current.state == "paused" || current.state == "preparing") {
        paused = value;
        if (current.state != "preparing")
            current.state = value ? "paused" : "running";
    }
    if (!value)
        current.selected = -1;
    cv.notify_all();
}
void Engine::cancel() {
    std::lock_guard<std::mutex> lock(mutex);
    preparation.finish(generation.load(),"cancelled",monotonicMs());
    ++generation;
    pending = false;
    paused = false;
    current.state = "cancelled";
    cv.notify_all();
}
void Engine::seek(int i) {
    std::lock_guard<std::mutex> lock(mutex);
    if (i < 0) {
        current.selected = -1;
        return;
    }
    if (history.empty())
        return;
    paused = true;
    if (current.state == "running")
        current.state = "paused";
    current.selected = std::min(i, int(history.size() - 1));
}
bool Engine::stopped(uint64_t g) const { return quit || g != generation.load(); }
bool Engine::waitUntilRunning(uint64_t g) {
    std::unique_lock<std::mutex> lock(mutex);
    cv.wait(lock, [&] { return !paused || stopped(g); });
    return !stopped(g);
}
bool Engine::preparationStage(uint64_t g,const std::string& stage) {
    std::lock_guard<std::mutex> lock(mutex);
    if(workerRequestId==g)workerStage=stage;
    if(stopped(g))return false;
    preparation.advance(g,stage,monotonicMs());return true;
}
void Engine::publish(std::shared_ptr<Frame> f, uint64_t g, double ms) {
    std::lock_guard<std::mutex> lock(mutex);
    if (stopped(g))
        return;
    if(history.empty()){preparation.finish(g,"ready",monotonicMs());workerStage="simulation";}
    history.push_back(f);
    if (history.size() > maxFrames) {
        history.pop_front();
        if (current.selected >= 0)
            current.selected = std::max(0, current.selected - 1);
    }
    current.state = paused ? "paused" : "running";
    current.stepMs = ms;
    current.steps++;
    current.time = f->time;
    current.count = f->particles.size();
}
Status Engine::status() {
    std::lock_guard<std::mutex> lock(mutex);
    Status s = current;
    s.preparation=preparation.snapshot(monotonicMs(),workerRequestId,workerStage);
    s.config = config;
    s.frames = history.size();
    if (!history.empty()) {
        auto f = current.selected < 0 ? history.back()
                                      : history[std::min(size_t(current.selected), history.size() - 1)];
        s.sph=f->sph;s.galaxy=f->galaxy;
        s.time = f->time;
        s.maxSpeed = f->maxSpeed;
        s.meanDensity = f->meanDensity;
        s.totalMass = f->totalMass;
        s.count = f->particles.size();
        s.energyError=f->energyError;s.angularError=f->angularError;
        if(f->orbital){s.bodies=f->particles;s.contact=f->contact;}
    }
    return s;
}
OrbitObservation Engine::observation(int body) {
    if(body<1||body>7)throw std::invalid_argument("Observation requires planet index 1..7");
    std::lock_guard<std::mutex> lock(mutex);
    OrbitObservation result;result.sceneRevision=generation.load();result.body=body;result.selected=current.selected;
    if(history.empty()||!history.back()->orbital||size_t(body)>=history.back()->particles.size())return result;
    const char *names[]={"恒星","蓝色行星","金色行星","红色行星"};
    result.name=config.preset==5?config.orbitBodies.at(body).name:(body<4?names[body]:"行星 "+std::to_string(body));
    result.samples.reserve(history.size());
    for(size_t i=0;i<history.size();++i){const auto &f=*history[i];
        if(!f.orbital||size_t(body)>=f.particles.size()){result.samples.clear();return result;}
        const auto &p=f.particles[body],&star=f.particles[0];
        const double x=double(p.x)-star.x,y=double(p.y)-star.y,z=double(p.z)-star.z;
        result.samples.push_back({int(i),f.time,std::sqrt(x*x+y*y+z*z),p.speed});
    }
    return result;
}
SphObservation Engine::sphObservation() {
    std::lock_guard<std::mutex> lock(mutex);
    SphObservation result;result.sceneRevision=generation.load();result.selected=current.selected;
    for(size_t i=0;i<history.size();++i){const auto &f=*history[i];
        if(f.orbital||!f.sph.available){result.samples.clear();return result;}
        result.samples.push_back({int(i),f.time,f.sph.values,f.sph.structure});
    }
    return result;
}
GalaxyObservation Engine::galaxyObservation(){
    std::lock_guard<std::mutex> lock(mutex);GalaxyObservation out;out.sceneRevision=generation.load();out.selected=current.selected;out.config=config;
    if(!current.configKnown||config.preset!=6||history.empty())return out;
    for(size_t i=0;i<history.size();i++){const auto& f=*history[i];if(!validGalaxyDiagnostics(f.galaxy)){out.samples.clear();return out;}
        out.samples.push_back({int(i),f.time,f.galaxy.values,f.energyError,f.angularError});}
    out.available=true;return out;
}
void Engine::seekGalaxyObservation(int index,uint64_t revision,double time){
    std::lock_guard<std::mutex> lock(mutex);
    if(revision!=generation.load()||index<0||size_t(index)>=history.size()||!std::isfinite(time)||history[index]->time!=time||!history[index]->galaxy.available)
        throw std::invalid_argument("Galaxy observation changed; refresh and try again");
    paused=true;if(current.state=="running")current.state="paused";current.selected=index;
}
FragmentFrame Engine::fragmentFrame(){
    std::lock_guard<std::mutex> lock(mutex);FragmentFrame result;result.sceneRevision=generation.load();result.selected=current.selected;
    if(!history.empty()){result.frame=current.selected<0?history.back():history[std::min(size_t(current.selected),history.size()-1)];if(result.frame->galaxy.available)result.initial=history.front();}return result;
}
void Engine::seekSphObservation(int index,uint64_t revision,double time) {
    std::lock_guard<std::mutex> lock(mutex);
    if(revision!=generation.load()||index<0||size_t(index)>=history.size()||!std::isfinite(time)||
       history[index]->time!=time||history[index]->orbital||!history[index]->sph.available)
        throw std::invalid_argument("SPH observation changed; refresh the chart and try again");
    paused=true;if(current.state=="running")current.state="paused";current.selected=index;
}
void Engine::seekObservation(int index, uint64_t revision, double time) {
    std::lock_guard<std::mutex> lock(mutex);
    // History indices shift at the 240-frame cap. Refuse a stale chart atomically.
    if(revision!=generation.load()||index<0||size_t(index)>=history.size()||
       !std::isfinite(time)||history[index]->time!=time||!history[index]->orbital)
        throw std::invalid_argument("Observation changed; refresh the chart and try again");
    paused=true;if(current.state=="running")current.state="paused";current.selected=index;
}
std::shared_ptr<const Frame> Engine::frame() {
    std::lock_guard<std::mutex> lock(mutex);
    if (history.empty())
        return {};
    return current.selected < 0 ? history.back()
                                : history[std::min(size_t(current.selected), history.size() - 1)];
}
void Engine::loop() {
    while (!quit) {
        Config c;
        uint64_t g;
        {
            std::unique_lock<std::mutex> lock(mutex);
            cv.wait(lock, [&] { return pending || quit; });
            if (quit)
                return;
            c = config;
            g = generation;
            pending = false;
            workerRequestId=g;workerStage="starting";
            preparation.advance(g,"starting",monotonicMs());
        }
        try {
            if(c.preset==6)runGalaxy(*this,c,g);
            else if(c.preset>=3) runOrbit(*this,c,g);
            else {preparationPoint(*this,g,"starting");Experiment run(*this, c, g);Storage storage;run.run(storage, run);preparationStage(g,"cleanup");}
            std::lock_guard<std::mutex> lock(mutex);
            if (!stopped(g))
                current.state = "completed";
        } catch (const Sph::Exception &e) {
            std::lock_guard<std::mutex> lock(mutex);
            if (!stopped(g)) {
                current.state = "failed";
                current.error = e.what();
                preparation.finish(g,"failed",monotonicMs());
            }
        } catch (const std::exception &e) {
            std::lock_guard<std::mutex> lock(mutex);
            if (!stopped(g)) {
                current.state = "failed";
                current.error = e.what();
                preparation.finish(g,"failed",monotonicMs());
            }
        }
        {std::lock_guard<std::mutex> lock(mutex);if(workerRequestId==g){workerRequestId=0;workerStage="idle";}}
    }
}
// Versioned, bounded playback format. This is visualization history, not a solver checkpoint.
// Fixed-width little-endian ARM64/desktop fields; reject other formats/version.
bool Engine::saveReplay(const std::string &dir,bool includeFragments) {
    std::deque<std::shared_ptr<Frame>> frames;
    double duration;
    Config saved;
    bool known;
    {
        std::lock_guard<std::mutex> lock(mutex);
        frames = history;
        duration = current.duration;
        saved = config; known = current.configKnown;
    }
    if (frames.empty())
        return false;
    std::string path = dir + "/last-replay.osphr", temp = path + ".tmp";
    const bool diagnostics=known&&saved.preset<3&&std::all_of(frames.begin(),frames.end(),[](const auto &f){return f->sph.available&&f->scalars.size()==f->particles.size();});
    const bool structure=diagnostics&&std::all_of(frames.begin(),frames.end(),[](const auto& f){return validSphStructure(f->sph.structure);});
    const bool fragments=includeFragments&&structure&&std::all_of(frames.begin(),frames.end(),[](const auto&f){return validSphFragments(f->fragments,f->particles.size(),f->totalMass);});
    if ((saved.selfGravity && !diagnostics)||(saved.relaxationSeconds>0&&!structure)) return false;
    std::ofstream out(temp, std::ios::binary);
    uint32_t magic = 0x4c485053, version = known&&saved.preset==6?12:known&&saved.preset==5&&!saved.orbitBodies.empty()&&saved.orbitBodies[0].radiusKm>0?11:fragments?10:saved.relaxationSeconds>0?9:diagnostics?(structure?(saved.selfGravity?8:7):(saved.selfGravity?6:5)):(known ? (saved.preset==5?4:(saved.preset>=3?3:2)) : 1), n = frames.size();
    out.write(reinterpret_cast<char *>(&magic), 4);
    out.write(reinterpret_cast<char *>(&version), 4);
    out.write(reinterpret_cast<char *>(&n), 4);
    out.write(reinterpret_cast<char *>(&duration), 8);
    if (version >= 2) {
        double values[] = {double(saved.preset),double(saved.count),saved.speed,saved.angle,saved.duration,
            saved.targetRadiusKm,saved.impactorRadiusKm,saved.targetDensity,saved.impactorDensity,saved.targetSpin,double(saved.seed)};
        out.write(reinterpret_cast<char *>(values),sizeof(values));
    }
    if(version==12){double g[]={saved.galaxyMassRatio,saved.galaxyOffsetKpc,saved.galaxyRetrograde?1.:0.};out.write(reinterpret_cast<const char*>(g),sizeof(g));}
    if(version==10){uint32_t gravity=saved.selfGravity?1:0;out.write(reinterpret_cast<const char*>(&gravity),4);out.write(reinterpret_cast<const char*>(&saved.relaxationSeconds),8);}
    if(version==9)out.write(reinterpret_cast<const char*>(&saved.relaxationSeconds),8);
    if(version==4||version==11){uint32_t count=saved.orbitBodies.size();out.write(reinterpret_cast<char *>(&count),4);
        for(const auto &b:saved.orbitBodies){uint32_t len=b.name.size();out.write(reinterpret_cast<char *>(&len),4);out.write(b.name.data(),len);
            double v[]={b.massSolar,b.xAU,b.yAU,b.zAU,b.vxKmS,b.vyKmS,b.vzKmS,double(b.surface)};out.write(reinterpret_cast<char *>(v),sizeof(v));if(version==11)out.write(reinterpret_cast<const char*>(&b.radiusKm),8);}}
    for (auto &f : frames) {
        uint32_t count = f->particles.size();
        out.write(reinterpret_cast<char *>(&count), 4);
        double values[] = {f->time, f->maxSpeed, f->meanDensity, f->totalMass};
        out.write(reinterpret_cast<char *>(values), sizeof(values));
        out.write(reinterpret_cast<char *>(f->centers), sizeof(f->centers));
        out.write(reinterpret_cast<char *>(f->particles.data()), count * sizeof(Particle));
        if(version>=5&&version<=10){out.write(reinterpret_cast<const char *>(f->sph.values.data()),sizeof(double)*10);out.write(reinterpret_cast<const char *>(f->scalars.data()),count*sizeof(SphScalar));}
        if(version>=7&&version<=10)out.write(reinterpret_cast<const char*>(f->sph.structure.values.data()),sizeof(double)*4);
        if(version==10){const auto& fragments=f->fragments;uint32_t groups=fragments.groups.size();out.write(reinterpret_cast<const char*>(&groups),4);out.write(reinterpret_cast<const char*>(fragments.labels.data()),count*4);
            for(const auto&g:fragments.groups){out.write(reinterpret_cast<const char*>(&g.anchor),4);out.write(reinterpret_cast<const char*>(&g.count),4);out.write(reinterpret_cast<const char*>(&g.mass),8);out.write(reinterpret_cast<const char*>(g.center.data()),24);out.write(reinterpret_cast<const char*>(g.velocity.data()),24);out.write(reinterpret_cast<const char*>(&g.rmsRadius),8);}}
        if(version==12){out.write(reinterpret_cast<const char*>(f->galaxy.values.data()),40);double errors[]={f->energyError,f->angularError};out.write(reinterpret_cast<const char*>(errors),16);}
        if(version==11){out.write(reinterpret_cast<const char*>(&f->contact.count),4);int32_t a=f->contact.a,b=f->contact.b;out.write(reinterpret_cast<const char*>(&a),4);out.write(reinterpret_cast<const char*>(&b),4);out.write(reinterpret_cast<const char*>(&f->contact.time),8);out.write(reinterpret_cast<const char*>(&f->contact.speed),8);}
        if(version==3||version==4||version==11){uint32_t ntrail=f->trails.size();double d[]={f->energyError,f->angularError};
            out.write(reinterpret_cast<char *>(d),sizeof(d));out.write(reinterpret_cast<char *>(&ntrail),4);
            out.write(reinterpret_cast<char *>(f->trails.data()),ntrail*sizeof(Particle));}
    }
    out.flush();
    bool ok = bool(out);
    out.close();
    if (!ok) {
        std::remove(temp.c_str());
        return false;
    }
    return std::rename(temp.c_str(), path.c_str()) == 0;
}
bool Engine::loadReplay(const std::string &dir) {
    std::ifstream in(dir + "/last-replay.osphr", std::ios::binary);
    uint32_t magic = 0, version = 0, n = 0;
    double duration = 0;
    in.read(reinterpret_cast<char *>(&magic), 4);
    in.read(reinterpret_cast<char *>(&version), 4);
    in.read(reinterpret_cast<char *>(&n), 4);
    in.read(reinterpret_cast<char *>(&duration), 8);
    if (!in || magic != 0x4c485053 || (version != 1 && version != 2 && version != 3 && version != 4 && version != 5 && version != 6 && version != 7 && version != 8 && version != 9 && version != 10 && version != 11 && version != 12) || n == 0 || n > maxFrames || !std::isfinite(duration) ||
        duration <= 0 || duration > (version==12?800:120))
        return false;
    Config saved;
    if (version >= 2) {
        double v[11]; in.read(reinterpret_cast<char *>(v),sizeof(v));
        if (!in) return false;
        for (double x : v) if (!std::isfinite(x) || std::abs(x) > 1.e7) return false;
        for (int i : {0,1,10}) if (std::trunc(v[i]) != v[i]) return false;
        saved = {int(v[0]),int(v[1]),v[2],v[3],v[4],v[5],v[6],v[7],v[8],v[9],int(v[10])};
        if(version==12){double g[3];in.read(reinterpret_cast<char*>(g),sizeof(g));if(!in||(g[2]!=0&&g[2]!=1))return false;saved.galaxyMassRatio=g[0];saved.galaxyOffsetKpc=g[1];saved.galaxyRetrograde=g[2]==1;}
        saved.selfGravity = version == 6 || version == 8 || version == 9;
        if(version==10){uint32_t gravity=2;in.read(reinterpret_cast<char*>(&gravity),4);in.read(reinterpret_cast<char*>(&saved.relaxationSeconds),8);if(!in||gravity>1)return false;saved.selfGravity=gravity==1;}
        if(version==9){in.read(reinterpret_cast<char*>(&saved.relaxationSeconds),8);if(!in||saved.relaxationSeconds<=0)return false;}
        if(version==4||version==11){uint32_t count=0;in.read(reinterpret_cast<char *>(&count),4);if(!in||count<2||count>8)return false;
            for(uint32_t i=0;i<count;++i){uint32_t len=0;in.read(reinterpret_cast<char *>(&len),4);if(!in||len<1||len>192)return false;
                std::string name(len,'\0');in.read(&name[0],len);double d[8];in.read(reinterpret_cast<char *>(d),sizeof(d));if(!in)return false;
                for(double x:d)if(!std::isfinite(x))return false;
                if(d[7]<0||d[7]>5||std::trunc(d[7])!=d[7])return false;
                saved.orbitBodies.push_back({name,d[0],d[1],d[2],d[3],d[4],d[5],d[6],int(d[7])});if(version==11){in.read(reinterpret_cast<char*>(&saved.orbitBodies.back().radiusKm),8);if(!in||saved.orbitBodies.back().radiusKm<=0)return false;}}}
        if (!validConfig(saved) || saved.duration != duration || ((version==3||version==4||version==11)!=(saved.preset>=3&&saved.preset<=5)) || ((version==12)!=(saved.preset==6)) || (version==4||version==11)!=(saved.preset==5)) return false;
    }
    std::deque<std::shared_ptr<Frame>> frames;
    for (uint32_t k = 0; k < n; ++k) {
        uint32_t count = 0;
        in.read(reinterpret_cast<char *>(&count), 4);
        if (count == 0 || count > 10000)
            return false;
        auto f = std::make_shared<Frame>();
        double v[4];
        in.read(reinterpret_cast<char *>(v), sizeof(v));
        if (!in)
            return false;
        for (double d : v)
            if (!std::isfinite(d))
                return false;
        f->time = v[0];
        f->maxSpeed = v[1];
        f->meanDensity = v[2];
        f->totalMass = v[3];
        in.read(reinterpret_cast<char *>(f->centers), sizeof(f->centers));
        for (double d : f->centers)
            if (!std::isfinite(d))
                return false;
        f->particles.resize(count);
        in.read(reinterpret_cast<char *>(f->particles.data()), count * sizeof(Particle));
        if (!in)
            return false;
        for (const auto &p : f->particles)
            if (!std::isfinite(p.x) || !std::isfinite(p.y) || !std::isfinite(p.z) ||
                !std::isfinite(p.speed) || !std::isfinite(p.density) || (p.body < 0 || p.body > ((version==3||version==4||version==11)?7:1) || std::trunc(p.body)!=p.body))
                return false;
        if(version>=5&&version<=10){
            f->sph.available=true;in.read(reinterpret_cast<char *>(f->sph.values.data()),sizeof(double)*10);
            f->scalars.resize(count);in.read(reinterpret_cast<char *>(f->scalars.data()),count*sizeof(SphScalar));
            if(!in||!validSphDiagnostics(f->sph))return false;
            for(const auto &p:f->scalars)if(!validSphScalar(p))return false;
        }
        if(version>=7&&version<=10){f->sph.structure.available=true;in.read(reinterpret_cast<char*>(f->sph.structure.values.data()),sizeof(double)*4);
            if(!in||!validSphStructure(f->sph.structure)||(!saved.selfGravity&&f->sph.structure.values[0]!=0))return false;}
        if(version==10){uint32_t groups=0;in.read(reinterpret_cast<char*>(&groups),4);if(!in||groups==0||groups>count)return false;
            f->fragments.available=true;f->fragments.labels.resize(count);f->fragments.groups.resize(groups);in.read(reinterpret_cast<char*>(f->fragments.labels.data()),count*4);
            for(auto&g:f->fragments.groups){in.read(reinterpret_cast<char*>(&g.anchor),4);in.read(reinterpret_cast<char*>(&g.count),4);in.read(reinterpret_cast<char*>(&g.mass),8);in.read(reinterpret_cast<char*>(g.center.data()),24);in.read(reinterpret_cast<char*>(g.velocity.data()),24);in.read(reinterpret_cast<char*>(&g.rmsRadius),8);}
            if(!in||!validSphFragments(f->fragments,count,f->totalMass))return false;}
        if(version==12){
            if(count!=uint32_t(saved.count))return false;
            f->galaxy.available=true;in.read(reinterpret_cast<char*>(f->galaxy.values.data()),40);double errors[2];in.read(reinterpret_cast<char*>(errors),16);
            if(!in||!validGalaxyDiagnostics(f->galaxy)||!std::isfinite(errors[0])||!std::isfinite(errors[1]))return false;
            f->energyError=errors[0];f->angularError=errors[1];
            for(uint32_t i=0;i<count;i++)if(f->particles[i].body!=(i<count/2?0:1)||f->particles[i].density!=0||f->particles[i].speed<0)return false;
            if(f->time>duration||f->maxSpeed<0||f->meanDensity!=0||f->totalMass<=0)return false;
        }
        if(version==11){
            int32_t a,b;in.read(reinterpret_cast<char*>(&f->contact.count),4);in.read(reinterpret_cast<char*>(&a),4);in.read(reinterpret_cast<char*>(&b),4);in.read(reinterpret_cast<char*>(&f->contact.time),8);in.read(reinterpret_cast<char*>(&f->contact.speed),8);f->contact.a=a;f->contact.b=b;
            if(!in||f->contact.count>1000000||!std::isfinite(f->contact.time)||!std::isfinite(f->contact.speed)||f->contact.time<0||f->contact.time>f->time+1.e-12||f->contact.speed<0)return false;
            if(f->contact.count==0){if(a!=-1||b!=-1||f->contact.time!=0||f->contact.speed!=0)return false;}
            else if(a<0||b<=a||b>=int(count)||f->contact.speed<=0)return false;
            if(!frames.empty()){const auto& old=frames.back()->contact;
                if(f->contact.count<old.count||f->contact.time<old.time)return false;
                if(f->contact.count==old.count&&(a!=old.a||b!=old.b||f->contact.time!=old.time||f->contact.speed!=old.speed))return false;}
            for(const auto& body:saved.orbitBodies)f->radiiAU.push_back(body.radiusKm*1000/AU);
        }
        if(version==3||version==4||version==11){
            if(count!=uint32_t(saved.preset==5?saved.orbitBodies.size():(saved.preset==3?2:4)))return false;
            f->orbital=true;for(uint32_t i=0;i<count;++i)f->surfaces.push_back(saved.preset==5?saved.orbitBodies[i].surface:int(i));double d[2];uint32_t nt=0;
            in.read(reinterpret_cast<char *>(d),sizeof(d));in.read(reinterpret_cast<char *>(&nt),4);
            if(!in||!std::isfinite(d[0])||!std::isfinite(d[1])||nt==0||nt>count*512||nt%count!=0)return false;
            f->energyError=d[0];f->angularError=d[1];f->trails.resize(nt);
            in.read(reinterpret_cast<char *>(f->trails.data()),nt*sizeof(Particle));if(!in)return false;
            for(uint32_t i=0;i<nt;++i){const auto &p=f->trails[i];if(!std::isfinite(p.x)||!std::isfinite(p.y)||!std::isfinite(p.z)||!std::isfinite(p.speed)||!std::isfinite(p.density)||p.body!=float(i/(nt/count)))return false;}
            for(uint32_t i=0;i<count;++i)if(f->particles[i].body!=float(i))return false;
        }
        if(f->time<0||f->time>duration+0.15||(!frames.empty()&&f->time<frames.back()->time))return false;
        frames.push_back(f);
    }
    if (in.peek() != std::char_traits<char>::eof())
        return false;
    std::lock_guard<std::mutex> lock(mutex);
    ++generation;
    pending = false;
    paused = false;
    history = std::move(frames);
    current = Status{};
    current.state = "replay";
    preparation=PreparationTracker{};
    current.configKnown = version >= 2;
    if (current.configKnown) config = saved;else config=Config{};
    current.duration = duration;
    current.selected = 0;
    cv.notify_all();
    return true;
}
} // namespace lab
