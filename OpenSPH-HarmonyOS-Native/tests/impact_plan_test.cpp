#include "impact_plan.h"
#include <iostream>
#include <stdexcept>
using namespace lab;
void require(bool x,const char* m){if(!x)throw std::runtime_error(m);}
bool near(double a,double b,double scale=1){return std::abs(a-b)<1e-9*std::max({scale,std::abs(a),std::abs(b)});}
int main(){try{
 const double ra=100000,rb=60000,rho=2700;const double ma=4*3.141592653589793/3*std::pow(ra,3)*rho/SOLAR_MASS,mb=ma*std::pow(rb/ra,3);
 OrbitSystem s({{ma,{-ra/AU,0,0},{2000*YEAR/AU,0,0},ra/AU},{mb,{rb/AU,0,0},{-3000*YEAR/AU,700*YEAR/AU,0},rb/AU}},false);s.step(.02/YEAR);
 require(s.contact.count==1&&s.contact.hasIncoming,"missing incoming event");require(validIncomingContact(s.contact),"invalid actual event");auto plan=makeImpactPlan(s.contact);require(plan.available&&plan.supported,"supported rock pair rejected");
 require(plan.bodies[0].velocityMS[0]>0&&plan.bodies[1].velocityMS[0]<0,"used outgoing velocity");require(s.bodies[0].velocity[0]!=s.contact.incoming[0].velocity[0],"no elastic response");
 const double radial=5000+ORBIT_G*(ma+mb)*AU*AU*AU/(YEAR*YEAR)/((ra+rb)*(ra+rb))*.01;
 require(near(plan.relativeSpeedKmS,std::hypot(radial,700.)/1000),"relative speed conversion");require(near(plan.bodies[0].densityKgM3,rho),"density conversion");
 for(int k=0;k<3;k++){require(near(plan.bodies[0].massKg*plan.bodies[0].velocityMS[k]+plan.bodies[1].massKg*plan.bodies[1].velocityMS[k],0,plan.bodies[0].massKg*5000),"COM momentum");require(near(plan.bodies[0].massKg*plan.bodies[0].positionM[k]+plan.bodies[1].massKg*plan.bodies[1].positionM[k],0,plan.bodies[0].massKg*ra),"COM origin");}
 const double reduced=ma*mb/(ma+mb)*SOLAR_MASS;require(near(plan.kineticEnergyJ,.5*reduced*(radial*radial+700*700)),"relative energy");require(near(plan.angularMomentum[2],reduced*(ra+rb)*700),"angular momentum");
 auto translated=s.contact;for(auto& body:translated.incoming){body.position[0]+=1;body.position[1]-=.5;body.velocity[0]+=6;body.velocity[2]-=2;}
 auto moved=makeImpactPlan(translated);require(moved.available&&near(moved.kineticEnergyJ,plan.kineticEnergyJ)&&near(moved.angularMomentum[2],plan.angularMomentum[2]),"Galilean invariance");
 auto before=s.contact;s.step(.02/YEAR);require(s.contact.count==before.count&&s.contact.incoming[0].position==before.incoming[0].position,"event mutated after evolution");
 for(int variant=0;variant<4;variant++){auto bad=before;if(variant==0)bad.incoming[0].mass=NAN;if(variant==1)bad.incoming[0].position[0]=NAN;if(variant==2)bad.speed*=2;if(variant==3)bad.incoming[1].position[0]+=.01;require(!makeImpactPlan(bad).available,"corrupt snapshot accepted");}
 auto large=before;for(auto& body:large.incoming){body.radius*=100;for(double& x:body.position)x*=100;body.mass*=1e6;}require(makeImpactPlan(large).available&&!makeImpactPlan(large).supported,"planet silently shrunk");
 OrbitContact legacy;legacy.count=1;require(!makeImpactPlan(legacy).available,"legacy fabricated incoming state");
 std::cout<<"PASS incoming event capture, no outgoing substitution, SI conversion, COM, energy/angular momentum, Galilean invariance, immutable snapshot, corrupt and unsupported guards\n";
}catch(const std::exception& e){std::cerr<<"FAIL "<<e.what()<<'\n';return 1;}}
