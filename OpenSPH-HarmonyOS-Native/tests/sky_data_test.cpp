#include "sky_data.h"
#include <cassert>
#include <cmath>
#include <iostream>
using namespace lab;
int main(){auto a=makeSkyData(),b=makeSkyData();assert(a.width==1024&&a.height==512&&a.haze.size()==1024*512*3);assert(a.haze==b.haze&&a.stars.size()==6500);
 int band=0;double intensity=0;
 for(size_t i=0;i<a.stars.size();i++){const auto &s=a.stars[i],&t=b.stars[i];assert(s.x==t.x&&s.y==t.y&&s.z==t.z&&s.brightness==t.brightness);assert(std::abs(s.x*s.x+s.y*s.y+s.z*s.z-1)<1.e-5);assert(s.brightness>=.2&&s.brightness<=1);if(std::abs(-.5*s.x+.85*s.y-.17*s.z)<.2)band++;}
 assert(band>2000&&band<6000);
 for(int i=0;i<100;i++){float y=-.99f+i*.02f,r=std::sqrt(1-y*y);auto u=skyHaze(-r,y,.000001f),v=skyHaze(-r,y,-.000001f);for(int k=0;k<3;k++){assert(std::isfinite(u[k])&&u[k]>=0&&u[k]<1);assert(std::abs(u[k]-v[k])<.0001);intensity+=u[k];}}
 assert(intensity>0);std::cout<<"PASS sky: deterministic 6500 directions, unit sphere, galactic concentration, finite haze, seam continuity; band="<<band<<"\n";
}
