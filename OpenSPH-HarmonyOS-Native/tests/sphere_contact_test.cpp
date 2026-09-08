#include "orbit.h"
#include "sphere_contact.h"
#include <iostream>
#include <stdexcept>
#include <cmath>
#include <limits>
using namespace lab;
void require(bool ok,const char* m){if(!ok)throw std::runtime_error(m);}
void near(double a,double b,double tolerance,const char*m){require(std::abs(a-b)<=tolerance,m);}
Vec3 difference(Vec3 a,Vec3 b){for(int k=0;k<3;k++)a[k]-=b[k];return a;}
OrbitSystem pair(double ratio=1,double offset=0){return OrbitSystem({{1e-20,{-3,0,0},{20000,0,0},1},{ratio*1e-20,{3,offset,0},{-20000,0,0},1}});}
OrbitSystem demo(){const double earth=398600.435507e9/SOLAR_GM;return OrbitSystem({{1,{0,0,0},{0,0,0},695700e3/AU},{earth,{1,-.00012,0},{0,35000*YEAR/AU,0},6371e3/AU},{.4*earth,{1,.00012,0},{0,25000*YEAR/AU,0},6371e3*std::cbrt(.4)/AU}});}
int main(){try{
 near(sphereContactTime({6,0,0},{-40000,0,0},2,ORBIT_DT),.0001,1e-18,"swept time");
 require(sphereContactTime({6,0,0},{40000,0,0},2,ORBIT_DT)<0,"separating");
 require(sphereContactTime({6,2,0},{-40000,0,0},2,ORBIT_DT)<0,"tangent");
 require(sphereContactTime({6,0,0},{-40000,0,0},2,.00009)<0,"outside interval");
 bool rejected=false;try{sphereContactTime({1,0,0},{-1,0,0},2,1);}catch(...){rejected=true;}require(rejected,"overlap rejected");
 std::cout<<"PASS sweep: high speed, separating, tangent, bounds, overlap\n";
 for(double ratio:{1.,3.})for(double offset:{0.,1.}){
  auto s=pair(ratio,offset);double e=s.energy();auto p=s.momentum(),l=s.angularMomentum();auto v0=s.bodies[0].velocity[0],v1=s.bodies[1].velocity[0];s.step(ORBIT_DT);
  require(s.contact.count==1&&s.contact.a==0&&s.contact.b==1,"one pair event");require(s.contact.time>0&&s.contact.time<s.elapsed,"event time");
  near(s.energy()/e,1,1e-12,"kinetic energy");require(norm(difference(s.momentum(),p))<1e-30,"momentum");require(norm(difference(s.angularMomentum(),l))<1e-29,"angular momentum");
  require(norm(difference(s.bodies[1].position,s.bodies[0].position))>=2,"no penetration");
  if(offset==0){near(s.bodies[0].velocity[0],((1-ratio)*v0+2*ratio*v1)/(1+ratio),1e-9,"analytic first velocity");near(s.bodies[1].velocity[0],(2*v0+(ratio-1)*v1)/(1+ratio),1e-9,"analytic second velocity");}
  s.step(ORBIT_DT);require(s.contact.count==1,"no repeated separating impulse");
 }
 std::cout<<"PASS elastic: equal/unequal masses, head-on/oblique, E/P/L, no tunneling\n";
 auto failed=pair();failed.contact.count=1000000;auto before=failed.bodies;rejected=false;try{failed.step(ORBIT_DT);}catch(...){rejected=true;}
 require(rejected&&failed.elapsed==0&&failed.contact.count==1000000,"event budget rollback");for(size_t i=0;i<before.size();i++)require(failed.bodies[i].position==before[i].position&&failed.bodies[i].velocity==before[i].velocity,"atomic rollback");
 auto triple=OrbitSystem({{1e-20,{-4,0,0},{20000,0,0},1},{1e-20,{0,0,0},{0,0,0},1},{1e-20,{4,0,0},{-20000,0,0},1}});double et=triple.energy();triple.step(ORBIT_DT);require(triple.contact.count>=2,"simultaneous contacts");near(triple.energy()/et,1,1e-12,"multi contact energy");
 std::cout<<"PASS simultaneous pair resolution and failure rollback\n";
 double times[3];for(int level=0;level<3;level++){
  auto s=demo();double e=s.energy();auto p=s.momentum(),l=s.angularMomentum();int steps=0;
  while(!s.contact.count&&steps++<100000)s.step(.5/YEAR/(1<<level));
  require(s.contact.count==1&&s.contact.a==1&&s.contact.b==2,"demo contact");times[level]=s.contact.time*YEAR;
  std::cout<<"measured error "<<(s.energy()-e)/e<<" time "<<times[level]<<std::endl;
  require(std::abs((s.energy()-e)/e)<1e-4,"demo energy budget");require(norm(difference(s.momentum(),p))<1e-18,"demo momentum");require(norm(difference(s.angularMomentum(),l))<1e-18,"demo angular momentum");
  std::cout<<"demo step="<<.5/(1<<level)<<" time_s="<<times[level]<<" relative_energy="<<(s.energy()-e)/e<<"\n";
 }
 require(std::abs(times[2]-times[1])<std::abs(times[1]-times[0])&&std::abs(times[2]-times[1])<2,"contact time convergence");
 std::cout<<"PASS gravitational demo, timestep convergence, conservation\n";
}catch(const std::exception&e){std::cerr<<"FAIL "<<e.what()<<"\n";return 1;}}
