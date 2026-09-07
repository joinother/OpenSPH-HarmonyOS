#pragma once
#include "sph_fragments.h"
namespace lab {
struct FragmentFollowStatus {
    bool active=false,moving=false;int seed=-1,anchor=-1,rank=0,count=0;
    uint64_t sceneRevision=0;double time=0;std::array<double,3> centerKm{};
};
// Follow the component containing one immutable particle ordinal, not a mass rank.
// The current SPH implementation preserves particle order; scene replacement clears it.
class FragmentFollower {
    int seed=-1;uint64_t requestedRevision=0,contextRevision=0;
    bool initialized=false,releasing=false;
    std::array<double,3> displayed{};
    FragmentFollowStatus state;
public:
    void select(int particle,uint64_t revision){
        if(particle<0||particle>=10000)throw std::invalid_argument("Invalid material particle");
        seed=particle;requestedRevision=revision;
    }
    void clear(){releasing=state.active||releasing;seed=-1;}
    FragmentFollowStatus status()const{return state;}
    std::array<double,3> step(uint64_t scene,uint64_t latest,const SphFragments* fragments,double time,const std::array<double,3>& base,double dt){
        // A late old frame cannot cancel a request belonging to the next scene.
        if(scene!=latest)return base;
        if(!initialized||contextRevision!=scene){initialized=true;contextRevision=scene;displayed=base;releasing=false;if(requestedRevision!=scene)seed=-1;}
        const MaterialGroup* group=nullptr;int rank=0;
        if(seed>=0&&requestedRevision==scene&&fragments&&fragments->available&&size_t(seed)<fragments->labels.size()){
            auto anchor=fragments->labels[seed];for(size_t i=0;i<fragments->groups.size();i++)if(fragments->groups[i].anchor==anchor){group=&fragments->groups[i];rank=int(i)+1;break;}
        }
        if(seed>=0&&!group)clear();
        state={};state.sceneRevision=scene;state.time=time;
        auto target=base;
        if(group){state.active=true;state.seed=seed;state.anchor=group->anchor;state.rank=rank;state.count=group->count;
            for(int k=0;k<3;k++){state.centerKm[k]=group->center[k]/1000;target[k]=group->center[k]/1e5;}}
        if(state.active||releasing){
            const double blend=-std::expm1(-std::max(0.,dt)/.12);double error=0;
            for(int k=0;k<3;k++){displayed[k]+=(target[k]-displayed[k])*blend;error=std::max(error,std::abs(target[k]-displayed[k]));}
            state.moving=error>1e-5;
            if(!state.moving){displayed=target;releasing=false;}
        }else displayed=target;
        return displayed;
    }
};
}
