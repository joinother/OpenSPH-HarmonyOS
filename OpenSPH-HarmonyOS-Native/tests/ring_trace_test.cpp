#include "ring_trace.h"
#include <iostream>
#include <stdexcept>
#include <limits>
using namespace lab;
void require(bool condition,const char* message){if(!condition)throw std::runtime_error(message);}
// Independent kick-drift-kick integration used only as a convergence cross-check.
double numericalError(double dt,double scale=1){double mass=.0002857,mu=SOLAR_GM*mass/1e9,r=60000*1.28,x=r,y=0,vx=0,vy=scale*std::sqrt(mu/r);const double end=21600;
 for(int i=0;i<int(end/dt);i++){double f=-mu/std::pow(std::hypot(x,y),3);vx+=.5*dt*f*x;vy+=.5*dt*f*y;x+=dt*vx;y+=dt*vy;f=-mu/std::pow(std::hypot(x,y),3);vx+=.5*dt*f*x;vy+=.5*dt*f*y;}
 auto exact=sampleRing(mass,end,scale)[0];return std::hypot(x-exact.x,y-exact.y);
}
int main(){try{
 const double mass=.0002857,mu=SOLAR_GM*mass/1e9;auto zero=sampleRing(mass,0);require(zero.size()==192,"wrong tracer count");
 // NASA circular-orbit example: ~1.5426 h at 6778 km, Earth GM 398601.2 km^3/s^2.
 require(std::abs(ringPeriod(398601.2e9/SOLAR_GM,6778)/3600-1.542625)<.0001,"Earth orbital period reference");
 double maxForceError=0,maxEnergyError=0;
 auto minus=sampleRing(mass,100-.01),plus=sampleRing(mass,100+.01),center=sampleRing(mass,100);
 for(size_t i=0;i<zero.size();i++){
  const auto &a=center[i];double acceleration=mu/(a.radiusKm*a.radiusKm);
  maxForceError=std::max(maxForceError,std::hypot((plus[i].vx-minus[i].vx)/.02+mu*a.x/std::pow(a.radiusKm,3),(plus[i].vy-minus[i].vy)/.02+mu*a.y/std::pow(a.radiusKm,3))/acceleration);
  double e=.5*(a.vx*a.vx+a.vy*a.vy)-mu/a.radiusKm;maxEnergyError=std::max(maxEnergyError,std::abs((e+mu/(2*a.radiusKm))/(mu/(2*a.radiusKm))));
  require(std::abs(a.x*a.vx+a.y*a.vy)<1e-8,"velocity not tangential");
 }
 require(maxForceError<1e-8&&maxEnergyError<1e-14,"Newtonian force/energy mismatch");
 auto loop=sampleRing(mass,zero[0].periodSeconds);require(std::hypot(loop[0].x-zero[0].x,loop[0].y-zero[0].y)<1e-7,"inner orbit did not close");
 require(std::abs(zero.back().periodSeconds/zero[0].periodSeconds-std::pow(2.22/1.28,1.5))<1e-12,"Kepler period ratio");
 auto second=sampleRing(mass,3600);require(std::atan2(second[0].y,second[0].x)>std::atan2(second[176].y,second[176].x),"inner ring did not lead outer ring");
 double coarse=numericalError(60),fine=numericalError(30);require(coarse/fine>3.8&&coarse/fine<4.2,"independent integrator failed second-order convergence");
 double ellipseForce=0,ellipseEnergy=0,ellipseAngular=0;
 for(double m:{1e-8,mass,.01})for(double f:{1.,1.01,1.12,1.2})for(double t:{1.,7200.,43200.,86399.}){
  const double gm=SOLAR_GM*m/1e9,e=f*f-1;auto ps=sampleRing(m,t,f),lo=sampleRing(m,t-.001,f),hi=sampleRing(m,t+.001,f);
  for(size_t i=0;i<ps.size();i++){
   auto p=ps[i];double r=std::hypot(p.x,p.y),a=p.radiusKm/(1-e),energy=.5*(p.vx*p.vx+p.vy*p.vy)-gm/r,h=p.x*p.vy-p.y*p.vx,expectedH=f*std::sqrt(gm*p.radiusKm);
   require(r>=p.radiusKm*(1-1e-14)&&r<=a*(1+e)*(1+1e-14),"ellipse outside peri/apo bounds");
   ellipseEnergy=std::max(ellipseEnergy,std::abs((energy+gm/(2*a))/(gm/(2*a))));
   ellipseAngular=std::max(ellipseAngular,std::abs(h/expectedH-1));
   ellipseForce=std::max(ellipseForce,std::hypot((hi[i].vx-lo[i].vx)/.002+gm*p.x/std::pow(r,3),(hi[i].vy-lo[i].vy)/.002+gm*p.y/std::pow(r,3))/(gm/(r*r)));
  }
 }
 require(ellipseForce<1e-6&&ellipseEnergy<1e-13&&ellipseAngular<1e-13,"elliptical Newtonian dynamics mismatch");
 for(double f:{1.,1.01,1.12,1.2}){
  auto peri=sampleRing(mass,0,f)[0],apo=sampleRing(mass,peri.periodSeconds/2,f)[0],closed=sampleRing(mass,peri.periodSeconds,f)[0];
  double ratio=f*f/(2-f*f);require(std::abs(apo.x+peri.x*ratio)<1e-6&&std::abs(apo.y)<1e-6,"apoapsis prediction");
  require(std::hypot(closed.x-peri.x,closed.y-peri.y)<1e-6,"ellipse closure");
  require(std::abs(std::hypot(peri.vx,peri.vy)/std::hypot(apo.vx,apo.vy)-ratio)<1e-12,"apsidal speed and area law");
  double c=numericalError(60,f),finer=numericalError(30,f);require(c/finer>3.8&&c/finer<4.2,"ellipse independent leapfrog convergence");
  std::cout<<"ellipse speed="<<f<<" e="<<f*f-1<<" errors km="<<c<<","<<finer<<'\n';
 }
 std::cout<<"elliptical grid 9216 states: max force="<<ellipseForce<<" energy="<<ellipseEnergy<<" angular="<<ellipseAngular<<'\n';
 RingClock clock;clock.configure(true,true,1,mass);clock.advance(.1);require(clock.seconds==360,"clock rate");clock.seek(7200);require(!clock.running&&clock.seconds==7200,"seek must pause");
 clock.configure(true,true,1,mass);clock.advance(.1);require(clock.seconds==7560,"resume must preserve clock");
 bool rejected=false;try{clock.seek(std::numeric_limits<double>::quiet_NaN());}catch(...){rejected=true;}require(rejected&&clock.seconds==7560,"invalid seek mutated clock");
 rejected=false;try{clock.configure(true,true,0,mass);}catch(...){rejected=true;}require(rejected&&clock.target==1,"invalid target mutated clock");
 clock.seek(86399);clock.configure(true,true,1,mass);clock.advance(.1);require(clock.seconds==86400&&!clock.running,"end must pause without wrapping");
 clock.configure(false,false,-1,mass);clock.advance(.1);require(clock.seconds==86400,"disabled clock advanced");
 clock.configure(true,false,2,mass);require(clock.seconds==0,"new target did not reset");
 clock.parameters(1.12,.1);clock.seek(3600);clock.configure(true,true,2,mass);clock.parameters(1.12,4);clock.advance(.1);require(clock.seconds==5040&&clock.running,"rate change reset state");
 clock.parameters(1.2,4);require(clock.seconds==0&&!clock.running,"launch change must reset and pause");
 for(double value:{.99,1.21,std::numeric_limits<double>::quiet_NaN()}){rejected=false;try{clock.parameters(value,1);}catch(...){rejected=true;}require(rejected&&clock.speedScale==1.2&&clock.rateHours==4&&clock.seconds==0,"invalid launch transaction");}
 for(double rate:{0.,4.1,std::numeric_limits<double>::infinity()}){rejected=false;try{clock.parameters(1.1,rate);}catch(...){rejected=true;}require(rejected&&clock.speedScale==1.2&&clock.rateHours==4,"invalid rate partially changed launch");}
 clock.configure(false,false,-1,mass);rejected=false;try{clock.parameters(1.1,1);}catch(...){rejected=true;}require(rejected,"disabled parameters accepted");clock.configure(true,false,1,mass);require(clock.speedScale==1&&clock.rateHours==1,"new experiment parameters not reset");
 std::cout<<"PASS 192 deterministic circular tracers; Earth reference; force relative error="<<maxForceError<<" energy="<<maxEnergyError<<"; differential periods; independent leapfrog errors km="<<coarse<<","<<fine<<"; bounded/atomic clock and terminal pause\n";
}catch(const std::exception&e){std::cerr<<"FAIL "<<e.what()<<'\n';return 1;}}
