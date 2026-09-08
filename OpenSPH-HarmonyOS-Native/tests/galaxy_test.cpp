#include "galaxy.h"
#include <cassert>
#include <iostream>
#include <iomanip>
using namespace lab;
static double distance(const GalaxyVector&a,const GalaxyVector&b){GalaxyVector d;for(int k=0;k<3;k++)d[k]=a[k]-b[k];return galaxyLength(d);}
int main(){
 std::cout<<std::setprecision(12);GalaxyParameters p;p.count=200;
 assert(std::abs(GALAXY_G-4.4985e-12)<1.e-15);
 GalaxySystem a(p,true),b(p,true);assert(a.points.size()==200);for(int i=0;i<200;i++)assert(a.points[i].position==b.points[i].position);
 const auto start=a.points;double maxRadius=0,maxEnergy=0;const double e0=.5*std::pow(galaxyLength(a.points[0].velocity),2)+GalaxySystem::potential(a.points[0].position,a.cores[0]);
 // More than ten inner circular periods, with radii covering the whole disk.
 for(int j=0;j<24000;j++)a.step(.125);
 for(int i=0;i<200;i++)maxRadius=std::max(maxRadius,std::abs(galaxyLength(a.points[i].position)/galaxyLength(start[i].position)-1));
 const double e1=.5*std::pow(galaxyLength(a.points[0].velocity),2)+GalaxySystem::potential(a.points[0].position,a.cores[0]);maxEnergy=std::abs((e1-e0)/e0);
 assert(maxRadius<1.e-4&&maxEnergy<1.e-7);std::cout<<"PASS isolated disk: 3000 Myr max relative radius "<<maxRadius<<" relative energy "<<maxEnergy<<"\n";
 GalaxySystem forward(p);const auto original=forward.points;const auto cores=forward.cores;
 for(int i=0;i<1000;i++)forward.step(.125);for(int i=0;i<1000;i++)forward.step(-.125);
 double reverse=0;for(int i=0;i<200;i++)reverse=std::max(reverse,distance(original[i].position,forward.points[i].position));assert(reverse<1.e-9);std::cout<<"PASS reversibility "<<reverse<<" kpc\n";
 double errors[3];std::array<double,5> results[3];std::vector<GalaxyPoint> positions[3];
 for(int level=0;level<3;level++){
  GalaxySystem pair(p);const double dt=.125/std::pow(2,level),initial=pair.coreEnergy(),l0=galaxyLength(pair.coreAngularMomentum());double maxDrift=0;
  for(int i=0;i<int(600/dt);i++){pair.step(dt);maxDrift=std::max(maxDrift,std::abs((pair.coreEnergy()-initial)/initial));}
  const double angular=std::abs(galaxyLength(pair.coreAngularMomentum())/l0-1);
  assert(maxDrift<1.e-3&&angular<1.e-10&&galaxyLength(pair.coreMomentum())<1.e-3);
  errors[level]=maxDrift;results[level]=pair.diagnostics().values;positions[level]=pair.points;
  assert(validGalaxyDiagnostics(pair.diagnostics()));std::cout<<"PASS pair dt "<<dt<<" core energy "<<maxDrift<<" angular "<<angular<<" separation "<<results[level][0]<<" outer fractions "<<results[level][3]<<" "<<results[level][4]<<"\n";
 }
 assert(errors[1]<errors[0]*.3&&errors[2]<errors[1]*.3);
 double coarse=0,fine=0;for(int i=0;i<200;i++){coarse+=std::pow(distance(positions[0][i].position,positions[2][i].position),2);fine+=std::pow(distance(positions[1][i].position,positions[2][i].position),2);}assert(fine<coarse*.15);std::cout<<"PASS tracer step refinement RMS "<<std::sqrt(coarse/200)<<" -> "<<std::sqrt(fine/200)<<" kpc\n";
 p.retrograde=true;GalaxySystem retro(p);for(int i=0;i<19200;i++)retro.step(.03125);
 const auto d=retro.diagnostics();double difference=0;for(int i=100;i<200;i++)difference+=distance(retro.points[i].position,positions[2][i].position);assert(difference/100>1);assert(results[2][3]>.01||results[2][4]>.01);
 std::cout<<"PASS spin comparison retro outer fractions "<<d.values[3]<<" "<<d.values[4]<<" mean secondary displacement "<<difference/100<<" kpc\n";
 bool rejected=false;try{retro.step(NAN);}catch(...){rejected=true;}assert(rejected);p.massRatio=INFINITY;assert(!validGalaxyParameters(p));
 double worst=0;int corners=0;
 for(double mass:{.2,1.})for(double speed:{.75,1.25})for(double offset:{0.,30.}){
  GalaxyParameters cp;cp.count=200;cp.massRatio=mass;cp.speed=speed;cp.offset=offset;cp.inclination=70;GalaxySystem corner(cp);
  double e=corner.coreEnergy(),den=std::abs(e);for(const auto& c:corner.cores)den+=c.mass*std::pow(galaxyLength(c.velocity),2);
  for(int i=0;i<12800;i++){corner.step(.0625);worst=std::max(worst,std::abs((corner.coreEnergy()-e)/den));}
  assert(validGalaxyDiagnostics(corner.diagnostics()));corners++;
 }
 assert(worst<.001);std::cout<<"PASS "<<corners<<" parameter corners to 800 Myr; worst normalized core energy "<<worst<<"\n";
 GalaxyParameters sparse,dense;sparse.count=200;dense.count=2400;GalaxySystem sparseModel(sparse),denseModel(dense);
 for(int i=0;i<800;i++){sparseModel.step(.0625);denseModel.step(.0625);}
 assert(sparseModel.cores[0].position==denseModel.cores[0].position&&sparseModel.cores[1].velocity==denseModel.cores[1].velocity);
 std::cout<<"PASS tracer count does not change mass or core trajectory\n";
 std::cout<<"PASS galaxy model\n";
}
