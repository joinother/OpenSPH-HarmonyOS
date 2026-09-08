#pragma once
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <stdexcept>
#include <vector>

namespace lab {
// Independent units: kpc, Myr, solar mass. No hard-sphere contacts or tracer backreaction.
constexpr double GALAXY_KPC_M = 3.0856775814913673e19;
constexpr double GALAXY_MYR_S = 31557600.0e6;
constexpr double GALAXY_SOLAR_GM = 1.32712440041279419e20;
constexpr double GALAXY_G = GALAXY_SOLAR_GM*GALAXY_MYR_S*GALAXY_MYR_S/
    (GALAXY_KPC_M*GALAXY_KPC_M*GALAXY_KPC_M);
constexpr double GALAXY_SPEED_KMS = GALAXY_KPC_M/GALAXY_MYR_S/1000;
constexpr double GALAXY_VIEW_KPC = 10;
using GalaxyVector = std::array<double,3>;
inline double galaxyLength(const GalaxyVector& v) { return std::hypot(v[0],std::hypot(v[1],v[2])); }
struct GalaxyPoint { GalaxyVector position{},velocity{}; int origin=0; };
struct GalaxyCore { GalaxyVector position{},velocity{}; double mass=1.e11,scale=5; };
struct GalaxyParameters { int count=1600,seed=1234;double speed=1,inclination=25,massRatio=.6,offset=12;bool retrograde=false; };
struct GalaxyDiagnostics {
    bool available=false;
    // Separation, RMS radii, fractions beyond 1.5 initial outer radii. Not bound mass fractions.
    std::array<double,5> values{};
};
inline bool validGalaxyParameters(const GalaxyParameters& p) {
    auto range=[](double v,double lo,double hi){return std::isfinite(v)&&v>=lo&&v<=hi;};
    return p.count>=200&&p.count<=2400&&p.seed>=1&&p.seed<=1000000&&
        range(p.speed,.75,1.25)&&range(p.inclination,0,70)&&range(p.massRatio,.2,1)&&range(p.offset,0,30);
}
inline bool validGalaxyDiagnostics(const GalaxyDiagnostics& d) {
    return d.available&&std::all_of(d.values.begin(),d.values.end(),[](double v){return std::isfinite(v)&&v>=0;})&&d.values[3]<=1&&d.values[4]<=1;
}
class GalaxySystem {
public:
    std::array<GalaxyCore,2> cores;
    std::vector<GalaxyPoint> points;
    double elapsed=0;
    explicit GalaxySystem(const GalaxyParameters& p,bool isolated=false):isolated_(isolated) {
        if(!validGalaxyParameters(p))throw std::invalid_argument("Invalid galaxy parameters");
        const double ratio=p.massRatio,secondaryScale=std::cbrt(ratio);
        cores[1].mass*=ratio;cores[1].scale*=secondaryScale;
        if(!isolated_){
            const GalaxyVector separation{60,p.offset,0},relativeVelocity{-.16*p.speed,0,0};
            for(int k=0;k<3;k++){
                cores[0].position[k]=-separation[k]*ratio/(1+ratio);cores[1].position[k]=separation[k]/(1+ratio);
                cores[0].velocity[k]=-relativeVelocity[k]*ratio/(1+ratio);cores[1].velocity[k]=relativeVelocity[k]/(1+ratio);
            }
        }
        uint32_t random=uint32_t(p.seed);
        auto unit=[&](){random^=random<<13;random^=random>>17;random^=random<<5;return (double(random)+.5)/4294967296.;};
        points.reserve(p.count);
        for(int i=0;i<p.count;i++){
            const int b=isolated_?0:(i<p.count/2?0:1);const auto& core=cores[b];
            // A cold circular tracer disk in its own spherical Plummer potential, truncated at 12 kpc.
            const double scale=core.scale/5,r=(.5+11.5*std::pow(unit(),.7))*scale,phi=unit()*6.283185307179586;
            const double tilt=b==0?0:p.inclination*3.141592653589793/180.;
            const double v=circularSpeed(r,core)*(b==1&&p.retrograde?-1:1);
            GalaxyPoint point;point.origin=b;
            point.position={r*std::cos(phi),r*std::sin(phi)*std::cos(tilt),r*std::sin(phi)*std::sin(tilt)};
            point.velocity={-v*std::sin(phi),v*std::cos(phi)*std::cos(tilt),v*std::cos(phi)*std::sin(tilt)};
            for(int k=0;k<3;k++){point.position[k]+=core.position[k];point.velocity[k]+=core.velocity[k];}
            points.push_back(point);
        }
    }
    static double potential(const GalaxyVector& position,const GalaxyCore& core) {
        double r2=core.scale*core.scale;for(int k=0;k<3;k++)r2+=std::pow(position[k]-core.position[k],2);
        return -GALAXY_G*core.mass/std::sqrt(r2);
    }
    static double circularSpeed(double r,const GalaxyCore& core) {
        return std::sqrt(GALAXY_G*core.mass*r*r/std::pow(r*r+core.scale*core.scale,1.5));
    }
    GalaxyVector acceleration(const GalaxyVector& position) const {
        GalaxyVector a{};
        for(int b=0;b<(isolated_?1:2);b++){
            const auto& core=cores[b];GalaxyVector d;double r2=core.scale*core.scale;
            for(int k=0;k<3;k++){d[k]=core.position[k]-position[k];r2+=d[k]*d[k];}
            const double factor=GALAXY_G*core.mass/(r2*std::sqrt(r2));for(int k=0;k<3;k++)a[k]+=factor*d[k];
        }
        return a;
    }
    void step(double dt) {
        if(!std::isfinite(dt)||dt==0||std::abs(dt)>.5)throw std::invalid_argument("Galaxy step must be nonzero and at most 0.5 Myr");
        kick(dt*.5);
        for(auto& p:points)for(int k=0;k<3;k++)p.position[k]+=p.velocity[k]*dt;
        if(!isolated_)for(auto& c:cores)for(int k=0;k<3;k++)c.position[k]+=c.velocity[k]*dt;
        kick(dt*.5);elapsed+=dt;
    }
    double coreEnergy() const {
        double e=0;for(const auto& c:cores)e+=.5*c.mass*std::pow(galaxyLength(c.velocity),2);
        double r2=coreSoftening2();for(int k=0;k<3;k++)r2+=std::pow(cores[1].position[k]-cores[0].position[k],2);
        return e-GALAXY_G*cores[0].mass*cores[1].mass/std::sqrt(r2);
    }
    GalaxyVector coreMomentum() const {GalaxyVector p{};for(const auto& c:cores)for(int k=0;k<3;k++)p[k]+=c.mass*c.velocity[k];return p;}
    GalaxyVector coreAngularMomentum() const {
        GalaxyVector l{};for(const auto& c:cores)for(int k=0;k<3;k++)l[k]+=c.mass*(c.position[(k+1)%3]*c.velocity[(k+2)%3]-c.position[(k+2)%3]*c.velocity[(k+1)%3]);return l;
    }
    GalaxyDiagnostics diagnostics() const {
        GalaxyDiagnostics d;d.available=true;GalaxyVector gap{};int counts[2]={};
        for(int k=0;k<3;k++)gap[k]=cores[1].position[k]-cores[0].position[k];d.values[0]=galaxyLength(gap);
        for(const auto& p:points){const auto& c=cores[p.origin];double r2=0;for(int k=0;k<3;k++)r2+=std::pow(p.position[k]-c.position[k],2);
            d.values[1+p.origin]+=r2;counts[p.origin]++;if(r2>std::pow(18*c.scale/5,2))d.values[3+p.origin]++;}
        for(int b=0;b<2;b++)if(counts[b]){d.values[1+b]=std::sqrt(d.values[1+b]/counts[b]);d.values[3+b]/=counts[b];}
        return d;
    }
private:
    bool isolated_;
    double coreSoftening2() const {return cores[0].scale*cores[0].scale+cores[1].scale*cores[1].scale;}
    void kick(double dt) {
        for(auto& p:points){const auto a=acceleration(p.position);for(int k=0;k<3;k++)p.velocity[k]+=a[k]*dt;}
        if(isolated_)return;
        GalaxyVector d;double r2=coreSoftening2();for(int k=0;k<3;k++){d[k]=cores[1].position[k]-cores[0].position[k];r2+=d[k]*d[k];}
        // Shared symmetric pair potential conserves core momentum. This is a model, not an extended-density convolution.
        const double factor=GALAXY_G*dt/(r2*std::sqrt(r2));
        for(int k=0;k<3;k++){cores[0].velocity[k]+=factor*cores[1].mass*d[k];cores[1].velocity[k]-=factor*cores[0].mass*d[k];}
    }
};
}
