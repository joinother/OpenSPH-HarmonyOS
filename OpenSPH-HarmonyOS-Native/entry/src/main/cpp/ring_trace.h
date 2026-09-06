#pragma once
#include "orbit.h"
#include <cmath>
#include <stdexcept>
#include <vector>
namespace lab {
// Restricted bound Kepler test particles; km and seconds. No mutual force or collision.
constexpr double RING_RADIUS_KM=60000, RING_INNER=1.28, RING_OUTER=2.22;
constexpr double RING_END_SECONDS=86400, RING_CLOCK_RATE=3600;
constexpr int RING_COUNT=192;
struct RingPoint { double x,y,vx,vy,radiusKm,periodSeconds; };
inline double ringPeriod(double massSolar,double radiusKm){return 2*3.141592653589793*std::sqrt(radiusKm*radiusKm*radiusKm/(SOLAR_GM*massSolar/1e9));}
inline void validateRingSpeed(double scale){
 if(!std::isfinite(scale)||scale<1||scale>1.2)throw std::invalid_argument("Launch speed outside 1–1.2 circular speed");
}
// Tangential launch at periapsis: e=f^2-1 and a=r0/(2-f^2).
// Bounded e<=0.44 gives a monotone, well-conditioned Kepler equation.
inline RingPoint ringPoint(double massSolar,double seconds,double radius,double scale,double phase=0){
 const double mu=SOLAR_GM*massSolar/1e9,e=scale*scale-1,a=radius/(2-scale*scale);
 const double period=ringPeriod(massSolar,a),n=2*3.141592653589793/period;
 const double mean=std::remainder(n*seconds,2*3.141592653589793);
 double E=mean;
 for(int i=0;i<12;i++){double d=(E-e*std::sin(E)-mean)/(1-e*std::cos(E));E-=d;if(std::abs(d)<1e-14)break;}
 const double c=std::cos(E),s=std::sin(E),q=std::sqrt(1-e*e),edot=n/(1-e*c);
 const double x=a*(c-e),y=a*q*s,vx=-a*s*edot,vy=a*q*c*edot,C=std::cos(phase),S=std::sin(phase);
 return {x*C-y*S,x*S+y*C,vx*C-vy*S,vx*S+vy*C,radius,period};
}
inline std::vector<RingPoint> sampleRing(double massSolar,double seconds,double scale=1){
 validateRingSpeed(scale);
 if(!std::isfinite(massSolar)||massSolar<1e-8||massSolar>.01||!std::isfinite(seconds)||seconds<0||seconds>RING_END_SECONDS)throw std::invalid_argument("Invalid ring mass/time");
 std::vector<RingPoint> points;points.reserve(RING_COUNT);
 for(int lane=0;lane<12;++lane){double r=RING_RADIUS_KM*(RING_INNER+(RING_OUTER-RING_INNER)*lane/11);
  const auto p=ringPoint(massSolar,seconds,r,scale);
  for(int spoke=0;spoke<16;++spoke){double phase=spoke*2*3.141592653589793/16,c=std::cos(phase),s=std::sin(phase);
   points.push_back({p.x*c-p.y*s,p.x*s+p.y*c,p.vx*c-p.vy*s,p.vx*s+p.vy*c,r,p.periodSeconds});}
 }
 return points;
}
struct RingClock {
 bool enabled=false,running=false;int target=-1;double massSolar=.0002857,seconds=0,speedScale=1,rateHours=1;
 void configure(bool on,bool play,int body,double mass){
  if((play&&!on)||(on&&(body<1||body>7))||!std::isfinite(mass)||mass<1e-8||mass>.01)throw std::invalid_argument("Invalid ring controls");
  if(on&&(!enabled||target!=body||massSolar!=mass)){seconds=0;speedScale=1;rateHours=1;}
  enabled=on;running=on&&play&&seconds<RING_END_SECONDS;target=body;massSolar=mass;
 }
 // Validate the whole transaction before changing any field. Rate changes preserve time/play.
 void parameters(double scale,double rate){
  validateRingSpeed(scale);
  if(!enabled||!std::isfinite(rate)||rate<.1||rate>4)throw std::invalid_argument("Local clock rate outside 0.1–4 hours/second or trace disabled");
  if(scale!=speedScale){seconds=0;running=false;}
  speedScale=scale;rateHours=rate;
 }
 void seek(double t){if(!enabled||!std::isfinite(t)||t<0||t>RING_END_SECONDS)throw std::invalid_argument("Ring time outside 0–24 hours");seconds=t;running=false;}
 void advance(double dt){if(!std::isfinite(dt)||dt<0||dt>.100001)throw std::invalid_argument("Invalid ring clock delta");if(enabled&&running){seconds=std::min(RING_END_SECONDS,seconds+dt*RING_CLOCK_RATE*rateHours);if(seconds>=RING_END_SECONDS)running=false;}}
};
}
