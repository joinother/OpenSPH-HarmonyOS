#pragma once
#include <algorithm>
#include <cstdint>
#include <string>
#include <vector>

namespace lab {
struct PreparationEvent { std::string stage; double elapsedMs=0; };
struct PreparationStatus {
    uint64_t requestId=0, previousRequestId=0;
    std::string stage="idle", previousStage;
    double elapsedMs=0, stageMs=0;
    bool slow=false;
    std::vector<PreparationEvent> events;
};
// Caller holds the engine mutex. Explicit monotonic time permits deterministic
// threshold tests without injecting stalls into the shipping application.
class PreparationTracker {
    PreparationStatus value;
    double started=0, changed=0, ended=0;
    bool active=false;
public:
    void begin(uint64_t id,double now) {
        value={};value.requestId=id;value.stage="queued";
        value.events.push_back({"queued",0});started=changed=now;active=true;
    }
    bool advance(uint64_t id,const std::string& stage,double now) {
        if(!active||id!=value.requestId)return false;
        if(stage==value.stage)return true;
        value.stage=stage;changed=now;
        if(value.events.size()==16)value.events.erase(value.events.begin());
        value.events.push_back({stage,std::max(0.,now-started)});
        return true;
    }
    void finish(uint64_t id,const std::string& stage,double now) {
        if(advance(id,stage,now)){ended=now;active=false;}
    }
    PreparationStatus snapshot(double now,uint64_t worker=0,const std::string& workerStage="") const {
        auto result=value;
        if(!value.requestId)return result;
        const double time=active?now:ended;
        result.elapsedMs=std::max(0.,time-started);result.stageMs=std::max(0.,time-changed);
        result.slow=active&&result.stageMs>=15000;
        if(active&&worker&&worker!=value.requestId){result.previousRequestId=worker;result.previousStage=workerStage;}
        return result;
    }
};
}
