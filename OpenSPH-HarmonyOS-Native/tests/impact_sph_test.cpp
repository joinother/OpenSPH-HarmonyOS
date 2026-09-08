#include "engine.h"
#include "sph_impact_initial.h"
#include <chrono>
#include <fstream>
#include <iostream>
#include <functional>
#include <thread>
#include <cstring>
using namespace lab;
void require(bool x,const char* m){if(!x)throw std::runtime_error(m);}
bool near(double a,double b,double scale=1){return std::abs(a-b)<=1e-9*std::max({scale,std::abs(a),std::abs(b)});}
Status wait(Engine& e,const std::function<bool(Status)>& done){for(int i=0;i<24000;i++){auto s=e.status();if(s.state=="failed")throw std::runtime_error(s.error);if(done(s))return s;std::this_thread::sleep_for(std::chrono::milliseconds(5));}throw std::runtime_error("timeout");}
void same(const Status& a,const Status& b){require(a.time==b.time&&a.frames==b.frames&&a.orbitState.size()==b.orbitState.size(),"world history changed");for(size_t i=0;i<a.orbitState.size();i++)for(auto k:{&OrbitSpec::massSolar,&OrbitSpec::xAU,&OrbitSpec::yAU,&OrbitSpec::zAU,&OrbitSpec::vxKmS,&OrbitSpec::vyKmS,&OrbitSpec::vzKmS,&OrbitSpec::radiusKm})require(a.orbitState[i].*k==b.orbitState[i].*k,"world vectors changed");}
int main(int argc,char** argv){try{
 require(argc==2,"directory required");double ma=4*3.141592653589793/3*std::pow(100000.,3)*2700/SOLAR_MASS;
 Config c;c.preset=5;c.speed=1;c.duration=1;c.orbitBodies={{"star",1,0,0,0,0,0,0,0,695700},{"target",ma,1,-200000/AU,0,0,34,0,3,100},{"impactor",ma*.216,1,200000/AU,0,.7,26,.3,5,60}};
 Engine e;e.start(c,true);wait(e,[](Status s){return s.state=="paused"&&s.frames>0;});e.orbitClock(.001);e.pause(false);auto hit=wait(e,[](Status s){return s.state=="paused"&&s.contact.count>0;});const auto plan=makeImpactPlan(hit.contact);require(plan.supported,"missing oblique event");
 // Independently inspect generated upstream particles before solver initialization.
 using namespace Sph;RunSettings settings;InitialConditions ic(settings);double total=0,kinetic=0;Vec3 momentum{},angular{},weighted{};
 for(int body=0;body<2;body++){Storage storage;BodySettings material;material.set(BodySettingsId::PARTICLE_COUNT,body==0?450:150);material.set(BodySettingsId::DENSITY,Float(plan.bodies[body].densityKgM3));ic.addMonolithicBody(storage,SphericalDomain(Vector(0._f),Float(plan.bodies[body].radiusKm*1000)),material);placeImpactBody(storage,plan.bodies[body]);
   const auto& r=storage.getValue<Vector>(QuantityId::POSITION);const auto& v=storage.getDt<Vector>(QuantityId::POSITION);const auto& m=storage.getValue<Float>(QuantityId::MASS);
   double mass=0;Vec3 center{};for(Size i=0;i<r.size();i++){mass+=m[i];total+=m[i];for(int k=0;k<3;k++){center[k]+=m[i]*r[i][k];weighted[k]+=m[i]*r[i][k];momentum[k]+=m[i]*v[i][k];angular[k]+=m[i]*(r[i][(k+1)%3]*v[i][(k+2)%3]-r[i][(k+2)%3]*v[i][(k+1)%3]);kinetic+=.5*m[i]*v[i][k]*v[i][k];}}
   require(near(mass,plan.bodies[body].massKg),"particle mass");for(int k=0;k<3;k++)require(near(center[k]/mass,plan.bodies[body].positionM[k],1e5),"particle COM");
 }
 require(near(kinetic,plan.kineticEnergyJ),"particle kinetic budget");for(int k=0;k<3;k++){require(near(momentum[k],0,total*8000),"particle momentum");require(near(weighted[k],0,total*1e5),"particle centroid");require(near(angular[k],plan.angularMomentum[k],total*1e5*8000),"particle angular budget");}
 std::cout<<"PASS actual sampled particle mass, 3D COM, momentum, kinetic and angular budgets\n";
 for(int variant=0;variant<3;variant++){bool refused=false;try{e.startImpact(hit.orbitRevision+(variant==0?1:0),hit.contact.count+(variant==1?1:0),variant==2?199:600,8);}catch(...){refused=true;}require(refused,"invalid request accepted");same(hit,e.status());}
 e.startImpact(hit.orbitRevision,hit.contact.count,600,8);require(e.status().impactPreparing,"not staged");require(e.frame()->orbital,"discarded world during preparation");e.returnFromImpact();same(hit,e.status());
 auto parent=e.status();e.startImpact(parent.orbitRevision,parent.contact.count,600,8);
 auto initial=wait(e,[](Status s){return s.state=="paused"&&s.config.impactContact.hasIncoming&&s.sph.available;});require(initial.time==0&&initial.impactReturnAvailable&&!initial.impactPreparing,"local initial state");require(near(initial.totalMass,total)&&near(initial.sph.values[8],kinetic),"engine initial mass/kinetic");
 bool duplicate=false;try{e.startImpact(parent.orbitRevision,parent.contact.count);}catch(...){duplicate=true;}require(duplicate,"duplicate transition accepted");
 e.pause(false);auto done=wait(e,[](Status s){return s.state=="completed";});require(done.time>=8&&done.sph.values[9]>initial.sph.values[9],"collision did not heat");require(near(done.totalMass,total),"evolving mass");
 require(e.saveReplay(argv[1]),"v17 save failed");std::string path=std::string(argv[1])+"/last-replay.osphr";std::ifstream f(path,std::ios::binary);std::string bytes((std::istreambuf_iterator<char>(f)),{});uint32_t version;std::memcpy(&version,bytes.data()+4,4);require(version==17,"missing source replay version");
 e.returnFromImpact();same(hit,e.status());require(!e.status().impactReturnAvailable,"return did not release branch");
 require(e.loadReplay(argv[1]),"v17 load failed");e.seek(done.frames-1);auto loaded=e.status();require(loaded.config.impactContact.hasIncoming&&!loaded.impactReturnAvailable,"replay fabricated world");require(loaded.sph.values==done.sph.values&&loaded.time==done.time,"replay diagnostics changed");require(loaded.config.impactContact.incoming[1].velocity==hit.contact.incoming[1].velocity,"source vectors lost");
 // Invalid context must leave current replay intact.
 auto bad=bytes;double nan=NAN;std::memcpy(&bad[136+28+16],&nan,8);std::ofstream out(path,std::ios::binary|std::ios::trunc);out.write(bad.data(),bad.size());out.close();auto revision=e.sceneRevision();require(!e.loadReplay(argv[1])&&e.sceneRevision()==revision,"corrupt source changed scene");
 std::cout<<"PASS staged cancellation, stale/invalid/duplicate rejection, actual "<<initial.count<<" particle SPH at "<<done.time<<" s, thermal growth "<<done.sph.values[9]-initial.sph.values[9]<<" J, exact parent restoration, v17 provenance/diagnostics and invalid replay rejection\n";e.cancel();
}catch(const std::exception& e){std::cerr<<"FAIL "<<e.what()<<'\n';return 1;}}
