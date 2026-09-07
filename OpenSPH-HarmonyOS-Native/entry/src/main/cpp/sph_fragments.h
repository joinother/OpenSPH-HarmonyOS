#pragma once
#include "sph_structure.h"
#include <algorithm>
#include <cstdint>
#include <numeric>
#include <map>
namespace lab {
// Geometric connectivity only: no material strength or gravitational binding verdict.
// Symmetric linking avoids traversal-order dependence with unequal smoothing lengths.
constexpr double fragmentLinkScale=1.5;
struct MaterialGroup {uint32_t anchor=0,count=0;double mass=0;std::array<double,3> center{},velocity{};double rmsRadius=0;};
struct SphFragments {bool available=false;std::vector<uint32_t> labels;std::vector<MaterialGroup> groups;};
inline bool validSphFragments(const SphFragments& f,size_t count,double totalMass){
    if(!f.available||count==0||f.labels.size()!=count||f.groups.empty()||f.groups.size()>count||!std::isfinite(totalMass)||totalMass<=0)return false;
    std::map<uint32_t,uint32_t> sizes;for(size_t i=0;i<count;i++){auto label=f.labels[i];if(label>=count||label>i||f.labels[label]!=label)return false;sizes[label]++;}
    if(sizes.size()!=f.groups.size())return false;double mass=0,previous=totalMass;uint32_t previousAnchor=0;
    for(size_t i=0;i<f.groups.size();i++){const auto&g=f.groups[i];const auto it=sizes.find(g.anchor);if(it==sizes.end()||g.count!=it->second||!std::isfinite(g.mass)||g.mass<=0||g.mass>previous*(1+1e-12)||(!std::isfinite(g.rmsRadius))||g.rmsRadius<0)return false;
      if(i&&g.mass==previous&&g.anchor<=previousAnchor)return false;
      for(int k=0;k<3;k++)if(!std::isfinite(g.center[k])||!std::isfinite(g.velocity[k]))return false;
      mass+=g.mass;previous=g.mass;previousAnchor=g.anchor;sizes.erase(it);
    }
    return sizes.empty()&&std::isfinite(mass)&&std::abs(mass/totalMass-1)<1e-10;
}
inline SphFragments measureSphFragments(const std::vector<StructureParticle>& p,const std::vector<double>& h,double scale=fragmentLinkScale){
    if(p.empty()||p.size()!=h.size()||!std::isfinite(scale)||scale<=0||scale>4)throw std::runtime_error("Invalid fragment input");
    const size_t n=p.size();std::vector<uint32_t> parent(n);std::iota(parent.begin(),parent.end(),0);
    auto root=[&](uint32_t i){while(parent[i]!=i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
    double total=0;
    for(size_t i=0;i<n;i++){if(!std::isfinite(p[i].mass)||p[i].mass<=0||!std::isfinite(h[i])||h[i]<=0)throw std::runtime_error("Invalid fragment mass/length");total+=p[i].mass;
      for(int k=0;k<3;k++)if(!std::isfinite(p[i].position[k])||!std::isfinite(p[i].velocity[k]))throw std::runtime_error("Invalid fragment vector");}
    for(size_t i=0;i<n;i++)for(size_t j=0;j<i;j++){
      const double link=scale*(h[i]/2+h[j]/2),d=std::hypot(p[i].position[0]-p[j].position[0],p[i].position[1]-p[j].position[1],p[i].position[2]-p[j].position[2]);
      if(!std::isfinite(link)||!std::isfinite(d))throw std::runtime_error("Fragment distance overflow");
      if(d<=link){auto a=root(i),b=root(j);if(a!=b)parent[std::max(a,b)]=std::min(a,b);}
    }
    SphFragments out;out.available=true;out.labels.resize(n);std::map<uint32_t,MaterialGroup> grouped;
    for(size_t i=0;i<n;i++){const auto a=root(i);out.labels[i]=a;auto&g=grouped[a];g.anchor=a;g.count++;g.mass+=p[i].mass;
      for(int k=0;k<3;k++){g.center[k]+=p[i].mass*p[i].position[k];g.velocity[k]+=p[i].mass*p[i].velocity[k];}}
    for(auto&entry:grouped){auto&g=entry.second;for(int k=0;k<3;k++){g.center[k]/=g.mass;g.velocity[k]/=g.mass;}}
    for(size_t i=0;i<n;i++){auto&g=grouped[out.labels[i]];double r2=0;for(int k=0;k<3;k++){const double d=p[i].position[k]-g.center[k];r2+=d*d;}g.rmsRadius+=p[i].mass/g.mass*r2;}
    for(auto&entry:grouped){auto g=entry.second;g.rmsRadius=std::sqrt(g.rmsRadius);out.groups.push_back(g);}
    std::sort(out.groups.begin(),out.groups.end(),[](const auto&a,const auto&b){return a.mass!=b.mass?a.mass>b.mass:a.anchor<b.anchor;});
    if(!validSphFragments(out,n,total))throw std::runtime_error("Invalid fragment summary");return out;
}
}
