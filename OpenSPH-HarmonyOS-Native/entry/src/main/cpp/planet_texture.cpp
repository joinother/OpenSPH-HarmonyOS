#include "planet_texture.h"
#include <algorithm>
#include <cmath>
#include <stdexcept>
namespace lab {
namespace {
double mix(double a,double b,double t){return a+(b-a)*t;}
double smooth(double a,double b,double x){double t=std::clamp((x-a)/(b-a),0.,1.);return t*t*(3-2*t);}
struct Field { uint32_t seed;
double hash(int x,int y,int z){uint32_t h=seed*2654435761u+uint32_t(x)*374761393u+uint32_t(y)*668265263u+uint32_t(z)*2147483647u;h=(h^(h>>13))*1274126177u;return double(h^(h>>16))/4294967295.;}
double noise(double x,double y,double z){int i=int(std::floor(x)),j=int(std::floor(y)),k=int(std::floor(z));double a=x-i,b=y-j,c=z-k;a=a*a*(3-2*a);b=b*b*(3-2*b);c=c*c*(3-2*c);
 return mix(mix(mix(hash(i,j,k),hash(i+1,j,k),a),mix(hash(i,j+1,k),hash(i+1,j+1,k),a),b),mix(mix(hash(i,j,k+1),hash(i+1,j,k+1),a),mix(hash(i,j+1,k+1),hash(i+1,j+1,k+1),a),b),c);}
double fbm(double x,double y,double z,int n){double total=0,weight=0,a=0.5;for(int i=0;i<n;++i){total+=a*noise(x,y,z);weight+=a;x=x*2.03+13.4;y=y*2.03-7.2;z=z*2.03+3.7;a*=.5;}return total/weight;}
};
std::array<float,3> color(double r,double g,double b){return {float(r),float(g),float(b)};}
}
PlanetTexel planetTexel(int style,double x,double y,double z,uint32_t seed,uint32_t cloudSeed){
 Field land{seed}, clouds{cloudSeed};
 const double terrain=land.fbm(x*2.7+9,y*2.7+3,z*2.7-4,6),detail=land.fbm(x*28,y*28,z*28,3);
 // Warp longitude with latitude-dependent winds, while keeping the field spherical.
 const double warp=.24*std::sin(y*7)+.35*clouds.fbm(x*3+30,y*3,z*3,3);
 const double wx=x*std::cos(warp)-z*std::sin(warp),wz=x*std::sin(warp)+z*std::cos(warp);
 double cloud=smooth(.49,.69,clouds.fbm(wx*9+41,y*10+15,wz*9,5));
 PlanetTexel p{{0,0,0},0,float(cloud)};
 if(style==0){double cells=land.fbm(x*55,y*55,z*55,3);p.color=color(.90+.10*cells,.35+.46*cells,.045+.24*cells);p.cloud=0;return p;}
 if(style==1){
  const double land=smooth(.505,.525,terrain),shore=smooth(.475,.515,terrain),dry=smooth(.45,.70,detail+.12*(1-std::abs(y)));
  auto ocean=color(.015+.018*shore,.07+.23*shore,.22+.23*shore);
  auto ground=color(.08+.30*dry,.20+.13*dry,.075+.12*dry);
  double mountain=smooth(.65,.76,terrain)*(.6+.4*detail);
  double ice=smooth(.86,.96,std::abs(y)+.10*(terrain-.5));
  for(int c=0;c<3;++c)p.color[c]=mix(mix(ocean[c],mix(ground[c],.65,mountain),land),.88+.10*detail,ice);
  p.ocean=float((1-land)*(1-ice));p.cloud=float(cloud*.90);return p;
 }
 if(style==2){double cracks=smooth(.46,.49,detail)*(1-smooth(.52,.56,detail));p.color=color(.47+.32*terrain-.16*cracks,.23+.25*terrain-.10*cracks,.09+.13*terrain);p.cloud=float(.64+.34*clouds.fbm(wx*9+11,y*19,wz*9,5));return p;}
 if(style==4){
  // Original latitude bands, warped gently by spherical turbulence; no external textures.
  double bands=.5+.5*std::sin(y*65+2.2*land.fbm(x*6,y*5,z*6,3));
  double fine=.5+.5*std::sin(y*190+.9*detail);
  p.color=color(.62+.23*bands+.035*fine,.47+.25*bands+.035*fine,.30+.25*bands+.025*fine);
  p.cloud=float(.08+.13*clouds.fbm(wx*12,y*45,wz*12,4));return p;
 }
 double basin=smooth(.42,.57,terrain),dust=.7+.3*detail;
 p.color=color((.32+.32*basin)*dust,(.12+.18*basin)*dust,(.065+.09*basin)*dust);
 // Deterministic circular depressions with brighter rims; synthetic geology.
 for(int i=0;i<28;++i){double cy=land.hash(i,9,2)*2-1,a=land.hash(i,2,8)*6.28318530718,r=std::sqrt(1-cy*cy);double d=std::sqrt(std::max(0.,2-2*(x*r*std::cos(a)+y*cy+z*r*std::sin(a))));double radius=.018+.12*land.hash(i,7,4);double bowl=1-smooth(radius*.65,radius,d),rim=std::exp(-std::pow((d-radius)/(radius*.1),2));for(auto &c:p.color)c=float(c*(1-.35*bowl)+.13*rim);}
 double ice=smooth(.94,.985,std::abs(y)+.02*detail);for(auto &c:p.color)c=float(mix(c,.83,ice));p.cloud=float(cloud*.10);return p;
}
PlanetTexture makePlanetTexture(int style,int width,int height,uint32_t seed,uint32_t cloudSeed,const std::function<bool()> &cancel){
 if(style<0||style>4||width<8||height<4||width>2048||height>1024)throw std::invalid_argument("Invalid planet texture dimensions/style");
 PlanetTexture t{width,height,std::vector<uint8_t>(size_t(width)*height*4),std::vector<uint8_t>(size_t(width)*height)};
 for(int j=0;j<height;++j){if(cancel&&cancel())return {};double lat=((j+.5)/height-.5)*3.141592653589793;
  for(int i=0;i<width;++i){double lon=((i+.5)/width-.5)*6.283185307179586;auto p=planetTexel(style,std::cos(lat)*std::cos(lon),std::sin(lat),std::cos(lat)*std::sin(lon),seed,cloudSeed);size_t k=size_t(j)*width+i;
   for(int c=0;c<3;++c)t.surface[k*4+c]=uint8_t(std::clamp(p.color[c],0.f,1.f)*255+.5f);t.surface[k*4+3]=uint8_t(std::clamp(p.ocean,0.f,1.f)*255+.5f);t.clouds[k]=uint8_t(std::clamp(p.cloud,0.f,1.f)*255+.5f);
  }
 }
 return t;
}
const std::array<PlanetTexture,5>& planetTextures(){static const std::array<PlanetTexture,5> maps={makePlanetTexture(0),makePlanetTexture(1),makePlanetTexture(2),makePlanetTexture(3),makePlanetTexture(4)};return maps;}
}
