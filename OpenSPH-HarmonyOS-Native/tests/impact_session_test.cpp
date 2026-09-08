#include "engine.h"
#include "impact_plan.h"
#include <chrono>
#include <cstring>
#include <fstream>
#include <functional>
#include <iostream>
#include <stdexcept>
#include <thread>
using namespace lab;
void require(bool x,const char* m){if(!x)throw std::runtime_error(m);}
Status wait(Engine& e,const std::function<bool(Status)>& done){for(int i=0;i<4000;i++){auto s=e.status();if(s.state=="failed")throw std::runtime_error(s.error);if(done(s))return s;std::this_thread::sleep_for(std::chrono::milliseconds(5));}throw std::runtime_error("engine timeout");}
uint32_t u32(const std::string& b,size_t p){uint32_t n;require(p+4<=b.size(),"parser overrun");std::memcpy(&n,b.data()+p,4);return n;}
void same(const OrbitContact& a,const OrbitContact& b){require(a.count==b.count&&a.a==b.a&&a.b==b.b&&a.time==b.time&&a.speed==b.speed&&a.hasIncoming==b.hasIncoming,"event metadata changed");for(int i=0;i<2;i++){require(a.incoming[i].mass==b.incoming[i].mass&&a.incoming[i].radius==b.incoming[i].radius&&a.incoming[i].position==b.incoming[i].position&&a.incoming[i].velocity==b.incoming[i].velocity,"incoming vectors changed");}}
int main(int argc,char** argv){try{
 require(argc==2,"directory required");std::string path=std::string(argv[1])+"/last-replay.osphr";
 auto write=[&](const std::string& b){std::ofstream f(path,std::ios::binary|std::ios::trunc);f.write(b.data(),b.size());};
 Config c;c.preset=5;c.speed=1;c.duration=1;double ma=4*3.141592653589793/3*std::pow(100000.,3)*2700/SOLAR_MASS;
 c.orbitBodies={{"star",1,0,0,0,0,0,0,0,695700},{"target",ma,1,-200000/AU,0,0,34,0,3,100},{"impactor",ma*.216,1,200000/AU,0,0,26,0,5,60}};
 Engine e;e.start(c,true);wait(e,[](Status s){return s.state=="paused"&&s.frames>0;});e.orbitClock(.001);e.pause(false);
 auto hit=wait(e,[](Status s){return s.state=="paused"&&s.contact.count>0;});auto plan=makeImpactPlan(hit.contact);require(hit.impactEntryReady,"fresh event entry unavailable");
 require(plan.available&&plan.supported,"real world incoming plan unavailable");require(hit.contact.a==1&&hit.contact.b==2,"wrong colliders");require(plan.timeSeconds>29&&plan.timeSeconds<31,"unexpected impact time");
 require(e.saveReplay(argv[1]),"v18 save failed");std::ifstream f(path,std::ios::binary);std::string bytes((std::istreambuf_iterator<char>(f)),{});require(u32(bytes,4)==18,"missing v18");
 std::vector<size_t> incoming,extensions,worlds;size_t p=88;const auto n=u32(bytes,8);
 for(uint32_t k=0;k<n;k++){p+=84;extensions.push_back(p);if(u32(bytes,p)==1)incoming.push_back(p+4);p+=u32(bytes,p)?132:4;worlds.push_back(p);p+=4+64*u32(bytes,p);auto count=u32(bytes,p);p+=4;for(uint32_t i=0;i<count;i++){auto len=u32(bytes,p);p+=4+len+72;}auto trails=u32(bytes,p);p+=4+trails*sizeof(Particle);}
 require(p==bytes.size()&&!incoming.empty(),"format mismatch");
 require(e.loadReplay(argv[1]),"v18 load failed");same(hit.contact,e.status().contact);require(e.status().contact.world.size()==3,"whole event world lost");for(int i=0;i<3;i++)require(e.status().contact.world[i].position==hit.contact.world[i].position&&e.status().contact.world[i].velocity==hit.contact.world[i].velocity,"world vectors changed");e.seek(0);require(!makeImpactPlan(e.status().contact).available,"initial frame invented event");e.seek(n-1);same(hit.contact,e.status().contact);
 const size_t offset=incoming.back();for(int variant=0;variant<9;variant++){auto bad=bytes;double value=0;
   if(variant==0)bad.resize(offset+63);
   if(variant==1){value=NAN;std::memcpy(&bad[offset+16],&value,8);}
   if(variant==2){value=ma*1.01;std::memcpy(&bad[offset],&value,8);}
   if(variant==3){value=10000/AU;std::memcpy(&bad[offset+8],&value,8);}
   if(variant==4){uint32_t flag=2;std::memcpy(&bad[offset-4],&flag,4);}
   if(variant==5)bad.push_back('x');
   if(variant==6){uint32_t n=9;std::memcpy(&bad[worlds.back()],&n,4);}
   if(variant==7){value=NAN;std::memcpy(&bad[worlds.back()+4+16],&value,8);}
   if(variant==8){value=ma*1.01;std::memcpy(&bad[worlds.back()+4+64],&value,8);}
   write(bad);const auto revision=e.sceneRevision();require(!e.loadReplay(argv[1]),"corrupt event accepted");require(e.sceneRevision()==revision,"failed load changed scene");same(hit.contact,e.status().contact);
 }
 write(bytes);require(e.loadReplay(argv[1]),"restore v18 failed");e.orbitClock(.001);e.pause(false);wait(e,[&](Status s){return s.time>hit.time;});e.pause(true);same(hit.contact,e.status().contact);
 auto advanced=e.status();require(!advanced.impactEntryReady,"old event still exposed as ready");bool staleRejected=false;try{e.startImpact(advanced.orbitRevision,advanced.contact.count,600,8);}catch(const std::invalid_argument&){staleRejected=true;}
 require(staleRejected,"continued world accepted an old collision event");require(e.sceneRevision()==advanced.orbitRevision&&e.status().time==advanced.time,"stale rejection changed world");

 auto v16=bytes;for(auto it=worlds.rbegin();it!=worlds.rend();++it)v16.erase(*it,4+64*u32(bytes,*it));uint32_t version16=16;std::memcpy(&v16[4],&version16,4);write(v16);require(e.loadReplay(argv[1]),"legacy v16 failed");require(e.status().contact.world.empty(),"legacy world invented");same(hit.contact,e.status().contact);
 auto legacy=bytes;for(size_t i=worlds.size();i-->0;){legacy.erase(worlds[i],4+64*u32(bytes,worlds[i]));legacy.erase(extensions[i],u32(bytes,extensions[i])?132:4);}uint32_t v14=14;std::memcpy(&legacy[4],&v14,4);write(legacy);
 require(e.loadReplay(argv[1]),"legacy v14 contact failed");require(e.status().contact.count==hit.contact.count&&!makeImpactPlan(e.status().contact).available,"legacy fabricated velocities");
 std::cout<<"PASS actual 3-body orbit incoming capture at "<<plan.timeSeconds<<" seconds, "<<plan.relativeSpeedKmS<<" km/s; v18 world roundtrip, seek, nine corrupt transactional rejections, resume immutability, expired event rejection, v14/v16 compatibility\n";
 e.cancel();
}catch(const std::exception& e){std::cerr<<"FAIL "<<e.what()<<'\n';return 1;}}
