#pragma once
#include "orbit.h"
#include <cmath>
#include <stdexcept>
#include <vector>
namespace lab {
// Restricted circular test particles; km and seconds. No mutual force or collision.
constexpr double RING_RADIUS_KM=60000, RING_INNER=1.28, RING_OUTER=2.22;
constexpr double RING_END_SECONDS=86400, RING_CLOCK_RATE=3600;
constexpr int RING_COUNT=192;
struct RingPoint { double x,y,vx,vy,radiusKm,periodSeconds; };
inline double ringPeriod(double massSolar,double radiusKm){return 2*3.141592653589793*std::sqrt(radiusKm*radiusKm*radiusKm/(SOLAR_GM*massSolar/1e9));}
inline std::vector<RingPoint> sampleRing(double massSolar,double seconds){
 if(!std::isfinite(massSolar)||massSolar<1e-8||massSolar>.01||!std::isfinite(seconds)||seconds<0||seconds>RING_END_SECONDS)throw std::invalid_argument("Invalid ring mass/time");
 std::vector<RingPoint> points;points.reserve(RING_COUNT);
 for(int lane=0;lane<12;++lane){double r=RING_RADIUS_KM*(RING_INNER+(RING_OUTER-RING_INNER)*lane/11),period=ringPeriod(massSolar,r),omega=2*3.141592653589793/period;
  for(int spoke=0;spoke<16;++spoke){double phase=spoke*2*3.141592653589793/16+omega*seconds,c=std::cos(phase),s=std::sin(phase);
   points.push_back({r*c,r*s,-r*omega*s,r*omega*c,r,period});}
 }
 return points;
}
struct RingClock {
 bool enabled=false,running=false;int target=-1;double massSolar=.0002857,seconds=0;
 void configure(bool on,bool play,int body,double mass){
  if((play&&!on)||(on&&(body<1||body>7))||!std::isfinite(mass)||mass<1e-8||mass>.01)throw std::invalid_argument("Invalid ring controls");
  if(on&&(!enabled||target!=body||massSolar!=mass))seconds=0;
  enabled=on;running=on&&play&&seconds<RING_END_SECONDS;target=body;massSolar=mass;
 }
 void seek(double t){if(!enabled||!std::isfinite(t)||t<0||t>RING_END_SECONDS)throw std::invalid_argument("Ring time outside 0–24 hours");seconds=t;running=false;}
 void advance(double dt){if(!std::isfinite(dt)||dt<0||dt>.100001)throw std::invalid_argument("Invalid ring clock delta");if(enabled&&running){seconds=std::min(RING_END_SECONDS,seconds+dt*RING_CLOCK_RATE);if(seconds>=RING_END_SECONDS)running=false;}}
};
}
