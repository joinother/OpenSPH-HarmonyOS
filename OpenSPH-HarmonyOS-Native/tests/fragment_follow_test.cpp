#include "fragment_follow.h"
#include <cassert>
#include <iostream>
using namespace lab;
int main(){
 std::vector<StructureParticle> p={{2,{0,0,0},{}},{3,{1e5,0,0},{}},{1,{1e6,0,0},{}}};auto groups=measureSphFragments(p,{1e5,1e5,1e5});
 FragmentFollower f;std::array<double,3> base{.5,0,0};f.step(1,1,&groups,0,base,0);f.select(1,1);
 auto start=f.step(1,1,&groups,0,base,0);assert(start==base&&f.status().seed==1&&f.status().anchor==0);
 auto middle=f.step(1,1,&groups,0,base,.06);assert(middle[0]>.5&&middle[0]<.6);auto end=f.step(1,1,&groups,0,base,3);assert(std::abs(end[0]-.6)<1e-10&&!f.status().moving);
 // Splitting and re-ranking changes the group, not the selected material ordinal.
 p[0].position[0]=-1e6;p[2].mass=10;auto split=measureSphFragments(p,{1e5,1e5,1e5});auto held=f.step(1,1,&split,10,base,0);assert(held==end&&f.status().seed==1&&f.status().anchor==1&&f.status().rank==2);
 auto tracked=f.step(1,1,&split,10,base,3);assert(std::abs(tracked[0]-1)<1e-10);assert(f.status().centerKm[0]==100);
 f.step(1,1,&groups,0,base,3);assert(f.status().anchor==0&&f.status().seed==1); // replay backwards / merge
 // Exponential camera response does not depend on render cadence for a fixed target.
 FragmentFollower a,b;for(auto*x:{&a,&b}){x->step(1,1,&groups,0,base,0);x->select(2,1);}std::array<double,3> ca{},cb{};for(int i=0;i<10;i++)ca=a.step(1,1,&groups,0,base,.01);cb=b.step(1,1,&groups,0,base,.1);assert(std::abs(ca[0]-cb[0])<1e-12);
 f.clear();auto release=f.step(1,1,&groups,0,base,.05);assert(!f.status().active&&f.status().moving&&release[0]>.5);assert(f.step(1,1,&groups,0,base,3)==base);
 f.select(1,1);f.step(2,2,&groups,0,base,.1);assert(!f.status().active); // scene replacement
 f.select(2,3);f.step(2,3,&groups,0,base,1);f.step(3,3,&groups,0,base,1);assert(f.status().active&&f.status().seed==2); // late old frame
 f.step(3,3,nullptr,0,base,1);assert(!f.status().active); // legacy or unavailable
 bool rejected=false;try{f.select(-1,3);}catch(...){rejected=true;}assert(rejected);
 std::cout<<"PASS fragment follow: continuous target/return, split and merge, rank-independent particle identity, replay reverse, cadence, scene expiry, late-frame isolation, legacy absence\n";
}
