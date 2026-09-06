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
    auto hidden=projectBody(c,2,{0,0,0},800,1200,1);assert(hidden.opacity==0);assert(pickProjected({hidden},.5,.5,1,0)==-1);
    std::cout<<"PASS projection: portrait/landscape scale, depth, touch tolerance, invisible bodies, boundaries, closeup\n";
}
