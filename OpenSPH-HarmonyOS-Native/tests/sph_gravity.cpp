// Independent shell integration reference plus actual IRun material evolution.
#include "Sph.h"
#include "sph_gravity.h"
#include "system/Factory.h"
#include "gravity/IGravity.h"
#include "io/LogWriter.h"
#include "thread/Scheduler.h"
#include <cmath>
#include <iomanip>
#include <iostream>
#include <stdexcept>
using namespace Sph;
static void require(bool ok,const char* why){if(!ok)throw std::runtime_error(why);}
// Integrate the normalized cubic density over spherical shells. No production
// gravity LUT/force/potential function is called by this reference.
static double shellMass(double q){
    if(q>=2)return 1;
    const int n=400;const double dx=q/n;double sum=0;
    for(int i=0;i<=n;++i){double x=i*dx,w=x<1?1-1.5*x*x+.75*x*x*x:.25*std::pow(2-x,3);
        sum+=(i==0||i==n?1:(i%2?4:2))*4*x*x*w;}
    return sum*dx/3;
}
static double potential(double q){
    if(q>=2)return -1/q;
    const int n=400;double sum=0,dx=(2-q)/n;
    for(int i=0;i<=n;++i){double x=q+i*dx,f=x==0?0:shellMass(x)/(x*x);sum+=(i==0||i==n?1:(i%2?4:2))*f;}
    return -.5-sum*dx/3;
}
static void forceReference(){
    auto scheduler=SequentialScheduler::getGlobalInstance();Statistics stats;RunSettings settings;lab::configureSphGravity(settings,true);
    double maxForce=0,maxPotential=0,maxMomentum=0;int cases=0;
    // Includes coincidence, unequal smoothing lengths, LUT interior/boundaries,
    // exterior Newtonian recovery and multiple softening scales in SI units.
    for(double scale:{100.,10000.,100000.})for(double q:{0.,.0001,.1,.5,.999,1.,1.001,1.5,1.999,2.,2.001,5.}){
        Storage s;s.insert<Vector>(QuantityId::POSITION,OrderEnum::SECOND,Array<Vector>{Vector(0,0,0,scale*.5),Vector(q*scale,0,0,scale*1.5)});
        s.insert<Float>(QuantityId::MASS,OrderEnum::ZERO,Array<Float>{2.e17,5.e17});
        auto g=Factory::getGravity(settings);g->build(*scheduler,s);
        auto& a=s.getD2t<Vector>(QuantityId::POSITION);g->evalSelfGravity(*scheduler,a,stats);
        const double G=Constants::gravity,normalized=q==0?0:shellMass(q)/(q*q);
        double err=std::abs(a[0][X]/(G*5.e17/(scale*scale))-normalized);
        double pe=std::abs(g->evalEnergy(*scheduler,stats)/(G*2.e17*5.e17/scale)-potential(q));
        double me=std::abs(2.e17*a[0][X]+5.e17*a[1][X])/(G*2.e17*5.e17/(scale*scale));
        require(std::isfinite(err)&&err<2.e-5,"softened acceleration differs from shell integral");
        require(std::isfinite(pe)&&pe<2.e-5,"potential differs from shell integral");require(me<1.e-12,"pair momentum drift");
        maxForce=std::max(maxForce,err);maxPotential=std::max(maxPotential,pe);maxMomentum=std::max(maxMomentum,me);++cases;
    }
    std::cout<<"{\"kind\":\"force-reference\",\"cases\":"<<cases<<",\"maxForceError\":"<<maxForce<<",\"maxPotentialError\":"<<maxPotential<<",\"maxMomentumError\":"<<maxMomentum<<"}"<<std::endl;
}
struct Result {double radial=0,rmsRadius=0,momentum=0;};
class Sphere:public IRun,public IRunCallbacks{
    bool enabled;int budget,steps=0;double dt;double mass0=0;Vector center0=Vector(0._f);
public:
    Result result;
    Sphere(bool gravity,int count,double timestep):enabled(gravity),budget(count),dt(timestep){
        scheduler=SequentialScheduler::getGlobalInstance();lab::configureSphGravity(settings,enabled);
        settings.set(RunSettingsId::RUN_LOGGER,LoggerEnum::NONE);settings.set(RunSettingsId::RUN_OUTPUT_TYPE,IoEnum::NONE);
        settings.set(RunSettingsId::RUN_RNG_SEED,1234);settings.set(RunSettingsId::RUN_END_TIME,5._f);
        settings.set(RunSettingsId::RUN_TIMESTEP_CNT,int(4/dt));settings.set(RunSettingsId::TIMESTEPPING_CRITERION,EMPTY_FLAGS);
        settings.set(RunSettingsId::TIMESTEPPING_INITIAL_TIMESTEP,Float(dt));settings.set(RunSettingsId::TIMESTEPPING_MAX_TIMESTEP,Float(dt));
        logWriter=makeAuto<NullLogWriter>();
    }
    void setUp(SharedPtr<Storage> s)override{InitialConditions ic(settings);BodySettings b;b.set(BodySettingsId::PARTICLE_COUNT,budget);ic.addMonolithicBody(*s,SphericalDomain(Vector(0._f),100000._f),b);}
    void onSetUp(const Storage&s,Statistics&)override{const auto&m=s.getValue<Float>(QuantityId::MASS);const auto&r=s.getValue<Vector>(QuantityId::POSITION);for(Size i=0;i<m.size();++i){mass0+=m[i];center0+=m[i]*r[i];}center0/=mass0;}
    void onTimeStep(const Storage&s,Statistics&)override{
        ++steps;double mass=0,radial=0,r2=0;Vector momentum(0._f),center(0._f);
        const auto&m=s.getValue<Float>(QuantityId::MASS);const auto&r=s.getValue<Vector>(QuantityId::POSITION);const auto&v=s.getDt<Vector>(QuantityId::POSITION);
        for(Size i=0;i<m.size();++i){mass+=m[i];momentum+=m[i]*v[i];center+=m[i]*r[i];const Vector d=r[i]-center0;double radius=getLength(d);r2+=m[i]*radius*radius;if(radius>0)radial+=m[i]*dot(d,v[i])/radius;}
        double me=getLength(momentum)/(mass0*1000),ce=getLength(center/mass-center0)/100000;
        require(std::isfinite(radial)&&std::isfinite(r2)&&std::abs(mass/mass0-1)<1.e-12&&me<1.e-10&&ce<1.e-10,"sphere invariant failed");
        result={radial/mass,std::sqrt(r2/mass),std::max(result.momentum,me)};
    }
    void tearDown(const Storage&s,const Statistics&)override{require(steps==int(4/dt),"incomplete sphere");std::cout<<"{\"kind\":\"sphere\",\"selfGravity\":"<<(enabled?"true":"false")<<",\"budget\":"<<budget<<",\"count\":"<<s.getParticleCnt()<<",\"dt\":"<<dt<<",\"steps\":"<<steps<<",\"timeSeconds\":4,\"radialMS\":"<<result.radial<<",\"rmsRadiusM\":"<<result.rmsRadius<<",\"maxMomentumError\":"<<result.momentum<<"}"<<std::endl;}
    bool shouldAbortRun()const override{return false;}
};
int main(){try{
    // Keep the default scheduler alive while IRun constructors replace their
    // temporary reference with the sequential scheduler (upstream startup teardown race).
    auto schedulerLifetime=Factory::getScheduler(RunSettings{});
    std::cout<<std::setprecision(17);forceReference();
    for(int n:{200,600,1200}){Sphere off(false,n,.03125),on(true,n,.03125),fine(true,n,.015625);Storage a,b,c;off.run(a,off);on.run(b,on);fine.run(c,fine);
        require(on.result.radial<off.result.radial-.01,"gravity did not change material motion inward");
        require(std::abs(on.result.radial-fine.result.radial)<.01,"short-time radial timestep sensitivity");}
    std::cout<<"{\"kind\":\"complete\",\"ok\":true,\"sphereRuns\":9}"<<std::endl;return 0;
}catch(const std::exception&e){std::cerr<<e.what()<<std::endl;return 1;}}
