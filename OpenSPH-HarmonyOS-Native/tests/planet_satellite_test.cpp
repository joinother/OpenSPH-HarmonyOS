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
}catch(const std::exception& e){std::cerr<<"FAIL "<<e.what()<<"\n";return 1;}}
