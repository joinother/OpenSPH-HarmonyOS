#include "galaxy_placement.h"
#include <iostream>
#include <stdexcept>
using namespace lab;
void check(bool v,const char* text){if(!v)throw std::runtime_error(text);}
int main(){try{
 int checked=0;
 for(auto dims:{std::array<int,2>{2210,2416},{1080,2444},{2444,1080}})for(double ratio:{.2,.6,1.})for(double offset:{0.,7.,18.,30.})for(float yaw:{0.f,.3f})for(float pitch:{0.f,.4f})for(float scale:{1.f,.7f}){
  Camera c{yaw,pitch,6,-1,0};std::array<float,3> composition{.45f,.55f,scale};auto p=projectBody(c,1,rotateView(c,6/(1+ratio),offset/10/(1+ratio),0),dims[0],dims[1],0,0);
  double x=composition[0]+(p.x-.5)*scale,y=composition[1]+(p.y-.5)*scale;
  double actual=galaxyOffsetAt(c,dims[0],dims[1],composition,x,y,ratio);check(std::abs(actual-offset)<3.e-5,"projection roundtrip");++checked;
 }
 Camera c{0,0,5.2,-1,0};check(galaxyOffsetAt(c,1080,2444,{.5,.5,1},.8,1,.6)==0,"lower clamp");check(galaxyOffsetAt(c,1080,2444,{.5,.5,1},.8,0,.6)==30,"upper clamp");
 for(auto p:{std::array<double,2>{NAN,.5},{-.1,.5},{.5,1.1}}){bool rejected=false;try{galaxyOffsetAt(c,1080,2444,{.5,.5,1},p[0],p[1],.6);}catch(...){rejected=true;}check(rejected,"invalid pointer");}
 bool rejected=false;c.pitch=1.57079632679f;try{galaxyOffsetAt(c,1080,2444,{.5,.5,1},.5,.5,.6);}catch(...){rejected=true;}check(rejected,"edge-on rejection");
 std::cout<<"PASS galaxy placement: "<<checked<<" projected point roundtrips across layouts, ratios, offsets, camera poses and compositions; endpoint clamp, invalid and edge-on rejection\n";
}catch(const std::exception& e){std::cerr<<"FAIL "<<e.what()<<"\n";return 1;}}
