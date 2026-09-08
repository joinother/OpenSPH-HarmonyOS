#include "engine.h"
#include "Sph.h"
#include "physics/Rheology.h"
#include "thread/Scheduler.h"
#include "system/Factory.h"
#include <chrono>
#include <fstream>
#include <iostream>
#include <iomanip>
#include <thread>
#include <cstring>
using namespace lab;
using namespace Sph;
static void require(bool x,const char* message){if(!x)throw std::runtime_error(message);}
static bool near(double a,double b,double eps=1e-10){return std::abs(a-b)<=eps*std::max({1.,std::abs(a),std::abs(b)});}
static Status wait(Engine& e,bool complete=false){for(int i=0;i<24000;i++){auto s=e.status();if(s.state=="failed")throw std::runtime_error(s.error);if((complete?s.state=="completed":s.state=="paused"&&s.frames>0))return s;std::this_thread::sleep_for(std::chrono::milliseconds(5));}throw std::runtime_error("engine timeout");}
static void rheology(){
    // Drive the actual imported implementation with a large imposed deviatoric
    // stress, independently of the application diagnostic function.
    int cases=0;
    for(double u:{0.,17.,34.,1.7e6,3.4e6,6.8e6})for(double d:{0.,.875,1.}){
        BodySettings b;Storage s(Factory::getMaterial(b));
        Array<Float> energy(1);energy.fill(Float(u));s.insert<Float>(QuantityId::ENERGY,OrderEnum::FIRST,std::move(energy));
        VonMisesRheology model;MaterialInitialContext context;model.create(s,s.getMaterial(0),context);
        s.insert<Float>(QuantityId::DAMAGE,OrderEnum::FIRST,Float(std::cbrt(d)));
        const TracelessTensor stress(Vector(1e11_f,0._f,0._f),Vector(0._f,-1e11_f,0._f),Vector(0._f,0._f,0._f));
        s.insert<TracelessTensor>(QuantityId::DEVIATORIC_STRESS,OrderEnum::ZERO,stress);
        s.insert<Float>(QuantityId::PRESSURE,OrderEnum::ZERO,-100._f);
        model.initialize(*SequentialScheduler::getGlobalInstance(),s,s.getMaterial(0));
        const auto actual=s.getValue<TracelessTensor>(QuantityId::DEVIATORIC_STRESS)[0];
        const double effectiveD=std::pow(double(s.getValue<Float>(QuantityId::DAMAGE)[0]),3);
        const double ratio=u/3.4e6,expected=3.5e9*(1-effectiveD)*(ratio<1e-5?1:std::max(0.,1-ratio));
        require(near(std::sqrt(1.5*ddot(actual,actual)),expected),"upstream yield stress mismatch");
        require(near(rockResponse(u,effectiveD).strength,expected/3.5e9),"display strength disagrees with actual rheology");
        require(near(s.getValue<Float>(QuantityId::PRESSURE)[0],-100*(1-effectiveD)),"tensile damage reduction mismatch");++cases;
    }
    ResponseAccumulator weighted;weighted.add(0,0,1);weighted.add(3.4e6,1,3);auto r=weighted.finish();
    require(r.values==std::array<double,4>{.75,.75,.75,.25},"mass weighted response wrong");
    for(auto pair:{std::array<double,2>{NAN,0},std::array<double,2>{0,-.1},std::array<double,2>{0,1.1}}){bool rejected=false;try{rockResponse(pair[0],pair[1]);}catch(...){rejected=true;}require(rejected,"invalid response accepted");}
    std::cout<<"{\"rheologyCases\":"<<cases<<",\"massWeighted\":true}"<<std::endl;
}
static std::string bytes(const std::string& file){std::ifstream in(file,std::ios::binary);return std::string((std::istreambuf_iterator<char>(in)),{});}
static void write(const std::string& file,const std::string& data){std::ofstream out(file,std::ios::binary|std::ios::trunc);out.write(data.data(),data.size());}
int main(int argc,char** argv){try{
    require(argc==2,"test directory required");auto scheduler=Factory::getScheduler(RunSettings{});rheology();Engine e;
    Config c;c.count=200;c.preset=1;c.speed=8;c.angle=45;c.duration=12;
    const std::string dir=argv[1],file=dir+"/last-replay.osphr";double coldEnergy=0,hotEnergy=0,coldDamage=0;int cases=0;
    for(int variant=0;variant<4;variant++){
        c.initialEnergyMJkg=variant==1?1.7:variant==3?3.4:0;c.initialDamage=variant==2?.9:0;
        e.start(c,true);auto initial=wait(e);require(initial.sph.response.available,"material response unavailable");
        require(near(initial.sph.values[InternalMean],c.initialEnergyMJkg),"initial energy ignored by solver");
        require(near(initial.sph.values[DamageMean],c.initialDamage),"initial damage root mapped incorrectly");
        require(near(initial.sph.response.values[3],(1-c.initialDamage)*std::max(0.,1-c.initialEnergyMJkg/3.4)),"initial yield mismatch");
        if(variant==3)require(initial.sph.response.values[1]==1&&initial.sph.response.values[3]==0,"threshold material must have zero shear yield");
        const double mass=initial.totalMass;e.pause(false);auto final=wait(e,true);
        require(near(final.totalMass,mass),"material evolution lost mass");require(validSphResponse(final.sph.response),"invalid final response");
        require(final.sph.values[DamageMean]+1e-12>=initial.sph.values[DamageMean],"damage healed without a model");
        if(variant==0){coldEnergy=final.sph.values[InternalMean];coldDamage=final.sph.values[DamageMean];require(coldEnergy>0&&coldDamage>0,"impact did not heat or fracture rock");}
        if(variant==1)hotEnergy=final.sph.values[InternalMean];
        require(e.saveReplay(dir),"v15 save failed");std::string original=bytes(file);uint32_t version=0;std::memcpy(&version,original.data()+4,4);require(version==15,"response missing from replay");
        require(e.loadReplay(dir),"v15 load failed");e.seek(-1);auto loaded=e.status();require(loaded.sph.response.values==final.sph.response.values,"response replay drift");
        require(loaded.config.initialEnergyMJkg==c.initialEnergyMJkg&&loaded.config.initialDamage==c.initialDamage,"material parameters lost from replay");
        for(size_t size:{size_t(8),size_t(123),original.size()-1}){write(file,original.substr(0,size));auto revision=e.sceneRevision();require(!e.loadReplay(dir)&&e.sceneRevision()==revision,"truncated replay mutated world");}
        std::string bad=original;double invalid=2;std::memcpy(bad.data()+bad.size()-8,&invalid,8);write(file,bad);auto revision=e.sceneRevision();require(!e.loadReplay(dir)&&e.sceneRevision()==revision,"invalid response accepted");write(file,original);
        std::cout<<std::setprecision(17)<<"{\"variant\":"<<variant<<",\"time\":"<<final.time<<",\"count\":"<<final.count<<",\"internalMJkg\":"<<final.sph.values[InternalMean]<<",\"damage\":"<<final.sph.values[DamageMean]<<",\"softening\":"<<final.sph.response.values[0]<<",\"zeroShearMassFraction\":"<<final.sph.response.values[1]<<",\"strength\":"<<final.sph.response.values[3]<<"}"<<std::endl;++cases;
    }
    require(std::abs(hotEnergy-coldEnergy)>.1,"preheat did not change evolution");
    c.initialEnergyMJkg=0;c.initialDamage=0;e.start(c,true);wait(e);require(e.saveReplay(dir,false)&&e.loadReplay(dir),"legacy diagnostic replay incompatible");require(!e.status().sph.response.available,"legacy response invented");
    for(int invalid=0;invalid<5;invalid++){Config bad=c;if(invalid==0)bad.initialEnergyMJkg=NAN;if(invalid==1)bad.initialDamage=1.01;if(invalid==2)bad.initialEnergyMJkg=6.81;if(invalid==3){bad.preset=4;bad.speed=1;bad.initialEnergyMJkg=1;}if(invalid==4){bad.selfGravity=true;bad.relaxationSeconds=16;bad.initialDamage=.2;}require(!validConfig(bad),"invalid material config accepted");}
    std::cout<<"PASS SPH material response: actual rheology, evolving fracture/energy, four material conditions, v15 roundtrip, corruption rollback and legacy loading"<<std::endl;
}catch(const std::exception& ex){std::cerr<<"FAIL "<<ex.what()<<std::endl;return 1;}}
