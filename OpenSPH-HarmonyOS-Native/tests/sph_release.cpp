#include "sph_relaxation.h"
#include "sph_structure.h"
#include <iostream>
#include <iomanip>
using namespace Sph;
static void require(bool b,const char* why){if(!b)throw std::runtime_error(why);}
static lab::SphStructure measure(const Storage&s){std::vector<lab::StructureParticle> p;const auto&m=s.getValue<Float>(QuantityId::MASS);const auto&r=s.getValue<Vector>(QuantityId::POSITION);const auto&v=s.getDt<Vector>(QuantityId::POSITION);for(Size i=0;i<m.size();++i)p.push_back({m[i],{r[i][X],r[i][Y],r[i][Z]},{v[i][X],v[i][Y],v[i][Z]}});return lab::measureSphStructure(p,0);}
class FreeSphere:public IRun,public IRunCallbacks {
    int budget,steps=0;double prepared,dt,mass0=0,radius0=0,lastK=0,meanK=0,maxRadiusPercent=0,peakRadial=0,maxAcceleration=0,maxMomentum=0,finalAcceleration=0;Vector center0=Vector(0._f);
public:
    FreeSphere(int count,double preparation,double timeStep):budget(count),prepared(preparation),dt(timeStep){
        scheduler=SequentialScheduler::getGlobalInstance();lab::configureSphGravity(settings,true);
        settings.set(RunSettingsId::RUN_LOGGER,LoggerEnum::NONE);settings.set(RunSettingsId::RUN_OUTPUT_TYPE,IoEnum::NONE);logWriter=makeAuto<NullLogWriter>();
        settings.set(RunSettingsId::RUN_RNG_SEED,1234);settings.set(RunSettingsId::RUN_END_TIME,32._f);settings.set(RunSettingsId::RUN_TIMESTEP_CNT,int(32/dt));
        settings.set(RunSettingsId::TIMESTEPPING_CRITERION,EMPTY_FLAGS);settings.set(RunSettingsId::TIMESTEPPING_INITIAL_TIMESTEP,Float(dt));settings.set(RunSettingsId::TIMESTEPPING_MAX_TIMESTEP,Float(dt));
    }
    void setUp(SharedPtr<Storage>s)override{InitialConditions ic(settings);BodySettings b;b.set(BodySettingsId::PARTICLE_COUNT,budget);ic.addMonolithicBody(*s,SphericalDomain(Vector(0._f),100000._f),b);
        if(prepared>0)lab::prepareStationaryBody(*s,settings,prepared,[]{return false;});}
    void onSetUp(const Storage&s,Statistics&)override{
        auto initial=measure(s);radius0=initial.values[2];require(initial.values[1]==0,"release must start stationary");
        const auto&m=s.getValue<Float>(QuantityId::MASS);const auto&r=s.getValue<Vector>(QuantityId::POSITION);for(Size i=0;i<m.size();++i){mass0+=m[i];center0+=m[i]*r[i];}center0/=mass0;
    }
    void onTimeStep(const Storage&s,Statistics&)override{
        ++steps;auto state=measure(s);meanK+=dt/32*(lastK/2+state.values[1]/2);lastK=state.values[1];maxRadiusPercent=std::max(maxRadiusPercent,std::abs(state.values[2]/radius0-1)*100);peakRadial=std::max(peakRadial,std::abs(state.values[3]));
        const auto&m=s.getValue<Float>(QuantityId::MASS);const auto&r=s.getValue<Vector>(QuantityId::POSITION);const auto&v=s.getDt<Vector>(QuantityId::POSITION);const auto&a=s.getD2t<Vector>(QuantityId::POSITION);double mass=0,ar2=0;Vector momentum(0._f),center(0._f);
        for(Size i=0;i<m.size();++i){mass+=m[i];momentum+=m[i]*v[i];center+=m[i]*r[i];ar2+=m[i]*(a[i][X]*a[i][X]+a[i][Y]*a[i][Y]+a[i][Z]*a[i][Z]);}
        finalAcceleration=std::sqrt(ar2/mass);require(std::isfinite(finalAcceleration),"invalid acceleration");maxAcceleration=std::max(maxAcceleration,finalAcceleration);
        double pe=getLength(momentum)/(mass0*1000),ce=getLength(center/mass-center0)/100000;maxMomentum=std::max(maxMomentum,pe);
        require(std::abs(mass/mass0-1)<1e-12&&pe<1e-10&&ce<1e-10,"release mass/COM/momentum invariant");
    }
    bool shouldAbortRun()const override{return false;}
    void tearDown(const Storage&s,const Statistics&)override{
        require(steps==int(32/dt),"incomplete free evolution");
        std::cout<<"{\"budget\":"<<budget<<",\"preparationSeconds\":"<<prepared<<",\"dt\":"<<dt<<",\"timeSeconds\":32,\"steps\":"<<steps<<",\"count\":"<<s.getParticleCnt()<<",\"initialRadiusKm\":"<<radius0<<",\"meanKineticJ\":"<<meanK<<",\"finalKineticJ\":"<<lastK<<",\"maxRadiusChangePercent\":"<<maxRadiusPercent<<",\"peakAbsRadialMS\":"<<peakRadial<<",\"peakRmsAccelerationMS2\":"<<maxAcceleration<<",\"finalRmsAccelerationMS2\":"<<finalAcceleration<<",\"maxMomentumError\":"<<maxMomentum<<"}"<<std::endl;
    }
};
int main(){try{auto keep=Factory::getScheduler(RunSettings{});std::cout<<std::setprecision(17);
 for(int count:{200,600})for(double prep:{0.,16.,64.})for(double dt:{.0625,.03125}){FreeSphere run(count,prep,dt);Storage s;run.run(s,run);}
 std::cout<<"{\"ok\":true,\"cases\":12}"<<std::endl;return 0;
}catch(const std::exception&e){std::cerr<<"FAIL "<<e.what()<<std::endl;return 1;}}
