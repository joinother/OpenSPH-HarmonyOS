#include "sph_structure.h"
#include <limits>
#include <iostream>
#include <stdexcept>
using namespace lab;
void check(bool b){if(!b)throw std::runtime_error("structure check failed");}
void near(double a,double b){check(std::abs(a-b)<1e-10*std::max(1.,std::abs(b)));}
int main(){
    // Unequal masses: COM=(3,0,0), bulk velocity=(5,0,0).
    std::vector<StructureParticle> p{{1,{0,0,0},{2,0,0}},{3,{4,0,0},{6,0,0}}};
    auto a=measureSphStructure(p,-10);near(a.values[0],-10);near(a.values[1],6);near(a.values[2],std::sqrt(3.)/1000);near(a.values[3],1.5);
    // Radius and relative motion do not change under translation/boost/rotation.
    for(auto&x:p){x.position={1e8,x.position[0]-2e8,0};x.velocity={1e7,x.velocity[0]-2e7,0};}
    auto b=measureSphStructure(p,-10);for(int i=0;i<4;i++)near(a.values[i],b.values[i]);
    for(auto&x:p)x.velocity={0,0,0};b=measureSphStructure(p,0);near(b.values[1],0);near(b.values[3],0);
    p={{1,{-1000,0,0},{5,0,0}},{1,{1000,0,0},{-5,0,0}}};b=measureSphStructure(p,-100);near(b.values[2],1);near(b.values[3],-5);near(b.values[1],25);
    p={{1,{0,0,0},{1,2,3}}};b=measureSphStructure(p,0);for(double v:b.values)near(v,0);
    int rejected=0;auto reject=[&](const std::vector<StructureParticle>&v,double energy){try{measureSphStructure(v,energy);}catch(const std::runtime_error&){++rejected;}};
    reject({},0);reject(p,1);reject(p,std::numeric_limits<double>::quiet_NaN());
    p[0].mass=0;reject(p,0);p[0].mass=1;p[0].velocity[0]=std::numeric_limits<double>::infinity();reject(p,0);
    check(rejected==5);std::cout<<"PASS analytic COM energy/radius/radial, boost/translation/rotation, contraction, singleton, invalid inputs\n";
}
