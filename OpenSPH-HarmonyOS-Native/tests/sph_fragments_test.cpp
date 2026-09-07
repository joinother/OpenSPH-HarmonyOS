#include "sph_fragments.h"
#include <iostream>
#include <chrono>
#include <limits>
using namespace lab;
void require(bool value,const char*why){if(!value)throw std::runtime_error(why);}
int main(){try{
 std::vector<StructureParticle> p={{2,{0,0,0},{1,2,3}},{3,{1,0,0},{3,2,3}},{5,{8,0,0},{-1,0,0}},{7,{9,0,0},{1,0,0}},{1,{30,0,0},{0,0,0}}};std::vector<double> h(5,1);
 auto f=measureSphFragments(p,h);require(f.groups.size()==3&&f.groups[0].count==2&&f.groups[0].mass==12&&f.groups[1].mass==5&&f.groups[2].mass==1,"groups/mass sorting");require(f.labels==std::vector<uint32_t>({0,0,2,2,4}),"membership");require(std::abs(f.groups[1].center[0]-.6)<1e-14&&std::abs(f.groups[1].velocity[0]-2.2)<1e-14,"weighted vectors");
 double mass=0;std::array<double,3> momentum{};for(const auto&g:f.groups){mass+=g.mass;for(int k=0;k<3;k++)momentum[k]+=g.mass*g.velocity[k];}require(mass==18&&std::abs(momentum[0]-13)<1e-14,"mass/momentum closure");
 auto boosted=p;for(auto&q:boosted)for(int k=0;k<3;k++){q.position[k]+=100;q.velocity[k]+=20;}auto g=measureSphFragments(boosted,h);require(g.labels==f.labels,"translation changed grouping");for(size_t i=0;i<g.groups.size();i++){require(std::abs(g.groups[i].rmsRadius-f.groups[i].rmsRadius)<1e-12,"boost changed size");for(int k=0;k<3;k++)require(std::abs(g.groups[i].velocity[k]-f.groups[i].velocity[k]-20)<1e-12,"boost velocity");}
 std::vector<StructureParticle> asymmetric={{1,{0,0,0},{0,0,0}},{1,{1,0,0},{0,0,0}}};auto a=measureSphFragments(asymmetric,{.1,2});std::reverse(asymmetric.begin(),asymmetric.end());auto b=measureSphFragments(asymmetric,{2,.1});require(a.groups.size()==1&&b.groups.size()==1,"unequal-h permutation dependence");
 std::reverse(p.begin(),p.end());auto reverse=measureSphFragments(p,h);require(reverse.groups.size()==f.groups.size(),"permutation groups");for(size_t i=0;i<f.groups.size();i++)require(reverse.groups[i].mass==f.groups[i].mass&&reverse.groups[i].count==f.groups[i].count,"permutation mass spectrum");
 auto separated=measureSphFragments(asymmetric,{.1,2},.5);require(separated.groups.size()==2,"link-scale sensitivity missing");
 for(int mode=0;mode<5;mode++){auto bad=f;if(mode==0)bad.labels[1]=4;if(mode==1)bad.groups[0].mass=-1;if(mode==2)bad.groups[1].anchor=bad.groups[0].anchor;if(mode==3)bad.groups[0].count=9;if(mode==4)bad.groups[0].mass=std::numeric_limits<double>::quiet_NaN();require(!validSphFragments(bad,5,18),"invalid summary accepted");}
 for(int count:{200,600,1200,2400}){std::vector<StructureParticle> cloud;std::vector<double> lengths(count,1);for(int i=0;i<count;i++)cloud.push_back({1,{double(i%20),double((i/20)%20),double(i/400)},{0,0,0}});auto start=std::chrono::steady_clock::now();auto groups=measureSphFragments(cloud,lengths);require(groups.groups.size()==1&&groups.groups[0].mass==count,"connected grid");std::cout<<"budget="<<count<<" analysis_ms="<<std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-start).count()<<std::endl;}
 std::cout<<"PASS fragments: symmetric unequal-h connectivity, permutation/translation/boost invariance, exact mass and momentum, sensitivity and corrupted summaries"<<std::endl;return 0;
}catch(const std::exception&e){std::cerr<<"FAIL "<<e.what()<<std::endl;return 1;}}
