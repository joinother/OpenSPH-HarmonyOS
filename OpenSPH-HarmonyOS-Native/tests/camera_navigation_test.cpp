#include "camera_navigation.h"
#include <cassert>
#include <iostream>
using namespace lab;
void tick(CameraNavigation &n,uint64_t scene,float dt){n.step(scene,dt);n.presented(n.status().requestId);}
int main(){
 CameraNavigation n;Camera a;a.focus=1;
 auto first=n.request(1,a,true,2,true,true);assert(n.status(first).state=="queued");
 n.step(1,1);assert(n.status().state=="running");assert(n.status().progress>.49&&n.status().progress<.51);
 auto weights=n.journey();auto before=n.displayed();
 auto stopped=n.cancel(first);assert(stopped.state=="cancelled"&&stopped.reason=="user");
 tick(n,1,1);assert(n.journey().detail(1)==weights.detail(1));assert(n.displayed().zoom==before.zoom);
 // Applying visual settings cannot restart an explicitly stopped flight.
 assert(n.request(1,a,true,2,true,false)==first);assert(n.status().state=="cancelled");
 auto resumed=n.request(1,a,true,2,true,true);assert(resumed>first);assert(n.journey().detail(1)==weights.detail(1));
 tick(n,1,.25f);Camera b=a;b.focus=2;b.yaw=1.2f;b.zoom=5;
 auto displayed=n.displayed();auto middle=n.journey();auto second=n.request(1,b,true,2,true,true);
 assert(n.status(resumed).reason=="superseded");assert(n.displayed().yaw==displayed.yaw);assert(n.journey().detail(1)==middle.detail(1));
 n.cancel(first);assert(n.status().requestId==second&&n.status().state=="queued"); // stale cancellation cannot cancel newer flight
 n.step(1,2);assert(n.status().state=="running");n.presented(resumed);assert(n.status().state=="running");
 n.presented(second);assert(n.status().state=="completed");assert(n.displayed().zoom==5&&n.journey().detail(2)==1);
 // Every invalid target is rejected without changing the active request.
 for(int i=0;i<4;++i){Camera bad=b;float duration=1;if(i==0)bad.focus=8;if(i==1)bad.zoom=0;if(i==2)duration=-1;if(i==3)bad.pitch=NAN;
  bool threw=false;try{n.request(1,bad,true,duration,true,true);}catch(...){threw=true;}assert(threw&&n.status().requestId==second);}
 auto old=n.request(1,a,true,2,true,true);tick(n,2,.1f);assert(n.status(old).reason=="scene_changed");assert(n.journey().totalDetail()==0);
 auto quick=n.request(2,b,true,0,true,true);tick(n,2,0);assert(n.status(quick).state=="completed"&&n.journey().detail(2)==1);
 n.request(2,a,true,2,true,true);assert(n.journey().detail(2)==1&&n.journey().detail(1)==0);
 auto latest=n.status();tick(n,1,.5f);assert(n.status().requestId==latest.requestId&&n.status().state=="queued"&&n.status().progress==0);
 tick(n,2,1);assert(std::abs(n.journey().detail(2)-.5f)<1e-6&&std::abs(n.journey().detail(1)-.5f)<1e-6);
 auto drag=n.request(2,b,true,2,true,true);tick(n,2,.2f);n.cancel(drag);
 for(int i=0;i<100;++i){Camera pose=b;pose.yaw=i*.01f;assert(n.request(2,pose,true,.42f,false,false)==drag);tick(n,2,.01f);}
 assert(n.status(drag).state=="cancelled"&&n.status(drag).reason=="user");
 // History is bounded and unknown IDs are explicit errors.
 for(int i=0;i<40;++i){n.request(2,a,true,0,false,true);tick(n,2,0);}
 bool expired=false;try{n.status(first);}catch(...){expired=true;}assert(expired);
 CameraNavigation x,y;auto id=x.request(1,b,true,2,true,true);y.request(1,b,true,2,true,true);
 for(int i=0;i<10;++i)tick(x,1,.1f);tick(y,1,1);assert(std::abs(x.displayed().zoom-y.displayed().zoom)<1e-5);assert(std::abs(x.status(id).progress-y.status().progress)<1e-5);
 std::cout<<"PASS native camera requests: cancel freeze, explicit resume, retarget continuity, stale IDs, presented completion, invalid atomicity, scene replacement, zero duration, bounded history and cadence\n";
}
