#pragma once
#include "ring_trace.h"
#include <algorithm>
#include <array>
#include <cstdint>
namespace lab {
constexpr int DENSE_RING_COUNT=8192,RING_MAP_SIZE=512;
constexpr double RING_MAP_EXTENT=7.0;
// A prescribed, localized radial impulse at t=0. There is no colliding impactor.
inline void validateRingImpulse(double impulse){if(!std::isfinite(impulse)||impulse<0||impulse>.35)throw std::invalid_argument("Ring impulse outside 0–0.35 circular speed");}
inline RingPoint impulseOrbit(double mass,double seconds,double radius,double scale,double phase,double kick){
 const double mu=SOLAR_GM*mass/1e9,D=2-scale*scale-kick*kick;
 const double ex=scale*scale-1,ey=-kick*scale,e=std::hypot(ex,ey);
 if(e<1e-14)return ringPoint(mass,seconds,radius,scale,phase);
 const double a=radius/D,period=ringPeriod(mass,a),omega=phase+std::atan2(ey,ex);
 const double E0=std::atan2(kick*std::sqrt(D),ex+kick*kick),M0=E0-e*std::sin(E0);
 const double mean=std::remainder(M0+2*3.141592653589793*seconds/period,2*3.141592653589793);
 double E=mean;for(int i=0;i<16;i++){const double delta=(E-e*std::sin(E)-mean)/(1-e*std::cos(E));E-=delta;if(std::abs(delta)<1e-14)break;}
 const double c=std::cos(E),s=std::sin(E),q=std::sqrt(1-e*e),edot=std::sqrt(mu/(a*a*a))/(1-e*c),C=std::cos(omega),S=std::sin(omega);
 const double x=a*(c-e),y=a*q*s,vx=-a*s*edot,vy=a*q*c*edot;
 return {x*C-y*S,x*S+y*C,vx*C-vy*S,vx*S+vy*C,radius,period};
}
inline std::vector<RingPoint> denseRing(double mass,double seconds,double scale=1,double impulse=0){
 validateRingSpeed(scale);validateRingImpulse(impulse);
 if(!std::isfinite(mass)||mass<1e-8||mass>.01||!std::isfinite(seconds)||seconds<0||seconds>RING_END_SECONDS)throw std::invalid_argument("Invalid dense ring mass/time");
 std::vector<RingPoint> points;points.reserve(DENSE_RING_COUNT);
 const double inner2=RING_INNER*RING_INNER,outer2=RING_OUTER*RING_OUTER,gapLow=1.90*1.90,gapHigh=2.00*2.00;
 const double area=outer2-inner2-(gapHigh-gapLow);
 for(int i=0;i<DENSE_RING_COUNT;i++){
  double r2=inner2+area*(i+.5)/DENSE_RING_COUNT;if(r2>=gapLow)r2+=gapHigh-gapLow;
  // A hashed phase avoids the artificial spiral lattice produced by a golden-angle
  // sequence under Kepler shear. Radial strata retain equal represented area.
  uint32_t hash=uint32_t(i)+0x9e3779b9u;hash=(hash^(hash>>16))*0x85ebca6bu;hash=(hash^(hash>>13))*0xc2b2ae35u;hash^=hash>>16;
  const double r=std::sqrt(r2),phase=2*3.141592653589793*(double(hash)+.5)/4294967296.;
  const double theta=std::remainder(phase,2*3.141592653589793),kick=impulse*std::exp(-std::pow(theta/.55,2)-std::pow((r-1.75)/.34,2));
  points.push_back(impulseOrbit(mass,seconds,r*RING_RADIUS_KM,scale,phase,kick));
 }
 return points;
}
struct RingDensityMap {std::vector<uint8_t> pixels;double depositedWeight=0;int outside=0;};
// Kernel sum is normalized. This is tracer surface concentration mapped to opacity,
// not a calibrated optical depth or surface mass density in kg/m².
inline RingDensityMap ringDensityMap(const std::vector<RingPoint> &points){
 RingDensityMap map;map.pixels.resize(RING_MAP_SIZE*RING_MAP_SIZE);std::vector<float> cells(map.pixels.size(),0);
 const double cell=2*RING_MAP_EXTENT/RING_MAP_SIZE,area=3.141592653589793*(RING_OUTER*RING_OUTER-RING_INNER*RING_INNER-(4.-3.61));
 const double weight=.9*area/(DENSE_RING_COUNT*cell*cell);
 for(const auto &p:points){
  const double x=(p.x/RING_RADIUS_KM+RING_MAP_EXTENT)/cell-.5,y=(p.y/RING_RADIUS_KM+RING_MAP_EXTENT)/cell-.5;
  const int ix=int(std::floor(x)),iy=int(std::floor(y));double norm=0;
  std::array<double,36> kernel{};int k=0;
  for(int dy=-2;dy<=3;dy++)for(int dx=-2;dx<=3;dx++){double v=std::exp(-((ix+dx-x)*(ix+dx-x)+(iy+dy-y)*(iy+dy-y))/2.);kernel[k++]=v;norm+=v;}
  k=0;double deposited=0;
  for(int dy=-2;dy<=3;dy++)for(int dx=-2;dx<=3;dx++){int u=ix+dx,v=iy+dy;double q=kernel[k++]/norm;if(u>=0&&u<RING_MAP_SIZE&&v>=0&&v<RING_MAP_SIZE){cells[v*RING_MAP_SIZE+u]+=float(weight*q);deposited+=q;}}
  map.depositedWeight+=deposited;if(deposited<.999999)++map.outside;
 }
 for(size_t i=0;i<cells.size();i++)map.pixels[i]=uint8_t(std::clamp(1.-std::exp(-double(cells[i])),0.,1.)*255+.5);
 return map;
}
}
