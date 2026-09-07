#include "projection.h"
#include <cassert>
#include <iostream>
using namespace lab;
int main(){
    Camera c{0,0,2.7f,-1,0};
    for(auto size:std::vector<std::array<int,2>>{{1200,800},{800,1200},{1,1}}){
        auto b=projectBody(c,1,{1,0,0},size[0],size[1],0);
        float expected=1/2.7f*std::min(size[0],size[1])*.5f;
        assert(std::abs((b.x-.5f)*size[0]-expected)<.001f);assert(b.y==.5f);
        assert(pickProjected({b},b.x,b.y,float(size[0])/size[1],0)==1);
    }
    auto v=rotateView({float(3.141592653589793/2),0,2.7f,-1,0},1,0,0);
    assert(std::abs(v[0])<1.e-6&&std::abs(v[2]+1)<1.e-6);
    auto far=ProjectedBody{1,.5f,.5f,.03f,-1,1},near=ProjectedBody{2,.5f,.5f,.03f,1,1};
    assert(pickProjected({near,far},.5,.5,1,0)==2);
    assert(pickProjected({far,near},.5,.5,1,0)==2);
    near.opacity=.1;assert(pickProjected({far,near},.5,.5,1,0)==1);
    near.opacity=1;near.x=.54;near.radius=.01;assert(pickProjected({near,far},.5,.5,1,.04)==1);
    assert(pickProjected({far},.54,.5,1,.015)==1);assert(pickProjected({far},.55,.5,1,.015)==-1);
    assert(pickProjected({far},.53,.5,2,0)==-1);assert(pickProjected({far},.5,.52,2,0)==1);
    assert(pickProjected({far},-1,.5,1,0)==-1);assert(pickProjected({far},NAN,.5,1,0)==-1);
    c.focus=1;auto close=projectBody(c,1,{1,1,0},800,1200,1);assert(close.x==.5f&&close.y==.5f&&close.radius>.2f);
    for(auto size:std::vector<std::array<int,2>>{{2210,2416},{1080,2444},{2444,1080}}){
      for(float blend:{0.f,.2f,.5f,1.f})for(int id:{0,2,3}){
        auto other=projectBody(c,id,{.5f,0,-1},size[0],size[1],blend,0);
        assert(other.opacity==1&&std::isfinite(other.x)&&other.radius>0);
        assert(pickProjected({other},other.x,other.y,float(size[0])/size[1],0)==id);
        assert(projectBody(c,id,{.5f,0,-1},size[0],size[1],blend).opacity==1);
      }
      auto target=projectBody(c,1,{0,0,0},size[0],size[1],1,1);
      auto background=projectBody(c,0,{0,0,-1},size[0],size[1],1,0);
      assert(pickProjected({background,target},.5,.5,float(size[0])/size[1],0)==1);
      auto behind=projectBody(c,0,{0,0,1},size[0],size[1],1,0);assert(behind.opacity==0);
      assert(pickProjected({behind},.5,.5,float(size[0])/size[1],0)==-1);
      auto far=projectBody(c,0,{.5f,0,-1},size[0],size[1],1,0),farther=projectBody(c,0,{5,0,-10},size[0],size[1],1,0);
      assert(std::abs(far.x-farther.x)<1.e-6); // Direction, not AU diagram displacement.
      // Rotating around a planet exposes its Sun on one side, conceals it behind
      // the target at conjunction, and excludes the rear camera hemisphere.
      bool exposed=false,rear=false;
      for(int k=0;k<72;k++){Camera spin=c;spin.yaw=float(k)*6.2831853f/72;auto view=rotateView(spin,-1,0,0);auto sun=projectBody(spin,0,view,size[0],size[1],1,0);
        assert(std::isfinite(sun.x)&&std::isfinite(sun.y));
        if(sun.opacity==0)rear=true;
        if(sun.opacity==1&&sun.x>0&&sun.x<1&&pickProjected({sun,target},sun.x,sun.y,float(size[0])/size[1],0)==0)exposed=true;
      }
      assert(exposed&&rear);
    }
    std::cout<<"PASS projection: portrait/landscape scale, depth, touch tolerance, invisible bodies, boundaries, closeup retains Sun/companions and depth occlusion\n";
}
