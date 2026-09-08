#pragma once
#include "orbit.h"
#include <algorithm>
#include <cmath>
#include <limits>
#include <string>
namespace lab {
struct LocalImpactBody {double massKg=0,radiusKm=0,densityKgM3=0;Vec3 positionM{},velocityMS{};};
struct ImpactPlan {
    bool available=false,supported=false;std::string reason;
    std::array<LocalImpactBody,2> bodies{};
    Vec3 originAU{},velocityKmS{},angularMomentum{};
    double timeSeconds=0,relativeSpeedKmS=0,kineticEnergyJ=0,contactAngleDegrees=0;
};
inline bool validIncomingContact(const OrbitContact& c){
    if(!c.hasIncoming)return true;
    if(c.count==0||c.a<0||c.b<=c.a||!std::isfinite(c.time)||c.time<0||!std::isfinite(c.speed)||c.speed<=0)return false;
    Vec3 r{},v{};double scale=1;
    for(const auto& b:c.incoming){
        if(!std::isfinite(b.mass)||b.mass<=0||b.mass>2||!std::isfinite(b.radius)||b.radius<=0||b.radius>1)return false;
        for(int k=0;k<3;k++){if(!std::isfinite(b.position[k])||std::abs(b.position[k])>1e7||!std::isfinite(b.velocity[k])||std::abs(b.velocity[k])>1e10)return false;scale=std::max(scale,std::abs(b.position[k]));}
    }
    for(int k=0;k<3;k++){r[k]=c.incoming[1].position[k]-c.incoming[0].position[k];v[k]=c.incoming[1].velocity[k]-c.incoming[0].velocity[k];}
    const double distance=norm(r),radius=c.incoming[0].radius+c.incoming[1].radius;
    if(distance<=0||std::abs(distance-radius)>1e-7*radius+64*std::numeric_limits<double>::epsilon()*scale)return false;
    double approaching=0;for(int k=0;k<3;k++)approaching-=v[k]*r[k]/distance;
    return approaching>0&&std::abs(approaching-c.speed)<=1e-8*std::max(approaching,c.speed);
}
inline ImpactPlan makeImpactPlan(const OrbitContact& contact){
    ImpactPlan p;if(!contact.hasIncoming){p.reason="尚无反弹前状态；旧回放不会补造撞击初值";return p;}
    if(!validIncomingContact(contact)){p.reason="撞击事件数据无效";return p;}
    const auto& a=contact.incoming[0];const auto& b=contact.incoming[1];const double total=a.mass+b.mass,fa=a.mass/total,fb=b.mass/total;
    Vec3 r{},v{};
    for(int k=0;k<3;k++){
        r[k]=(b.position[k]-a.position[k])*AU;v[k]=(b.velocity[k]-a.velocity[k])*AU/YEAR;
        p.originAU[k]=a.position[k]+fb*(b.position[k]-a.position[k]);
        p.velocityKmS[k]=(a.velocity[k]+fb*(b.velocity[k]-a.velocity[k]))*AU/YEAR/1000;
        p.bodies[0].positionM[k]=-fb*r[k];p.bodies[1].positionM[k]=fa*r[k];
        p.bodies[0].velocityMS[k]=-fb*v[k];p.bodies[1].velocityMS[k]=fa*v[k];
    }
    for(int i=0;i<2;i++){auto& local=p.bodies[i];const auto& body=contact.incoming[i];local.massKg=body.mass*SOLAR_MASS;local.radiusKm=body.radius*AU/1000;local.densityKgM3=local.massKg/(4.*3.141592653589793/3*std::pow(local.radiusKm*1000,3));}
    const double reduced=a.mass*fb*SOLAR_MASS,speed=norm(v);
    p.timeSeconds=contact.time*YEAR;p.relativeSpeedKmS=speed/1000;p.kineticEnergyJ=.5*reduced*speed*speed;
    p.contactAngleDegrees=std::acos(std::clamp(contact.speed*AU/YEAR/speed,0.,1.))*180/3.141592653589793;
    for(int k=0;k<3;k++)p.angularMomentum[k]=reduced*(r[(k+1)%3]*v[(k+2)%3]-r[(k+2)%3]*v[(k+1)%3]);
    p.available=true;
    // Preserve event order; no swapping, scaling or density substitution to force eligibility.
    const auto& x=p.bodies[0];const auto& y=p.bodies[1];
    if(x.radiusKm<40-1e-8||x.radiusKm>200+1e-8||y.radiusKm<20-1e-8||y.radiusKm>120+1e-8)p.reason="半径超出现有局部岩体范围；保留原尺寸，不缩小行星";
    else if(x.densityKgM3<2400-1e-7||x.densityKgM3>3000+1e-7||y.densityKgM3<2400-1e-7||y.densityKgM3>3000+1e-7)p.reason="质量与半径推得的密度超出现有岩质材料范围";
    else if(p.relativeSpeedKmS<.5||p.relativeSpeedKmS>10)p.reason="相对撞速超出现有 0.5–10 km/s 岩体范围";
    else {p.supported=true;p.reason="尺寸、密度与撞速可用于局部岩体初值；粒子化与外部引力耦合尚待接通";}
    return p;
}
}
