#pragma once
#include "engine.h"
#include <limits>
#include <stdexcept>
namespace lab {
// Presentation only: follow one persistent massless disk tracer, never integrate a new orbit.
struct GalaxyObserverSettings {int mode=0;double yaw=3.141592653589793,pitch=.12,fov=90;uint64_t revision=0;double latitude=35,siderealHours=12;};
struct GalaxyObserverView {
    bool available=false;int mode=0,anchor=-1,selected=-1;uint64_t sceneRevision=0;
    double time=0,initialRadiusKpc=0;GalaxyVector positionKpc{},primaryDirection{},secondaryDirection{};
    GalaxyObserverSettings settings;
};
inline void validateGalaxyObserver(int mode,double yaw,double pitch,double fov,double latitude=35,double siderealHours=12){
    if(mode<0||mode>2||!std::isfinite(yaw)||std::abs(yaw)>100||!std::isfinite(pitch)||std::abs(pitch)>1.5||!std::isfinite(fov)||fov<35||fov>120||!std::isfinite(latitude)||std::abs(latitude)>90||!std::isfinite(siderealHours)||siderealHours<0||siderealHours>24)
        throw std::invalid_argument("Invalid galaxy observer view");
}
inline GalaxyObserverView galaxyObserverView(const FragmentFrame& snapshot,const GalaxyObserverSettings& settings){
    GalaxyObserverView out;out.sceneRevision=snapshot.sceneRevision;out.selected=snapshot.selected;out.settings=settings;
    if(!snapshot.frame||!snapshot.initial||!snapshot.frame->galaxy.available||!snapshot.initial->galaxy.available)return out;
    const auto& first=*snapshot.initial;const auto& frame=*snapshot.frame;
    if(first.particles.size()!=frame.particles.size()||first.time!=0)return out;
    double best=std::numeric_limits<double>::infinity();
    for(size_t i=0;i<first.particles.size();i++){
        const auto& p=first.particles[i];if(p.body!=0)continue;
        double x=p.x-first.centers[0],y=p.y-first.centers[1],z=p.z-first.centers[2];
        const double d=(x-.8)*(x-.8)+y*y+z*z;
        if(d<best){best=d;out.anchor=int(i);out.initialRadiusKpc=std::sqrt(x*x+y*y+z*z)*GALAXY_VIEW_KPC;}
    }
    if(out.anchor<0)return out;
    const auto& p=frame.particles[out.anchor];out.positionKpc={p.x*GALAXY_VIEW_KPC,p.y*GALAXY_VIEW_KPC,p.z*GALAXY_VIEW_KPC};
    for(int k=0;k<3;k++){out.primaryDirection[k]=frame.centers[k]*GALAXY_VIEW_KPC-out.positionKpc[k];out.secondaryDirection[k]=frame.centers[k+3]*GALAXY_VIEW_KPC-out.positionKpc[k];}
    out.available=true;out.time=frame.time;out.mode=settings.revision==snapshot.sceneRevision?settings.mode:0;return out;
}
// Illustrative frozen J2000 terrestrial orientation. Local sidereal time is independent
// of the Myr solver clock. Galactic axes mapped to model (-X,-Y,+Z); no precession,
// refraction, Earth position or future habitability is inferred. Constants: Astropy FK5 Galactic definition.
inline GalaxyVector galaxyHorizonUp(double latitude,double siderealHours){
    const double rad=3.141592653589793/180,lat=latitude*rad,lst=siderealHours*15*rad;
    GalaxyVector v{std::cos(lat)*std::cos(lst),std::cos(lat)*std::sin(lst),std::sin(lat)};
    auto rz=[](GalaxyVector a,double angle){double c=std::cos(angle),s=std::sin(angle);return GalaxyVector{c*a[0]+s*a[1],-s*a[0]+c*a[1],a[2]};};
    v=rz(v,192.8594812065348*rad);double b=(90-27.12825118085622)*rad;
    v={std::cos(b)*v[0]-std::sin(b)*v[2],v[1],std::sin(b)*v[0]+std::cos(b)*v[2]};
    v=rz(v,(180-122.9319185680026)*rad);return {-v[0],-v[1],v[2]};
}
struct GalaxySkyBasis {GalaxyVector right,up,forward;};
inline GalaxySkyBasis galaxySkyBasis(double yaw,double pitch){
    return {{-std::sin(yaw),std::cos(yaw),0},{-std::cos(yaw)*std::sin(pitch),-std::sin(yaw)*std::sin(pitch),std::cos(pitch)},
        {std::cos(yaw)*std::cos(pitch),std::sin(yaw)*std::cos(pitch),std::sin(pitch)}};
}
inline double galaxySkyDot(const GalaxyVector& a,const GalaxyVector& b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
// fov applies to the shorter viewport axis, so folding preserves angular scale there.
inline std::array<double,2> galaxySkyExtent(double fov,int width,int height){double a=double(std::max(width,1))/std::max(height,1),t=std::tan(fov*3.141592653589793/360);return {t*std::max(a,1.0),t/std::min(a,1.0)};}
inline GalaxySkyBasis galaxyGroundBasis(double yaw,double pitch,double latitude,double siderealHours){
    const auto zenith=galaxyHorizonUp(latitude,siderealHours),equator=galaxyHorizonUp(0,siderealHours),pole=galaxyHorizonUp(90,0),east=galaxyHorizonUp(0,std::fmod(siderealHours+6,24));
    const double lat=latitude*3.141592653589793/180;GalaxyVector north{},horizontal{};GalaxySkyBasis b;
    for(int k=0;k<3;k++){north[k]=-std::sin(lat)*equator[k]+std::cos(lat)*pole[k];horizontal[k]=std::cos(yaw)*north[k]+std::sin(yaw)*east[k];b.right[k]=std::cos(yaw)*east[k]-std::sin(yaw)*north[k];b.forward[k]=std::cos(pitch)*horizontal[k]+std::sin(pitch)*zenith[k];b.up[k]=-std::sin(pitch)*horizontal[k]+std::cos(pitch)*zenith[k];}return b;
}
inline std::array<double,2> galaxyObserverAim(const GalaxyObserverView& view,bool secondary){
    auto d=secondary?view.secondaryDirection:view.primaryDirection;
    if(view.mode==2){auto base=galaxyGroundBasis(0,0,view.settings.latitude,view.settings.siderealHours);d={galaxySkyDot(d,base.forward),galaxySkyDot(d,base.right),galaxySkyDot(d,base.up)};}
    return {std::atan2(d[1],d[0]),std::clamp(std::atan2(d[2],std::hypot(d[0],d[1])),-1.5,1.5)};
}
} // namespace lab
