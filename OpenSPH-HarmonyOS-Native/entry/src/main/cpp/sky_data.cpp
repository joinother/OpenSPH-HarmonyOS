#include "sky_data.h"
#include <algorithm>
#include <cmath>
namespace lab {
namespace {
constexpr float pi=3.14159265358979323846f;
float hash(int x,int y,int z){uint32_t n=uint32_t(x)*73856093u^uint32_t(y)*19349663u^uint32_t(z)*83492791u;n=(n^(n>>13))*1274126177u;return float(n>>8)/16777216.f;}
float noise(float x,float y,float z){int a=int(std::floor(x)),b=int(std::floor(y)),c=int(std::floor(z));x-=a;y-=b;z-=c;x=x*x*(3-2*x);y=y*y*(3-2*y);z=z*z*(3-2*z);
 float n=0;for(int i=0;i<2;i++)for(int j=0;j<2;j++)for(int k=0;k<2;k++)n+=hash(a+i,b+j,c+k)*(i?x:1-x)*(j?y:1-y)*(k?z:1-z);return n;}
float fbm(float x,float y,float z){float sum=0,w=.55f;for(int i=0;i<5;i++){sum+=w*noise(x,y,z);x=x*2.03f+13.1f;y=y*2.03f+7.4f;z=z*2.03f-9.2f;w*=.5f;}return sum;}
float latitude(float x,float y,float z){return -.5f*x+.85f*y-.17f*z;}
}
std::array<float,3> skyHaze(float x,float y,float z){
 float lat=latitude(x,y,z),cloud=fbm(x*18,y*18,z*18),fine=fbm(x*68,y*68,z*68);
 float broad=std::exp(-lat*lat/0.027f),band=std::exp(-lat*lat/.006f);
 float core=std::exp((x*.286f-y*.095f-z*.953f-1)*9);
 float lane=lat+.035f*(cloud-.5f),dust=std::exp(-lane*lane/.0007f)*(.5f+.5f*fine);
 float glow=(broad*.3f+band*(.25f+cloud)*(.65f+fine))*(1-.82f*dust);
 return {glow*(.20f+.09f*core),glow*(.23f+.06f*core),glow*(.32f-.015f*core)};
}
SkyData makeSkyData(){SkyData d;d.haze.resize(d.width*d.height*3);
 for(int y=0;y<d.height;y++){float lat=(float(y)+.5f)/d.height*pi-pi*.5f;
  for(int x=0;x<d.width;x++){float lon=(float(x)+.5f)/d.width*2*pi-pi;auto color=skyHaze(std::cos(lat)*std::cos(lon),std::sin(lat),std::cos(lat)*std::sin(lon));
   for(int k=0;k<3;k++)d.haze[(y*d.width+x)*3+k]=uint8_t(std::clamp(color[k]*255.f,0.f,255.f));}}
 uint32_t seed=24190906;auto random=[&](){seed=1664525u*seed+1013904223u;return float(seed>>8)/16777216.f;};
 d.stars.reserve(6500);
 while(d.stars.size()<6500){float y=random()*2-1,lon=random()*2*pi,r=std::sqrt(std::max(0.f,1-y*y)),x=r*std::cos(lon),z=r*std::sin(lon),lat=latitude(x,y,z);
  if(random()>.24f+.76f*std::exp(-lat*lat/.016f))continue;
  float b=.2f+.8f*std::pow(random(),3.f),color=random();
  std::array<float,3> rgb=color<.22f?std::array<float,3>{.67f,.79f,1.f}:(color>.83f?std::array<float,3>{1.f,.81f,.60f}:std::array<float,3>{.92f,.95f,1.f});
  d.stars.push_back({x,y,z,b,rgb[0],rgb[1],rgb[2]});}
 return d;
}
}
