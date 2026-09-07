#pragma once
#include "camera_journey.h"
#include "projection.h"
#include <deque>
#include <stdexcept>
#include <string>

namespace lab {
struct CameraMotion {
    uint64_t requestId=0, sceneRevision=0;
    int targetFocus=-1;
    bool targetCloseup=false;
    float progress=1;
    Camera displayed;
    std::string state="idle", reason;
};

// Owned by the renderer, protected by its mutex. No solver or UI clock.
class CameraNavigation {
    CameraJourney journey_;
    Camera target_, from_, displayed_;
    CameraMotion motion_;
    std::deque<CameraMotion> history_;
    uint64_t serial_=0, revision_=0;
    bool initialized_=false, close_=false;
    float elapsed_=0, poseDuration_=0;
    bool live()const{return motion_.state=="queued"||motion_.state=="running";}
    void finish(const std::string &state,const std::string &reason) {
        if(!live())return;
        motion_.state=state;motion_.reason=reason;motion_.displayed=displayed_;
        history_.push_back(motion_);if(history_.size()>32)history_.pop_front();
    }
    void bind(uint64_t scene) {
        if(initialized_&&scene==revision_)return;
        finish("cancelled","scene_changed");
        initialized_=true;revision_=scene;
        journey_=CameraJourney{};journey_.step(scene,-1,false,1);
        target_.focus=displayed_.focus=-1;close_=false;
    }
public:
    uint64_t request(uint64_t scene,Camera target,bool close,float duration,bool animatePose,bool force) {
        if(!std::isfinite(target.yaw)||!std::isfinite(target.pitch)||!std::isfinite(target.zoom)||
           target.yaw < -100 || target.yaw > 100 || target.pitch < -1.5f || target.pitch > 1.5f ||
           target.zoom < .5f || target.zoom > 15 || target.focus < -1 || target.focus > 7 ||
           target.color < 0 || target.color > 5 || !std::isfinite(duration)||duration<0||duration>3||
           (close&&target.focus<0))throw std::invalid_argument("Invalid camera navigation target");
        if(initialized_&&scene<revision_)throw std::invalid_argument("Stale camera scene");
        bind(scene);
        bool same=target.yaw==target_.yaw&&target.pitch==target_.pitch&&target.zoom==target_.zoom&&
                  target.focus==target_.focus&&close==close_;
        target_.color=displayed_.color=target.color;
        if(same&&!force)return motion_.requestId;
        // Continuous input is a pose update, not hundreds of semantic flights.
        // Preserve the terminal request that the gesture interrupted.
        if(!force&&!animatePose&&target.focus==target_.focus&&close==close_&&motion_.sceneRevision==scene){
            if(live()){finish("cancelled","user");journey_.cancel();}
            target_=displayed_=target;return motion_.requestId;
        }
        finish("cancelled","superseded");
        from_=displayed_;target_=target;close_=close;elapsed_=0;poseDuration_=animatePose?duration:0;
        // A direct drag changes only pose; do not restart a cancelled focus blend.
        bool focusChanged=force||target.focus!=motion_.targetFocus||close!=motion_.targetCloseup||motion_.sceneRevision!=scene;
        if(focusChanged)journey_.retarget(scene,target.focus,close,duration);
        if(!animatePose)displayed_=target;
        motion_={++serial_,scene,target.focus,close,0,displayed_,"queued",""};
        return serial_;
    }
    void step(uint64_t scene,float dt) {
        // A render frame captured before an asynchronous scene replacement may arrive late.
        if(initialized_&&scene<revision_)return;
        bind(scene);
        if(!live())return;
        motion_.state="running";dt=std::isfinite(dt)?std::max(0.f,dt):0;
        elapsed_=std::min(poseDuration_,elapsed_+dt);
        float t=poseDuration_>0?elapsed_/poseDuration_:1.f;
        float k=t*t*t*(t*(t*6-15)+10);
        displayed_=target_;
        displayed_.yaw=from_.yaw+(target_.yaw-from_.yaw)*k;
        displayed_.pitch=from_.pitch+(target_.pitch-from_.pitch)*k;
        displayed_.zoom=from_.zoom+(target_.zoom-from_.zoom)*k;
        // Immediate pose requests start at their target, including on the first frame.
        if(poseDuration_==0)displayed_=target_;
        journey_.step(scene,target_.focus,close_,dt);
        motion_.progress=std::min(t,journey_.progress());motion_.displayed=displayed_;
    }
    void presented(uint64_t id) {
        if(id==motion_.requestId&&live()&&motion_.progress>=1)finish("completed","");
    }
    CameraMotion status(uint64_t id=0)const {
        if(id==0||id==motion_.requestId){auto m=motion_;m.displayed=displayed_;return m;}
        for(const auto &m:history_)if(m.requestId==id)return m;
        throw std::invalid_argument("Unknown or expired camera request (last 32 terminal results retained)");
    }
    CameraMotion cancel(uint64_t id=0) {
        if(id!=0&&id!=motion_.requestId)return status(id);
        finish("cancelled","user");journey_.cancel();
        target_.yaw=displayed_.yaw;target_.pitch=displayed_.pitch;target_.zoom=displayed_.zoom;
        return status();
    }
    Camera displayed()const{return displayed_;}
    CameraJourney journey()const{return journey_;}
    bool moving()const{return live();}
};
}
