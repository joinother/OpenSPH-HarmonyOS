#include "engine.h"
#include "impact_tides.h"
#include <chrono>
#include <cstring>
#include <fstream>
#include <functional>
#include <iostream>
#include <thread>
using namespace lab;
void check(bool b,const char* s){if(!b)throw std::runtime_error(s);}
Status wait(Engine& e,const std::function<bool(Status)>& done){for(int i=0;i<24000;i++){auto s=e.status();if(s.state=="failed")throw std::runtime_error(s.error);if(done(s))return s;std::this_thread::sleep_for(std::chrono::milliseconds(5));}throw std::runtime_error("timeout");}
double energy(const Status& s){return s.sph.values[8]+s.sph.values[9]+s.sph.structure.values[0]+s.tidalPotentialJ;}
int main(int argc,char** argv){try{
 check(argc==2,"directory required");const double mass=4*3.141592653589793/3*1e15*2700/SOLAR_MASS;
 OrbitContact contact{1,1,2,0,8000*YEAR/AU};contact.hasIncoming=true;
 contact.incoming={OrbitBody{mass,{.02,-80000/AU,0},{0,4000*YEAR/AU,0},100000/AU},OrbitBody{mass*.216,{.02,80000/AU,0},{0,-4000*YEAR/AU,0},60000/AU}};
 contact.world={{1,{0,0,0},{0,0,0},695700000/AU},contact.incoming[0],contact.incoming[1]};
 auto field=makeImpactTides(contact);check(field.available&&field.sources==1,"field unavailable");
 const auto plan=makeImpactPlan(contact);Vec3 d{};for(int k=0;k<3;k++)d[k]=-plan.originAU[k]*AU;
 const double distance=norm(d),k=SOLAR_GM/std::pow(distance,3);Vec3 axis{};for(int i=0;i<3;i++)axis[i]=d[i]/distance;
 Vec3 radial{},transverse{};for(int i=0;i<3;i++)radial[i]=axis[i]*100000;transverse={-axis[1]*100000,axis[0]*100000,0};
 const auto stretch=field.acceleration(radial),compress=field.acceleration(transverse);
 for(int i=0;i<3;i++){check(std::abs(stretch[i]-2*k*radial[i])<1e-15,"radial stretch");check(std::abs(compress[i]+k*transverse[i])<1e-15,"transverse compression");}
 check(norm(field.acceleration({0,0,0}))==0,"uniform force not removed");
 const Vec3 sample{30000,-20000,40000};const auto a=field.acceleration(sample);
 for(int i=0;i<3;i++){auto left=sample,right=sample;left[i]-=1;right[i]+=1;const double gradient=(field.potential(right)-field.potential(left))/2;check(std::abs(gradient+a[i])<1e-12,"potential gradient");}
 // Independent exact point-source differential acceleration, with expansion error O(r/d).
 Vec3 exact{};Vec3 delta{};for(int i=0;i<3;i++)delta[i]=d[i]-sample[i];for(int i=0;i<3;i++)exact[i]=SOLAR_GM*(delta[i]/std::pow(norm(delta),3)-d[i]/std::pow(distance,3));
 Vec3 difference{};for(int i=0;i<3;i++)difference[i]=a[i]-exact[i];check(norm(difference)/norm(a)<1e-4,"point-source expansion mismatch");
 auto legacy=contact;legacy.world.clear();check(!makeImpactTides(legacy).available,"fabricated legacy field");
 check(!makeImpactTides(contact,61).available,"unbounded duration");auto fast=contact;fast.world[0].velocity={1e6,0,0};check(!makeImpactTides(fast).available,"rapid source accepted");
 bool rejected=false;try{field.acceleration({field.radiusLimitM*1.01,0,0});}catch(...){rejected=true;}check(rejected,"unbounded particle accepted");
 // Closed static quadratic potential: independent velocity Verlet energy check.
 Vec3 r=sample,v={100,200,-50};auto mechanical=[&](){return .5*norm(v)*norm(v)+field.potential(r);};const double first=mechanical();
 for(int step=0;step<6000;step++){auto g=field.acceleration(r);for(int i=0;i<3;i++){v[i]+=.005*g[i];r[i]+=.01*v[i];}g=field.acceleration(r);for(int i=0;i<3;i++)v[i]+=.005*g[i];}
 check(std::abs(mechanical()/first-1)<1e-10,"static field energy drift");
 std::cout<<"PASS analytic radial/transverse tide, zero origin force, potential gradient, exact point-source comparison, bounds and independent 60-second energy budget\n";
 Config c;c.preset=5;c.speed=1;c.duration=1;c.orbitBodies={{"star",1,0,0,0,0,0,0,0,695700},{"target",mass,.02,-200000/AU,0,0,34,0,3,100},{"impactor",mass*.216,.02,200000/AU,0,0,26,0,5,60}};
 Engine e;e.start(c,true);wait(e,[](Status s){return s.state=="paused"&&s.frames>0;});e.orbitClock(.001);e.pause(false);const auto hit=wait(e,[](Status s){return s.state=="paused"&&s.contact.count>0;});
 check(makeImpactTides(hit.contact).available,"live near-star tide not eligible");
 e.startImpact(hit.orbitRevision,hit.contact.count,600,8,false);wait(e,[](Status s){return s.sph.available&&s.state=="paused";});e.pause(false);const auto isolated=wait(e,[](Status s){return s.state=="completed";});e.returnFromImpact();
 const auto parent=e.status();e.startImpact(parent.orbitRevision,parent.contact.count,600,8,true);const auto initial=wait(e,[](Status s){return s.sph.available&&s.state=="paused";});
 check(initial.config.impactTides&&initial.tidalPotentialJ!=0,"missing field diagnostic");e.pause(false);const auto done=wait(e,[](Status s){return s.state=="completed";});
 check(std::abs(done.totalMass/initial.totalMass-1)<1e-12,"mass budget");
 check(std::abs(done.sph.values[8]/isolated.sph.values[8]-1)>1e-8,"force did not affect actual solver");
 const double drift=energy(done)/energy(initial)-1;check(std::abs(drift)<.1,"gross local energy error");
 check(e.saveReplay(argv[1]),"v19 save");const std::string path=std::string(argv[1])+"/last-replay.osphr";std::ifstream input(path,std::ios::binary);std::string bytes((std::istreambuf_iterator<char>(input)),{});uint32_t version;std::memcpy(&version,bytes.data()+4,4);check(version==19,"v19 missing");
 e.returnFromImpact();check(e.status().time==hit.time&&e.status().frames==hit.frames,"parent time/history");
 check(e.loadReplay(argv[1]),"v19 load");e.seek(done.frames-1);const auto loaded=e.status();check(loaded.config.impactTides&&!loaded.impactReturnAvailable&&loaded.tidalPotentialJ==done.tidalPotentialJ&&loaded.sph.values==done.sph.values,"replay changed model or budgets");check(loaded.config.impactContact.world[0].position==hit.contact.world[0].position,"source world lost");
 for(int variant=0;variant<4;variant++){auto bad=bytes;double nan=NAN;if(variant==0){uint32_t nine=9;std::memcpy(&bad[292],&nine,4);}if(variant==1)std::memcpy(&bad[296+16],&nan,8);if(variant==2)std::memcpy(&bad[bad.size()-8],&nan,8);if(variant==3)bad.resize(300);std::ofstream out(path,std::ios::binary|std::ios::trunc);out.write(bad.data(),bad.size());out.close();const auto revision=e.sceneRevision();check(!e.loadReplay(argv[1])&&e.sceneRevision()==revision&&e.status().tidalPotentialJ==done.tidalPotentialJ,"invalid v19 mutated scene");}
 std::cout<<"PASS tides engine: "<<done.count<<" particles, "<<done.time<<" s, kinetic relative difference "<<done.sph.values[8]/isolated.sph.values[8]-1<<", local energy drift "<<drift<<", v19 budgets/world context, four transactional corruption rejections and parent return\n";e.cancel();
}catch(const std::exception& e){std::cerr<<"FAIL "<<e.what()<<'\n';return 1;}}
