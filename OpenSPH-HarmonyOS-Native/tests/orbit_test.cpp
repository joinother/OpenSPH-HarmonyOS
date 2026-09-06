#include "orbit.h"
#include <algorithm>
#include <cmath>
#include <iostream>
#include <stdexcept>
using namespace lab;
void check(bool ok,const char *message){if(!ok)throw std::runtime_error(message);}
double distance(const Vec3&a,const Vec3&b){Vec3 d;for(int k=0;k<3;++k)d[k]=a[k]-b[k];return norm(d);}
double circularError(double dt){
    OrbitSystem s(3);const auto initial=s.bodies;
    const double total=1+s.bodies[1].mass,omega=std::sqrt(ORBIT_G*total);
    const int steps=int(std::ceil(0.25/dt));dt=0.25/steps;
    for(int i=0;i<steps;++i)s.step(dt);
    Vec3 expected{initial[1].position[0]*std::cos(omega*0.25),initial[1].position[0]*std::sin(omega*0.25),0};
    return distance(s.bodies[1].position,expected);
}
int main(){try{
    double coarse=circularError(ORBIT_DT),fine=circularError(ORBIT_DT/2);
    check(coarse/fine>3.8&&coarse/fine<4.2,"not second-order convergence");
    std::cout<<"PASS analytic circular orbit: position errors AU="<<coarse<<","<<fine<<" ratio="<<coarse/fine<<'\n';
    for(int preset:{3,4})for(double scale:{0.75,1.0,1.25}){
        if(preset==4&&scale==0.75)continue;
        OrbitSystem s(preset,scale);double e0=s.energy(),l0=norm(s.angularMomentum()),maxE=0,maxL=0,maxP=0;
        for(int i=0;i<40960;++i){s.step(ORBIT_DT);maxE=std::max(maxE,std::abs((s.energy()-e0)/e0));maxL=std::max(maxL,std::abs(norm(s.angularMomentum())/l0-1));maxP=std::max(maxP,norm(s.momentum()));}
        check(maxE<2e-4,"energy drift too large");check(maxL<1e-10,"angular momentum drift");check(maxP<1e-15,"linear momentum drift");
        std::cout<<"PASS 10 years preset="<<preset<<" velocity="<<scale<<" max relative E="<<maxE<<" L="<<maxL<<" momentum="<<maxP<<'\n';
    }
    {
        OrbitSystem planar(3);auto b=planar.bodies;
        for(auto &body:b){body.position[2]=body.position[1];body.position[1]=0;body.velocity[2]=body.velocity[1];body.velocity[1]=0;}
        OrbitSystem tilted(b);double e0=tilted.energy();
        for(int i=0;i<32768;++i)tilted.step(ORBIT_DT/8);
        check(std::abs((tilted.energy()-e0)/e0)<1.e-10,"custom inclined orbit energy");
        check(std::abs(tilted.bodies[1].position[1])<1.e-15,"orbital plane changed");
        check(distance(tilted.bodies[1].position,b[1].position)<.001,"custom inclined orbit period");
        for(auto &body:b){body.position[0]+=3;body.position[1]-=2;body.velocity[0]+=5;body.velocity[2]-=4;}
        OrbitSystem shifted(b);check(norm(shifted.momentum())<1.e-15,"custom barycentre momentum");
        bool rejected=false;b[1].mass=0;try{OrbitSystem invalid(b);}catch(const std::invalid_argument&){rejected=true;}check(rejected,"custom invalid mass accepted");
        std::cout<<"PASS custom constructor, 3D circular orbit, one-year energy, barycentric transformation\n";
    }
    OrbitSystem s(4,1);auto initial=s.bodies;
    for(int i=0;i<4096;++i)s.step(ORBIT_DT);
    for(int i=0;i<4096;++i)s.step(-ORBIT_DT);
    for(size_t i=0;i<initial.size();++i){check(distance(initial[i].position,s.bodies[i].position)<1e-10,"time reversal position");check(distance(initial[i].velocity,s.bodies[i].velocity)<1e-9,"time reversal velocity");}
    for(double scale:{0.75}){OrbitSystem crossing(4,scale);bool stopped=false;
        for(int i=0;i<40960;++i){try{crossing.step(ORBIT_DT);}catch(const std::runtime_error&){stopped=true;break;}}
        check(stopped,"crossing orbits failed to stop at close encounter");
        std::cout<<"PASS crossing preset=4 velocity="<<scale<<" encounter stop\n";
    }
    OrbitSystem near(3);near.bodies[1].position=near.bodies[0].position;
    bool caught=false;try{near.step(ORBIT_DT);}catch(const std::runtime_error&){caught=true;}check(caught,"close encounter not stopped");
    caught=false;try{s.step(1);}catch(const std::invalid_argument&){caught=true;}check(caught,"oversized step accepted");
    std::cout<<"PASS reversibility, close encounter stop, timestep validation\n";
}catch(const std::exception&e){std::cerr<<"FAIL "<<e.what()<<'\n';return 1;}}
