#include "orbit.h"
#include "sphere_contact.h"
#include <algorithm>
#include <cmath>
#include <stdexcept>
namespace lab {
double norm(const Vec3 &v) {return std::sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);}
OrbitSystem::OrbitSystem(int preset,double scale) {
    if((preset!=3&&preset!=4)||!std::isfinite(scale)||scale<0.75||scale>1.25)
        throw std::invalid_argument("Invalid orbit preset or velocity scale");
    bodies.push_back({1,{0,0,0},{0,0,0}});
    // Educational, coplanar initial conditions, not ephemerides. Earth-like mass.
    auto add=[&](double radius,double mass,double phase) {
        double speed=std::sqrt(ORBIT_G*(1+mass)/radius)*scale;
        bodies.push_back({mass,{radius*std::cos(phase),radius*std::sin(phase),0},
            {-speed*std::sin(phase),speed*std::cos(phase),0}});
    };
    add(1,398600.435507e9/SOLAR_GM,0);
    if(preset==4) {add(0.72,324858.592000e9/SOLAR_GM,2.1);add(1.52,42828.375816e9/SOLAR_GM,4.2);}
    recenter();
}
OrbitSystem::OrbitSystem(std::vector<OrbitBody> initial,bool center):bodies(std::move(initial)) {
    if(bodies.size()<2||bodies.size()>8)throw std::invalid_argument("Expected 2–8 bodies");
    for(const auto &b:bodies){if(!std::isfinite(b.mass)||b.mass<=0||!std::isfinite(norm(b.position))||!std::isfinite(norm(b.velocity)))throw std::invalid_argument("Invalid initial body");}
    for(const auto& b:bodies)if(!std::isfinite(b.radius)||b.radius<0||(b.radius>0)!=finiteSpheres())throw std::invalid_argument("All bodies need physical radii, or all must be point masses");
    if(center)recenter();accelerations();
}
void OrbitSystem::recenter() {
    Vec3 p{},v{};double mass=0;
    for(const auto &b:bodies){mass+=b.mass;for(int k=0;k<3;++k){p[k]+=b.mass*b.position[k];v[k]+=b.mass*b.velocity[k];}}
    for(auto &b:bodies)for(int k=0;k<3;++k){b.position[k]-=p[k]/mass;b.velocity[k]-=v[k]/mass;}
}
std::vector<Vec3> OrbitSystem::accelerations() const {
    std::vector<Vec3> a(bodies.size());
    for(size_t i=0;i<bodies.size();++i)for(size_t j=i+1;j<bodies.size();++j){
        Vec3 d;for(int k=0;k<3;++k)d[k]=bodies[j].position[k]-bodies[i].position[k];
        double r=norm(d);
        if(!std::isfinite(r)||r<(finiteSpheres()?(bodies[i].radius+bodies[j].radius)*(1-1.e-8):0.02))throw std::runtime_error(finiteSpheres()?"实体表面重叠或接触误差过大，已停止":"近距离遭遇：间距小于 0.02 AU，已停止；请启用球体接触模型");
        double f=ORBIT_G/(r*r*r);
        for(int k=0;k<3;++k){a[i][k]+=f*bodies[j].mass*d[k];a[j][k]-=f*bodies[i].mass*d[k];}
    }
    return a;
}
double OrbitSystem::step(double dt) {
    if(finiteSpheres()){
        if(!std::isfinite(dt)||dt<=0||dt>ORBIT_DT)throw std::invalid_argument("Sphere timestep must be positive and bounded");
        const auto before=bodies;const auto oldContact=contact;const double oldElapsed=elapsed;
        double done=0;int iterations=0;
        try{while(done<dt){
            if(++iterations>8192)throw std::runtime_error("接触步长预算已达到，请增大半径或降低密度");
            double h=dt-done;
            for(size_t i=0;i<bodies.size();i++)for(size_t j=0;j<i;j++){
                Vec3 r;for(int k=0;k<3;k++)r[k]=bodies[i].position[k]-bodies[j].position[k];
                double d=norm(r);h=std::min(h,.001*std::sqrt(d*d*d/(ORBIT_G*(bodies[i].mass+bodies[j].mass))));
            }
            if(h<1.e-14)throw std::runtime_error("接触时间步过小，已停止");
            auto a=accelerations();for(size_t i=0;i<bodies.size();i++)for(int k=0;k<3;k++)bodies[i].velocity[k]+=a[i][k]*h*.5;
            double remaining=h,drifted=0;int events=0;
            while(remaining>0){
                double first=remaining;int hitA=-1,hitB=-1;
                for(size_t i=0;i<bodies.size();i++)for(size_t j=i+1;j<bodies.size();j++){
                    Vec3 r,v;for(int k=0;k<3;k++){r[k]=bodies[j].position[k]-bodies[i].position[k];v[k]=bodies[j].velocity[k]-bodies[i].velocity[k];}
                    double t=sphereContactTime(r,v,bodies[i].radius+bodies[j].radius,remaining);
                    if(t>=0&&(hitA<0||t<first)){first=t;hitA=i;hitB=j;}
                }
                for(auto& b:bodies)for(int k=0;k<3;k++)b.position[k]+=b.velocity[k]*first;
                drifted+=first;remaining=std::max(0.,remaining-first);
                if(hitA<0)break;
                if(++events>64||contact.count>=1000000)throw std::runtime_error("同时接触过密，已停止");
                auto& x=bodies[hitA];auto& y=bodies[hitB];Vec3 n,v;for(int k=0;k<3;k++){n[k]=y.position[k]-x.position[k];v[k]=y.velocity[k]-x.velocity[k];}
                double d=norm(n),vn=0;for(int k=0;k<3;k++){n[k]/=d;vn+=v[k]*n[k];}
                OrbitContact event{contact.count+1,hitA,hitB,elapsed+drifted,-vn};
                event.hasIncoming=true;event.incoming={x,y};
                double impulse=-2*vn/(1/x.mass+1/y.mass);
                for(int k=0;k<3;k++){x.velocity[k]-=impulse*n[k]/x.mass;y.velocity[k]+=impulse*n[k]/y.mass;}
                contact=event;
            }
            a=accelerations();for(size_t i=0;i<bodies.size();i++)for(int k=0;k<3;k++)bodies[i].velocity[k]+=a[i][k]*h*.5;
            done+=h;elapsed+=h;
            if(contact.count!=oldContact.count)break; // Present the first response before continuing.
        }}catch(...){bodies=before;contact=oldContact;elapsed=oldElapsed;throw;}
        return done;
    }
    if(!std::isfinite(dt)||std::abs(dt)>ORBIT_DT)throw std::invalid_argument("Orbit timestep exceeds limit");
    auto a=accelerations();
    // Kick-drift-kick leapfrog. Commit only after the encounter check succeeds.
    auto original=bodies;
    for(size_t i=0;i<bodies.size();++i)for(int k=0;k<3;++k){bodies[i].velocity[k]+=a[i][k]*dt*0.5;bodies[i].position[k]+=bodies[i].velocity[k]*dt;}
    try {a=accelerations();} catch(...) {bodies=std::move(original);throw;}
    for(size_t i=0;i<bodies.size();++i)for(int k=0;k<3;++k)bodies[i].velocity[k]+=a[i][k]*dt*0.5;
    elapsed+=dt;return dt;
}
double OrbitSystem::energy() const {
    double e=0;
    for(size_t i=0;i<bodies.size();++i){const auto &b=bodies[i];double v=norm(b.velocity);e+=0.5*b.mass*v*v;
        for(size_t j=i+1;j<bodies.size();++j){Vec3 d;for(int k=0;k<3;++k)d[k]=b.position[k]-bodies[j].position[k];e-=ORBIT_G*b.mass*bodies[j].mass/norm(d);}}
    return e;
}
Vec3 OrbitSystem::momentum() const {Vec3 p{};for(const auto &b:bodies)for(int k=0;k<3;++k)p[k]+=b.mass*b.velocity[k];return p;}
Vec3 OrbitSystem::angularMomentum() const {Vec3 l{};for(const auto &b:bodies)for(int k=0;k<3;++k)l[k]+=b.mass*(b.position[(k+1)%3]*b.velocity[(k+2)%3]-b.position[(k+2)%3]*b.velocity[(k+1)%3]);return l;}
}
