#include "orbit.h"
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
OrbitSystem::OrbitSystem(std::vector<OrbitBody> initial):bodies(std::move(initial)) {
    if(bodies.size()<2||bodies.size()>8)throw std::invalid_argument("Expected 2–8 bodies");
    for(const auto &b:bodies){if(!std::isfinite(b.mass)||b.mass<=0||!std::isfinite(norm(b.position))||!std::isfinite(norm(b.velocity)))throw std::invalid_argument("Invalid initial body");}
    recenter();accelerations();
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
        if(!std::isfinite(r)||r<0.02)throw std::runtime_error("近距离遭遇：间距小于 0.02 AU，已停止；碰撞耦合尚未接入");
        double f=ORBIT_G/(r*r*r);
        for(int k=0;k<3;++k){a[i][k]+=f*bodies[j].mass*d[k];a[j][k]-=f*bodies[i].mass*d[k];}
    }
    return a;
}
void OrbitSystem::step(double dt) {
    if(!std::isfinite(dt)||std::abs(dt)>ORBIT_DT)throw std::invalid_argument("Orbit timestep exceeds limit");
    auto a=accelerations();
    // Kick-drift-kick leapfrog. Commit only after the encounter check succeeds.
    auto original=bodies;
    for(size_t i=0;i<bodies.size();++i)for(int k=0;k<3;++k){bodies[i].velocity[k]+=a[i][k]*dt*0.5;bodies[i].position[k]+=bodies[i].velocity[k]*dt;}
    try {a=accelerations();} catch(...) {bodies=std::move(original);throw;}
    for(size_t i=0;i<bodies.size();++i)for(int k=0;k<3;++k)bodies[i].velocity[k]+=a[i][k]*dt*0.5;
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
