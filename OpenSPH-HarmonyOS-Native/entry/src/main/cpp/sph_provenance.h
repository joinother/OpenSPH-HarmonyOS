#pragma once
#include "sph_fragments.h"
namespace lab {
// Source identifies the initial rock body. Both sources use the same basalt material;
// this does not encode chemical composition, a layer, or gravitational binding.
struct ParticleOrigin {double massKg=0;uint32_t source=0;};
struct FragmentOrigins {
    std::array<double,2> totals{};
    std::vector<std::array<double,2>> groups; // aligned with mass-ranked geometric groups
};
inline FragmentOrigins measureFragmentOrigins(const SphFragments& fragments,
    const std::vector<ParticleOrigin>& particles,double totalMass){
    if(!validSphFragments(fragments,particles.size(),totalMass))throw std::runtime_error("Invalid provenance grouping");
    FragmentOrigins out;out.groups.resize(fragments.groups.size());std::map<uint32_t,size_t> ranks;
    for(size_t i=0;i<fragments.groups.size();i++)ranks[fragments.groups[i].anchor]=i;
    for(size_t i=0;i<particles.size();i++){
        const auto& p=particles[i];if(p.source>1||!std::isfinite(p.massKg)||p.massKg<=0)throw std::runtime_error("Invalid particle origin");
        out.totals[p.source]+=p.massKg;out.groups[ranks.at(fragments.labels[i])][p.source]+=p.massKg;
    }
    for(size_t i=0;i<out.groups.size();i++){
        const auto& m=out.groups[i];const double mass=m[0]+m[1];
        if(!std::isfinite(mass)||std::abs(mass/fragments.groups[i].mass-1)>1e-10)throw std::runtime_error("Fragment source mass mismatch");
    }
    if(!std::isfinite(out.totals[0]+out.totals[1])||std::abs((out.totals[0]+out.totals[1])/totalMass-1)>1e-10)throw std::runtime_error("Source mass budget mismatch");
    return out;
}
}
