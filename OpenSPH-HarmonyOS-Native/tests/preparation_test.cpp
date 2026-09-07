#include "preparation.h"
#include <iostream>
#include <stdexcept>
using namespace lab;
void require(bool ok,const char* message){if(!ok)throw std::runtime_error(message);}
int main(){try{
 PreparationTracker p;require(p.snapshot(99).stage=="idle","idle");
 p.begin(10,100);p.advance(10,"target",200);
 require(!p.snapshot(15199).slow&&p.snapshot(15200).slow,"stage threshold");
 auto slow=p.snapshot(15200);require(slow.elapsedMs==15100&&slow.stageMs==15000,"monotonic elapsed");
 p.advance(10,"impactor",15300);require(!p.snapshot(15300).slow,"stage resets threshold");
 require(!p.advance(9,"wrong",15400)&&p.snapshot(15400).stage=="impactor","stale stage accepted");
 p.finish(10,"ready",15500);require(p.snapshot(99999).elapsedMs==15400&&!p.snapshot(99999).slow,"ready timer must freeze");
 require(!p.advance(10,"late",100000),"late stage accepted");
 p.begin(11,200000);auto queued=p.snapshot(215000,10,"cleanup");
 require(queued.slow&&queued.previousRequestId==10&&queued.previousStage=="cleanup","blocked worker attribution");
 p.finish(10,"failed",215001);require(p.snapshot(215002).stage=="queued","old failure polluted new request");
 p.finish(11,"cancelled",215100);require(p.snapshot(999999,10,"cleanup").previousRequestId==0&&p.snapshot(999999).elapsedMs==15100,"cancel timer and blocker freeze");
 p.begin(12,300000);for(int i=0;i<50;++i)p.advance(12,std::to_string(i),300001+i);
 require(p.snapshot(301000).events.size()==16,"unbounded stage history");
 p.finish(12,"failed",302000);auto failed=p.snapshot(400000);require(failed.stage=="failed"&&failed.events[14].stage=="49"&&failed.events.size()==16&&!failed.slow,"failure context lost");
 std::cout<<"PASS preparation threshold, frozen timing, generation isolation, cancellation, blocker attribution and bounded history\n";
}catch(const std::exception& e){std::cerr<<"FAIL "<<e.what()<<'\n';return 1;}}
