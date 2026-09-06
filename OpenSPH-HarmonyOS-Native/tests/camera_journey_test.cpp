#include "camera_journey.h"
#include "projection.h"
#include <cassert>
#include <cmath>
#include <iostream>
using namespace lab;
int main(){
 CameraJourney j;j.step(1,-1,false,1);assert(!j.moving());
 j.step(1,1,true,0);assert(j.tracking(1)==0&&j.detail(1)==0);
 j.step(1,1,true,.21f);float old=j.tracking(1);assert(old>.49&&old<.51);
 Camera c;c.focus=1;auto a=projectBody(c,1,{.5,0,0},1000,1000,j.totalDetail(),j.detail(1));
 j.step(1,2,true,0);assert(j.tracking(1)==old&&j.detail(1)==old);
 c.focus=2;auto b=projectBody(c,1,{.5,0,0},1000,1000,j.totalDetail(),j.detail(1));
 assert(a.x==b.x&&a.radius==b.radius&&a.opacity==b.opacity); // Retarget cannot swap the visible sphere.
 for(int n=0;n<60;++n){j.step(1,2,true,.016f);float total=0;for(int i=0;i<9;++i){assert(j.tracking(i)>=0&&j.tracking(i)<=1);total+=j.tracking(i);}assert(std::abs(total-1)<1e-5);}
 assert(!j.moving()&&j.detail(2)==1&&j.detail(1)==0);
 j.step(1,-1,false,0);assert(j.detail(2)==1);j.step(1,-1,false,1);assert(j.totalDetail()==0&&j.tracking(8)==1);
 CameraJourney x,y;x.step(1,3,true,0);y.step(1,3,true,0);for(int i=0;i<10;++i)x.step(1,3,true,.02f);y.step(1,3,true,.2f);assert(std::abs(x.detail(3)-y.detail(3))<1e-6);
 j.step(2,0,true,0);assert(j.detail(2)==0&&j.tracking(8)==1); // No old-scene target survives replacement.
 ViewportComposition comp;comp.step({.25f,.2f,.4f},.18f);auto mid=comp.current();assert(mid[0]>.25f&&mid[0]<.5f);comp.step({.5f,.5f,1},0);assert(comp.current()==mid);comp.step({.5f,.5f,1},1);assert(comp.current()[2]==1&&!comp.moving());
 std::cout<<"PASS camera journey: interrupted geometry, convex live tracking, old/new surface weights, overview, cadence, scene replacement\n";
}
