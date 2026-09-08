#include "placement_projection.h"
#include <cassert>
#include <iostream>
using namespace lab;
int main(){
  int count=0;
  for(auto size:std::vector<std::array<int,2>>{{2210,2416},{1080,2444},{2444,1080},{800,800}})
  for(float tilt:{-70.f,0.f,40.f,90.f})for(float yaw:{-.4f,0.f,.6f})for(float pitch:{-.7f,0.f,.5f})
  for(auto comp:std::vector<std::array<float,3>>{{.5f,.5f,1},{.35f,.45f,.65f}}){
    Camera c{yaw,pitch,4,-1,0};double t=tilt*3.141592653589793/180;
    auto a=rotateView(c,1,0,0),b=rotateView(c,0,std::cos(t),std::sin(t));if(std::abs(a[0]*b[1]-a[1]*b[0])<.03)continue;
    double radius=1.4,phase=.7;auto v=rotateView(c,radius*std::cos(phase),radius*std::sin(phase)*std::cos(t),radius*std::sin(phase)*std::sin(t));
    auto point=projectBody(c,1,v,size[0],size[1],0,0);double x=comp[0]+(point.x-.5)*comp[2],y=comp[1]+(point.y-.5)*comp[2];
    auto found=placementOnPlane(c,size[0],size[1],comp,x,y,tilt);
    assert(std::abs(found[0]-radius)<.00002);assert(std::abs(found[1]-phase*180/3.141592653589793)<.001);count++;
  }
  {Camera c{0,0,.002f,1,0};auto point=projectBody(c,1,{.001f,.0005f,0},1080,2444,0,0);
   auto local=placementOnPlane(c,1080,2444,{.5f,.5f,1},point.x,point.y,0,true);
   assert(std::abs(local[0]-std::hypot(.001,.0005))<1e-8);}
  auto reject=[](auto f){bool failed=false;try{f();}catch(const std::exception&){failed=true;}assert(failed);};
  reject([]{placementOnPlane({0,0,3,-1,0},800,800,{.5f,.5f,1},.7,.4,90);});
  reject([]{placementOnPlane({},800,800,{.5f,.5f,1},NAN,.4,0);});
  reject([]{placementOnPlane({},800,800,{.5f,.5f,1},.5,.5,0);});
  reject([]{placementOnPlane({},0,800,{.5f,.5f,1},.7,.4,0);});
  reject([]{placementOnPlane({},800,800,{.5f,.5f,1},1.1,.4,0);});
  std::cout<<"PASS "<<count<<" placement projection roundtrips, inclination, aspect, composition, singular-plane and invalid-input rejection\n";
}
