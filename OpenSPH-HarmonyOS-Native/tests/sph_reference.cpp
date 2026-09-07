// Independent extraction directly from OpenSPH Storage. Same application initial
// conditions and time stepping, but no lab::Engine or diagnostic accumulator.
#include "Sph.h"
#include "io/LogWriter.h"
#include "thread/Scheduler.h"
#include <algorithm>
#include <cmath>
#include <iomanip>
#include <iostream>
using namespace Sph;
class Reference : public IRun, public IRunCallbacks {
    int preset;double elapsed=0,usedDt=.02;
public:
    Reference(int p):preset(p){scheduler=SequentialScheduler::getGlobalInstance();settings.set(RunSettingsId::RUN_LOGGER,LoggerEnum::NONE);settings.set(RunSettingsId::RUN_OUTPUT_TYPE,IoEnum::NONE);settings.set(RunSettingsId::RUN_RNG_SEED,1234);settings.set(RunSettingsId::RUN_END_TIME,10._f);settings.set(RunSettingsId::TIMESTEPPING_CRITERION,TimeStepCriterionEnum::COURANT);settings.set(RunSettingsId::TIMESTEPPING_INITIAL_TIMESTEP,.02_f);settings.set(RunSettingsId::TIMESTEPPING_MAX_TIMESTEP,.15_f);logWriter=makeAuto<NullLogWriter>();}
    void setUp(SharedPtr<Storage> storage)override{
        InitialConditions ic(settings);BodySettings b;b.set(BodySettingsId::PARTICLE_COUNT,preset==2?200:150);b.set(BodySettingsId::DENSITY,2700._f);
        auto target=ic.addMonolithicBody(*storage,SphericalDomain(Vector(0._f),100000._f),b);
        if(preset==2)target.addRotation(Vector(0._f,0._f,.006_f),Vector(0._f));
        else{b.set(BodySettingsId::PARTICLE_COUNT,50);const double y=preset==1?std::sin(3.141592653589793/4)*180000*.5:0;
            auto impactor=ic.addMonolithicBody(*storage,SphericalDomain(Vector(180000._f,Float(y),0._f),60000._f),b);impactor.addVelocity(Vector(-5000._f,0._f,0._f));}
    }
    void onSetUp(const Storage &,Statistics &)override{}
    void onTimeStep(const Storage &,Statistics &stats)override{elapsed+=usedDt;if(stats.has(StatisticsId::TIMESTEP_VALUE))usedDt=stats.get<Float>(StatisticsId::TIMESTEP_VALUE);}
    bool shouldAbortRun()const override{return false;}
    void tearDown(const Storage &s,const Statistics &)override{
        const auto &m=s.getValue<Float>(QuantityId::MASS),&p=s.getValue<Float>(QuantityId::PRESSURE),&u=s.getValue<Float>(QuantityId::ENERGY),&d=s.getValue<Float>(QuantityId::DAMAGE);const auto &v=s.getDt<Vector>(QuantityId::POSITION);
        double mass=0,pm=0,um=0,dm=0,ke=0,ie=0,pmin=1e300,pmax=-1e300,umin=1e300,umax=-1e300,dmax=0;
        for(Size i=0;i<m.size();++i){const double pressure=p[i]/1e9,energy=u[i]/1e6,damage=std::pow(double(d[i]),3);mass+=m[i];pm+=m[i]*pressure;um+=m[i]*energy;dm+=m[i]*damage;ie+=m[i]*u[i];ke+=.5*m[i]*(v[i][X]*v[i][X]+v[i][Y]*v[i][Y]+v[i][Z]*v[i][Z]);pmin=std::min(pmin,pressure);pmax=std::max(pmax,pressure);umin=std::min(umin,energy);umax=std::max(umax,energy);dmax=std::max(dmax,damage);}
        std::cout<<std::setprecision(17)<<"{\"preset\":"<<preset<<",\"count\":"<<m.size()<<",\"time\":"<<elapsed<<",\"mass\":"<<mass<<",\"values\":["<<pmin<<","<<pmax<<","<<pm/mass<<","<<umin<<","<<umax<<","<<um/mass<<","<<dm/mass<<","<<dmax<<","<<ke<<","<<ie<<"]}"<<std::endl;
    }
};
int main(){try{for(int p=0;p<3;++p){Reference run(p);Storage s;run.run(s,run);}}catch(const std::exception &e){std::cerr<<e.what()<<std::endl;return 1;}}
