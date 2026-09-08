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
struct GalaxyParameters { int count=1600,seed=1234;double speed=1,inclination=25,massRatio=.6,offset=12;bool retrograde=false;bool responsive=false; };
struct GalaxyDiagnostics {
    bool available=false;
    // Separation, RMS radii, fractions beyond 1.5 initial outer radii. Not bound mass fractions.
    std::array<double,5> values{};
};
inline bool validGalaxyParameters(const GalaxyParameters& p) {
    auto range=[](double v,double lo,double hi){return std::isfinite(v)&&v>=lo&&v<=hi;};
    return p.count>=200&&p.count<=(p.responsive?800:2400)&&p.seed>=1&&p.seed<=1000000&&
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
    // In the responsive model each point represents a massive stellar population.
    std::vector<double> masses;
    static constexpr double stellarFraction=.2,stellarSoftening=.8;
    bool responsive() const {return !masses.empty();}
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
        if(p.responsive){
            masses.resize(points.size());int counts[2]={};for(const auto& q:points)counts[q.origin]++;
            for(size_t i=0;i<points.size();i++)masses[i]=cores[points[i].origin].mass*stellarFraction/counts[points[i].origin];
            for(auto& c:cores)c.mass*=1-stellarFraction;
            // Balance the initial radial force from the own core and own stellar disk.
            // This cold finite disk is not a distribution-function equilibrium.
            for(size_t i=0;i<points.size();i++){
                auto& q=points[i];const auto& c=cores[q.origin];GalaxyVector r{};for(int k=0;k<3;k++)r[k]=q.position[k]-c.position[k];
                const double radius=galaxyLength(r);double inward=GALAXY_G*c.mass*radius/std::pow(radius*radius+c.scale*c.scale,1.5);
                for(size_t j=0;j<points.size();j++)if(i!=j&&points[j].origin==q.origin){GalaxyVector d{};double r2=stellarSoftening*stellarSoftening,dot=0;
                    for(int k=0;k<3;k++){d[k]=points[j].position[k]-q.position[k];r2+=d[k]*d[k];dot+=d[k]*r[k];}
                    inward-=GALAXY_G*masses[j]*dot/(radius*r2*std::sqrt(r2));}
                GalaxyVector tangent{};for(int k=0;k<3;k++)tangent[k]=q.velocity[k]-c.velocity[k];const double old=galaxyLength(tangent),speed=std::sqrt(std::max(0.,radius*inward));
                for(int k=0;k<3;k++)q.velocity[k]=c.velocity[k]+tangent[k]*speed/old;
            }
            // Remove finite-sampling COM and bulk drift without fixing either core.
            GalaxyVector center{},bulk{};double mass=0;
            for(int b=0;b<(isolated_?1:2);b++){mass+=cores[b].mass;for(int k=0;k<3;k++){center[k]+=cores[b].mass*cores[b].position[k];bulk[k]+=cores[b].mass*cores[b].velocity[k];}}
            for(size_t i=0;i<points.size();i++){mass+=masses[i];for(int k=0;k<3;k++){center[k]+=masses[i]*points[i].position[k];bulk[k]+=masses[i]*points[i].velocity[k];}}
            for(auto& q:points)for(int k=0;k<3;k++){q.position[k]-=center[k]/mass;q.velocity[k]-=bulk[k]/mass;}
            for(auto& c:cores)for(int k=0;k<3;k++){c.position[k]-=center[k]/mass;c.velocity[k]-=bulk[k]/mass;}
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
        if(responsive())for(size_t i=0;i<points.size();i++){
            GalaxyVector d{};double r2=stellarSoftening*stellarSoftening;
            for(int k=0;k<3;k++){d[k]=points[i].position[k]-position[k];r2+=d[k]*d[k];}
            const double factor=GALAXY_G*masses[i]/(r2*std::sqrt(r2));for(int k=0;k<3;k++)a[k]+=factor*d[k];
        }
        return a;
    }
    void step(double dt) {
        if(!std::isfinite(dt)||dt==0||std::abs(dt)>.5)throw std::invalid_argument("Galaxy step must be nonzero and at most 0.5 Myr");
        kick(dt*.5);
        for(auto& p:points)for(int k=0;k<3;k++)p.position[k]+=p.velocity[k]*dt;
        if(!isolated_||responsive())for(int b=0;b<(isolated_?1:2);b++)for(int k=0;k<3;k++)cores[b].position[k]+=cores[b].velocity[k]*dt;
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
    double energy() const {
        if(!responsive())return coreEnergy();
        double e=0;for(int b=0;b<(isolated_?1:2);b++)e+=.5*cores[b].mass*std::pow(galaxyLength(cores[b].velocity),2);
        if(!isolated_){double r2=coreSoftening2();for(int k=0;k<3;k++)r2+=std::pow(cores[1].position[k]-cores[0].position[k],2);e-=GALAXY_G*cores[0].mass*cores[1].mass/std::sqrt(r2);}
        for(size_t i=0;i<points.size();i++){
            e+=.5*masses[i]*std::pow(galaxyLength(points[i].velocity),2);
            for(int b=0;b<(isolated_?1:2);b++)e+=masses[i]*potential(points[i].position,cores[b]);
            for(size_t j=i+1;j<points.size();j++){double r2=stellarSoftening*stellarSoftening;for(int k=0;k<3;k++)r2+=std::pow(points[i].position[k]-points[j].position[k],2);e-=GALAXY_G*masses[i]*masses[j]/std::sqrt(r2);}
        }return e;
    }
    GalaxyVector angularMomentum() const {
        auto l=coreAngularMomentum();if(isolated_)for(int k=0;k<3;k++)l[k]-=cores[1].mass*(cores[1].position[(k+1)%3]*cores[1].velocity[(k+2)%3]-cores[1].position[(k+2)%3]*cores[1].velocity[(k+1)%3]);
        if(responsive())for(size_t i=0;i<points.size();i++)for(int k=0;k<3;k++)l[k]+=masses[i]*(points[i].position[(k+1)%3]*points[i].velocity[(k+2)%3]-points[i].position[(k+2)%3]*points[i].velocity[(k+1)%3]);return l;
    }
    GalaxyVector momentum() const {
        auto p=coreMomentum();if(isolated_)for(int k=0;k<3;k++)p[k]-=cores[1].mass*cores[1].velocity[k];
        if(responsive())for(size_t i=0;i<points.size();i++)for(int k=0;k<3;k++)p[k]+=masses[i]*points[i].velocity[k];return p;
    }
    double kineticTwice() const {double e=0;for(int b=0;b<(isolated_?1:2);b++)e+=cores[b].mass*std::pow(galaxyLength(cores[b].velocity),2);if(responsive())for(size_t i=0;i<points.size();i++)e+=masses[i]*std::pow(galaxyLength(points[i].velocity),2);return e;}
    double angularScale() const {double a=0;for(int b=0;b<(isolated_?1:2);b++)a+=cores[b].mass*galaxyLength(cores[b].position)*galaxyLength(cores[b].velocity);if(responsive())for(size_t i=0;i<points.size();i++)a+=masses[i]*galaxyLength(points[i].position)*galaxyLength(points[i].velocity);return std::max(1.,a);}
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
    static void pairKick(const GalaxyVector& x,const GalaxyVector& y,GalaxyVector& vx,GalaxyVector& vy,double mx,double my,double soft2,double dt){
        GalaxyVector d{};double r2=soft2;for(int k=0;k<3;k++){d[k]=y[k]-x[k];r2+=d[k]*d[k];}
        const double f=GALAXY_G*dt/(r2*std::sqrt(r2));for(int k=0;k<3;k++){vx[k]+=my*f*d[k];vy[k]-=mx*f*d[k];}
    }
    void kick(double dt) {
        if(responsive()){
            for(size_t i=0;i<points.size();i++){
                auto& q=points[i];
                for(int b=0;b<(isolated_?1:2);b++){auto& c=cores[b];pairKick(q.position,c.position,q.velocity,c.velocity,masses[i],c.mass,c.scale*c.scale,dt);}
                for(size_t j=i+1;j<points.size();j++)pairKick(q.position,points[j].position,q.velocity,points[j].velocity,masses[i],masses[j],stellarSoftening*stellarSoftening,dt);
            }
            if(!isolated_)pairKick(cores[0].position,cores[1].position,cores[0].velocity,cores[1].velocity,cores[0].mass,cores[1].mass,coreSoftening2(),dt);
            return;
        }
        for(auto& p:points){const auto a=acceleration(p.position);for(int k=0;k<3;k++)p.velocity[k]+=a[k]*dt;}
        if(isolated_)return;
        GalaxyVector d;double r2=coreSoftening2();for(int k=0;k<3;k++){d[k]=cores[1].position[k]-cores[0].position[k];r2+=d[k]*d[k];}
        // Shared symmetric pair potential conserves core momentum. This is a model, not an extended-density convolution.
        const double factor=GALAXY_G*dt/(r2*std::sqrt(r2));
        for(int k=0;k<3;k++){cores[0].velocity[k]+=factor*cores[1].mass*d[k];cores[1].velocity[k]-=factor*cores[0].mass*d[k];}
    }
};
}
