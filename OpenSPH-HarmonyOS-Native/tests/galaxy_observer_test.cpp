#include "galaxy_observer.h"
#include <cassert>
#include <iostream>
using namespace lab;
static std::shared_ptr<Frame> sample(const GalaxySystem& system,double time){auto f=std::make_shared<Frame>();f->time=time;f->galaxy=system.diagnostics();for(int i=0;i<6;i++)f->centers[i]=system.cores[i/3].position[i%3]/GALAXY_VIEW_KPC;for(const auto& p:system.points)f->particles.push_back({float(p.position[0]/10),float(p.position[1]/10),float(p.position[2]/10),0,0,float(p.origin)});return f;}
int main(){
 GalaxySystem system({1600,1234,1,25,.6,12,false});auto initial=sample(system,0);GalaxyObserverSettings settings{1,3.14,.2,90,7};FragmentFrame snapshot{7,0,initial,initial};
 auto first=galaxyObserverView(snapshot,settings);assert(first.available&&first.mode==1&&first.anchor>=0&&initial->particles[first.anchor].body==0);assert(std::abs(first.initialRadiusKpc-8)<1.0);
 for(int i=0;i<6400;i++)system.step(.0625);auto later=sample(system,400);snapshot.frame=later;snapshot.selected=100;
 auto current=galaxyObserverView(snapshot,settings);assert(current.anchor==first.anchor&&current.initialRadiusKpc==first.initialRadiusKpc);assert(current.time==400&&current.selected==100);assert(std::abs(current.positionKpc[0]-first.positionKpc[0])+std::abs(current.positionKpc[1]-first.positionKpc[1])>1); // same tracer, different integrated position
 for(int k=0;k<3;k++)assert(std::abs(current.primaryDirection[k]+current.positionKpc[k]-later->centers[k]*10)<1e-10);
 snapshot.frame=initial;snapshot.selected=0;assert(galaxyObserverView(snapshot,settings).positionKpc==first.positionKpc);
 snapshot.sceneRevision=8;assert(galaxyObserverView(snapshot,settings).mode==0);snapshot.initial.reset();assert(!galaxyObserverView(snapshot,settings).available);
 for(double yaw:{-6.,0.,1.7,6.})for(double pitch:{-1.5,0.,1.5}){auto b=galaxySkyBasis(yaw,pitch);assert(std::abs(galaxyLength(b.forward)-1)<1e-12);assert(std::abs(galaxySkyDot(b.right,b.forward))<1e-12);assert(std::abs(galaxySkyDot(b.up,b.forward))<1e-12);assert(std::abs(galaxySkyDot(b.up,b.right))<1e-12);}
 auto portrait=galaxySkyExtent(90,1080,2444),landscape=galaxySkyExtent(90,2444,1080);assert(std::abs(portrait[0]-1)<1e-12);assert(portrait[0]==landscape[1]&&portrait[1]==landscape[0]);
 for(double lat:{-90.,-35.,0.,35.,90.})for(double hour:{0.,6.,12.,18.,24.}){auto n=galaxyHorizonUp(lat,hour);assert(std::abs(galaxyLength(n)-1)<1e-12);auto wrap=galaxyHorizonUp(lat,hour==24?0:hour);for(int k=0;k<3;k++)assert(std::abs(n[k]-wrap[k])<1e-12);}
 for(double lat:{-90.,0.,35.,90.})for(double hour:{0.,12.,24.})for(double yaw:{0.,2.}){
 auto b=galaxyGroundBasis(yaw,.3,lat,hour);auto up=galaxyHorizonUp(lat,hour);assert(std::abs(galaxySkyDot(b.forward,up)-std::sin(.3))<1e-12);assert(std::abs(galaxySkyDot(b.right,up))<1e-12);assert(std::abs(galaxyLength(b.right)-1)<1e-12);
 GalaxyObserverView v;v.mode=2;v.settings.latitude=lat;v.settings.siderealHours=hour;v.primaryDirection=b.forward;auto aim=galaxyObserverAim(v,false);assert(std::abs(aim[0]-yaw)<1e-12&&std::abs(aim[1]-.3)<1e-12);
 }
 auto north=galaxyHorizonUp(90,0),northLater=galaxyHorizonUp(90,12);for(int k=0;k<3;k++)assert(std::abs(north[k]-northLater[k])<1e-12);
 // An observer whose zenith has the FK5 north galactic pole coordinates maps to +model Z.
 auto pole=galaxyHorizonUp(27.12825118085622,192.8594812065348/15);assert(std::abs(pole[0])+std::abs(pole[1])<1e-12&&std::abs(pole[2]-1)<1e-12);
 auto equator=galaxyHorizonUp(0,0),opposite=galaxyHorizonUp(0,12);assert(std::abs(galaxySkyDot(equator,opposite)+1)<1e-12);
 for(const auto s:{GalaxyObserverSettings{3,0,0,90},GalaxyObserverSettings{1,0,2,90},GalaxyObserverSettings{1,0,0,121},GalaxyObserverSettings{1,std::numeric_limits<double>::quiet_NaN(),0,90}}){bool rejected=false;try{validateGalaxyObserver(s.mode,s.yaw,s.pitch,s.fov);}catch(...){rejected=true;}assert(rejected);}
 std::cout<<"PASS: persistent initial solar-radius tracer; 400 Myr evolution and rewind; scene invalidation; orthonormal sky; fold/rotation FOV; finite bounds\n";
}
