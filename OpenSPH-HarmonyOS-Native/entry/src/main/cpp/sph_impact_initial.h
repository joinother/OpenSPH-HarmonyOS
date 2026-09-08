#pragma once
#include "impact_plan.h"
#include "Sph.h"
#include <stdexcept>
namespace lab {
// Keep the sampled material's mass-weighted centre exactly on the incoming COM state.
// Upstream assigns mass from spherical volume and density; normalise roundoff only.
inline void placeImpactBody(Sph::Storage& storage,const LocalImpactBody& body){
    using namespace Sph;
    auto& r=storage.getValue<Vector>(QuantityId::POSITION);auto& v=storage.getDt<Vector>(QuantityId::POSITION);auto& m=storage.getValue<Float>(QuantityId::MASS);
    double total=0;Vec3 center{};for(Size i=0;i<r.size();i++){total+=m[i];for(int k=0;k<3;k++)center[k]+=m[i]*r[i][k];}
    if(!(total>0)||std::abs(total/body.massKg-1)>1e-6)throw std::runtime_error("Particle mass disagrees with incoming body");
    for(int k=0;k<3;k++)center[k]/=total;
    for(Size i=0;i<r.size();i++){m[i]*=body.massKg/total;for(int k=0;k<3;k++){r[i][k]+=body.positionM[k]-center[k];v[i][k]=body.velocityMS[k];}}
}
}
