#include "orbit.h"
#include <cmath>
#include <iostream>
#include <stdexcept>
using namespace lab;
static void need(bool x,const char* m){if(!x)throw std::runtime_error(m);}
static Vec3 minus(Vec3 a,Vec3 b){for(int k=0;k<3;k++)a[k]-=b[k];return a;}
int main(){try{
 const double m=398600.435507e9/SOLAR_GM,r=191130e3/AU,moon=m*.0123,v=std::sqrt(ORBIT_G*(m+moon)/r);
 OrbitSystem pair({{m,{0,0,0},{0,0,0},6371e3/AU},{moon,{r,0,0},{0,v,0},1737e3/AU}},false);
 const auto p=pair.momentum();const double energy=pair.energy(),period=2*3.141592653589793*r/v;
 pair.step(period/100000);need(pair.bodies[0].velocity[0]>0&&pair.bodies[1].velocity[0]<0,"missing mutual gravity");
 double error=0;while(pair.elapsed<period*10){pair.step(std::min(ORBIT_DT,period/1000));error=std::max(error,std::abs(norm(minus(pair.bodies[0].position,pair.bodies[1].position))/r-1));}
 need(error<1e-5,"satellite radial drift");need(pair.contact.count==0,"spurious satellite contact");need(norm(minus(pair.momentum(),p))<1e-17,"momentum drift");
 need(std::abs(pair.energy()/energy-1)<1e-7,"energy drift");
 std::cout<<"PASS ten satellite orbits; fractional radius error="<<error<<"; both bodies accelerate; momentum/energy bounded\n";
 // The same moon-mass projectile travels inward in the host velocity frame.
 OrbitSystem impact({{m,{0,0,0},{0,0,0},6371e3/AU},{moon,{r,0,0},{-1.5*v,0,0},1737e3/AU}},false);
 int steps=0;while(!impact.contact.count&&steps++<100000)impact.step(std::min(ORBIT_DT,period/5000));
 need(impact.contact.count==1,"directed projectile missed stationary two-body host");need(impact.contact.speed>1.5*v,"gravity did not accelerate impact");
 std::cout<<"PASS directed projectile reaches physical surface with gravitational acceleration; response remains elastic\n";
 // Validate relative impact energy, so the large host cannot hide small-body errors.
 const double rockMass=4*3.141592653589793/3*std::pow(7500.,3)*2700/SOLAR_MASS;
 const double separation=31371e3/AU,contactRadius=(6371e3+7500)/AU,incoming=10000*YEAR/AU;
 const double expected=std::sqrt(incoming*incoming+2*ORBIT_G*(m+rockMass)*(1/contactRadius-1/separation));
 double firstTime=0;
 for(double dt:{ORBIT_DT,.5/YEAR,.125/YEAR}){
  OrbitSystem small({{m,{1,0,0},{0,0,0},6371e3/AU},{rockMass,{1+separation,0,0},{-incoming,0,0},7500/AU}},false);
  int steps=0;while(!small.contact.count&&steps++<100000)small.step(dt);
  need(small.contact.count==1,"15 km projectile missed");need(std::abs(small.contact.speed/expected-1)<1e-4,"small-body gravitational impact speed mismatch");
  need(small.bodies[0].velocity[0]<0,"small body has no host reaction");
  if(firstTime>0)need(std::abs(small.contact.time-firstTime)*YEAR<.1,"small body contact time step sensitivity");else firstTime=small.contact.time;
  std::cout<<"PASS 15 km projectile: max step seconds="<<dt*YEAR<<"; contact seconds="<<small.contact.time*YEAR<<"; relative speed km/s="<<small.contact.speed*AU/YEAR/1000<<"; fractional analytic error="<<std::abs(small.contact.speed/expected-1)<<"\n";
 }
}catch(const std::exception& e){std::cerr<<"FAIL "<<e.what()<<"\n";return 1;}}
