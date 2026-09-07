// Constitutive limiting cases and controlled numerical sensitivity, not a
// shock-tube solution or independent validation of asteroid impact physics.
#include "Sph.h"
#include "physics/Eos.h"
#include "io/LogWriter.h"
#include "thread/Scheduler.h"
#include <array>
#include <cmath>
#include <iomanip>
#include <iostream>
#include <stdexcept>
using namespace Sph;

static void require(bool value, const char* message) {
    if (!value) throw std::runtime_error(message);
}
static double relative(double a, double b) {
    return std::abs(a-b)/std::max(1.,std::abs(b));
}
static void eosBaseline() {
    int checks=0;
    auto near=[&](double a,double b,double tolerance) {
        require(std::isfinite(a)&&relative(a,b)<=tolerance,"EOS limiting case failed");++checks;
    };
    IdealGasEos gas(1.4_f);
    for (double rho : {0.125,1.,10.}) for (double u : {1.,2.5,100.}) {
        const auto result=gas.evaluate(rho,u);
        near(result[0],.4*rho*u,1.e-12);
        near(result[1],std::sqrt(1.4*.4*u),1.e-12);
    }
    BodySettings b;TillotsonEos rock(b);
    const double rho0=b.get<Float>(BodySettingsId::DENSITY);
    const double A=b.get<Float>(BodySettingsId::BULK_MODULUS);
    const double B=b.get<Float>(BodySettingsId::TILLOTSON_NONLINEAR_B);
    const auto rest=rock.evaluate(rho0,0._f);
    near(rest[0],0.,1.e-12);near(rest[1],std::sqrt(A/rho0),1.e-12);
    // At zero specific energy the cold pressure reduces to A*mu+B*mu^2.
    for (double mu : {-.1,-.01,.01,.1,.5}) {
        near(rock.evaluate(rho0*(1.+mu),0._f)[0],A*mu+B*mu*mu,1.e-12);
    }
    // Finite difference of the cold pressure at the reference density gives
    // the bulk modulus. This exercises evaluation without its derivative code.
    const double epsilon=1.e-5;
    near((rock.evaluate(rho0*(1.+epsilon),0._f)[0]-
          rock.evaluate(rho0*(1.-epsilon),0._f)[0])/(2.*epsilon),A,1.e-9);
    // Continuity at the two expanded-material branch boundaries. This does
    // not assert that interpolated sound speed is an exact EOS derivative.
    for (auto key : {BodySettingsId::TILLOTSON_ENERGY_IV,BodySettingsId::TILLOTSON_ENERGY_CV}) {
        const double u=b.get<Float>(key);
        const auto lo=rock.evaluate(.8*rho0,u*(1.-1.e-9));
        const auto hi=rock.evaluate(.8*rho0,u*(1.+1.e-9));
        near(lo[0],hi[0],1.e-6);near(lo[1],hi[1],1.e-6);
    }
    std::cout<<"{\"kind\":\"eos\",\"ok\":true,\"checks\":"<<checks
             <<",\"rho0KgM3\":"<<rho0<<",\"bulkModulusPa\":"<<A
             <<",\"referenceSoundSpeedMS\":"<<rest[1]<<"}"<<std::endl;
}

struct Summary {
    double mass=0,pressureMax=-1.e300,internalMean=0,damageMean=0,kinetic=0,internal=0;
    std::array<double,3> momentum{},center{};
};
static Summary summarize(const Storage& s) {
    Summary out;
    const auto& m=s.getValue<Float>(QuantityId::MASS);
    const auto& p=s.getValue<Float>(QuantityId::PRESSURE);
    const auto& u=s.getValue<Float>(QuantityId::ENERGY);
    const auto& d=s.getValue<Float>(QuantityId::DAMAGE);
    const auto& r=s.getValue<Vector>(QuantityId::POSITION);
    const auto& v=s.getDt<Vector>(QuantityId::POSITION);
    for(Size i=0;i<m.size();++i) {
        require(std::isfinite(m[i])&&m[i]>0&&std::isfinite(p[i])&&std::isfinite(u[i])&&
                std::isfinite(d[i])&&d[i]>=0&&d[i]<=1.,"invalid Storage scalar");
        out.mass+=m[i];out.pressureMax=std::max(out.pressureMax,double(p[i]));
        out.internal+=m[i]*u[i];out.damageMean+=m[i]*std::pow(double(d[i]),3);
        for(int k=0;k<3;++k) {
            require(std::isfinite(r[i][k])&&std::isfinite(v[i][k]),"invalid Storage vector");
            out.momentum[k]+=m[i]*v[i][k];out.center[k]+=m[i]*r[i][k];
            out.kinetic+=.5*m[i]*v[i][k]*v[i][k];
        }
    }
    out.internalMean=out.internal/out.mass;out.damageMean/=out.mass;
    for(double& x:out.center)x/=out.mass;
    return out;
}

class Study : public IRun, public IRunCallbacks {
    int budget,repeat,steps=0;double dt;Summary initial;
public:
    Study(int count,double timestep,int rep=0):budget(count),repeat(rep),dt(timestep) {
        scheduler=SequentialScheduler::getGlobalInstance();
        settings.set(RunSettingsId::RUN_LOGGER,LoggerEnum::NONE);
        settings.set(RunSettingsId::RUN_OUTPUT_TYPE,IoEnum::NONE);
        settings.set(RunSettingsId::RUN_RNG_SEED,1234);
        settings.set(RunSettingsId::RUN_END_TIME,17._f);
        settings.set(RunSettingsId::RUN_TIMESTEP_CNT,int(16./dt));
        // No adaptive criterion: exact binary dt and fixed number of steps
        // ensure every resolution is compared at precisely the same time.
        settings.set(RunSettingsId::TIMESTEPPING_CRITERION,EMPTY_FLAGS);
        settings.set(RunSettingsId::TIMESTEPPING_INITIAL_TIMESTEP,Float(dt));
        settings.set(RunSettingsId::TIMESTEPPING_MAX_TIMESTEP,Float(dt));
        logWriter=makeAuto<NullLogWriter>();
    }
    void setUp(SharedPtr<Storage> s) override {
        InitialConditions ic(settings);BodySettings b;
        b.set(BodySettingsId::PARTICLE_COUNT,budget*3/4);
        b.set(BodySettingsId::DENSITY,2700._f);
        ic.addMonolithicBody(*s,SphericalDomain(Vector(0._f),100000._f),b);
        b.set(BodySettingsId::PARTICLE_COUNT,budget/4);
        auto impactor=ic.addMonolithicBody(*s,SphericalDomain(Vector(180000._f,0._f,0._f),60000._f),b);
        impactor.addVelocity(Vector(-5000._f,0._f,0._f));
    }
    void onSetUp(const Storage& s,Statistics&) override {
        initial=summarize(s);
        const double targetMass=4./3.*std::acos(-1.)*1.e15*2700.;
        const double impactorMass=4./3.*std::acos(-1.)*std::pow(60000.,3)*2700.;
        require(relative(initial.mass,targetMass+impactorMass)<1.e-12,"initial sphere mass mismatch");
        require(relative(initial.momentum[0],-5000.*impactorMass)<1.e-12,"initial impact momentum mismatch");
    }
    void onTimeStep(const Storage& s,Statistics& stats) override {
        ++steps;
        require(stats.get<Float>(StatisticsId::TIMESTEP_VALUE)==dt,"fixed timestep changed");
        require(stats.get<Float>(StatisticsId::RUN_TIME)==(steps-1)*dt,"step clock mismatch");
        // Validate every step; emit matched 4, 8, 12, 16 second samples only.
        const Summary now=summarize(s);
        double momentumError=0,centerError=0;
        for(int k=0;k<3;++k) {
            momentumError=std::max(momentumError,std::abs(now.momentum[k]-initial.momentum[k])/(initial.mass*5000.));
            centerError=std::max(centerError,std::abs(now.center[k]-initial.center[k]-initial.momentum[k]/initial.mass*steps*dt)/100000.);
        }
        require(relative(now.mass,initial.mass)<1.e-12,"mass drift");
        require(momentumError<1.e-10,"momentum drift");
        require(centerError<1.e-10,"center-of-mass drift");
        if(steps%int(4./dt)!=0)return;
        std::cout<<"{\"kind\":\"collision\",\"budget\":"<<budget<<",\"repeat\":"<<repeat
          <<",\"count\":"<<s.getParticleCnt()<<",\"dt\":"<<dt<<",\"steps\":"<<steps<<",\"time\":"<<steps*dt
          <<",\"massKg\":"<<now.mass<<",\"momentumError\":"<<momentumError<<",\"centerError\":"<<centerError
          <<",\"values\":["<<now.pressureMax/1.e9<<","<<now.internalMean/1.e6<<","<<now.damageMean
          <<","<<now.kinetic<<","<<now.internal<<"]}"<<std::endl;
    }
    bool shouldAbortRun() const override{return false;}
    void tearDown(const Storage&,const Statistics&) override {
        require(steps==int(16./dt),"incorrect final step count");
    }
};
int main() {
    try {
        static_assert(sizeof(Float)==8,"baseline expects double precision");
        std::cout<<std::setprecision(17);
        std::cout<<"{\"kind\":\"configuration\",\"schemaVersion\":1,\"model\":\"basalt-impact-v1\",\"upstream\":\"f3033faf4422a056dcb79cc6643c7c6f3d9fee19\",\"seed\":1234,\"targetRadiusKm\":100,\"impactorRadiusKm\":60,\"densityKgM3\":2700,\"speedKmS\":5,\"separationKm\":180,\"angle\":0,\"durationSeconds\":16,\"selfGravity\":false,\"timestep\":\"fixed\"}"<<std::endl;
        eosBaseline();
        for(double dt:{.125,.0625,.03125}){Study run(200,dt);Storage s;run.run(s,run);}
        for(int count:{600,1200}){Study run(count,.03125);Storage s;run.run(s,run);}
        Study repeat(200,.03125,1);Storage s;repeat.run(s,repeat);
        std::cout<<"{\"kind\":\"complete\",\"ok\":true,\"runs\":6}"<<std::endl;
    } catch(const std::exception& e) {std::cerr<<"FAIL "<<e.what()<<std::endl;return 1;}
}
