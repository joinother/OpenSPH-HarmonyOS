#pragma once
#include <algorithm>
#include <array>
#include <cmath>
#include <stdexcept>
namespace lab {
constexpr double ROCK_MELT_ENERGY_JKG=3.4e6;
constexpr double ROCK_YIELD_PA=3.5e9;
struct MaterialResponse {double softening, strength;};
inline MaterialResponse rockResponse(double energyJkg,double damage){
    if(!std::isfinite(energyJkg)||!std::isfinite(damage)||damage<0||damage>1)throw std::runtime_error("Invalid rock response input");
    const double ratio=energyJkg/ROCK_MELT_ENERGY_JKG;
    const double softening=ratio<1e-5?0:std::clamp(ratio,0.,1.);
    return {softening,(1-damage)*(1-softening)};
}
// Mass-weighted thermal softening, thermally zero-yield mass, D>=0.9 mass,
// and available yield strength relative to intact cold rock. Not melt fractions.
struct SphResponse {bool available=false;std::array<double,4> values{};};
inline bool validSphResponse(const SphResponse& r){
    if(!r.available)return false;
    for(double v:r.values)if(!std::isfinite(v)||v<0||v>1)return false;
    return r.values[1]<=r.values[0]+1e-12&&r.values[3]<=1-r.values[0]+1e-12;
}
class ResponseAccumulator {
    double mass=0;SphResponse result;
public:
    void add(double energyJkg,double damage,double m){
        if(!std::isfinite(m)||m<=0)throw std::runtime_error("Invalid response mass");
        const auto r=rockResponse(energyJkg,damage);mass+=m;
        result.values[0]+=m*r.softening;result.values[1]+=m*(energyJkg>=ROCK_MELT_ENERGY_JKG);
        result.values[2]+=m*(damage>=.9-1e-12);result.values[3]+=m*r.strength;
    }
    SphResponse finish()const{
        auto r=result;if(mass==0)return r;
        if(!std::isfinite(mass))throw std::runtime_error("Response mass overflow");
        for(double& v:r.values){v/=mass;if(!std::isfinite(v))throw std::runtime_error("Response overflow");v=std::clamp(v,0.,1.);}
        r.available=true;if(!validSphResponse(r))throw std::runtime_error("Invalid response statistics");return r;
    }
};
}
