#include "galaxy.h"
#include <cassert>
#include <iostream>
#include <iomanip>
using namespace lab;
static GalaxyVector delta(const GalaxyVector&a,const GalaxyVector&b){return {a[0]-b[0],a[1]-b[1],a[2]-b[2]};}
int main(){
 std::cout<<std::setprecision(12);GalaxyParameters p;p.responsive=true;p.count=201;p.speed=.75;
 GalaxySystem a(p),same(p);double stellar=0;for(double m:a.masses)stellar+=m;
 assert(std::abs(stellar/3.2e10-1)<1e-13);assert(a.cores[0].mass==8e10&&a.cores[1].mass==4.8e10);assert(a.points[30].velocity==same.points[30].velocity);
 auto bad=p;bad.count=801;assert(!validGalaxyParameters(bad));bad.responsive=false;assert(validGalaxyParameters(bad));
 std::cout<<"PASS deterministic odd-count mass allocation: stellar="<<stellar<<" total="<<stellar+a.cores[0].mass+a.cores[1].mass<<" solar masses\n";
 // Independently differentiate the Hamiltonian, then observe a vanishing-time kick.
 for(int target:{-1,0,105})for(int k=0;k<3;k++){
  GalaxySystem plus=a,minus=a,step=a,back=a;const double h=1e-3,dt=1e-3;
  (target<0?plus.cores[0].position:plus.points[target].position)[k]+=h;
  (target<0?minus.cores[0].position:minus.points[target].position)[k]-=h;
  const double mass=target<0?a.cores[0].mass:a.masses[target],force=-(plus.energy()-minus.energy())/(2*h);
  step.step(dt);back.step(-dt);
  const double observed=((target<0?step.cores[0].velocity:step.points[target].velocity)[k]-(target<0?back.cores[0].velocity:back.points[target].velocity)[k])*mass/(2*dt);
  if(target>=0)assert(std::abs(a.acceleration(a.points[target].position)[k]*mass-observed)<std::max(1.,std::abs(observed))*2e-5);
  assert(std::abs(force-observed)<std::max(1.,std::abs(force))*2e-5);
 }
 std::cout<<"PASS core and both stellar populations respond to gradient of the same total potential\n";
 GalaxySystem shifted=a;shifted.points[0].position[0]+=3;
 a.step(.0625);shifted.step(.0625);assert(galaxyLength(delta(a.cores[0].velocity,shifted.cores[0].velocity))>1e-9);
 std::cout<<"PASS moving a massive stellar population changes core motion (backreaction)\n";
 double errors[3];std::vector<GalaxyPoint> end[3];
 for(int level=0;level<3;level++){
  GalaxySystem s(p);double dt=.125/std::pow(2,level),e=s.energy(),norm=std::abs(e)+s.kineticTwice(),lscale=s.angularScale(),worst=0;auto mom=s.momentum(),angular=s.angularMomentum();
  for(int n=0;n<int(360/dt);n++){s.step(dt);if(n%32==31)worst=std::max(worst,std::abs(s.energy()-e)/norm);}
  assert(worst<1e-4);assert(galaxyLength(delta(mom,s.momentum()))/1.6e11<1e-12);assert(galaxyLength(delta(angular,s.angularMomentum()))/lscale<1e-11);errors[level]=worst;end[level]=s.points;
  std::cout<<"PASS 360 Myr dt="<<dt<<" normalized total energy="<<worst<<" separation="<<s.diagnostics().values[0]<<" kpc\n";
 }
 assert(errors[1]<errors[0]*.35&&errors[2]<errors[1]*.35);
 double coarse=0,fine=0;for(size_t i=0;i<a.points.size();i++){coarse+=std::pow(galaxyLength(delta(end[0][i].position,end[2][i].position)),2);fine+=std::pow(galaxyLength(delta(end[1][i].position,end[2][i].position)),2);}assert(fine<coarse*.2);
 std::cout<<"PASS stellar trajectory step refinement RMS "<<std::sqrt(coarse/a.points.size())<<" -> "<<std::sqrt(fine/a.points.size())<<" kpc\n";
 GalaxySystem reverse(p);const auto original=reverse.points;const auto cores=reverse.cores;for(int i=0;i<160;i++)reverse.step(.0625);for(int i=0;i<160;i++)reverse.step(-.0625);for(size_t i=0;i<original.size();i++)assert(galaxyLength(delta(original[i].position,reverse.points[i].position))<1e-10);assert(galaxyLength(delta(cores[0].position,reverse.cores[0].position))<1e-10);
 std::cout<<"PASS reversible closed gravitational system, without imposed drag or merging\n";
 GalaxySystem isolated(p,true);const double initialR=isolated.diagnostics().values[1],e=isolated.energy(),norm=std::abs(e)+isolated.kineticTwice();double worst=0;
 for(int n=0;n<12800;n++){isolated.step(.0625);if(n%64==63)worst=std::max(worst,std::abs(isolated.energy()-e)/norm);}
 assert(worst<1e-4);std::cout<<"PASS isolated numerical conservation; NOT equilibrium validation: 800 Myr RMS radius "<<initialR<<" -> "<<isolated.diagnostics().values[1]<<" kpc; energy="<<worst<<"\n";
 double cornerWorst=0;for(double ratio:{.2,1.})for(double speed:{.75,1.25})for(double offset:{0.,30.}){
  auto cp=p;cp.count=200;cp.massRatio=ratio;cp.speed=speed;cp.offset=offset;cp.inclination=70;GalaxySystem s(cp);const double ce=s.energy(),cn=std::abs(ce)+s.kineticTwice();
  for(int n=0;n<12800;n++){s.step(.0625);if(n%64==63)cornerWorst=std::max(cornerWorst,std::abs(s.energy()-ce)/cn);}assert(validGalaxyDiagnostics(s.diagnostics()));
 }assert(cornerWorst<.001);std::cout<<"PASS eight parameter corners through 800 Myr worst normalized energy="<<cornerWorst<<"\n";
 p.count=800;GalaxySystem budget(p);for(int n=0;n<800;n++)budget.step(.0625);assert(validGalaxyDiagnostics(budget.diagnostics()));std::cout<<"PASS 800-population budget to 50 Myr\n";
}
