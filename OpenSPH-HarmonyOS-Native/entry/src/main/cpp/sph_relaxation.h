#pragma once
#include "Sph.h"
#include "sph_gravity.h"
#include "sph/solvers/StabilizationSolver.h"
#include "io/LogWriter.h"
#include "thread/Scheduler.h"
#include <functional>
#include <cmath>
#include <stdexcept>
namespace lab {
// Preparation only: each stationary body evolves in isolation. This dissipates
// energy and resets fracture; it is not part of the physical collision clock.
class SphPreRelaxation : public Sph::IRun, public Sph::IRunCallbacks {
    std::function<bool()> cancelled;
    int expectedSteps, steps=0;
public:
    SphPreRelaxation(const Sph::RunSettings& initial,double seconds,std::function<bool()> stop,double damping=.5)
        :cancelled(std::move(stop)),expectedSteps(0) {
        using namespace Sph;
        if(!std::isfinite(seconds)||seconds<=0||seconds>64||!std::isfinite(damping)||damping<0||damping>1)throw std::invalid_argument("Invalid relaxation settings");
        expectedSteps=int(seconds*16);if(seconds*16!=expectedSteps)throw std::invalid_argument("Invalid relaxation duration");
        settings=initial;scheduler=SequentialScheduler::getGlobalInstance();
        configureSphGravity(settings,true);
        settings.set(RunSettingsId::RUN_START_TIME,Float(0));settings.set(RunSettingsId::RUN_END_TIME,Float(seconds));
        settings.set(RunSettingsId::RUN_TIMESTEP_CNT,expectedSteps);
        settings.set(RunSettingsId::TIMESTEPPING_CRITERION,EMPTY_FLAGS);
        settings.set(RunSettingsId::TIMESTEPPING_INITIAL_TIMESTEP,Float(1./16));settings.set(RunSettingsId::TIMESTEPPING_MAX_TIMESTEP,Float(1./16));
        settings.set(RunSettingsId::SPH_STABILIZATION_DAMPING,Float(damping));
        settings.set(RunSettingsId::RUN_LOGGER,LoggerEnum::NONE);settings.set(RunSettingsId::RUN_OUTPUT_TYPE,IoEnum::NONE);
        logWriter=makeAuto<NullLogWriter>();
    }
    void setUp(Sph::SharedPtr<Sph::Storage> s) override {
        using namespace Sph;
        if(cancelled())throw std::runtime_error("Preparation cancelled");
        solver=makeAuto<StabilizationSolver>(settings,Factory::getSolver(*scheduler,settings));
        for(Size i=0;i<s->getMaterialCnt();++i)solver->create(*s,s->getMaterial(i));
    }
    void onSetUp(const Sph::Storage&,Sph::Statistics&) override {}
    void onTimeStep(const Sph::Storage& s,Sph::Statistics&) override {
        using namespace Sph;++steps;
        const auto&r=s.getValue<Vector>(QuantityId::POSITION);const auto&v=s.getDt<Vector>(QuantityId::POSITION);
        const auto&rho=s.getValue<Float>(QuantityId::DENSITY);const auto&u=s.getValue<Float>(QuantityId::ENERGY);
        for(Size i=0;i<r.size();++i)if(!isReal(r[i])||!isReal(v[i])||!std::isfinite(rho[i])||rho[i]<=0||!std::isfinite(u[i]))throw std::runtime_error("Non-finite relaxation state");
    }
    bool shouldAbortRun() const override {return cancelled();}
    void tearDown(const Sph::Storage&,const Sph::Statistics&) override {
        if(cancelled()||steps!=expectedSteps)throw std::runtime_error("Incomplete relaxation");
    }
};
inline void prepareStationaryBody(Sph::Storage& s,const Sph::RunSettings& settings,double seconds,const std::function<bool()>& stop) {
    SphPreRelaxation run(settings,seconds,stop);run.run(s,run);
    using namespace Sph;
    // Remove residual preparation motion before applying the requested spin and
    // impact velocity. Keep evolved positions, density, internal energy and stress.
    for(auto&v:s.getDt<Vector>(QuantityId::POSITION))v=Vector(0._f);
    s.zeroHighestDerivatives(*SequentialScheduler::getGlobalInstance());
}
}
