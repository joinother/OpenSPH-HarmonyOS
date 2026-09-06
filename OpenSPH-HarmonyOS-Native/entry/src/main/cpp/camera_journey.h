#pragma once
#include <array>
#include <algorithm>
#include <cstdint>
namespace lab {
// Convex weights follow live body positions, so tracking keeps up with replay.
// Retarget from the displayed weights, never from the previous destination.
class CameraJourney {
    std::array<float,17> from{}, target{}, value{};
    uint64_t revision=0;
    bool initialized=false;
    int focus=-2;
    bool close=false;
    float elapsed=.42f;
public:
    void step(uint64_t scene,int body,bool near,float dt) {
        if(!initialized||scene!=revision){
            initialized=true;revision=scene;focus=-2;close=false;
            value.fill(0);value[8]=1;from=value;target=value;elapsed=.42f;
        }
        if(body!=focus||near!=close){
            focus=body;close=near;from=value;target.fill(0);
            target[body>=0&&body<8?body:8]=1;
            if(near&&body>=0&&body<8)target[9+body]=1;
            elapsed=0;
        }
        elapsed=std::min(.42f,elapsed+std::max(0.f,dt));
        float t=elapsed/.42f,k=t*t*t*(t*(t*6-15)+10);
        for(size_t i=0;i<value.size();++i)value[i]=from[i]+(target[i]-from[i])*k;
    }
    float tracking(int body)const{return value[body];}
    float detail(int body)const{return value[9+body];}
    float totalDetail()const{float v=0;for(int i=0;i<8;++i)v+=detail(i);return std::clamp(v,0.f,1.f);}
    bool moving()const{return elapsed<.42f;}
};
class ViewportComposition {
    std::array<float,3> from{.5f,.5f,1},target=from,value=from;
    float elapsed=.36f;
public:
    void step(std::array<float,3> next,float dt){
        if(next!=target){from=value;target=next;elapsed=0;}
        elapsed=std::min(.36f,elapsed+std::max(0.f,dt));
        float t=elapsed/.36f,k=t*t*(3-2*t);
        for(int i=0;i<3;++i)value[i]=from[i]+(target[i]-from[i])*k;
    }
    std::array<float,3> current()const{return value;}
    bool moving()const{return elapsed<.36f;}
};
}
