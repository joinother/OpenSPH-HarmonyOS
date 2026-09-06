#include "planet_texture.h"
#include <cmath>
#include <iostream>
#include <stdexcept>
using namespace lab;
void check(bool ok,const char *s){if(!ok)throw std::runtime_error(s);}
int main(){try {
 double sea=0,cloud=0,maxSeam=0;int n=0;
 for(int j=0;j<60;++j){double lat=(j+.5)/60*3.141592653589793-1.5707963267948966;
  auto a=planetTexel(1,-std::cos(lat),std::sin(lat),1e-9),b=planetTexel(1,-std::cos(lat),std::sin(lat),-1e-9);
  for(int k=0;k<3;++k)maxSeam=std::max(maxSeam,double(std::abs(a.color[k]-b.color[k])));
  for(int i=0;i<120;++i){double lon=i*6.283185307179586/120;auto p=planetTexel(1,std::cos(lat)*std::cos(lon),std::sin(lat),std::cos(lat)*std::sin(lon));sea+=p.ocean;cloud+=p.cloud;++n;}
 }
 check(sea/n>.2&&sea/n<.9,"ocean/land coverage");check(cloud/n>.05&&cloud/n<.7,"cloud coverage");check(maxSeam<1e-5,"longitude seam");
 for(int style=0;style<4;++style){auto a=makePlanetTexture(style,128,64),b=makePlanetTexture(style,128,64);check(a.surface==b.surface&&a.clouds==b.clouds,"non deterministic maps");check(a.surface.size()==128*64*4&&a.clouds.size()==128*64,"map bounds");}
 bool bad=false;try{makePlanetTexture(1,999999,1);}catch(const std::invalid_argument&){bad=true;}check(bad,"unbounded texture accepted");
 std::cout<<"PASS deterministic surface/cloud maps; ocean coverage="<<sea/n<<" cloud coverage="<<cloud/n<<" max longitude seam="<<maxSeam<<"; bounded texture allocation\n";
}catch(const std::exception&e){std::cerr<<"FAIL "<<e.what()<<'\n';return 1;}}
