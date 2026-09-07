#include "dense_ring.h"
#include <iostream>
#include <chrono>
#include <limits>
using namespace lab;
void require(bool ok,const char *message){if(!ok)throw std::runtime_error(message);}
double leapfrog(double dt){
 const double m=.0002857,mu=SOLAR_GM*m/1e9,r=105000,f=1.12,k=.25;
 double x=r,y=0,vx=k*std::sqrt(mu/r),vy=f*std::sqrt(mu/r);
 for(int i=0;i<int(21600/dt);i++){double g=-mu/std::pow(std::hypot(x,y),3);vx+=g*x*dt/2;vy+=g*y*dt/2;x+=vx*dt;y+=vy*dt;g=-mu/std::pow(std::hypot(x,y),3);vx+=g*x*dt/2;vy+=g*y*dt/2;}
 auto q=impulseOrbit(m,21600,r,f,0,k);return std::hypot(x-q.x,y-q.y);
}
int main(){try{
 double force=0,energy=0,angular=0,initial=0;size_t states=0;
 for(double m:{1e-8,.0002857,.01})for(double f:{1.,1.12,1.2})for(double k:{0.,.01,.25,.35}){
  const double mu=SOLAR_GM*m/1e9;auto start=denseRing(m,0,f,k);require(start.size()==DENSE_RING_COUNT,"dense count");
  auto circular=denseRing(m,0,1,0);
  for(size_t i=0;i<start.size();i++){
   auto p=start[i];double r=std::hypot(p.x,p.y);initial=std::max(initial,std::hypot(p.x-circular[i].x,p.y-circular[i].y)/r);
   require(r>=RING_RADIUS_KM*RING_INNER&&r<=RING_RADIUS_KM*RING_OUTER,"initial radius");
   require(!(r>114000&&r<120000),"initial gap");
  }
  for(double t:{1.,7200.,43200.,86399.}){
   auto ps=denseRing(m,t,f,k),lo=denseRing(m,t-.001,f,k),hi=denseRing(m,t+.001,f,k);
   for(size_t i=0;i<ps.size();i++){
    auto p=ps[i],z=start[i];double r=std::hypot(p.x,p.y),r0=std::hypot(z.x,z.y),e0=(z.vx*z.vx+z.vy*z.vy)/2-mu/r0;
    energy=std::max(energy,std::abs(((p.vx*p.vx+p.vy*p.vy)/2-mu/r-e0)/e0));
    angular=std::max(angular,std::abs((p.x*p.vy-p.y*p.vx)/(z.x*z.vy-z.y*z.vx)-1));
    force=std::max(force,std::hypot((hi[i].vx-lo[i].vx)/.002+mu*p.x/(r*r*r),(hi[i].vy-lo[i].vy)/.002+mu*p.y/(r*r*r))/(mu/(r*r)));
    require(r<RING_MAP_EXTENT*RING_RADIUS_KM,"orbit outside density grid");states++;
   }
  }
 }
 std::cout<<"grid initial="<<initial<<" energy="<<energy<<" angular="<<angular<<" force="<<force<<std::endl;
 require(initial<1e-13&&energy<1e-12&&angular<1e-12&&force<2e-6,"impulse physics mismatch");
 // Injection at zero is exactly radial plus independently specified tangential velocity.
 for(double phase:{0.,.7,3.1}){const double r=105000,mu=SOLAR_GM*.0002857/1e9;auto p=impulseOrbit(.0002857,0,r,1.12,phase,.35);
  require(std::abs((p.vx*std::cos(phase)+p.vy*std::sin(phase))/std::sqrt(mu/r)-.35)<1e-12,"radial injection");
  require(std::abs((-p.vx*std::sin(phase)+p.vy*std::cos(phase))/std::sqrt(mu/r)-1.12)<1e-12,"tangent injection");}
 double coarse=leapfrog(60),fine=leapfrog(30);require(coarse/fine>3.8&&coarse/fine<4.2,"independent second order convergence");
 double difference=0;auto baseline=ringDensityMap(denseRing(.0002857,0));
 for(double t:{0.,3600.,21600.,86400.})for(double f:{1.,1.2})for(double m:{1e-8,.0002857,.01}){
  auto ps=denseRing(m,t,f,.35);auto map=ringDensityMap(ps);require(map.outside==0&&std::abs(map.depositedWeight-DENSE_RING_COUNT)<1e-7,"density drops particles");
  require(map.pixels.size()==size_t(RING_MAP_SIZE*RING_MAP_SIZE),"density dimensions");
  if(t==21600&&f==1&&m==.0002857)for(size_t i=0;i<map.pixels.size();i++)difference+=std::abs(int(map.pixels[i])-int(baseline.pixels[i]));
 }
 require(difference>100000,"band does not deform with particles");
 RingClock clock;clock.configure(true,true,1,.0002857);clock.seek(7200);clock.configure(true,true,1,.0002857);clock.disturbance(0,true);require(clock.seconds==7200&&clock.running,"grain toggle resets time");clock.disturbance(.25,true);require(clock.seconds==0&&!clock.running,"impulse must reset and pause");
 clock.seek(1800);for(double k:{-.1,.36,std::numeric_limits<double>::quiet_NaN()}){bool rejected=false;try{clock.disturbance(k,false);}catch(...){rejected=true;}require(rejected&&clock.impulse==.25&&clock.points&&clock.seconds==1800,"invalid impulse mutation");}
 clock.configure(false,false,-1,.0002857);clock.configure(true,false,1,.0002857);require(clock.impulse==0&&!clock.points,"new ring did not reset disturbance");
 auto begin=std::chrono::steady_clock::now();for(int i=0;i<20;i++)ringDensityMap(denseRing(.0002857,i*10,1,.25));double ms=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-begin).count()/20;
 std::cout<<"PASS dense ring: "<<states<<" states; initial="<<initial<<" force="<<force<<" energy="<<energy<<" angular="<<angular<<" leapfrog km="<<coarse<<","<<fine<<" density difference="<<difference<<" CPU sample+map ms="<<ms<<'\n';
}catch(const std::exception &e){std::cerr<<e.what()<<'\n';return 1;}}
